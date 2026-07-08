import {
  STORAGE_KEY,
  addNote,
  addTodoItemToDocument,
  buildEditorContent,
  createTodoDocument,
  deleteNote,
  extractTitleAndContent,
  loadNotes as loadLegacyNotesFromStorage,
  updateNote,
} from "./notes.mjs";

const electronAPI = window.electronAPI ?? {};
const noteList = document.querySelector("#note-list");
const statusLine = document.querySelector("#status");
const deleteButton = document.querySelector("#delete-note");
const newButton = document.querySelector("#new-note");
const panelNewButton = document.querySelector("#panel-new-note");
const renameButton = document.querySelector("#rename-note");
const filterInput = document.querySelector("#filter");
const canvas = document.querySelector("#canvas");
const welcome = document.querySelector("#welcome");
const editorView = document.querySelector("#editor-view");
const todoView = document.querySelector("#todo-view");
const notesSidebar = document.querySelector("#notes-sidebar");
const todoSidebar = document.querySelector("#todo-sidebar");
const todoList = document.querySelector("#todo-list");
const todoSidebarList = document.querySelector("#todo-sidebar-list");
const todoInput = document.querySelector("#todo-input");
const addTodoButton = document.querySelector("#add-todo");
const panelNewTodoButton = document.querySelector("#panel-new-todo");
const renameTodoFileButton = document.querySelector("#rename-todo-file");
const deleteTodoFileButton = document.querySelector("#delete-todo-file");
const todoViewTitle = document.querySelector("#todo-view-title");
const railButtons = Array.from(document.querySelectorAll(".rail-button"));
const toggleSidebarButton = document.querySelector("#toggle-sidebar");
const focusSearchButton = document.querySelector("#focus-search");
const openFileTabs = document.createElement("div");
openFileTabs.id = "open-file-tabs";
openFileTabs.className = "canvas-tabs";
const editorTabsSlot = document.querySelector("#editor-tabs-slot");
const todoTabsSlot = document.querySelector("#todo-tabs-slot");
const appShell = document.querySelector(".app-shell");

let notes = [];
let selectedNoteId = null;
let todoFiles = [];
let selectedTodoFileId = null;
let activeView = "notes";

const UI_STATE_KEY = "simple-notes-ui-state";

