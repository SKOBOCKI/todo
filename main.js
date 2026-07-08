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

  const entries = await fs.promises.readdir(notesDir, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .sort((a, b) => a.name.localeCompare(b.name));

  const notes = [];
  for (const file of files) {
    const filePath = path.join(notesDir, file.name);
    const raw = await fs.promises.readFile(filePath, "utf8");
    const { title, content } = parseMarkdownNote(raw, "United");
    const stat = await fs.promises.stat(filePath);
    notes.push({
      id: path.basename(file.name, ".md"),
      title,
      content,
      updatedAt: stat.mtime.toISOString(),
    });
  }

  return notes.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

async function saveNotesToDisk(notes) {
  const { createMarkdownFilesMap } = await import("./notes.mjs");
  const notesDir = path.join(getDataDir(), "notes");
  await ensureDir(notesDir);

  const existingFiles = await fs.promises.readdir(notesDir, {
    withFileTypes: true,
  });
  const fileNames = new Set(
    existingFiles.filter((entry) => entry.isFile()).map((entry) => entry.name),
  );

  const markdownFiles = createMarkdownFilesMap(notes);
  for (const [fileName, content] of Object.entries(markdownFiles)) {
    const filePath = path.join(notesDir, fileName);
    await fs.promises.writeFile(filePath, content, "utf8");
    fileNames.delete(fileName);
  }

  for (const fileName of fileNames) {
    await fs.promises.rm(path.join(notesDir, fileName), { force: true });
  }

  return notes;
}

async function loadTodoFilesFromDisk() {
  const { parseTodoMarkdown } = await import("./notes.mjs");
  const todoDir = path.join(getDataDir(), "todo-files");
  await ensureDir(todoDir);

  const entries = await fs.promises.readdir(todoDir, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .sort((a, b) => a.name.localeCompare(b.name));

  const todoFiles = [];
  for (const file of files) {
    const filePath = path.join(todoDir, file.name);
    const raw = await fs.promises.readFile(filePath, "utf8");
    const { title, items } = parseTodoMarkdown(raw, "United");
    const stat = await fs.promises.stat(filePath);
    todoFiles.push({
      id: path.basename(file.name, ".md"),
      title,
      items,
      updatedAt: stat.mtime.toISOString(),
    });
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

  const existingFiles = await fs.promises.readdir(todoDir, {
    withFileTypes: true,
  });
  const fileNames = new Set(
    existingFiles.filter((entry) => entry.isFile()).map((entry) => entry.name),
  );

  for (const todoFile of todoFiles) {
    const safeTodoFile = {
      ...todoFile,
      id: todoFile.id || createId(),
      title: String(todoFile.title ?? "").trim() || "United",
      items: Array.isArray(todoFile.items) ? todoFile.items : [],
    };
    const filePath = path.join(todoDir, `${safeTodoFile.id}.md`);
    await fs.promises.writeFile(
      filePath,
      serializeTodoDocumentToMarkdown(safeTodoFile),
      "utf8",
    );
    fileNames.delete(`${safeTodoFile.id}.md`);
  }

  for (const fileName of fileNames) {
    await fs.promises.rm(path.join(todoDir, fileName), { force: true });
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
