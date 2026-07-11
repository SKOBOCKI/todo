const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  loadNotes: () => ipcRenderer.invoke("notes:load"),
  saveNotes: (notes) => ipcRenderer.invoke("notes:save", notes),
  loadTodoFiles: () => ipcRenderer.invoke("todos:load"),
  saveTodoFiles: (todoFiles) => ipcRenderer.invoke("todos:save", todoFiles),
  getFilePath: (type, file) => ipcRenderer.invoke("file:get-path", type, file),
  copyFilePath: (type, file) =>
    ipcRenderer.invoke("file:copy-path", type, file),
  showFileInFolder: (type, file) =>
    ipcRenderer.invoke("file:show-in-folder", type, file),
  openInNewWindow: (view, id) =>
    ipcRenderer.invoke("window:open-solo", view, id),
});
