const STORAGE_KEY = "simple-notes";

function createId() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function createNote(title, content) {
  const safeTitle = String(title ?? "").trim() || "United";
  const safeContent = String(content ?? "").trim();

  return {
    id: createId(),
    title: safeTitle,
    content: safeContent,
    updatedAt: new Date().toISOString(),
  };
}

export function extractTitleAndContent(text) {
  const normalized = String(text ?? "").replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  const title = lines[0]?.trim() || "United";
  const content = lines.slice(1).join("\n").trim();

  return { title, content };
}

export function buildEditorContent(title, content) {
  const safeTitle = String(title ?? "").trim() || "United";
  const safeContent = String(content ?? "").trim();

  return safeContent ? `${safeTitle}\n${safeContent}` : safeTitle;
}

export function loadNotes(storage = null) {
  if (!storage) {
    return [];
  }

  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((item) => item && typeof item === "object")
      : [];
  } catch {
    return [];
  }
}

export function saveNotes(notes, storage = null) {
  const normalized = notes.map((note) => ({
    ...note,
    title: note.title?.trim() || "Notă nouă",
    content: note.content ?? "",
  }));

  const serialized = JSON.stringify(normalized);
  if (storage) {
    storage.setItem(STORAGE_KEY, serialized);
  }

  return serialized;
}

export function addNote(notes, title, content) {
  const note = createNote(title, content);
  return [note, ...notes];
}

export function updateNote(notes, noteId, updates) {
  return notes.map((note) => {
    if (note.id !== noteId) {
      return note;
    }

    return {
      ...note,
      ...updates,
      title: updates.title?.trim() || note.title || "United",
      content: updates.content ?? note.content ?? "",
      updatedAt: new Date().toISOString(),
    };
  });
}

export function deleteNote(notes, noteId) {
  return notes.filter((note) => note.id !== noteId);
}

export function createTodoDocument(title = "United", items = []) {
  return {
    id: createId(),
    title: String(title ?? "").trim() || "United",
    items: Array.isArray(items) ? items : [],
    updatedAt: new Date().toISOString(),
  };
}

export function addTodoItemToDocument(todoDocument, text) {
  const safeText = String(text ?? "").trim();
  if (!safeText) {
    return todoDocument;
  }

  return {
    ...todoDocument,
    items: [
      ...(todoDocument?.items ?? []).map((item) => ({ ...item })),
      { id: createId(), text: safeText, completed: false },
    ],
    updatedAt: new Date().toISOString(),
  };
}

export function serializeNoteToMarkdown(note) {
  const title = String(note?.title ?? "").trim() || "United";
  const content = String(note?.content ?? "").trim();

  return content ? `# ${title}\n\n${content}` : `# ${title}`;
}

export function createMarkdownFilesMap(notes = []) {
  const safeNotes = Array.isArray(notes) ? notes : [];

  return safeNotes.reduce((files, note) => {
    const safeNote = {
      ...note,
      id: String(note?.id ?? "").trim() || createId(),
      title: String(note?.title ?? "").trim() || "United",
      content: String(note?.content ?? ""),
    };

    files[`${safeNote.id}.md`] = serializeNoteToMarkdown(safeNote);
    return files;
  }, {});
}

export function parseMarkdownNote(markdown, fallbackTitle = "United") {
  const normalized = String(markdown ?? "").replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  const isMarkdownTitle = lines[0]?.trim().startsWith("# ");
  const title = isMarkdownTitle
    ? lines[0].replace(/^#\s*/, "").trim() || fallbackTitle
    : lines[0]?.trim() || fallbackTitle;
  const content = lines.slice(1).join("\n").trim();

  return { title, content };
}

export function serializeTodoDocumentToMarkdown(todoDocument) {
  const title = String(todoDocument?.title ?? "").trim() || "United";
  const body = (todoDocument?.items ?? [])
    .map(
      (item) =>
        `- [${item.completed ? "x" : " "}] ${String(item.text ?? "").trim()}`,
    )
    .join("\n");

  return body ? `# ${title}\n\n${body}` : `# ${title}`;
}

export function parseTodoMarkdown(markdown, fallbackTitle = "United") {
  const { title, content } = parseMarkdownNote(markdown, fallbackTitle);
  const items = content
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.match(/^- \[( |x)\]\s*(.+)$/))
    .filter(Boolean)
    .map((match) => ({
      id: createId(),
      text: String(match[2] ?? "").trim(),
      completed: match[1] === "x",
    }));

  return { title, items };
}

export { STORAGE_KEY };
