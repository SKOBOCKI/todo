const {
  app,
  BrowserWindow,
  clipboard,
  ipcMain,
  screen,
  shell,
} = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { buildWindowUrl } = require("./window-launch.js");

const dataVersions = {
  notes: 0,
  todos: 0,
};

const NOTES_MANIFEST_FILE = "notes-files.json";

function getDataDir() {
  return path.join(app.getPath("userData"), "local-notes");
}

async function ensureDir(dirPath) {
  await fs.promises.mkdir(dirPath, { recursive: true });
}

function sanitizeFileTitle(title) {
  const safeTitle = String(title ?? "")
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\.+$/g, "")
    .trim();

  return safeTitle || "United";
}

function getTitledMarkdownFileName(title) {
  const safeTitle = sanitizeFileTitle(title);
  return `${safeTitle}.md`;
}

function getIdFromMarkdownFileName(fileName) {
  const baseName = path.basename(fileName, ".md");
  const separatorIndex = baseName.lastIndexOf("--");
  if (separatorIndex === -1) return baseName;

  const id = baseName.slice(separatorIndex + 2).trim();
  return id || baseName;
}

async function readNotesManifest(notesDir) {
  try {
    const raw = await fs.promises.readFile(
      path.join(notesDir, NOTES_MANIFEST_FILE),
      "utf8",
    );
    const manifest = JSON.parse(raw);
    return manifest && typeof manifest === "object" ? manifest : {};
  } catch {
    return {};
  }
}

function getUniqueMarkdownRelPath(folderName, title, usedRelPaths) {
  const baseTitle = sanitizeFileTitle(title);
  let index = 1;

  while (true) {
    const fileName = index === 1 ? `${baseTitle}.md` : `${baseTitle} ${index}.md`;
    const relPath = folderName ? path.join(folderName, fileName) : fileName;
    if (!usedRelPaths.has(relPath)) {
      usedRelPaths.add(relPath);
      return relPath;
    }
    index += 1;
  }
}

async function loadNotesFromDisk() {
  const { parseMarkdownNote } = await import("./notes.mjs");
  const notesDir = path.join(getDataDir(), "notes");
  await ensureDir(notesDir);
  const manifest = await readNotesManifest(notesDir);

  const notes = [];
  const entries = await fs.promises.readdir(notesDir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith(".md")) {
      const filePath = path.join(notesDir, entry.name);
      const raw = await fs.promises.readFile(filePath, "utf8");
      const { title, content } = parseMarkdownNote(raw, "United");
      const stat = await fs.promises.stat(filePath);
      notes.push({
        id: manifest[entry.name]?.id || getIdFromMarkdownFileName(entry.name),
        title,
        content,
        folder: null,
        relPath: entry.name,
        updatedAt: stat.mtime.toISOString(),
      });
    } else if (entry.isDirectory()) {
      const folderName = entry.name;
      const folderDir = path.join(notesDir, folderName);
      const subEntries = await fs.promises.readdir(folderDir, {
        withFileTypes: true,
      });
      for (const subEntry of subEntries) {
        if (subEntry.isFile() && subEntry.name.endsWith(".md")) {
          const filePath = path.join(folderDir, subEntry.name);
          const raw = await fs.promises.readFile(filePath, "utf8");
          const { title, content } = parseMarkdownNote(raw, "United");
          const stat = await fs.promises.stat(filePath);
          const relPath = path.join(folderName, subEntry.name);
          notes.push({
            id: manifest[relPath]?.id || getIdFromMarkdownFileName(subEntry.name),
            title,
            content,
            folder: folderName,
            relPath,
            updatedAt: stat.mtime.toISOString(),
          });
        }
      }
    }
  }

  return notes.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

