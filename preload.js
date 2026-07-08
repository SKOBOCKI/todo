const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  loadNotes: () => ipcRenderer.invoke("notes:load"),
  saveNotes: (notes) => ipcRenderer.invoke("notes:save", notes),
  loadTodoFiles: () => ipcRenderer.invoke("todos:load"),
  saveTodoFiles: (todoFiles) => ipcRenderer.invoke("todos:save", todoFiles),
});
