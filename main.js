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

function getDataDir() {
  return path.join(app.getPath("userData"), "local-notes");
}

async function ensureDir(dirPath) {
  await fs.promises.mkdir(dirPath, { recursive: true });
}

async function loadNotesFromDisk() {
  const { parseMarkdownNote } = await import("./notes.mjs");
  const notesDir = path.join(getDataDir(), "notes");
  await ensureDir(notesDir);

  const notes = [];
  const entries = await fs.promises.readdir(notesDir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith(".md")) {
      const filePath = path.join(notesDir, entry.name);
      const raw = await fs.promises.readFile(filePath, "utf8");
      const { title, content } = parseMarkdownNote(raw, "United");
      const stat = await fs.promises.stat(filePath);
      notes.push({
        id: path.basename(entry.name, ".md"),
        title,
        content,
        folder: null,
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
          notes.push({
            id: path.basename(subEntry.name, ".md"),
            title,
            content,
            folder: folderName,
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

  for (const note of notes) {
    const { serializeNoteToMarkdown } = await import("./notes.mjs");
    const safeNote = {
      ...note,
      id: String(note.id).trim(),
      title: String(note.title).trim() || "United",
      content: String(note.content ?? ""),
    };

    let relPath = `${safeNote.id}.md`;
    if (note.folder) {
      const targetDir = path.join(notesDir, note.folder);
      await ensureDir(targetDir);
      relPath = path.join(note.folder, `${safeNote.id}.md`);
    }

    const filePath = path.join(notesDir, relPath);
    await fs.promises.writeFile(
      filePath,
      serializeNoteToMarkdown(safeNote),
      "utf8",
    );
    fileNames.delete(relPath);
  }

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

  return notes;
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
        id: path.basename(entry.name, ".md"),
        title,
        items,
        folder: null,
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
          todoFiles.push({
            id: path.basename(subEntry.name, ".md"),
            title,
            items,
            folder: folderName,
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

  for (const todoFile of todoFiles) {
    const safeTodoFile = {
      ...todoFile,
      id: todoFile.id || createId(),
      title: String(todoFile.title ?? "").trim() || "United",
      items: Array.isArray(todoFile.items) ? todoFile.items : [],
    };

    let relPath = `${safeTodoFile.id}.md`;
    if (todoFile.folder) {
      const targetDir = path.join(todoDir, todoFile.folder);
      await ensureDir(targetDir);
      relPath = path.join(todoFile.folder, `${safeTodoFile.id}.md`);
    }

    const filePath = path.join(todoDir, relPath);
    await fs.promises.writeFile(
      filePath,
      serializeTodoDocumentToMarkdown(safeTodoFile),
      "utf8",
    );
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
      JSON.stringify(todoFiles, null, 2),
      "utf8",
    );
  } catch {
    // Ignore JSON backup failures.
  }

  return todoFiles;
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

  win.once("ready-to-show", () => {
    win.show();
    win.focus();
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
  const fileName = `${id}.md`;
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
