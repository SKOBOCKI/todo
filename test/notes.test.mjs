import test from "node:test";
import assert from "node:assert/strict";
import {
  addNote,
  deleteNote,
  loadNotes,
  saveNotes,
  updateNote,
} from "../notes.mjs";

function createMemoryStorage() {
  const data = new Map();

  return {
    getItem(key) {
      return data.has(key) ? data.get(key) : null;
    },
    setItem(key, value) {
      data.set(key, String(value));
    },
    removeItem(key) {
      data.delete(key);
    },
  };
}

test("adds and updates notes", () => {
  const storage = createMemoryStorage();
  let notes = loadNotes(storage);

  notes = addNote(notes, "Prima notă", "Text initial");
  assert.equal(notes.length, 1);
  assert.equal(notes[0].title, "Prima notă");

  notes = updateNote(notes, notes[0].id, {
    title: "Notă actualizată",
    content: "Text nou",
  });

  assert.equal(notes[0].title, "Notă actualizată");
  assert.equal(notes[0].content, "Text nou");

  const serialized = saveNotes(notes, storage);
  assert.match(serialized, /Notă actualizată/);
});

test("deletes a note", () => {
  const storage = createMemoryStorage();
  let notes = loadNotes(storage);

  notes = addNote(notes, "Prima", "Conținut");
  notes = addNote(notes, "A doua", "Alt conținut");
  notes = deleteNote(notes, notes[0].id);

  assert.equal(notes.length, 1);
  assert.equal(notes[0].title, "Prima");
});