function readUiState() {
  if (!window?.localStorage) {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(UI_STATE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function persistUiState(patch = {}) {
  if (!window?.localStorage) {
    return;
  }

  try {
    const nextState = { ...readUiState(), ...patch };
    window.localStorage.setItem(UI_STATE_KEY, JSON.stringify(nextState));
  } catch {
    // Ignore storage errors so the app remains usable.
  }
}

function formatDate(isoString) {
  const date = new Date(isoString);
  return new Intl.DateTimeFormat("ro-RO", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function debounce(fn, ms = 250) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

function escapeHtml(s) {
  return String(s).replace(
    /[&<>\"]/g,
    (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[m],
  );
}

async function loadNotesFromDisk() {
  const loadedNotes = await electronAPI.loadNotes?.();
  return Array.isArray(loadedNotes) ? loadedNotes : [];
}

async function persistNotes(items = notes) {
  const next = Array.isArray(items) ? items : [];
  const savedNotes = await electronAPI.saveNotes?.(next);
  return Array.isArray(savedNotes) ? savedNotes : next;
}

async function loadTodoFilesFromDisk() {
  const loadedFiles = await electronAPI.loadTodoFiles?.();
  return Array.isArray(loadedFiles) ? loadedFiles : [];
}

async function persistTodoFiles(items = todoFiles) {
  const next = Array.isArray(items) ? items : [];
  const savedFiles = await electronAPI.saveTodoFiles?.(next);
  return Array.isArray(savedFiles) ? savedFiles : next;
}

function renderNotes(filter = "") {
  noteList.innerHTML = "";

  const list = notes.filter((n) =>
    n.title.toLowerCase().includes(filter.toLowerCase()),
  );
  if (list.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "Nu există fișiere.";
    noteList.appendChild(empty);
    return;
  }

  const fragment = document.createDocumentFragment();
  list.forEach((note) => {
    const item = document.createElement("div");
    item.className = `note-item${note.id === selectedNoteId ? " active" : ""}`;
    item.setAttribute("role", "listitem");
    item.innerHTML = `
      <div class="meta">
        <strong>${escapeHtml(note.title)}</strong>
        <span>${formatDate(note.updatedAt)}</span>
      </div>
    `;
    item.addEventListener("click", () => selectNote(note.id));
    fragment.appendChild(item);
  });

  noteList.appendChild(fragment);
}

function updateStatus(message) {
  if (statusLine) statusLine.textContent = message;
}

function renderOpenFileTabs() {
  if (!openFileTabs) return;
  openFileTabs.innerHTML = "";

  const activeNote =
    activeView === "notes"
      ? notes.find((note) => note.id === selectedNoteId)
      : null;
  const activeTodoFile =
    activeView === "todo"
      ? todoFiles.find((file) => file.id === selectedTodoFileId)
      : null;

  const tabsContainer = document.createElement("div");
  tabsContainer.className = "open-file-tabs";

  const buildTab = (title, onClick, onClose) => {
    const tab = document.createElement("button");
    tab.type = "button";
    tab.className = "file-tab active";
    tab.title = title;

    const label = document.createElement("span");
    label.textContent = title;
    label.className = "tab-label";

    const close = document.createElement("span");
    close.className = "tab-close-button";
    close.title = "Închide";
    close.textContent = "×";
    close.addEventListener("click", (event) => {
      event.stopPropagation();
      onClose();
    });

    tab.addEventListener("click", onClick);
    tab.append(label, close);
    return tab;
  };

  if (activeNote) {
    tabsContainer.appendChild(
      buildTab(
        activeNote.title,
        () => selectNote(activeNote.id),
        () => {
          resetSelection();
          showNotesView();
        },
      ),
    );
  } else if (activeTodoFile) {
    tabsContainer.appendChild(
      buildTab(activeTodoFile.title, showTodoView, () => {
        showNotesView();
      }),
    );
  } else {
    const placeholder = document.createElement("span");
    placeholder.className = "file-tab empty";
    placeholder.textContent = "Niciun fișier deschis";
    tabsContainer.appendChild(placeholder);
  }

  const addButton = document.createElement("button");
  addButton.type = "button";
  addButton.className = "tab-add-button";
  addButton.title = "Nota noua";
  addButton.innerHTML = '<span class="icon plus-icon"></span>';
  addButton.addEventListener("click", () => {
    void createNewFile();
  });

  openFileTabs.append(tabsContainer, addButton);

  const targetSlot = activeView === "todo" ? todoTabsSlot : editorTabsSlot;
  if (targetSlot && openFileTabs.parentElement !== targetSlot) {
    targetSlot.appendChild(openFileTabs);
  }
}

function renderTodoFilesSidebar() {
  if (!todoSidebarList) return;

  todoSidebarList.innerHTML = "";

  if (todoFiles.length === 0) {
    const empty = document.createElement("p");
    empty.className = "todo-sidebar-empty";
    empty.textContent = "Nu există fișiere To-do.";
    todoSidebarList.appendChild(empty);
    return;
  }

  const fragment = document.createDocumentFragment();
  todoFiles.forEach((todoFile) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = `todo-sidebar-item${todoFile.id === selectedTodoFileId ? " active" : ""}`;
    item.innerHTML = `
      <strong>${escapeHtml(todoFile.title)}</strong>
      <span>${todoFile.items?.length || 0} sarcini</span>
    `;
    item.addEventListener("click", () => selectTodoFile(todoFile.id));
    fragment.appendChild(item);
  });

  todoSidebarList.appendChild(fragment);

  if (renameTodoFileButton) {
    renameTodoFileButton.disabled = !selectedTodoFileId;
  }
  if (deleteTodoFileButton) {
    deleteTodoFileButton.disabled = !selectedTodoFileId;
  }
}

function renderTodoItems() {
  if (!todoList || !todoViewTitle) return;

  const selectedFile = todoFiles.find(
    (todoFile) => todoFile.id === selectedTodoFileId,
  );
  if (!selectedFile) {
    todoViewTitle.textContent = "Activități";
    todoList.innerHTML = "";
    return;
  }

  todoViewTitle.textContent = selectedFile.title;
  todoList.innerHTML = "";

  if (!selectedFile.items?.length) {
    const empty = document.createElement("li");
    empty.className = "todo-empty";
    empty.textContent = "Nu există sarcini în această listă.";
    todoList.appendChild(empty);
    return;
  }

  const fragment = document.createDocumentFragment();
  selectedFile.items.forEach((item) => {
    const todoItem = document.createElement("li");
    todoItem.className = `todo-item${item.completed ? " done" : ""}`;

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = Boolean(item.completed);
    checkbox.addEventListener("change", () => void toggleTodo(item.id));

    const label = document.createElement("span");
    label.className = "todo-text";
    label.textContent = item.text;

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "todo-delete";
    removeButton.textContent = "×";
    removeButton.addEventListener("click", () => void deleteTodo(item.id));

    todoItem.append(checkbox, label, removeButton);
    fragment.appendChild(todoItem);
  });

  todoList.appendChild(fragment);
}

async function addTodo() {
  const value = todoInput?.value.trim();
  if (!value || !selectedTodoFileId) return;

  todoFiles = await persistTodoFiles(
    todoFiles.map((todoFile) =>
      todoFile.id === selectedTodoFileId
        ? addTodoItemToDocument(todoFile, value)
        : todoFile,
    ),
  );
  if (todoInput) todoInput.value = "";
  renderTodoItems();
  renderTodoFilesSidebar();
}

async function toggleTodo(todoId) {
  if (!selectedTodoFileId) return;

  todoFiles = await persistTodoFiles(
    todoFiles.map((todoFile) =>
      todoFile.id !== selectedTodoFileId
        ? todoFile
        : {
            ...todoFile,
            items: todoFile.items.map((item) =>
              item.id === todoId
                ? { ...item, completed: !item.completed }
                : item,
            ),
            updatedAt: new Date().toISOString(),
          },
    ),
  );
  renderTodoItems();
  renderTodoFilesSidebar();
}

async function deleteTodo(todoId) {
  if (!selectedTodoFileId) return;

  todoFiles = await persistTodoFiles(
    todoFiles.map((todoFile) =>
      todoFile.id !== selectedTodoFileId
        ? todoFile
        : {
            ...todoFile,
            items: todoFile.items.filter((item) => item.id !== todoId),
            updatedAt: new Date().toISOString(),
          },
    ),
  );
  renderTodoItems();
  renderTodoFilesSidebar();
}

async function createNewTodoFile() {
  const todoFile = createTodoDocument("United");
  todoFiles = await persistTodoFiles([todoFile, ...todoFiles]);
  selectedTodoFileId = todoFile.id;
  renderTodoFilesSidebar();
  renderTodoItems();
  if (todoInput) {
    todoInput.value = "";
    todoInput.focus();
  }
}

function selectTodoFile(todoFileId) {
  selectedTodoFileId = todoFileId;
  renderTodoFilesSidebar();
  renderTodoItems();
  persistUiState({ selectedTodoFileId: todoFileId, activeView: "todo" });
}

async function renameTodoFile() {
  if (!selectedTodoFileId) return;

  const selectedFile = todoFiles.find(
    (todoFile) => todoFile.id === selectedTodoFileId,
  );
  if (!selectedFile) return;

  const newName = prompt("Numele nou al fișierului To-do:", selectedFile.title);
  if (!newName) return;

  todoFiles = await persistTodoFiles(
    todoFiles.map((todoFile) =>
      todoFile.id === selectedTodoFileId
        ? { ...todoFile, title: newName, updatedAt: new Date().toISOString() }
        : todoFile,
    ),
  );
  renderTodoFilesSidebar();
  renderTodoItems();
}

async function deleteTodoFile() {
  if (!selectedTodoFileId) return;
  if (!confirm("Ștergi fișierul To-do selectat?")) return;

  todoFiles = await persistTodoFiles(
    todoFiles.filter((todoFile) => todoFile.id !== selectedTodoFileId),
  );
  selectedTodoFileId = todoFiles[0]?.id ?? null;
  renderTodoFilesSidebar();
  renderTodoItems();
}

function showWelcome() {
  welcome.hidden = false;
  editorView.hidden = true;
  todoView.hidden = true;
  notesSidebar.hidden = false;
  todoSidebar.hidden = true;
}

function showEditor() {
  welcome.hidden = true;
  editorView.hidden = false;
  todoView.hidden = true;
  notesSidebar.hidden = false;
  todoSidebar.hidden = true;
}

function showTodoView() {
  activeView = "todo";
  welcome.hidden = true;
  editorView.hidden = true;
  todoView.hidden = false;
  notesSidebar.hidden = true;
  todoSidebar.hidden = false;
  renderTodoFilesSidebar();
  renderTodoItems();
  railButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.view === "todo");
  });
  renderOpenFileTabs();
  persistUiState({ activeView: "todo" });
}

function showNotesView() {
  activeView = "notes";
  railButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.view === "notes");
  });

  if (selectedNoteId) {
    showEditor();
  } else {
    showWelcome();
  }

  renderOpenFileTabs();
  persistUiState({ activeView: "notes" });
}