async function saveNotesToDisk(notes) {
  const notesDir = path.join(getDataDir(), "notes");
  await ensureDir(notesDir);

  const existingFiles = [];
  const entries = await fs.promises.readdir(notesDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith(".md")) {
      existingFiles.push({
        relPath: entry.name,
        absPath: path.join(notesDir, entry.name),
      });
    } else if (entry.isDirectory()) {
      const subEntries = await fs.promises.readdir(
        path.join(notesDir, entry.name),
        { withFileTypes: true },
      );
      for (const subEntry of subEntries) {
        if (subEntry.isFile() && subEntry.name.endsWith(".md")) {
          existingFiles.push({
            relPath: path.join(entry.name, subEntry.name),
            absPath: path.join(notesDir, entry.name, subEntry.name),
          });
        }
      }
    }
  }

  const fileNames = new Set(existingFiles.map((f) => f.relPath));
  const usedRelPaths = new Set();
  const manifest = {};
  const savedNotes = [];

  for (const note of notes) {
    const { serializeNoteToMarkdown } = await import("./notes.mjs");
    const safeNote = {
      ...note,
      id: String(note.id).trim(),
      title: String(note.title).trim() || "United",
      content: String(note.content ?? ""),
    };

    const folderName = note.folder ? String(note.folder) : null;
    const relPath = getUniqueMarkdownRelPath(
      folderName,
      safeNote.title,
      usedRelPaths,
    );
    if (folderName) {
      const targetDir = path.join(notesDir, folderName);
      await ensureDir(targetDir);
    }

    const filePath = path.join(notesDir, relPath);
    await fs.promises.writeFile(
      filePath,
      serializeNoteToMarkdown(safeNote),
      "utf8",
    );
    manifest[relPath] = { id: safeNote.id };
    savedNotes.push({ ...safeNote, folder: folderName, relPath });
    fileNames.delete(relPath);
  }

  await fs.promises.writeFile(
    path.join(notesDir, NOTES_MANIFEST_FILE),
    JSON.stringify(manifest, null, 2),
    "utf8",
  );

  for (const relPath of fileNames) {
    const fileToDelete = existingFiles.find((f) => f.relPath === relPath);
    if (fileToDelete) {
      await fs.promises.rm(fileToDelete.absPath, { force: true });
    }
  }

  // Clean empty subfolders
  const updatedEntries = await fs.promises.readdir(notesDir, {
    withFileTypes: true,
  });
  for (const entry of updatedEntries) {
    if (entry.isDirectory()) {
      const folderPath = path.join(notesDir, entry.name);
      const contents = await fs.promises.readdir(folderPath);
      if (contents.length === 0) {
        await fs.promises.rmdir(folderPath);
      }
    }
  }

  return savedNotes;
}

async function loadTodoFilesFromDisk() {
  const { parseTodoMarkdown } = await import("./notes.mjs");
  const todoDir = path.join(getDataDir(), "todo-files");
  await ensureDir(todoDir);

  const jsonFilePath = path.join(todoDir, "todo-files.json");
  try {
    const rawJson = await fs.promises.readFile(jsonFilePath, "utf8");
    const loadedJson = JSON.parse(rawJson);
    if (Array.isArray(loadedJson)) {
      return loadedJson.filter((file) => file && typeof file === "object");
    }
  } catch {
    // Ignore missing or invalid JSON and fall back to markdown.
  }

  const todoFiles = [];
  const entries = await fs.promises.readdir(todoDir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith(".md")) {
      const filePath = path.join(todoDir, entry.name);
      const raw = await fs.promises.readFile(filePath, "utf8");
      const { title, items } = parseTodoMarkdown(raw, "United");
      const stat = await fs.promises.stat(filePath);
      todoFiles.push({
        id: getIdFromMarkdownFileName(entry.name),
        title,
        items,
        folder: null,
        relPath: entry.name,
        updatedAt: stat.mtime.toISOString(),
      });
    } else if (entry.isDirectory()) {
      const folderName = entry.name;
      const folderDir = path.join(todoDir, folderName);
      const subEntries = await fs.promises.readdir(folderDir, {
        withFileTypes: true,
      });
      for (const subEntry of subEntries) {
        if (subEntry.isFile() && subEntry.name.endsWith(".md")) {
          const filePath = path.join(folderDir, subEntry.name);
          const raw = await fs.promises.readFile(filePath, "utf8");
          const { title, items } = parseTodoMarkdown(raw, "United");
          const stat = await fs.promises.stat(filePath);
          const relPath = path.join(folderName, subEntry.name);
          todoFiles.push({
            id: getIdFromMarkdownFileName(subEntry.name),
            title,
            items,
            folder: folderName,
            relPath,
            updatedAt: stat.mtime.toISOString(),
          });
        }
      }
    }
  }

  return todoFiles.sort(
    (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt),
  );
}

