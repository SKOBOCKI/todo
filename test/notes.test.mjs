import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  addNote,
  addTodoItemToDocument,
  buildEditorContent,
  createMarkdownFilesMap,
  createNote,
  createTodoDocument,
  deleteNote,
  extractTitleAndContent,
  loadNotes,
  parseMarkdownNote,
  parseTodoMarkdown,
  saveNotes,
  serializeNoteToMarkdown,
  serializeTodoDocumentToMarkdown,
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

test("derives title from the first line of editor content", () => {
  const editorContent = "Titlu nou\nCorpul notei";
  const { title, content } = extractTitleAndContent(editorContent);

  assert.equal(title, "Titlu nou");
  assert.equal(content, "Corpul notei");
  assert.equal(
    buildEditorContent("Titlu nou", "Corpul notei"),
    "Titlu nou\nCorpul notei",
  );
});

test("creates todo documents and adds items", () => {
  const todoDocument = createTodoDocument("Listă de cumpărături");
  const updatedDocument = addTodoItemToDocument(todoDocument, "Pâine");

  assert.equal(updatedDocument.title, "Listă de cumpărături");
  assert.equal(updatedDocument.items.length, 1);
  assert.equal(updatedDocument.items[0].text, "Pâine");
});

test("serializes and parses note markdown", () => {
  const note = createNote("Titlu test", "Conținut test");
  const markdown = serializeNoteToMarkdown(note);
  const parsed = parseMarkdownNote(markdown);

  assert.equal(parsed.title, "Titlu test");
  assert.equal(parsed.content, "Conținut test");
  assert.match(markdown, /^# Titlu test/);
});

test("serializes and parses todo markdown", () => {
  const todoDocument = createTodoDocument("Listă nouă");
  const updatedDocument = addTodoItemToDocument(todoDocument, "Pâine");
  const markdown = serializeTodoDocumentToMarkdown(updatedDocument);
  const parsed = parseTodoMarkdown(markdown);

  assert.equal(parsed.title, "Listă nouă");
  assert.equal(parsed.items.length, 1);
  assert.equal(parsed.items[0].text, "Pâine");
  assert.match(markdown, /^# Listă nouă/);
});

test("creates markdown file payloads for note migration", () => {
  const note = createNote("Notă veche", "Conținut migrat");
  const files = createMarkdownFilesMap([note]);

  assert.equal(Object.keys(files).length, 1);
  assert.match(files[`${note.id}.md`], /^# Notă veche/);
  assert.match(files[`${note.id}.md`], /Conținut migrat/);
});
