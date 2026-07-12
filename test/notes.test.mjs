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
  normalizeTodoPriority,
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
  shouldCreateFileFromSearch,
  syncNoteTitleAndContent,
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

test("syncs the note title with the first line of editor content", () => {
  const note = createNote("Titlu vechi", "Conținut vechi");
  const synced = syncNoteTitleAndContent(note, "Titlu nou\nCorpul notei");

  assert.equal(synced.title, "Titlu nou");
  assert.equal(synced.content, "Corpul notei");
});

test("creates todo documents and adds items", () => {
  const todoDocument = createTodoDocument("Listă de cumpărături");
  const updatedDocument = addTodoItemToDocument(todoDocument, "Pâine");

  assert.equal(updatedDocument.title, "Listă de cumpărături");
  assert.equal(updatedDocument.items.length, 1);
  assert.equal(updatedDocument.items[0].text, "Pâine");
});

test("uses United as the default todo title", () => {
  const todoDocument = createTodoDocument();

  assert.equal(todoDocument.title, "United");
});

test("normalizes and stores todo priorities", () => {
  const todoDocument = createTodoDocument("Listă");
  const highPriority = addTodoItemToDocument(todoDocument, "Urgent", "high");
  const fallbackPriority = addTodoItemToDocument(
    highPriority,
    "Mai târziu",
    "unknown",
  );

  assert.equal(normalizeTodoPriority("HIGH"), "high");
  assert.equal(normalizeTodoPriority("unexpected"), null);
  assert.equal(highPriority.items[0].priority, "high");
  assert.equal(fallbackPriority.items[1].priority, undefined);
});

test("serializes and parses note markdown", () => {
  const note = createNote("Titlu test", "Conținut test");
  const markdown = serializeNoteToMarkdown(note);
  const parsed = parseMarkdownNote(markdown);

  assert.equal(parsed.title, "Titlu test");
  assert.equal(parsed.content, "Conținut test");
  assert.match(markdown, /^# Titlu test/);
});

test("round-trips todo priorities through markdown", () => {
  const todoDocument = createTodoDocument("Listă nouă");
  const updatedDocument = addTodoItemToDocument(todoDocument, "Pâine", "high");
  const markdown = serializeTodoDocumentToMarkdown(updatedDocument);
  const parsed = parseTodoMarkdown(markdown);

  assert.equal(parsed.title, "Listă nouă");
  assert.equal(parsed.items.length, 1);
  assert.equal(parsed.items[0].text, "Pâine");
  assert.equal(parsed.items[0].priority, "high");
  assert.match(markdown, /priority: high/);
});

test("round-trips todo due time through markdown", () => {
  const todoDocument = createTodoDocument("Listă nouă");
  const item = addTodoItemToDocument(todoDocument, "Pâine");
  item.items[0].dueTime = "Tomorrow";

  const markdown = serializeTodoDocumentToMarkdown(item);
  const parsed = parseTodoMarkdown(markdown);

  assert.equal(parsed.title, "Listă nouă");
  assert.equal(parsed.items.length, 1);
  assert.equal(parsed.items[0].text, "Pâine");
  assert.equal(parsed.items[0].dueTime, "Tomorrow");
  assert.match(markdown, /due: Tomorrow/);
});

test("round-trips todo tags through markdown", () => {
  const todoDocument = createTodoDocument("Listă nouă");
  const item = addTodoItemToDocument(todoDocument, "Pâine");
  item.items[0].tags = ["Work Type:Bug", "Personal:Home"];

  const markdown = serializeTodoDocumentToMarkdown(item);
  const parsed = parseTodoMarkdown(markdown);

  assert.equal(parsed.title, "Listă nouă");
  assert.equal(parsed.items.length, 1);
  assert.equal(parsed.items[0].text, "Pâine");
  assert.deepEqual(parsed.items[0].tags, ["Work Type:Bug", "Personal:Home"]);
  assert.match(markdown, /tags: Work Type:Bug\|Personal:Home/);
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

test("creates a file from search when there are no matching results", () => {
  const notes = [createNote("Existing note", "Content")];
  const todoFiles = [createTodoDocument("Existing todo")];

  assert.equal(shouldCreateFileFromSearch("New file", notes, todoFiles), true);
  assert.equal(
    shouldCreateFileFromSearch("Existing note", notes, todoFiles),
    false,
  );
  assert.equal(shouldCreateFileFromSearch("", notes, todoFiles), false);
});