function resetSelection() {
  selectedNoteId = null;
  canvas.innerHTML = "";
  deleteButton.disabled = true;
  renameButton.disabled = true;
  showWelcome();
  renderOpenFileTabs();
  updateStatus("Alege o pagina sau creeaza una noua.");
  persistUiState({ selectedNoteId: null, activeView: "notes" });
}

function selectTitleText() {
  if (!canvas) return;

  const editorText = canvas.innerText.replace(/\u00A0/g, " ");
  if (!editorText) return;

  const firstLineLength = editorText.split("\n")[0]?.length || 0;
  const selection = window.getSelection();
  const textNode = canvas.firstChild;

  if (!selection || !textNode) {
    canvas.focus();
    return;
  }

  const range = document.createRange();
  range.setStart(textNode, 0);
  range.setEnd(
    textNode,
    Math.min(firstLineLength, textNode.textContent?.length || 0),
  );
  selection.removeAllRanges();
  selection.addRange(range);
  canvas.focus();
}

function focusCanvasTitle() {
  if (!canvas) return;

  requestAnimationFrame(() => {
    canvas.focus();
    selectTitleText();
  });
}

function selectNote(noteId) {
  const note = notes.find((item) => item.id === noteId);
  if (!note) return;

  selectedNoteId = note.id;
  canvas.innerText = buildEditorContent(note.title, note.content);
  deleteButton.disabled = false;
  renameButton.disabled = false;
  showEditor();
  updateStatus(`Editezi: ${note.title}`);
  renderNotes(filterInput?.value || "");
  renderOpenFileTabs();
  persistUiState({ selectedNoteId: note.id, activeView: "notes" });
}

