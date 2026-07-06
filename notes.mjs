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
  const safeTitle = title.trim() || "Notă nouă";
  const safeContent = content.trim();

  return {
    id: createId(),
    title: safeTitle,
    content: safeContent,
    updatedAt: new Date().toISOString(),
  };
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
      title: updates.title?.trim() || note.title || "Notă nouă",
      content: updates.content ?? note.content ?? "",
      updatedAt: new Date().toISOString(),
    };
  });
}

export function deleteNote(notes, noteId) {
  return notes.filter((note) => note.id !== noteId);
}

export { STORAGE_KEY };
