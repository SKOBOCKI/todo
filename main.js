const { app, BrowserWindow, ipcMain } = require("electron");
const fs = require("node:fs");
const path = require("node:path");

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
      const subEntries = await fs.promises.readdir(folderDir, { withFileTypes: true });
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
      existingFiles.push({ relPath: entry.name, absPath: path.join(notesDir, entry.name) });
    } else if (entry.isDirectory()) {
      const subEntries = await fs.promises.readdir(path.join(notesDir, entry.name), { withFileTypes: true });
      for (const subEntry of subEntries) {
        if (subEntry.isFile() && subEntry.name.endsWith(".md")) {
          existingFiles.push({
            relPath: path.join(entry.name, subEntry.name),
            absPath: path.join(notesDir, entry.name, subEntry.name)
          });
        }
      }
    }
  }

  const fileNames = new Set(existingFiles.map(f => f.relPath));

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
    await fs.promises.writeFile(filePath, serializeNoteToMarkdown(safeNote), "utf8");
    fileNames.delete(relPath);
  }

  for (const relPath of fileNames) {
    const fileToDelete = existingFiles.find(f => f.relPath === relPath);
    if (fileToDelete) {
      await fs.promises.rm(fileToDelete.absPath, { force: true });
    }
  }

  // Clean empty subfolders
  const updatedEntries = await fs.promises.readdir(notesDir, { withFileTypes: true });
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
      const subEntries = await fs.promises.readdir(folderDir, { withFileTypes: true });
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
      existingFiles.push({ relPath: entry.name, absPath: path.join(todoDir, entry.name) });
    } else if (entry.isDirectory()) {
      const subEntries = await fs.promises.readdir(path.join(todoDir, entry.name), { withFileTypes: true });
      for (const subEntry of subEntries) {
        if (subEntry.isFile() && subEntry.name.endsWith(".md")) {
          existingFiles.push({
            relPath: path.join(entry.name, subEntry.name),
            absPath: path.join(todoDir, entry.name, subEntry.name)
          });
        }
      }
    }
  }

  const fileNames = new Set(existingFiles.map(f => f.relPath));

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
    const fileToDelete = existingFiles.find(f => f.relPath === relPath);
    if (fileToDelete) {
      await fs.promises.rm(fileToDelete.absPath, { force: true });
    }
  }

  // Clean empty subfolders
  const updatedEntries = await fs.promises.readdir(todoDir, { withFileTypes: true });
  for (const entry of updatedEntries) {
    if (entry.isDirectory()) {
      const folderPath = path.join(todoDir, entry.name);
      const contents = await fs.promises.readdir(folderPath);
      if (contents.length === 0) {
        await fs.promises.rmdir(folderPath);
      }
    }
  }

  return todoFiles;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 900,
    height: 700,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile("index.html");
}

app.whenReady().then(() => {
  ipcMain.handle("notes:load", loadNotesFromDisk);
  ipcMain.handle("notes:save", (_event, notes) => saveNotesToDisk(notes));
  ipcMain.handle("todos:load", loadTodoFilesFromDisk);
  ipcMain.handle("todos:save", (_event, todoFiles) =>
    saveTodoFilesToDisk(todoFiles),
  );

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