const saveCanvasDebounced = debounce(async () => {
  if (!selectedNoteId) return;
  const editorText = canvas.innerText.replace(/\u00A0/g, " ");
  const { title, content } = extractTitleAndContent(editorText);
  notes = updateNote(notes, selectedNoteId, { title, content });
  await persistNotes(notes);
  renderNotes(filterInput?.value || "");
  updateStatus("Salvat");
}, 400);

async function createNewFile() {
  notes = addNote(notes, "United", "");
  selectedNoteId = notes[0].id;
  notes = await persistNotes(notes);
  selectNote(selectedNoteId);
  focusCanvasTitle();
}

async function renameSelected() {
  if (!selectedNoteId) return;
  const note = notes.find((n) => n.id === selectedNoteId);
  const newName = prompt("Numele nou al fișierului:", note.title);
  if (!newName) return;
  notes = updateNote(notes, selectedNoteId, {
    title: newName,
    content: note.content,
  });
  notes = await persistNotes(notes);
  selectNote(selectedNoteId);
}

async function deleteSelectedNote() {
  if (!selectedNoteId) return;
  if (!confirm("Ștergi fișierul selectat?")) return;
  notes = deleteNote(notes, selectedNoteId);
  notes = await persistNotes(notes);
  resetSelection();
  renderNotes();
}