async function saveTodoFilesToDisk(todoFiles) {
  const { createId, serializeTodoDocumentToMarkdown } =
    await import("./notes.mjs");
  const todoDir = path.join(getDataDir(), "todo-files");
  await ensureDir(todoDir);

  const existingFiles = [];
  const entries = await fs.promises.readdir(todoDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith(".md")) {
      existingFiles.push({
        relPath: entry.name,
        absPath: path.join(todoDir, entry.name),
      });
    } else if (entry.isDirectory()) {
      const subEntries = await fs.promises.readdir(
        path.join(todoDir, entry.name),
        { withFileTypes: true },
      );
      for (const subEntry of subEntries) {
        if (subEntry.isFile() && subEntry.name.endsWith(".md")) {
          existingFiles.push({
            relPath: path.join(entry.name, subEntry.name),
            absPath: path.join(todoDir, entry.name, subEntry.name),
          });
        }
      }
    }
  }

  const fileNames = new Set(existingFiles.map((f) => f.relPath));
  const usedRelPaths = new Set();
  const savedTodoFiles = [];

  for (const todoFile of todoFiles) {
    const safeTodoFile = {
      ...todoFile,
      id: todoFile.id || createId(),
      title: String(todoFile.title ?? "").trim() || "United",
      items: Array.isArray(todoFile.items) ? todoFile.items : [],
    };

    const folderName = todoFile.folder ? String(todoFile.folder) : null;
    const relPath = getUniqueMarkdownRelPath(
      folderName,
      safeTodoFile.title,
      usedRelPaths,
    );
    if (folderName) {
      const targetDir = path.join(todoDir, folderName);
      await ensureDir(targetDir);
    }

    const filePath = path.join(todoDir, relPath);
    await fs.promises.writeFile(
      filePath,
      serializeTodoDocumentToMarkdown(safeTodoFile),
      "utf8",
    );
    savedTodoFiles.push({ ...safeTodoFile, folder: folderName, relPath });
    fileNames.delete(relPath);
  }

  for (const relPath of fileNames) {
    const fileToDelete = existingFiles.find((f) => f.relPath === relPath);
    if (fileToDelete) {
      await fs.promises.rm(fileToDelete.absPath, { force: true });
    }
  }

  // Clean empty subfolders
  const updatedEntries = await fs.promises.readdir(todoDir, {
    withFileTypes: true,
  });
  for (const entry of updatedEntries) {
    if (entry.isDirectory()) {
      const folderPath = path.join(todoDir, entry.name);
      const contents = await fs.promises.readdir(folderPath);
      if (contents.length === 0) {
        await fs.promises.rmdir(folderPath);
      }
    }
  }

  try {
    await fs.promises.writeFile(
      path.join(todoDir, "todo-files.json"),
      JSON.stringify(savedTodoFiles, null, 2),
      "utf8",
    );
  } catch {
    // Ignore JSON backup failures.
  }

  return savedTodoFiles;
}

const ZOOM_PERCENT_STEPS = [
  30, 50, 67, 80, 90, 100, 110, 120, 133, 150, 170, 200, 240, 300,
];

function getZoomPercent(level) {
  return Math.round(Math.pow(1.2, level) * 100);
}

function getZoomLevelForPercent(percent) {
  return Math.log(percent / 100) / Math.log(1.2);
}

function getClosestZoomStepIndex(percent) {
  return ZOOM_PERCENT_STEPS.reduce((closestIndex, stepPercent, index) => {
    const closestPercent = ZOOM_PERCENT_STEPS[closestIndex];
    return Math.abs(stepPercent - percent) < Math.abs(closestPercent - percent)
      ? index
      : closestIndex;
  }, 0);
}

function getNextZoomPercent(currentPercent, step) {
  const currentIndex = getClosestZoomStepIndex(currentPercent);
  const nextIndex = Math.min(
    ZOOM_PERCENT_STEPS.length - 1,
    Math.max(0, currentIndex + step),
  );
  return ZOOM_PERCENT_STEPS[nextIndex];
}

function getWindowZoomState(win) {
  const level = win?.webContents?.getZoomLevel?.() ?? 0;
  return {
    level,
    percent: getZoomPercent(level),
  };
}

function createZoomStateFromPercent(percent) {
  const level = getZoomLevelForPercent(percent);
  return {
    level,
    percent,
  };
}

function sendWindowZoomState(win) {
  if (!win || win.webContents.isDestroyed()) return;
  win.webContents.send("zoom:changed", getWindowZoomState(win));
}

