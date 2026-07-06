import {
  addNote,
  deleteNote,
  loadNotes,
  saveNotes,
  updateNote,
} from "./notes.mjs";

const storage = window.localStorage;
const noteForm = document.querySelector("#note-form");
const noteList = document.querySelector("#note-list");
const titleInput = document.querySelector("#title");
const contentInput = document.querySelector("#content");
const statusLine = document.querySelector("#status");
const deleteButton = document.querySelector("#delete-note");
const newButton = document.querySelector("#new-note");

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

function renderNotes() {
  noteList.innerHTML = "";

  if (notes.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "Nu ai nicio notă încă. Creează una nouă.";
    noteList.appendChild(empty);
    return;
  }

  const fragment = document.createDocumentFragment();

  notes.forEach((note) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = `note-item${note.id === selectedNoteId ? " active" : ""}`;
    item.innerHTML = `
      <strong>${note.title}</strong>
      <span>${formatDate(note.updatedAt)}</span>
    `;
    item.addEventListener("click", () => selectNote(note.id));
    fragment.appendChild(item);
  });

  noteList.appendChild(fragment);
}

function updateStatus(message) {
  statusLine.textContent = message;
}

function resetForm() {
  titleInput.value = "";
  contentInput.value = "";
  selectedNoteId = null;
  deleteButton.disabled = true;
  updateStatus("Scrie o notă nouă și salveaz-o.");
}

function selectNote(noteId) {
  const note = notes.find((item) => item.id === noteId);
  if (!note) {
    return;
  }

  selectedNoteId = note.id;
  titleInput.value = note.title;
  contentInput.value = note.content;
  deleteButton.disabled = false;
  updateStatus(`Se editează: ${note.title}`);
  renderNotes();
}

function saveCurrentNote(event) {
  event.preventDefault();

  const title = titleInput.value.trim();
  const content = contentInput.value.trim();

  if (!title && !content) {
    updateStatus("Adaugă un titlu sau un conținut înainte de a salva.");
    return;
  }

  if (selectedNoteId) {
    notes = updateNote(notes, selectedNoteId, { title, content });
    updateStatus("Notița a fost actualizată.");
  } else {
    const created = addNote(notes, title, content);
    notes = created;
    selectedNoteId = notes[0].id;
    updateStatus("Notița a fost creată.");
  }

  saveNotes(notes, storage);
  renderNotes();
}

function deleteSelectedNote() {
  if (!selectedNoteId) {
    return;
  }

  notes = deleteNote(notes, selectedNoteId);
  saveNotes(notes, storage);
  resetForm();
  renderNotes();
  updateStatus("Notița a fost ștearsă.");
}

newButton.addEventListener("click", () => {
  resetForm();
  renderNotes();
});

deleteButton.addEventListener("click", deleteSelectedNote);
noteForm.addEventListener("submit", saveCurrentNote);

resetForm();
renderNotes();