newButton.addEventListener("click", () => {
  void createNewFile();
});
panelNewButton?.addEventListener("click", () => {
  void createNewFile();
});
deleteButton.addEventListener("click", () => {
  void deleteSelectedNote();
});
renameButton.addEventListener("click", () => {
  void renameSelected();
});
panelNewTodoButton?.addEventListener("click", () => {
  void createNewTodoFile();
});
renameTodoFileButton?.addEventListener("click", () => {
  void renameTodoFile();
});
deleteTodoFileButton?.addEventListener("click", () => {
  void deleteTodoFile();
});
addTodoButton?.addEventListener("click", () => {
  void addTodo();
});
todoInput?.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    void addTodo();
  }
});

railButtons.forEach((button) => {
  button.addEventListener("click", () => {
    if (button.dataset.view === "todo") {
      showTodoView();
      return;
    }

    showNotesView();
  });
});

filterInput?.addEventListener("input", (e) => renderNotes(e.target.value));
focusSearchButton?.addEventListener("click", () => {
  appShell?.classList.remove("sidebar-collapsed");
  filterInput?.focus();
});
toggleSidebarButton?.addEventListener("click", () => {
  appShell?.classList.toggle("sidebar-collapsed");
});

document.addEventListener("keydown", (event) => {
  if (!event.ctrlKey || event.shiftKey || event.altKey || event.metaKey) return;

  if (event.key.toLowerCase() === "n") {
    event.preventDefault();
    void createNewFile();
  }

  if (event.key.toLowerCase() === "o") {
    event.preventDefault();
    appShell?.classList.remove("sidebar-collapsed");
    filterInput?.focus();
  }
});

canvas?.addEventListener("input", () => {
  void saveCanvasDebounced();
});
canvas?.addEventListener("paste", () => {
  setTimeout(() => {
    void saveCanvasDebounced();
  }, 50);
});

async function migrateLegacyNotesIfNeeded(existingNotes) {
  if (!window?.localStorage) {
    return existingNotes;
  }

  const legacyNotes = loadLegacyNotesFromStorage(window.localStorage);
  if (!legacyNotes.length) {
    return existingNotes;
  }

  if (existingNotes.length > 0) {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore cleanup errors in the browser.
    }
    return existingNotes;
  }

  notes = legacyNotes;
  notes = await persistNotes(notes);

  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore cleanup errors in the browser.
  }

  updateStatus("S-au migrat notele vechi în fișiere .md.");
  return notes;
}

async function initApp() {
  const diskNotes = await loadNotesFromDisk();
  notes = await migrateLegacyNotesIfNeeded(diskNotes);
  todoFiles = await loadTodoFilesFromDisk();

  if (todoFiles.length === 0) {
    const defaultTodoFile = createTodoDocument("Listă 1");
    todoFiles = await persistTodoFiles([defaultTodoFile]);
  }

  const persistedState = readUiState();
  const restoredTodoFileId = todoFiles.find(
    (todoFile) => todoFile.id === persistedState.selectedTodoFileId,
  )?.id;
  const restoredNoteId = notes.find(
    (note) => note.id === persistedState.selectedNoteId,
  )?.id;

  if (persistedState.activeView === "todo" && restoredTodoFileId) {
    selectedTodoFileId = restoredTodoFileId;
    renderTodoFilesSidebar();
    renderTodoItems();
    showTodoView();
    return;
  }

  if (persistedState.activeView === "todo") {
    selectedTodoFileId = todoFiles[0]?.id ?? null;
    renderTodoFilesSidebar();
    renderTodoItems();
    showTodoView();
    return;
  }

  if (restoredNoteId) {
    selectedNoteId = restoredNoteId;
    selectNote(restoredNoteId);
    return;
  }

  selectedTodoFileId = todoFiles[0]?.id ?? null;
  resetSelection();
  renderNotes();
  renderTodoFilesSidebar();
  renderTodoItems();
  showNotesView();
}

void initApp();