function changeWindowZoom(win, step) {
  const currentLevel = win.webContents.getZoomLevel();
  const nextPercent = getNextZoomPercent(getZoomPercent(currentLevel), step);
  const state = createZoomStateFromPercent(nextPercent);
  win.webContents.setZoomLevel(state.level);
  win.webContents.send("zoom:changed", state);
  return state;
}

function resetWindowZoom(win) {
  const state = createZoomStateFromPercent(100);
  win.webContents.setZoomLevel(0);
  win.webContents.send("zoom:changed", state);
  return state;
}

function attachBrowserZoomControls(win) {
  win.webContents.on("zoom-changed", (event, zoomDirection) => {
    event.preventDefault();
    changeWindowZoom(win, zoomDirection === "in" ? 1 : -1);
  });
}

function createWindow(options = {}) {
  const { isSolo = false, launchView = null, launchId = null } = options;
  const display = screen.getPrimaryDisplay().workAreaSize;
  const width = isSolo
    ? Math.min(1400, Math.max(1100, Math.floor(display.width * 0.9)))
    : 900;
  const height = isSolo
    ? Math.min(960, Math.max(820, Math.floor(display.height * 0.9)))
    : 700;

  const win = new BrowserWindow({
    width,
    height,
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  attachBrowserZoomControls(win);

  win.once("ready-to-show", () => {
    win.show();
    win.focus();
  });

  win.webContents.once("did-finish-load", () => {
    sendWindowZoomState(win);
  });

  win.loadURL(buildWindowUrl({ isSolo, view: launchView, id: launchId }));
  return win;
}

function getFilePath(type, file) {
  const id = String(file?.id ?? "").trim();
  if (!id) return null;

  const baseDir = path.join(
    getDataDir(),
    type === "todo" ? "todo-files" : "notes",
  );
  if (file?.relPath) {
    return path.join(baseDir, String(file.relPath));
  }

  const fileName = getTitledMarkdownFileName(file?.title);
  return file?.folder
    ? path.join(baseDir, String(file.folder), fileName)
    : path.join(baseDir, fileName);
}

function broadcastDataChanged(sourceWebContents, type) {
  dataVersions[type] = (dataVersions[type] ?? 0) + 1;

  BrowserWindow.getAllWindows().forEach((win) => {
    if (win.webContents === sourceWebContents || win.webContents.isDestroyed()) {
      return;
    }

    win.webContents.send("data:changed", type, dataVersions[type]);
  });
}

app.whenReady().then(() => {
  ipcMain.handle("notes:load", loadNotesFromDisk);
  ipcMain.handle("notes:save", async (event, notes) => {
    const savedNotes = await saveNotesToDisk(notes);
    broadcastDataChanged(event.sender, "notes");
    return savedNotes;
  });
  ipcMain.handle("todos:load", loadTodoFilesFromDisk);
  ipcMain.handle("todos:save", async (event, todoFiles) => {
    const savedTodoFiles = await saveTodoFilesToDisk(todoFiles);
    broadcastDataChanged(event.sender, "todos");
    return savedTodoFiles;
  });
  ipcMain.handle("data:get-version", () => ({ ...dataVersions }));
  ipcMain.handle("zoom:get", (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    return getWindowZoomState(win);
  });
  ipcMain.handle("zoom:change", (event, step) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return createZoomStateFromPercent(100);
    return changeWindowZoom(win, Number(step) || 0);
  });
  ipcMain.handle("zoom:reset", (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return createZoomStateFromPercent(100);
    return resetWindowZoom(win);
  });
  ipcMain.handle("file:get-path", (_event, type, file) =>
    getFilePath(type, file),
  );
  ipcMain.handle("file:copy-path", (_event, type, file) => {
    const filePath = getFilePath(type, file);
    if (!filePath) return null;
    clipboard.writeText(filePath);
    return filePath;
  });
  ipcMain.handle("file:show-in-folder", (_event, type, file) => {
    const filePath = getFilePath(type, file);
    if (!filePath || !fs.existsSync(filePath)) return false;
    shell.showItemInFolder(filePath);
    return true;
  });
  ipcMain.handle("window:open-solo", (_event, view, id) => {
    if (!view || !id) return false;
    createWindow({ isSolo: true, launchView: view, launchId: id });
    return true;
  });
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
