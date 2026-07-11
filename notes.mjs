const STORAGE_KEY = "simple-notes";

export function createId() {
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

export function normalizeTodoPriority(priority) {
  const normalized = String(priority ?? "")
    .trim()
    .toLowerCase();

  if (
    normalized === "high" ||
    normalized === "medium" ||
    normalized === "low"
  ) {
    return normalized;
  }

  return null;
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
    title: note.title?.trim() || "New note",
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

export function shouldCreateFileFromSearch(query, notes = [], todoFiles = []) {
  const normalizedQuery = String(query ?? "")
    .trim()
    .toLowerCase();
  if (!normalizedQuery) {
    return false;
  }

  const hasNoteMatch = Array.isArray(notes)
    ? notes.some((note) =>
        String(note?.title ?? "")
          .trim()
          .toLowerCase()
          .includes(normalizedQuery),
      )
    : false;

  const hasTodoMatch = Array.isArray(todoFiles)
    ? todoFiles.some((todo) => {
        const titleMatch = String(todo?.title ?? "")
          .trim()
          .toLowerCase()
          .includes(normalizedQuery);

        const itemMatch = Array.isArray(todo?.items)
          ? todo.items.some((item) =>
              String(item?.text ?? "")
                .trim()
                .toLowerCase()
                .includes(normalizedQuery),
            )
          : false;

        return titleMatch || itemMatch;
      })
    : false;

  return !hasNoteMatch && !hasTodoMatch;
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

export function addTodoItemToDocument(todoDocument, text, priority) {
  const safeText = String(text ?? "").trim();
  if (!safeText) {
    return todoDocument;
  }

  const normalizedPriority = normalizeTodoPriority(priority);
  const newItem = {
    id: createId(),
    text: safeText,
    completed: false,
  };

  if (normalizedPriority) {
    newItem.priority = normalizedPriority;
  }

  return {
    ...todoDocument,
    items: [
      ...(todoDocument?.items ?? []).map((item) => ({ ...item })),
      newItem,
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
    .map((item) => {
      const safeText = String(item.text ?? "").trim();
      const normalizedPriority = normalizeTodoPriority(item.priority);
      const prioritySuffix = normalizedPriority
        ? ` [priority: ${normalizedPriority}]`
        : "";
      const dueSuffix = item.dueTime
        ? ` [due: ${String(item.dueTime).trim()}]`
        : "";
      const tagsSuffix =
        Array.isArray(item.tags) && item.tags.length
          ? ` [tags: ${item.tags.map((tag) => String(tag).trim()).join("|")}]`
          : "";

      return `- [${item.completed ? "x" : " "}] ${safeText}${prioritySuffix}${dueSuffix}${tagsSuffix}`;
    })
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
    .map((match) => {
      const rawText = String(match[2] ?? "").trim();
      const metadata = {
        priority: undefined,
        dueTime: undefined,
        tags: undefined,
      };

      const metaMatches = [
        ...rawText.matchAll(/\[(priority|due|tags):\s*([^\]]+?)\]/gi),
      ];
      for (const metaMatch of metaMatches) {
        const key = String(metaMatch[1] ?? "").toLowerCase();
        const value = String(metaMatch[2] ?? "").trim();

        if (key === "priority") {
          metadata.priority = normalizeTodoPriority(value);
        }

        if (key === "due") {
          metadata.dueTime = value || undefined;
        }

        if (key === "tags") {
          const tagValues = value
            .split("|")
            .map((tag) => String(tag).trim())
            .filter(Boolean);
          if (tagValues.length) {
            metadata.tags = tagValues;
          }
        }
      }

      const text = rawText
        .replace(/(?:\s*\[(?:priority|due|tags):[^\]]+\]\s*)+$/gi, "")
        .trim();

      const item = {
        id: createId(),
        text,
        completed: match[1] === "x",
      };

      if (metadata.priority) {
        item.priority = metadata.priority;
      }
      if (metadata.dueTime) {
        item.dueTime = metadata.dueTime;
      }
      if (Array.isArray(metadata.tags) && metadata.tags.length) {
        item.tags = metadata.tags;
      }

      return item;
    });

  return { title, items };
}

export { STORAGE_KEY };
