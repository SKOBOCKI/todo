import {
  addNote,
  deleteNote,
  loadNotes,
  saveNotes,
  updateNote,
} from "./notes.mjs";

const storage = window.localStorage;
const noteList = document.querySelector("#note-list");
const statusLine = document.querySelector("#status");
const deleteButton = document.querySelector("#delete-note");
const newButton = document.querySelector("#new-note");
const renameButton = document.querySelector("#rename-note");
const filterInput = document.querySelector("#filter");
const fileTitle = document.querySelector("#file-title");
const canvas = document.querySelector("#canvas");

let notes = loadNotes(storage);
let selectedNoteId = null;

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
  statusLine.textContent = message;
}

function resetSelection() {
  selectedNoteId = null;
  fileTitle.textContent = "(Nicio fișier selectat)";
  canvas.innerHTML = "";
  deleteButton.disabled = true;
  renameButton.disabled = true;
  updateStatus("Selectează un fișier sau creează unul nou.");
}

function selectNote(noteId) {
  const note = notes.find((item) => item.id === noteId);
  if (!note) return;

  selectedNoteId = note.id;
  fileTitle.textContent = note.title;
  canvas.innerText = note.content || "";
  deleteButton.disabled = false;
  renameButton.disabled = false;
  updateStatus(`Editezi: ${note.title}`);
  renderNotes(filterInput?.value || "");
}

// removed legacy form-based save/delete handlers

const saveCanvasDebounced = debounce(() => {
  if (!selectedNoteId) return;
  const content = canvas.innerText.replace(/\u00A0/g, " ");
  notes = updateNote(notes, selectedNoteId, { content });
  saveNotes(notes, storage);
  updateStatus("Salvat");
}, 400);

function createNewFile() {
  const idx = notes.length + 1;
  notes = addNote(notes, `Fișier ${idx}`, "");
  selectedNoteId = notes[0].id;
  saveNotes(notes, storage);
  selectNote(selectedNoteId);
}

function renameSelected() {
  if (!selectedNoteId) return;
  const note = notes.find((n) => n.id === selectedNoteId);
  const newName = prompt("Numele nou al fișierului:", note.title);
  if (!newName) return;
  notes = updateNote(notes, selectedNoteId, { title: newName });
  saveNotes(notes, storage);
  selectNote(selectedNoteId);
}

function deleteSelectedNote() {
  if (!selectedNoteId) return;
  if (!confirm("Ștergi fișierul selectat?")) return;
  notes = deleteNote(notes, selectedNoteId);
  saveNotes(notes, storage);
  resetSelection();
  renderNotes();
}

newButton.addEventListener("click", createNewFile);
deleteButton.addEventListener("click", deleteSelectedNote);
renameButton.addEventListener("click", renameSelected);

filterInput?.addEventListener("input", (e) => renderNotes(e.target.value));

canvas?.addEventListener("input", saveCanvasDebounced);
canvas?.addEventListener("paste", (e) => {
  setTimeout(saveCanvasDebounced, 50);
});

// init
resetSelection();
renderNotes();
