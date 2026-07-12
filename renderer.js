import {
  STORAGE_KEY,
  addNote,
  addTodoItemToDocument,
  buildEditorContent,
  createTodoDocument,
  normalizeTodoPriority,
  deleteNote,
  extractTitleAndContent,
  loadNotes as loadLegacyNotesFromStorage,
  shouldCreateFileFromSearch,
  updateNote,
} from "./notes.mjs";

const electronAPI = window.electronAPI ?? {};
const noteList = document.querySelector("#note-list");
const deleteButton = document.querySelector("#delete-note");
const newButton = document.querySelector("#new-note");
const panelNewButton = document.querySelector("#panel-new-note");
const renameButton = document.querySelector("#rename-note");
const searchDialog = document.querySelector("#search-dialog");
const globalSearchInput = document.querySelector("#global-search-input");
const closeSearchDialogButton = document.querySelector("#close-search-dialog");
const canvas = document.querySelector("#canvas");
const welcome = document.querySelector("#welcome");
const editorView = document.querySelector("#editor-view");
const todoView = document.querySelector("#todo-view");
const tagSettingsView = document.querySelector("#tag-settings-view");
const notesSidebar = document.querySelector("#notes-sidebar");
const todoSidebar = document.querySelector("#todo-sidebar");
const tagsSidebar = document.querySelector("#tags-sidebar");
const todoList = document.querySelector("#todo-list");
const todoSidebarList = document.querySelector("#todo-sidebar-list");
const tagsTodoFileList = document.querySelector("#tags-todo-file-list");
const todoInput = document.querySelector("#todo-input");
const addTodoButton = document.querySelector("#add-todo");
const panelNewTodoButton = document.querySelector("#panel-new-todo");
const renameTodoFileButton = document.querySelector("#rename-todo-file");
const deleteTodoFileButton = document.querySelector("#delete-todo-file");
const todoViewTitle = document.querySelector("#todo-view-title");
const todoWelcome = document.querySelector("#todo-welcome");
const todoShell = document.querySelector("#todo-shell");
const railButtons = Array.from(document.querySelectorAll(".rail-button"));
const rail = document.querySelector(".rail");
const toggleSidebarButton = document.querySelector("#toggle-sidebar");
const focusSearchButtons = Array.from(
  document.querySelectorAll(".focus-search"),
);
const openFileTabs = document.createElement("div");
openFileTabs.id = "open-file-tabs";
openFileTabs.className = "canvas-tabs";
const editorTabsSlot = document.querySelector("#editor-tabs-slot");
const todoTabsSlot = document.querySelector("#todo-tabs-slot");
const welcomeTabsSlot = document.querySelector("#welcome-tabs-slot");
const rightEditorColumn = document.querySelector("#right-editor-column");
const rightCanvas = document.querySelector("#canvas-right");
const rightCanvasTitle = document.querySelector("#right-canvas-title");
const closeRightPaneButton = document.querySelector("#close-right-pane");
const appShell = document.querySelector(".app-shell");
const contextMenu = document.querySelector("#file-context-menu");
const todoItemContextMenu = document.querySelector("#todo-item-context-menu");
const addTagCategoryButton = document.querySelector("#add-tag-category");
const tagCategoryList = document.querySelector("#tag-category-list");

const launchQuery = new URLSearchParams(window.location.search);
const isSoloWindow = launchQuery.get("solo") === "1";
if (isSoloWindow) {
  appShell?.classList.add("solo-window");
}

let notes = [];
let selectedNoteId = null;
let selectedRightNoteId = null;
let todoFiles = [];
let rightCanvasLastText = "";
let selectedTodoFileId = null;
let activeView = "notes";
let lastCanvasText = "";
let contextMenuTarget = null; // { type: 'note'|'todo', id: string }
let openNoteIds = [];
let openTodoFileIds = [];
let activeNoteTabIndex = 0;
let activeTodoTabIndex = 0;
let selectedTagTodoFileId = null;
const DEFAULT_NOTE_TAB_ID = "__default_note_page__";
const DRAFT_NOTE_TAB_ID = "__draft_note_page__";
let knownDataVersions = {
  notes: 0,
  todos: 0,
};
let draftNoteContent = "";

const moveNoteButton = document.querySelector("#move-note");
const moveTodoFileButton = document.querySelector("#move-todo-file");
const newFolderButton = document.querySelector("#panel-new-folder");
const newTodoFolderButton = document.querySelector("#panel-new-todo-folder");
const folderMoveDialog = document.querySelector("#folder-move-dialog");
const folderMoveForm = document.querySelector("#folder-move-form");
const moveFolderSelect = document.querySelector("#move-folder-select");
const cancelMoveBtn = document.querySelector("#cancel-move-btn");

const folderInputDialog = document.querySelector("#folder-input-dialog");
const folderInputForm = document.querySelector("#folder-input-form");
const dialogTextInput = document.querySelector("#dialog-text-input");
const inputDialogTitle = document.querySelector("#input-dialog-title");
const inputDialogLabel = document.querySelector("#input-dialog-label");
const cancelInputBtn = document.querySelector("#cancel-input-btn");

const folderDeleteDialog = document.querySelector("#folder-delete-dialog");
const deleteFolderNameDisplay = document.querySelector(
  "#delete-folder-name-display",
);
const deleteFolderAllBtn = document.querySelector("#delete-folder-all-btn");
const deleteFolderKeepBtn = document.querySelector("#delete-folder-keep-btn");
const cancelDeleteFolderBtn = document.querySelector(
  "#cancel-delete-folder-btn",
);

const priorityMenuTrigger = todoItemContextMenu?.querySelector(
  ".context-menu-priority-trigger",
);
const prioritySubmenu = todoItemContextMenu?.querySelector(".priority-submenu");
let priorityOptions = Array.from(
  todoItemContextMenu?.querySelectorAll(".priority-option") ?? [],
);
const currentPriorityLabel = document.querySelector(
  "#context-menu-current-priority",
);
const tagsMenuTrigger = todoItemContextMenu?.querySelector(
  ".context-menu-tags-trigger",
);
const tagsSubmenu = todoItemContextMenu?.querySelector(".tag-submenu");
let tagOptions = Array.from(
  todoItemContextMenu?.querySelectorAll(".tag-option") ?? [],
);
const currentTagsLabel = document.querySelector("#context-menu-current-tags");

const dueMenuTrigger = todoItemContextMenu?.querySelector(
  ".context-menu-due-trigger",
);
const dueSubmenu = todoItemContextMenu?.querySelector(".due-submenu");
let dueOptions = Array.from(
  todoItemContextMenu?.querySelectorAll(".due-option") ?? [],
);
const currentDueLabel = document.querySelector("#context-menu-current-due");

const PRIORITY_LABELS = {
  high: "High",
  medium: "Medium",
  low: "Low",
};
const DEFAULT_PRIORITY_OPTIONS = [
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];
const DEFAULT_DUE_OPTIONS = ["Today", "Tomorrow", "This Week", "Next Week", ""];
const PRIORITY_OPTIONS_KEY = "loop-priority-options";
const DUE_OPTIONS_KEY = "loop-due-options";
const TAG_SETTINGS_KEY = "loop-todo-tag-settings";
const TAG_SETTINGS_BY_FILE_KEY = "loop-todo-tag-settings-by-file";
const CONTEXT_CATEGORY_SETTINGS_KEY = "loop-context-category-settings";
const DEFAULT_TAG_COLOR = "#4f7cac";

function normalizeTagEntry(tag) {
  if (tag && typeof tag === "object") {
    return {
      name: String(tag.name ?? "")
        .trim()
        .replace(/\s+/g, " "),
      color: /^#[0-9a-f]{6}$/i.test(String(tag.color ?? ""))
        ? String(tag.color)
        : DEFAULT_TAG_COLOR,
    };
  }

  return {
    name: String(tag ?? "")
      .trim()
      .replace(/\s+/g, " "),
    color: DEFAULT_TAG_COLOR,
  };
}

function readDueOptions() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(DUE_OPTIONS_KEY));
    if (Array.isArray(parsed)) {
      return parsed.map((option) => String(option).trim()).filter(Boolean);
    }
  } catch {
    // Fall back to defaults.
  }

  return DEFAULT_DUE_OPTIONS.filter(Boolean);
}

function readPriorityOptions() {
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(PRIORITY_OPTIONS_KEY),
    );
    if (Array.isArray(parsed)) {
      const validValues = new Set(
        DEFAULT_PRIORITY_OPTIONS.map((option) => option.value),
      );
      return parsed
        .map((value) => String(value).trim().toLowerCase())
        .filter((value) => validValues.has(value));
    }
  } catch {
    // Fall back to defaults.
  }

  return DEFAULT_PRIORITY_OPTIONS.map((option) => option.value);
}

let priorityCategoryOptions = readPriorityOptions();
let dueCategoryOptions = readDueOptions();

function persistPriorityOptions() {
  try {
    window.localStorage.setItem(
      PRIORITY_OPTIONS_KEY,
      JSON.stringify(priorityCategoryOptions),
    );
  } catch {
    // Ignore storage errors; the current session still updates.
  }
}

function persistDueOptions() {
  try {
    window.localStorage.setItem(
      DUE_OPTIONS_KEY,
      JSON.stringify(dueCategoryOptions),
    );
  } catch {
    // Ignore storage errors; the current session still updates.
  }
}

function readContextCategorySettings() {
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(CONTEXT_CATEGORY_SETTINGS_KEY) || "null",
    );
    if (parsed && typeof parsed === "object") {
      return {
        priority: parsed.priority !== false,
        due: parsed.due !== false,
      };
    }
  } catch {
    // Fall back to defaults.
  }

  return {
    priority: true,
    due: true,
  };
}

let contextCategorySettings = readContextCategorySettings();

function persistContextCategorySettings() {
  try {
    window.localStorage.setItem(
      CONTEXT_CATEGORY_SETTINGS_KEY,
      JSON.stringify(contextCategorySettings),
    );
  } catch {
    // Ignore storage errors; the current session still updates.
  }
}

function readDefaultTagCategoriesFromMenu() {
  const groups = Array.from(tagsSubmenu?.querySelectorAll(".tag-group") ?? []);
  return groups
    .map((group, index) => {
      const name =
        group.querySelector(".tag-group-label")?.textContent?.trim() ||
        `Category ${index + 1}`;
      const tags = Array.from(group.querySelectorAll(".tag-option"))
        .map((option) =>
          String(option.dataset.tag ?? "")
            .split(":")
            .pop(),
        )
        .map(normalizeTagEntry)
        .filter((tag) => tag.name);

      return {
        id: createFileId(),
        name,
        tags,
        pinned: index < 2,
      };
    })
    .filter((category) => category.tags.length > 0);
}

function readTagSettings() {
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(TAG_SETTINGS_KEY) || "null",
    );
    if (Array.isArray(parsed) && parsed.length) {
      return parsed
        .map((category) => ({
          id: String(category.id || createFileId()),
          name: String(category.name || "Category").trim() || "Category",
          tags: Array.isArray(category.tags)
            ? category.tags.map(normalizeTagEntry).filter((tag) => tag.name)
            : [],
          pinned: Boolean(category.pinned),
        }))
        .filter((category) => category.tags.length > 0);
    }
  } catch {
    // Fall back to the built-in menu categories.
  }

  return readDefaultTagCategoriesFromMenu();
}

let tagCategories = readTagSettings();

function normalizeTagCategory(category) {
  return {
    id: String(category?.id || createFileId()),
    name: String(category?.name || "Category").trim() || "Category",
    tags: Array.isArray(category?.tags)
      ? category.tags.map(normalizeTagEntry).filter((tag) => tag.name)
      : [],
    pinned: Boolean(category?.pinned),
  };
}

function cloneTagCategories(categories = tagCategories) {
  return categories.map((category) => ({
    ...normalizeTagCategory(category),
    tags: category.tags.map(normalizeTagEntry),
  }));
}

function readTagSettingsByFile() {
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(TAG_SETTINGS_BY_FILE_KEY) || "null",
    );
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return Object.fromEntries(
        Object.entries(parsed).map(([fileId, categories]) => [
          fileId,
          Array.isArray(categories)
            ? categories
                .map(normalizeTagCategory)
                .filter((category) => category.tags.length > 0)
            : [],
        ]),
      );
    }
  } catch {
    // Fall back to empty per-file settings.
  }

  return {};
}

let tagCategoriesByFile = readTagSettingsByFile();

function persistTagSettingsByFile() {
  try {
    window.localStorage.setItem(
      TAG_SETTINGS_BY_FILE_KEY,
      JSON.stringify(tagCategoriesByFile),
    );
  } catch {
    // Ignore storage errors; the current session still updates.
  }
}

function persistTagSettings() {
  try {
    window.localStorage.setItem(
      TAG_SETTINGS_KEY,
      JSON.stringify(tagCategories),
    );
  } catch {
    // Ignore storage errors; the current session still updates.
  }
}

function getTagCategoriesForTodoFile(fileId) {
  if (!fileId) return tagCategories;

  if (!Array.isArray(tagCategoriesByFile[fileId])) {
    tagCategoriesByFile[fileId] = [];
    persistTagSettingsByFile();
  }

  return tagCategoriesByFile[fileId];
}

function setTagCategoriesForTodoFile(fileId, categories) {
  if (!fileId) {
    tagCategories = categories;
    persistTagSettings();
    return;
  }

  tagCategoriesByFile[fileId] = categories
    .map(normalizeTagCategory)
    .filter((category) => category.tags.length > 0);
  persistTagSettingsByFile();
}

function ensureSelectedTagTodoFileId() {
  if (!selectedTagTodoFileId && todoFiles.length > 0) {
    selectedTagTodoFileId = selectedTodoFileId || todoFiles[0].id;
  }
}

function getContextTagCategories() {
  if (activeView === "tags") {
    ensureSelectedTagTodoFileId();
    return getTagCategoriesForTodoFile(
      selectedTagTodoFileId || selectedTodoFileId,
    );
  }

  return getTagCategoriesForTodoFile(
    selectedTodoFileId || selectedTagTodoFileId,
  );
}

function setContextTagCategories(categories) {
  if (activeView === "tags") {
    ensureSelectedTagTodoFileId();
    return setTagCategoriesForTodoFile(
      selectedTagTodoFileId || selectedTodoFileId,
      categories,
    );
  }

  return setTagCategoriesForTodoFile(
    selectedTodoFileId || selectedTagTodoFileId,
    categories,
  );
}

function getTagName(tag) {
  return normalizeTagEntry(tag).name;
}

function getTagColor(tag) {
  return normalizeTagEntry(tag).color;
}

function getTagValue(categoryName, tag) {
  return `${categoryName}:${getTagName(tag)}`;
}

function findTagColorByValue(tagValue) {
  const [categoryName, ...tagNameParts] = String(tagValue ?? "").split(":");
  const tagName = tagNameParts.join(":").trim();
  const category = getContextTagCategories().find(
    (item) => item.name === categoryName,
  );
  const tag = category?.tags
    .map(normalizeTagEntry)
    .find((item) => item.name === tagName);
  return tag?.color ?? DEFAULT_TAG_COLOR;
}

function createPriorityOptionButton(option) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "context-menu-item priority-option";
  button.dataset.action = option.value
    ? `priority-${option.value}`
    : "priority-none";
  button.setAttribute("role", "menuitemradio");

  const dot = document.createElement("span");
  dot.className = `priority-dot priority-dot-${option.value || "none"}`;
  const check = document.createElement("span");
  check.className = "priority-check";
  check.setAttribute("aria-hidden", "true");

  button.append(dot, option.label, check);
  return button;
}

function createDueOptionButton(value) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "context-menu-item due-option";
  button.dataset.action = "set-due";
  button.dataset.due = value;
  button.setAttribute("role", "menuitemradio");

  const normalizedValue = value.toLowerCase();
  const dot = document.createElement("span");
  dot.className = [
    "due-dot",
    normalizedValue === "today" ? "due-dot-today" : "",
    normalizedValue === "tomorrow" ? "due-dot-tomorrow" : "",
    normalizedValue.includes("week") ? "due-dot-week" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const check = document.createElement("span");
  check.className = "priority-check";
  check.setAttribute("aria-hidden", "true");

  button.append(dot, value || "None", check);
  return button;
}

function renderPriorityContextMenu() {
  if (!prioritySubmenu) return;

  prioritySubmenu.innerHTML = "";
  priorityCategoryOptions.forEach((value) => {
    const option = DEFAULT_PRIORITY_OPTIONS.find(
      (item) => item.value === value,
    );
    if (!option) return;
    prioritySubmenu.appendChild(createPriorityOptionButton(option));
  });
  const separator = document.createElement("div");
  separator.className = "context-menu-separator";
  prioritySubmenu.appendChild(separator);
  prioritySubmenu.appendChild(
    createPriorityOptionButton({ value: "", label: "No priority" }),
  );

  priorityOptions = Array.from(
    todoItemContextMenu?.querySelectorAll(".priority-option") ?? [],
  );
}

function renderDueContextMenu() {
  if (!dueSubmenu) return;

  dueSubmenu.innerHTML = "";
  dueCategoryOptions.forEach((option) => {
    dueSubmenu.appendChild(createDueOptionButton(option));
  });

  const separator = document.createElement("div");
  separator.className = "context-menu-separator";
  dueSubmenu.appendChild(separator);
  dueSubmenu.appendChild(createDueOptionButton(""));

  dueOptions = Array.from(
    todoItemContextMenu?.querySelectorAll(".due-option") ?? [],
  );
}

function createTagOptionButton(categoryName, tag) {
  const tagName = getTagName(tag);
  const button = document.createElement("button");
  button.type = "button";
  button.className = "context-menu-item tag-option";
  button.dataset.action = "toggle-tag";
  button.dataset.tag = getTagValue(categoryName, tag);
  button.setAttribute("role", "menuitemcheckbox");

  const dot = document.createElement("span");
  dot.className = "tag-color-dot";
  dot.style.backgroundColor = getTagColor(tag);
  const label = document.createElement("span");
  label.textContent = tagName;

  button.append(dot, label);
  return button;
}

function createTagGroupElement(category) {
  const group = document.createElement("div");
  group.className = "tag-group";

  const label = document.createElement("div");
  label.className = "tag-group-label";
  label.textContent = category.name;
  group.appendChild(label);

  category.tags.forEach((tag) => {
    group.appendChild(createTagOptionButton(category.name, tag));
  });

  return group;
}

function createTagCategoryDropdown(category) {
  const trigger = document.createElement("div");
  trigger.className =
    "context-menu-item context-menu-submenu-trigger quick-tag-dropdown";
  trigger.setAttribute("role", "menuitem");
  trigger.setAttribute("aria-haspopup", "true");
  trigger.setAttribute("aria-expanded", "false");
  trigger.tabIndex = 0;

  const label = document.createElement("span");
  label.className = "context-menu-item-label";
  label.textContent = category.name;

  const count = document.createElement("span");
  count.className = "context-menu-current-priority";
  count.textContent = `${category.tags.length}`;

  const chevron = document.createElement("span");
  chevron.className = "context-menu-chevron";
  chevron.setAttribute("aria-hidden", "true");

  const submenu = document.createElement("div");
  submenu.className = "priority-submenu quick-tag-submenu";
  submenu.setAttribute("role", "menu");
  submenu.setAttribute("aria-label", category.name);
  category.tags.forEach((tag) => {
    submenu.appendChild(createTagOptionButton(category.name, tag));
  });

  trigger.append(label, count, chevron, submenu);
  return trigger;
}

function renderTagContextMenu() {
  if (!todoItemContextMenu || !tagsSubmenu) return;

  renderPriorityContextMenu();
  renderDueContextMenu();
  renderSystemContextCategories();

  todoItemContextMenu
    .querySelectorAll(".quick-tag-dropdown, .quick-tag-separator")
    .forEach((element) => element.remove());

  const currentCategories = getContextTagCategories();
  const pinnedCategories = currentCategories.filter(
    (category) => category.pinned,
  );
  const tagsSeparator = todoItemContextMenu.querySelector(
    ".tags-menu-separator",
  );
  pinnedCategories.forEach((category, index) => {
    if (contextCategorySettings.priority || index > 0) {
      const separator = document.createElement("div");
      separator.className = "context-menu-separator quick-tag-separator";
      tagsSeparator?.before(separator);
    }
    tagsSeparator?.before(createTagCategoryDropdown(category));
  });
  tagsSeparator?.toggleAttribute(
    "hidden",
    !contextCategorySettings.priority && pinnedCategories.length === 0,
  );

  tagsSubmenu.innerHTML = "";
  currentCategories.forEach((category, index) => {
    if (index > 0) {
      const separator = document.createElement("div");
      separator.className = "context-menu-separator";
      tagsSubmenu.appendChild(separator);
    }
    tagsSubmenu.appendChild(createTagGroupElement(category));
  });

  const clearSeparator = document.createElement("div");
  clearSeparator.className = "context-menu-separator";
  const clearButton = document.createElement("button");
  clearButton.type = "button";
  clearButton.className = "context-menu-item tag-option";
  clearButton.dataset.action = "toggle-tag";
  clearButton.dataset.tag = "";
  clearButton.setAttribute("role", "menuitemcheckbox");
  clearButton.textContent = "Clear all tags";
  tagsSubmenu.append(clearSeparator, clearButton);

  tagOptions = Array.from(
    todoItemContextMenu.querySelectorAll(".tag-option") ?? [],
  );
}

function renderSystemContextCategories() {
  priorityMenuTrigger?.toggleAttribute(
    "hidden",
    !contextCategorySettings.priority,
  );
  dueMenuTrigger?.toggleAttribute("hidden", !contextCategorySettings.due);
  todoItemContextMenu
    ?.querySelector(".due-menu-separator")
    ?.toggleAttribute("hidden", !contextCategorySettings.due);

  if (!contextCategorySettings.priority) {
    closePrioritySubmenu(true);
  }
  if (!contextCategorySettings.due) {
    closeDueSubmenu(true);
  }
}

function createSystemCategoryCard({
  title,
  description,
  settingKey,
  options,
  editableType = null,
}) {
  const card = document.createElement("section");
  card.className = "tag-category-card system-category-card";

  const header = document.createElement("div");
  header.className = "tag-category-header";

  const titleWrap = document.createElement("div");
  titleWrap.className = "system-category-title";
  const titleEl = document.createElement("strong");
  titleEl.textContent = title;
  const descriptionEl = document.createElement("span");
  descriptionEl.textContent = description;
  titleWrap.append(titleEl, descriptionEl);

  const pinLabel = document.createElement("label");
  pinLabel.className = "tag-pin-toggle";
  const pinInput = document.createElement("input");
  pinInput.type = "checkbox";
  pinInput.checked = contextCategorySettings[settingKey] !== false;
  pinInput.addEventListener("change", () => {
    contextCategorySettings = {
      ...contextCategorySettings,
      [settingKey]: pinInput.checked,
    };
    persistContextCategorySettings();
    renderTagContextMenu();
    renderTagSettings();
  });
  const pinText = document.createElement("span");
  pinText.textContent = "In context menu";
  pinLabel.append(pinInput, pinText);

  header.append(titleWrap, pinLabel);

  const optionsRow = document.createElement("div");
  optionsRow.className = "system-category-options";
  if (editableType === "priority") {
    priorityCategoryOptions.forEach((optionValue, optionIndex) => {
      const row = document.createElement("div");
      row.className = "tag-editor-row";

      const select = document.createElement("select");
      select.setAttribute("aria-label", "Priority option");
      DEFAULT_PRIORITY_OPTIONS.forEach((option) => {
        const optionEl = document.createElement("option");
        optionEl.value = option.value;
        optionEl.textContent = option.label;
        optionEl.selected = option.value === optionValue;
        optionEl.disabled =
          option.value !== optionValue &&
          priorityCategoryOptions.includes(option.value);
        select.appendChild(optionEl);
      });
      select.addEventListener("change", () => {
        const nextValue = select.value;
        if (!nextValue || priorityCategoryOptions.includes(nextValue)) {
          renderTagSettings();
          return;
        }
        priorityCategoryOptions[optionIndex] = nextValue;
        persistPriorityOptions();
        renderTagContextMenu();
        renderTagSettings();
      });

      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.className = "icon-only-button";
      removeButton.title = "Delete option";
      removeButton.textContent = "×";
      removeButton.addEventListener("click", () => {
        priorityCategoryOptions = priorityCategoryOptions.filter(
          (_, index) => index !== optionIndex,
        );
        persistPriorityOptions();
        renderTagContextMenu();
        renderTagSettings();
      });

      row.append(select, removeButton);
      optionsRow.appendChild(row);
    });

    const availablePriorityOptions = DEFAULT_PRIORITY_OPTIONS.filter(
      (option) => !priorityCategoryOptions.includes(option.value),
    );
    if (availablePriorityOptions.length) {
      const addRow = document.createElement("div");
      addRow.className = "tag-editor-row";
      const select = document.createElement("select");
      select.setAttribute("aria-label", "New priority");
      availablePriorityOptions.forEach((option) => {
        const optionEl = document.createElement("option");
        optionEl.value = option.value;
        optionEl.textContent = option.label;
        select.appendChild(optionEl);
      });
      const addButton = document.createElement("button");
      addButton.type = "button";
      addButton.className = "secondary-button";
      addButton.textContent = "Add";
      addButton.addEventListener("click", () => {
        if (!select.value) return;
        priorityCategoryOptions = [...priorityCategoryOptions, select.value];
        persistPriorityOptions();
        renderTagContextMenu();
        renderTagSettings();
      });
      addRow.append(select, addButton);
      optionsRow.appendChild(addRow);
    }
  } else if (editableType === "due") {
    dueCategoryOptions.forEach((option, optionIndex) => {
      const row = document.createElement("div");
      row.className = "tag-editor-row";

      const input = document.createElement("input");
      input.value = option;
      input.setAttribute("aria-label", "Due option");
      input.addEventListener("change", () => {
        const nextValue = normalizeTodoText(input.value);
        if (nextValue) {
          dueCategoryOptions[optionIndex] = nextValue;
        } else {
          dueCategoryOptions.splice(optionIndex, 1);
        }
        persistDueOptions();
        renderTagContextMenu();
        renderTagSettings();
      });

      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.className = "icon-only-button";
      removeButton.title = "Delete option";
      removeButton.textContent = "×";
      removeButton.addEventListener("click", () => {
        dueCategoryOptions = dueCategoryOptions.filter(
          (_, index) => index !== optionIndex,
        );
        persistDueOptions();
        renderTagContextMenu();
        renderTagSettings();
      });

      row.append(input, removeButton);
      optionsRow.appendChild(row);
    });

    const addRow = document.createElement("div");
    addRow.className = "tag-editor-row";
    const addInput = document.createElement("input");
    addInput.placeholder = "New option";
    addInput.setAttribute("aria-label", "New due option");
    const addButton = document.createElement("button");
    addButton.type = "button";
    addButton.className = "secondary-button";
    addButton.textContent = "Add";
    const addDueOption = () => {
      const nextValue = normalizeTodoText(addInput.value);
      if (!nextValue) return;
      dueCategoryOptions = [...dueCategoryOptions, nextValue];
      persistDueOptions();
      renderTagContextMenu();
      renderTagSettings();
    };
    addButton.addEventListener("click", addDueOption);
    addInput.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      addDueOption();
    });
    addRow.append(addInput, addButton);
    optionsRow.appendChild(addRow);
  } else {
    options.forEach((option) => {
      const chip = document.createElement("span");
      chip.className = "system-category-chip";
      chip.textContent = option;
      optionsRow.appendChild(chip);
    });
  }

  card.append(header, optionsRow);
  return card;
}

function renderTagSettings() {
  if (!tagCategoryList) return;

  ensureSelectedTagTodoFileId();
  const currentCategories = getContextTagCategories();

  tagCategoryList.innerHTML = "";
  tagCategoryList.append(
    createSystemCategoryCard({
      title: "Priority",
      description: "Default category for importance level.",
      settingKey: "priority",
      options: [
        ...priorityCategoryOptions
          .map((value) =>
            DEFAULT_PRIORITY_OPTIONS.find((option) => option.value === value),
          )
          .filter(Boolean)
          .map((option) => option.label),
        "No priority",
      ],
      editableType: "priority",
    }),
    createSystemCategoryCard({
      title: "Due Time",
      description: "Default category for the task due time.",
      settingKey: "due",
      options: [...dueCategoryOptions, "None"],
      editableType: "due",
    }),
  );

  currentCategories.forEach((category, categoryIndex) => {
    const card = document.createElement("section");
    card.className = "tag-category-card";

    const header = document.createElement("div");
    header.className = "tag-category-header";

    const nameInput = document.createElement("input");
    nameInput.className = "tag-category-name-input";
    nameInput.value = category.name;
    nameInput.setAttribute("aria-label", "Category name");
    nameInput.addEventListener("change", () => {
      const nextName = normalizeTodoText(nameInput.value) || "Category";
      setContextTagCategories(
        currentCategories.map((item, index) =>
          index === categoryIndex ? { ...item, name: nextName } : item,
        ),
      );
      renderTagContextMenu();
      renderTagSettings();
    });

    const pinLabel = document.createElement("label");
    pinLabel.className = "tag-pin-toggle";
    const pinInput = document.createElement("input");
    pinInput.type = "checkbox";
    pinInput.checked = category.pinned;
    pinInput.addEventListener("change", () => {
      setContextTagCategories(
        currentCategories.map((item, index) =>
          index === categoryIndex
            ? { ...item, pinned: pinInput.checked }
            : item,
        ),
      );
      renderTagContextMenu();
      renderTagSettings();
    });
    const pinText = document.createElement("span");
    pinText.textContent = "In context menu";
    pinLabel.append(pinInput, pinText);

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "secondary-button danger";
    deleteButton.textContent = "Delete";
    deleteButton.addEventListener("click", () => {
      setContextTagCategories(
        currentCategories.filter((_, index) => index !== categoryIndex),
      );
      renderTagContextMenu();
      renderTagSettings();
    });

    header.append(nameInput, pinLabel, deleteButton);

    const tagsWrap = document.createElement("div");
    tagsWrap.className = "tag-editor-list";
    category.tags.forEach((tag, tagIndex) => {
      const tagEntry = normalizeTagEntry(tag);
      const row = document.createElement("div");
      row.className = "tag-editor-row";

      const colorInput = document.createElement("input");
      colorInput.type = "color";
      colorInput.className = "tag-color-input";
      colorInput.value = tagEntry.color;
      colorInput.setAttribute("aria-label", "Tag color");
      colorInput.addEventListener("input", () => {
        setContextTagCategories(
          currentCategories.map((item, index) =>
            index === categoryIndex
              ? {
                  ...item,
                  tags: item.tags.map((tagItem, tagItemIndex) =>
                    tagItemIndex === tagIndex
                      ? {
                          ...normalizeTagEntry(tagItem),
                          color: colorInput.value,
                        }
                      : normalizeTagEntry(tagItem),
                  ),
                }
              : item,
          ),
        );
        renderTagContextMenu();
      });

      const tagInput = document.createElement("input");
      tagInput.value = tagEntry.name;
      tagInput.setAttribute("aria-label", "Tag");
      tagInput.addEventListener("change", () => {
        const nextTag = normalizeTodoText(tagInput.value);
        setContextTagCategories(
          currentCategories.map((item, index) => {
            if (index !== categoryIndex) return item;
            const nextTags = item.tags.map(normalizeTagEntry);
            if (nextTag) {
              nextTags[tagIndex] = {
                ...nextTags[tagIndex],
                name: nextTag,
              };
            } else {
              nextTags.splice(tagIndex, 1);
            }
            return { ...item, tags: nextTags };
          }),
        );
        renderTagContextMenu();
        renderTagSettings();
      });

      const removeTagButton = document.createElement("button");
      removeTagButton.type = "button";
      removeTagButton.className = "icon-only-button";
      removeTagButton.title = "Delete tag";
      removeTagButton.textContent = "×";
      removeTagButton.addEventListener("click", () => {
        setContextTagCategories(
          currentCategories.map((item, index) =>
            index === categoryIndex
              ? {
                  ...item,
                  tags: item.tags.filter(
                    (_, tagIndexFilter) => tagIndexFilter !== tagIndex,
                  ),
                }
              : item,
          ),
        );
        renderTagContextMenu();
        renderTagSettings();
      });

      row.append(colorInput, tagInput, removeTagButton);
      tagsWrap.appendChild(row);
    });

    const addTagRow = document.createElement("div");
    addTagRow.className = "tag-editor-row";
    const addColorInput = document.createElement("input");
    addColorInput.type = "color";
    addColorInput.className = "tag-color-input";
    addColorInput.value = DEFAULT_TAG_COLOR;
    addColorInput.setAttribute("aria-label", "New tag color");
    const addTagInput = document.createElement("input");
    addTagInput.placeholder = "New tag";
    addTagInput.setAttribute("aria-label", "New tag");
    const addTagButton = document.createElement("button");
    addTagButton.type = "button";
    addTagButton.className = "secondary-button";
    addTagButton.textContent = "Add";
    const addTag = () => {
      const nextTag = normalizeTodoText(addTagInput.value);
      if (!nextTag) return;
      setContextTagCategories(
        currentCategories.map((item, index) =>
          index === categoryIndex
            ? {
                ...item,
                tags: [
                  ...item.tags.map(normalizeTagEntry),
                  { name: nextTag, color: addColorInput.value },
                ],
              }
            : item,
        ),
      );
      renderTagContextMenu();
      renderTagSettings();
    };
    addTagButton.addEventListener("click", addTag);
    addTagInput.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      addTag();
    });
    addTagRow.append(addColorInput, addTagInput, addTagButton);

    card.append(header, tagsWrap, addTagRow);
    tagCategoryList.appendChild(card);
  });
}

function addTagCategory() {
  const currentCategories = getContextTagCategories();
  setContextTagCategories([
    {
      id: createFileId(),
      name: "New category",
      tags: [{ name: "New tag", color: DEFAULT_TAG_COLOR }],
      pinned: true,
    },
    ...currentCategories,
  ]);
  renderTagContextMenu();
  renderTagSettings();
}

let priorityCloseTimer = null;
let tagsCloseTimer = null;
let dueCloseTimer = null;
let submenuTypeaheadBuffer = "";
let submenuTypeaheadTimer = null;

function clearSubmenuTimers() {
  if (priorityCloseTimer) {
    window.clearTimeout(priorityCloseTimer);
    priorityCloseTimer = null;
  }
  if (tagsCloseTimer) {
    window.clearTimeout(tagsCloseTimer);
    tagsCloseTimer = null;
  }
  if (dueCloseTimer) {
    window.clearTimeout(dueCloseTimer);
    dueCloseTimer = null;
  }
}

function getHoverTargetElement(relatedTarget) {
  if (!relatedTarget) return null;
  if (relatedTarget instanceof Element) {
    return relatedTarget;
  }
  return relatedTarget.parentElement ?? null;
}

function shouldKeepSubmenuOpen(relatedTarget, submenuType) {
  const targetEl = getHoverTargetElement(relatedTarget);
  if (!targetEl) return false;

  if (submenuType === "priority") {
    return Boolean(
      targetEl.closest(".priority-submenu") ||
      targetEl === priorityMenuTrigger ||
      targetEl.closest(".context-menu-submenu-trigger") === priorityMenuTrigger,
    );
  }

  if (submenuType === "tags") {
    return Boolean(
      targetEl.closest(".tag-submenu") ||
      targetEl === tagsMenuTrigger ||
      targetEl.closest(".context-menu-tags-trigger") === tagsMenuTrigger,
    );
  }

  return Boolean(
    targetEl.closest(".due-submenu") ||
    targetEl === dueMenuTrigger ||
    targetEl.closest(".context-menu-due-trigger") === dueMenuTrigger,
  );
}

function positionPrioritySubmenu() {
  if (!prioritySubmenu) return;
  prioritySubmenu.classList.remove("flip-left");
  const rect = prioritySubmenu.getBoundingClientRect();
  if (rect.right > window.innerWidth - 8) {
    prioritySubmenu.classList.add("flip-left");
  }
}

function syncPrioritySubmenuState(todoId) {
  const item = todoId ? findSelectedTodoItem(todoId) : null;
  const currentPriority = item ? normalizeTodoPriority(item.priority) : null;

  priorityOptions.forEach((option) => {
    const action = option.dataset.action;
    const optionPriority =
      action === "priority-none" ? null : action.replace("priority-", "");
    option.classList.toggle("active", optionPriority === currentPriority);
  });

  if (currentPriorityLabel) {
    currentPriorityLabel.textContent = currentPriority
      ? PRIORITY_LABELS[currentPriority]
      : "None";
  }
}

function positionTagsSubmenu() {
  if (!tagsSubmenu) return;
  tagsSubmenu.classList.remove("flip-left");
  const rect = tagsSubmenu.getBoundingClientRect();
  if (rect.right > window.innerWidth - 8) {
    tagsSubmenu.classList.add("flip-left");
  }
}

function syncTagsSubmenuState(todoId) {
  const item = todoId ? findSelectedTodoItem(todoId) : null;
  const selectedTags = Array.isArray(item?.tags) ? item.tags : [];

  tagOptions.forEach((option) => {
    option.classList.toggle(
      "active",
      selectedTags.includes(option.dataset.tag),
    );
  });

  if (currentTagsLabel) {
    if (!selectedTags.length) {
      currentTagsLabel.textContent = "None";
      return;
    }

    const preview = selectedTags
      .slice(0, 2)
      .map((tag) => tag.split(":").pop())
      .join(", ");
    currentTagsLabel.textContent =
      selectedTags.length > 2 ? `${preview}…` : preview;
  }
}

function positionDueSubmenu() {
  if (!dueSubmenu) return;
  dueSubmenu.classList.remove("flip-left");
  const rect = dueSubmenu.getBoundingClientRect();
  if (rect.right > window.innerWidth - 8) {
    dueSubmenu.classList.add("flip-left");
  }
}

function syncDueSubmenuState(todoId) {
  const item = todoId ? findSelectedTodoItem(todoId) : null;
  const currentDue = item?.dueTime ?? "";

  dueOptions.forEach((option) => {
    const optionDue = option.dataset.due ?? "";
    option.classList.toggle("active", optionDue === currentDue);
  });

  if (currentDueLabel) {
    currentDueLabel.textContent = currentDue || "None";
  }
}

function setSubmenuOpenState(trigger, submenu, isOpen) {
  trigger?.classList.toggle("submenu-open", isOpen);
  trigger?.setAttribute("aria-expanded", String(isOpen));
  submenu?.classList.remove("flip-left");
}

function getActiveSubmenu() {
  if (priorityMenuTrigger?.classList.contains("submenu-open")) {
    return prioritySubmenu;
  }
  if (tagsMenuTrigger?.classList.contains("submenu-open")) {
    return tagsSubmenu;
  }
  if (dueMenuTrigger?.classList.contains("submenu-open")) {
    return dueSubmenu;
  }
  return null;
}

function clearSubmenuTypeaheadHighlight(submenu) {
  submenu?.querySelectorAll(".submenu-search-match").forEach((element) => {
    element.classList.remove("submenu-search-match");
  });
}

function resetSubmenuTypeahead() {
  if (submenuTypeaheadTimer) {
    window.clearTimeout(submenuTypeaheadTimer);
    submenuTypeaheadTimer = null;
  }
  submenuTypeaheadBuffer = "";
  clearSubmenuTypeaheadHighlight(getActiveSubmenu());
}

function handleSubmenuTypeahead(event) {
  const activeSubmenu = getActiveSubmenu();
  if (!activeSubmenu) return;

  const target = event.target;
  const isEditableTarget =
    target instanceof HTMLElement &&
    (target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.isContentEditable ||
      Boolean(target.closest("input, textarea, [contenteditable='true']")));

  if (isEditableTarget || event.altKey || event.ctrlKey || event.metaKey) {
    return;
  }

  const key = event.key;
  if (key === "Escape") {
    resetSubmenuTypeahead();
    return;
  }

  if (key === "Backspace") {
    event.preventDefault();
    submenuTypeaheadBuffer = submenuTypeaheadBuffer.slice(0, -1);
  } else if (key.length === 1 && /[\p{L}\p{N}\s-]/u.test(key)) {
    event.preventDefault();
    submenuTypeaheadBuffer = `${submenuTypeaheadBuffer}${key}`.trim();
  } else {
    return;
  }

  if (submenuTypeaheadTimer) {
    window.clearTimeout(submenuTypeaheadTimer);
  }
  submenuTypeaheadTimer = window.setTimeout(resetSubmenuTypeahead, 700);

  const normalizedQuery = submenuTypeaheadBuffer.toLowerCase();
  if (!normalizedQuery) {
    clearSubmenuTypeaheadHighlight(activeSubmenu);
    return;
  }

  const options = Array.from(
    activeSubmenu.querySelectorAll(
      ".priority-option, .tag-option, .due-option",
    ),
  );
  const match = options.find((option) => {
    const label = (option.textContent ?? "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
    const metadata = [option.dataset.tag, option.dataset.due]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return (
      label.includes(normalizedQuery) || metadata.includes(normalizedQuery)
    );
  });

  if (!match) {
    clearSubmenuTypeaheadHighlight(activeSubmenu);
    return;
  }

  clearSubmenuTypeaheadHighlight(activeSubmenu);
  match.classList.add("submenu-search-match");
  match.scrollIntoView({ block: "nearest", inline: "nearest" });
}

function openPrioritySubmenu() {
  clearSubmenuTimers();
  resetSubmenuTypeahead();
  closeTagsSubmenu(true);
  closeDueSubmenu(true);
  setSubmenuOpenState(priorityMenuTrigger, prioritySubmenu, true);
  requestAnimationFrame(positionPrioritySubmenu);
}

function closePrioritySubmenu(immediate = false) {
  if (priorityCloseTimer) {
    window.clearTimeout(priorityCloseTimer);
    priorityCloseTimer = null;
  }

  if (immediate) {
    setSubmenuOpenState(priorityMenuTrigger, prioritySubmenu, false);
    return;
  }

  priorityCloseTimer = window.setTimeout(() => {
    setSubmenuOpenState(priorityMenuTrigger, prioritySubmenu, false);
    priorityCloseTimer = null;
  }, 300);
}

function openTagsSubmenu() {
  clearSubmenuTimers();
  resetSubmenuTypeahead();
  closePrioritySubmenu(true);
  closeDueSubmenu(true);
  setSubmenuOpenState(tagsMenuTrigger, tagsSubmenu, true);
  requestAnimationFrame(positionTagsSubmenu);
}

function closeTagsSubmenu(immediate = false) {
  if (tagsCloseTimer) {
    window.clearTimeout(tagsCloseTimer);
    tagsCloseTimer = null;
  }

  if (immediate) {
    setSubmenuOpenState(tagsMenuTrigger, tagsSubmenu, false);
    return;
  }

  tagsCloseTimer = window.setTimeout(() => {
    setSubmenuOpenState(tagsMenuTrigger, tagsSubmenu, false);
    tagsCloseTimer = null;
  }, 300);
}

function openDueSubmenu() {
  clearSubmenuTimers();
  resetSubmenuTypeahead();
  closePrioritySubmenu(true);
  closeTagsSubmenu(true);
  setSubmenuOpenState(dueMenuTrigger, dueSubmenu, true);
  requestAnimationFrame(positionDueSubmenu);
}

function closeDueSubmenu(immediate = false) {
  if (dueCloseTimer) {
    window.clearTimeout(dueCloseTimer);
    dueCloseTimer = null;
  }

  if (immediate) {
    setSubmenuOpenState(dueMenuTrigger, dueSubmenu, false);
    return;
  }

  dueCloseTimer = window.setTimeout(() => {
    setSubmenuOpenState(dueMenuTrigger, dueSubmenu, false);
    dueCloseTimer = null;
  }, 300);
}

priorityMenuTrigger?.addEventListener("mouseenter", () => {
  openPrioritySubmenu();
});

todoItemContextMenu?.addEventListener("mouseenter", () => {
  clearSubmenuTimers();
});

todoItemContextMenu?.addEventListener("mouseleave", () => {
  closePrioritySubmenu();
  closeTagsSubmenu();
  closeDueSubmenu();
});

priorityMenuTrigger?.addEventListener("mouseleave", (event) => {
  if (shouldKeepSubmenuOpen(event.relatedTarget, "priority")) return;
  closePrioritySubmenu();
});

prioritySubmenu?.addEventListener("mouseenter", () => {
  openPrioritySubmenu();
});

prioritySubmenu?.addEventListener("mouseleave", (event) => {
  if (shouldKeepSubmenuOpen(event.relatedTarget, "priority")) return;
  closePrioritySubmenu();
});

tagsMenuTrigger?.addEventListener("mouseenter", () => {
  openTagsSubmenu();
});

tagsMenuTrigger?.addEventListener("mouseleave", (event) => {
  if (shouldKeepSubmenuOpen(event.relatedTarget, "tags")) return;
  closeTagsSubmenu();
});

tagsSubmenu?.addEventListener("mouseenter", () => {
  openTagsSubmenu();
});

tagsSubmenu?.addEventListener("mouseleave", (event) => {
  if (shouldKeepSubmenuOpen(event.relatedTarget, "tags")) return;
  closeTagsSubmenu();
});

dueMenuTrigger?.addEventListener("mouseenter", () => {
  openDueSubmenu();
});

dueMenuTrigger?.addEventListener("mouseleave", (event) => {
  if (shouldKeepSubmenuOpen(event.relatedTarget, "due")) return;
  closeDueSubmenu();
});

dueSubmenu?.addEventListener("mouseenter", () => {
  openDueSubmenu();
});

dueSubmenu?.addEventListener("mouseleave", (event) => {
  if (shouldKeepSubmenuOpen(event.relatedTarget, "due")) return;
  closeDueSubmenu();
});

function hideContextMenu() {
  if (!contextMenu) return;
  contextMenu.hidden = true;
  contextMenuTarget = null;
}

function getPopupPosition(event, menuRect) {
  const left = Math.max(
    8,
    Math.min(event.clientX, window.innerWidth - menuRect.width - 8),
  );

  const fitsBelow = event.clientY + menuRect.height + 8 <= window.innerHeight;
  const top = fitsBelow
    ? Math.max(8, event.clientY)
    : Math.max(8, event.clientY - menuRect.height);

  return { left, top };
}

function showContextMenu(event, target) {
  if (!contextMenu) return;

  event.preventDefault();
  event.stopPropagation();
  contextMenuTarget = target;

  hideTodoItemContextMenu();
  contextMenu.hidden = false;
  const menuRect = contextMenu.getBoundingClientRect();
  const { left, top } = getPopupPosition(event, menuRect);

  contextMenu.style.left = `${left}px`;
  contextMenu.style.top = `${top}px`;
}

function showTodoItemContextMenu(event, target) {
  if (!todoItemContextMenu) return;

  event.preventDefault();
  event.stopPropagation();
  todoContextMenuTarget = target;

  hideContextMenu();
  closePrioritySubmenu();
  closeTagsSubmenu();
  closeDueSubmenu();
  syncPrioritySubmenuState(target?.todoId);
  syncTagsSubmenuState(target?.todoId);
  syncDueSubmenuState(target?.todoId);
  todoItemContextMenu.hidden = false;
  const menuRect = todoItemContextMenu.getBoundingClientRect();
  const { left, top } = getPopupPosition(event, menuRect);

  todoItemContextMenu.style.left = `${left}px`;
  todoItemContextMenu.style.top = `${top}px`;
}

function hideTodoItemContextMenu() {
  if (!todoItemContextMenu) return;
  todoItemContextMenu.hidden = true;
  todoContextMenuTarget = null;
  closePrioritySubmenu();
  closeTagsSubmenu();
  closeDueSubmenu();
}

function attachFileContextMenu(element, target) {
  element.addEventListener("contextmenu", (event) => {
    showContextMenu(event, target);
  });
}

let todoContextMenuTarget = null;

function handlePrimaryFileOpen(event, callback) {
  if (event.button !== 0) return;
  if (event.defaultPrevented) return;

  event.preventDefault();
  callback?.();
}

function createFileId() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getTargetFile(target = contextMenuTarget) {
  if (!target) return null;

  return target.type === "note"
    ? notes.find((note) => note.id === target.id)
    : todoFiles.find((todoFile) => todoFile.id === target.id);
}

function selectContextTarget(target = contextMenuTarget) {
  if (!target) return;

  if (target.type === "note") {
    selectNote(target.id);
    showNotesView();
  } else {
    selectTodoFile(target.id);
    showTodoView();
  }
}

function openContextTargetInNewTab(target = contextMenuTarget) {
  if (!target) return;

  if (target.type === "note") {
    openNoteIds = [...openNoteIds, target.id];
    activeNoteTabIndex = openNoteIds.length - 1;
    selectNote(target.id, {
      preserveOpenTabs: true,
      tabIndex: activeNoteTabIndex,
    });
    showNotesView();
    return;
  }

  openTodoFileIds = [...openTodoFileIds, target.id];
  activeTodoTabIndex = openTodoFileIds.length - 1;
  selectTodoFile(target.id, {
    preserveOpenTabs: true,
    tabIndex: activeTodoTabIndex,
  });
  showTodoView();
}

function openContextTargetToRight(target = contextMenuTarget) {
  if (!target) return;

  if (target.type === "note") {
    selectRightNote(target.id);
    showNotesView();
    return;
  }

  const ids = openTodoFileIds.slice();
  const activeIndex = ids.indexOf(selectedTodoFileId);
  const insertIndex = activeIndex >= 0 ? activeIndex + 1 : ids.length;

  ids.splice(insertIndex, 0, target.id);
  openTodoFileIds = ids;
  activeTodoTabIndex = insertIndex;
  selectTodoFile(target.id, {
    preserveOpenTabs: true,
    tabIndex: activeTodoTabIndex,
  });
  showTodoView();
}

async function openContextTargetInNewWindow(target = contextMenuTarget) {
  if (!target) return;

  await electronAPI.openInNewWindow?.(
    target.type === "note" ? "notes" : "todo",
    target.id,
  );
}

function selectRightNote(noteId) {
  const note = notes.find((item) => item.id === noteId);
  if (!note) return;

  selectedRightNoteId = note.id;
  const initialContent = buildEditorContent(note.title, note.content);
  if (rightCanvas) rightCanvas.innerText = initialContent;
  rightCanvasLastText = initialContent;
  if (rightCanvasTitle) rightCanvasTitle.textContent = note.title;
}

function closeRightPane() {
  selectedRightNoteId = null;
  rightCanvasLastText = "";
  if (rightCanvas) rightCanvas.innerText = "";
  if (rightCanvasTitle) rightCanvasTitle.textContent = "";
  showEditor();
}

async function copyContextFile(target = contextMenuTarget) {
  const file = getTargetFile(target);
  if (!file || !target) return;

  const now = new Date().toISOString();
  if (target.type === "note") {
    const copy = {
      ...file,
      id: createFileId(),
      title: `${file.title} copy`,
      updatedAt: now,
    };
    notes = await persistNotes([copy, ...notes]);
    selectNote(copy.id);
    return;
  }

  const copy = {
    ...file,
    id: createFileId(),
    title: `${file.title} copy`,
    items: Array.isArray(file.items)
      ? file.items.map((item) => ({ ...item, id: createFileId() }))
      : [],
    updatedAt: now,
  };
  todoFiles = await persistTodoFiles([copy, ...todoFiles]);
  selectTodoFile(copy.id);
}

async function copyContextFilePath(target = contextMenuTarget) {
  const file = getTargetFile(target);
  if (!file || !target) return;

  const path = await electronAPI.copyFilePath?.(target.type, file);
  if (path) {
    // no-op: status line removed
  }
}

async function showContextFileInFolder(target = contextMenuTarget) {
  const file = getTargetFile(target);
  if (!file || !target) return;

  const shown = await electronAPI.showFileInFolder?.(target.type, file);
  if (!shown) {
    // no-op: status line removed
  }
}

const emptyNotesFolders = new Set();
const emptyTodoFolders = new Set();
const collapsedNotesFolders = new Set();
const collapsedTodoFolders = new Set();

let renameFolderName = null;

function updateRailInk(view) {
  if (!rail) return;

  const activeButton = railButtons.find(
    (button) => button.dataset.view === view,
  );
  if (!activeButton) return;

  rail.style.setProperty("--rail-ink-y", `${activeButton.offsetTop}px`);
}

function setRailMorph(factor, originY) {
  if (!rail) return;
  rail.style.setProperty("--morph-factor", `${factor}`);
  if (originY !== undefined) {
    rail.style.setProperty("--rail-morph-origin", originY);
  }
}

function initRailMorphHover() {
  if (!rail || !railButtons.length) return;

  let squishResetTimer = null;
  let morphFrame = null;

  function getActiveIndex() {
    return railButtons.findIndex((btn) => btn.classList.contains("active"));
  }

  function morphTowards(index) {
    const activeIndex = getActiveIndex();
    if (activeIndex === -1 || index === activeIndex) return;

    const distance = index - activeIndex;
    const direction = distance > 0 ? 1 : -1;
    const magnitude = Math.min(Math.abs(distance), 2) === 2 ? 1.35 : 1;
    // Anchor the near edge of the pill so it only elongates toward the
    // hovered button instead of growing symmetrically from its center.
    const originY = direction > 0 ? "0%" : "100%";
    if (morphFrame) window.cancelAnimationFrame(morphFrame);
    morphFrame = window.requestAnimationFrame(() => {
      setRailMorph(magnitude, originY);
      morphFrame = null;
    });
  }

  function releaseSquish() {
    if (morphFrame) {
      window.cancelAnimationFrame(morphFrame);
      morphFrame = null;
    }
    setRailMorph(0, "50%");
    if (squishResetTimer) window.clearTimeout(squishResetTimer);
    squishResetTimer = window.setTimeout(() => {
      rail.classList.remove("rail-squish");
      squishResetTimer = null;
    }, 220);
  }

  railButtons.forEach((button, index) => {
    button.addEventListener("mouseenter", () => morphTowards(index));

    button.addEventListener("mousedown", () => {
      if (squishResetTimer) {
        window.clearTimeout(squishResetTimer);
        squishResetTimer = null;
      }
      rail.classList.add("rail-squish");
      morphTowards(index);
    });
  });

  rail.addEventListener("mouseleave", () => setRailMorph(0, "50%"));

  // Catch releases anywhere (drag off the button, fast clicking, etc.) so
  // the pill never gets stuck stretched out.
  window.addEventListener("mouseup", releaseSquish);
  window.addEventListener("blur", releaseSquish);
}

function rememberOpenTab(type, id) {
  if (type === "note") {
    openNoteIds = [id];
    activeNoteTabIndex = 0;
    return;
  }

  openTodoFileIds = [id];
  activeTodoTabIndex = 0;
}

function closeNoteTab(tabIndex) {
  if (tabIndex < 0 || tabIndex >= openNoteIds.length) return;

  const closingNoteId = openNoteIds[tabIndex];
  if (tabIndex < activeNoteTabIndex) {
    activeNoteTabIndex -= 1;
  } else if (tabIndex === activeNoteTabIndex) {
    if (activeNoteTabIndex === openNoteIds.length - 1) {
      activeNoteTabIndex = Math.max(0, activeNoteTabIndex - 1);
    }
  }

  openNoteIds.splice(tabIndex, 1);
  if (closingNoteId === DRAFT_NOTE_TAB_ID) {
    draftNoteContent = "";
  }
  if (openNoteIds.length === 0) {
    resetSelection();
    return;
  }

  const nextNoteId = openNoteIds[activeNoteTabIndex];
  if (nextNoteId === DEFAULT_NOTE_TAB_ID) {
    showDefaultNotePage({
      preserveOpenTabs: true,
      tabIndex: activeNoteTabIndex,
    });
    return;
  }

  if (nextNoteId === DRAFT_NOTE_TAB_ID) {
    showDraftNotePage({
      preserveOpenTabs: true,
      tabIndex: activeNoteTabIndex,
    });
    return;
  }

  selectNote(nextNoteId, {
    preserveOpenTabs: true,
    tabIndex: activeNoteTabIndex,
  });
}

function closeTodoTab(tabIndex) {
  if (tabIndex < 0 || tabIndex >= openTodoFileIds.length) return;

  if (tabIndex < activeTodoTabIndex) {
    activeTodoTabIndex -= 1;
  } else if (tabIndex === activeTodoTabIndex) {
    if (activeTodoTabIndex === openTodoFileIds.length - 1) {
      activeTodoTabIndex = Math.max(0, activeTodoTabIndex - 1);
    }
  }

  openTodoFileIds.splice(tabIndex, 1);
  if (openTodoFileIds.length === 0) {
    resetTodoSelection();
    return;
  }

  const nextTodoFileId = openTodoFileIds[activeTodoTabIndex];
  selectTodoFile(nextTodoFileId, {
    preserveOpenTabs: true,
    tabIndex: activeTodoTabIndex,
  });
}

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

async function refreshKnownDataVersions() {
  const versions = await electronAPI.getDataVersion?.();
  if (!versions || typeof versions !== "object") return knownDataVersions;

  knownDataVersions = {
    notes: Number(versions.notes) || 0,
    todos: Number(versions.todos) || 0,
  };
  return knownDataVersions;
}

async function persistNotes(items = notes) {
  const next = Array.isArray(items) ? items : [];
  const savedNotes = await electronAPI.saveNotes?.(next);
  await refreshKnownDataVersions();
  return Array.isArray(savedNotes) ? savedNotes : next;
}

async function loadTodoFilesFromDisk() {
  const loadedFiles = await electronAPI.loadTodoFiles?.();
  return Array.isArray(loadedFiles) ? loadedFiles : [];
}

async function persistTodoFiles(items = todoFiles) {
  const next = Array.isArray(items) ? items : [];
  const savedFiles = await electronAPI.saveTodoFiles?.(next);
  await refreshKnownDataVersions();
  return Array.isArray(savedFiles) ? savedFiles : next;
}

async function syncNotesFromDisk() {
  const previousSelectedNoteId = selectedNoteId;
  const previousRightNoteId = selectedRightNoteId;
  const loadedNotes = await loadNotesFromDisk();
  notes = loadedNotes;

  openNoteIds = openNoteIds.filter(
    (id) =>
      id === DEFAULT_NOTE_TAB_ID ||
      id === DRAFT_NOTE_TAB_ID ||
      notes.some((note) => note.id === id),
  );

  if (
    previousSelectedNoteId &&
    notes.some((note) => note.id === previousSelectedNoteId)
  ) {
    selectedNoteId = previousSelectedNoteId;
    const selectedNote = notes.find((note) => note.id === selectedNoteId);
    const selectedContent = buildEditorContent(
      selectedNote.title,
      selectedNote.content,
    );
    if (canvas && activeView === "notes") {
      canvas.innerText = selectedContent;
      lastCanvasText = selectedContent;
    }
  } else if (previousSelectedNoteId) {
    selectedNoteId = null;
    lastCanvasText = "";
    if (canvas) canvas.innerText = "";
  }

  if (
    previousRightNoteId &&
    notes.some((note) => note.id === previousRightNoteId)
  ) {
    selectedRightNoteId = previousRightNoteId;
    const rightNote = notes.find((note) => note.id === selectedRightNoteId);
    const rightContent = buildEditorContent(rightNote.title, rightNote.content);
    if (rightCanvas) rightCanvas.innerText = rightContent;
    rightCanvasLastText = rightContent;
    if (rightCanvasTitle) rightCanvasTitle.textContent = rightNote.title;
  } else if (previousRightNoteId) {
    selectedRightNoteId = null;
    rightCanvasLastText = "";
    if (rightCanvas) rightCanvas.innerText = "";
    if (rightCanvasTitle) rightCanvasTitle.textContent = "";
  }

  renderNotes("");
  renderSearchResults();
  renderOpenFileTabs();
}

async function syncTodoFilesFromDisk() {
  const previousSelectedTodoFileId = selectedTodoFileId;
  const loadedTodoFiles = await loadTodoFilesFromDisk();
  todoFiles = loadedTodoFiles;

  openTodoFileIds = openTodoFileIds.filter((id) =>
    todoFiles.some((file) => file.id === id),
  );

  if (
    previousSelectedTodoFileId &&
    todoFiles.some((file) => file.id === previousSelectedTodoFileId)
  ) {
    selectedTodoFileId = previousSelectedTodoFileId;
  } else if (previousSelectedTodoFileId) {
    selectedTodoFileId = todoFiles[0]?.id ?? null;
  }

  renderTodoFilesSidebar();
  renderTodoItems();
  renderSearchResults();
  renderOpenFileTabs();
}

async function syncChangedDataVersions(nextVersions) {
  const normalizedVersions = {
    notes: Number(nextVersions?.notes) || 0,
    todos: Number(nextVersions?.todos) || 0,
  };
  const notesChanged = normalizedVersions.notes > knownDataVersions.notes;
  const todosChanged = normalizedVersions.todos > knownDataVersions.todos;

  knownDataVersions = normalizedVersions;

  if (notesChanged) {
    await syncNotesFromDisk();
  }

  if (todosChanged) {
    await syncTodoFilesFromDisk();
  }
}

electronAPI.onDataChanged?.((type, version) => {
  if (type === "notes") {
    knownDataVersions = {
      ...knownDataVersions,
      notes: Math.max(knownDataVersions.notes, Number(version) || 0),
    };
    void syncNotesFromDisk();
    return;
  }

  if (type === "todos") {
    knownDataVersions = {
      ...knownDataVersions,
      todos: Math.max(knownDataVersions.todos, Number(version) || 0),
    };
    void syncTodoFilesFromDisk();
  }
});

setInterval(() => {
  void electronAPI
    .getDataVersion?.()
    ?.then((versions) => syncChangedDataVersions(versions))
    ?.catch(() => {});
}, 500);

function renderNotes(filter = "") {
  noteList.innerHTML = "";

  const filteredNotes = notes.filter((n) =>
    n.title.toLowerCase().includes(filter.toLowerCase()),
  );

  // Group notes by folder
  const foldersInNotes = new Set(notes.map((n) => n.folder).filter(Boolean));
  const allFolders = Array.from(
    new Set([...foldersInNotes, ...emptyNotesFolders]),
  ).sort();

  const notesByFolder = {};
  allFolders.forEach((f) => {
    notesByFolder[f] = filteredNotes.filter((n) => n.folder === f);
  });

  const rootNotes = filteredNotes.filter((n) => !n.folder);

  const totalDisplayed =
    rootNotes.length +
    allFolders.reduce(
      (acc, f) => acc + (notesByFolder[f] ? notesByFolder[f].length : 0),
      0,
    );
  const hasEmptyFolders = allFolders.some(
    (f) =>
      emptyNotesFolders.has(f) &&
      (!filter || f.toLowerCase().includes(filter.toLowerCase())),
  );

  if (totalDisplayed === 0 && !hasEmptyFolders) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "No files.";
    noteList.appendChild(empty);
    return;
  }

  const fragment = document.createDocumentFragment();

  // Render Folders
  allFolders.forEach((folderName) => {
    const folderNotes = notesByFolder[folderName] || [];
    const isCollapsed = collapsedNotesFolders.has(folderName);

    if (
      filter &&
      folderNotes.length === 0 &&
      !folderName.toLowerCase().includes(filter.toLowerCase())
    ) {
      return;
    }

    const folderGroup = document.createElement("div");
    folderGroup.className = "folder-group";

    const isFolderActive = folderNotes.some(
      (note) => note.id === selectedNoteId,
    );
    const header = document.createElement("div");
    header.className = `folder-header${isFolderActive ? " active" : ""}`;
    header.setAttribute("role", "button");
    header.setAttribute("aria-expanded", !isCollapsed);

    const chevron = document.createElement("span");
    chevron.className = `chevron-icon${isCollapsed ? " collapsed" : ""}`;

    const folderIcon = document.createElement("span");
    folderIcon.className = "folder-icon";

    const title = document.createElement("span");
    title.className = "folder-title";
    title.textContent = folderName;

    if (folderName === renameFolderName) {
      title.setAttribute("contenteditable", "true");
      title.setAttribute("spellcheck", "false");
      title.classList.add("folder-title-editing");
      title.addEventListener("click", (e) => e.stopPropagation());
      const commitInline = async () => {
        if (!title.isConnected) return;
        const newName = title.textContent.trim();
        const captured = folderName;
        renameFolderName = null;
        title.removeAttribute("contenteditable");
        title.classList.remove("folder-title-editing");
        await commitFolderRename(captured, newName, "notes");
      };
      title.addEventListener("blur", commitInline);
      title.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          title.blur();
        } else if (e.key === "Escape") {
          e.preventDefault();
          renameFolderName = null;
          title.textContent = folderName;
          title.blur();
        }
      });
      requestAnimationFrame(() => {
        title.focus();
        selectElementText(title);
      });
    }

    const countBadge = document.createElement("span");
    countBadge.className = "folder-count-badge";
    countBadge.textContent = folderNotes.length;

    const actions = document.createElement("div");
    actions.className = "folder-actions";

    const plusBtn = document.createElement("button");
    plusBtn.className = "folder-action-button";
    plusBtn.title = "New note in folder";
    plusBtn.innerHTML = "+";
    plusBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      void createNewFile(folderName);
    });

    const renameBtn = document.createElement("button");
    renameBtn.className = "folder-action-button";
    renameBtn.title = "Rename folder";
    renameBtn.innerHTML = "✎";
    renameBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      void renameFolder(folderName, "notes");
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "folder-action-button danger";
    deleteBtn.title = "Delete folder";
    deleteBtn.innerHTML = "×";
    deleteBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      void deleteFolder(folderName, "notes");
    });

    actions.append(plusBtn, renameBtn, deleteBtn);
    header.append(chevron, folderIcon, title, countBadge, actions);

    header.addEventListener("click", () => {
      if (isCollapsed) {
        collapsedNotesFolders.delete(folderName);
      } else {
        collapsedNotesFolders.add(folderName);
      }
      renderNotes(filter);
    });

    header.addEventListener("dragover", (e) => {
      e.preventDefault();
      header.classList.add("drag-over");
    });
    header.addEventListener("dragleave", () => {
      header.classList.remove("drag-over");
    });
    header.addEventListener("drop", async (e) => {
      e.preventDefault();
      header.classList.remove("drag-over");
      const noteId = e.dataTransfer.getData("text/plain");
      if (!noteId) return;

      const note = notes.find((n) => n.id === noteId);
      if (note && note.folder !== folderName) {
        note.folder = folderName;
        emptyNotesFolders.delete(folderName);
        notes = await persistNotes(notes);
        renderNotes(filter);
        if (selectedNoteId === noteId) {
          selectNote(noteId);
        }
      }
    });

    folderGroup.appendChild(header);

    const contents = document.createElement("div");
    contents.className = `folder-contents${isCollapsed ? " collapsed" : ""}`;

    folderNotes.forEach((note) => {
      const item = document.createElement("div");
      item.className = `note-item${note.id === selectedNoteId ? " active" : ""}`;
      item.setAttribute("role", "listitem");
      item.draggable = true;
      item.innerHTML = `
        <div class="meta">
          <strong>${escapeHtml(note.title)}</strong>
          <span>${formatDate(note.updatedAt)}</span>
        </div>
      `;
      item.addEventListener("click", (event) => {
        handlePrimaryFileOpen(event, () => selectNote(note.id));
      });
      attachFileContextMenu(item, { type: "note", id: note.id });
      item.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("text/plain", note.id);
        e.dataTransfer.effectAllowed = "move";
      });
      contents.appendChild(item);
    });

    folderGroup.appendChild(contents);
    fragment.appendChild(folderGroup);
  });

  // Render root level notes
  rootNotes.forEach((note) => {
    const item = document.createElement("div");
    item.className = `note-item${note.id === selectedNoteId ? " active" : ""}`;
    item.setAttribute("role", "listitem");
    item.draggable = true;
    item.innerHTML = `
      <div class="meta">
        <strong>${escapeHtml(note.title)}</strong>
        <span>${formatDate(note.updatedAt)}</span>
      </div>
    `;
    item.addEventListener("click", (event) => {
      handlePrimaryFileOpen(event, () => selectNote(note.id));
    });
    attachFileContextMenu(item, { type: "note", id: note.id });
    item.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/plain", note.id);
      e.dataTransfer.effectAllowed = "move";
    });
    fragment.appendChild(item);
  });

  noteList.appendChild(fragment);
}

function renderOpenFileTabs() {
  if (!openFileTabs) return;
  openFileTabs.innerHTML = "";

  openNoteIds = openNoteIds.filter(
    (id) =>
      id === DEFAULT_NOTE_TAB_ID ||
      id === DRAFT_NOTE_TAB_ID ||
      notes.some((note) => note.id === id),
  );
  openTodoFileIds = openTodoFileIds.filter((id) =>
    todoFiles.some((file) => file.id === id),
  );

  if (
    activeView === "notes" &&
    selectedNoteId &&
    !openNoteIds.includes(selectedNoteId)
  ) {
    openNoteIds = [selectedNoteId];
  }

  if (
    activeView === "todo" &&
    selectedTodoFileId &&
    !openTodoFileIds.includes(selectedTodoFileId)
  ) {
    openTodoFileIds = [selectedTodoFileId];
  }

  const tabsContainer = document.createElement("div");
  tabsContainer.className = "open-file-tabs";

  const buildTab = (title, isActive, onClick, onClose) => {
    const tab = document.createElement("button");
    tab.type = "button";
    tab.className = `file-tab${isActive ? " active" : ""}`;
    tab.title = title;

    const label = document.createElement("span");
    label.textContent = title;
    label.className = "tab-label";

    const close = document.createElement("span");
    close.className = "tab-close-button";
    close.title = "Close";
    close.textContent = "×";
    close.addEventListener("click", (event) => {
      event.stopPropagation();
      onClose();
    });

    tab.addEventListener("click", onClick);
    tab.append(label, close);
    return tab;
  };

  if (activeView === "notes" && openNoteIds.length > 0) {
    openNoteIds.forEach((noteId, index) => {
      if (noteId === DEFAULT_NOTE_TAB_ID) {
        tabsContainer.appendChild(
          buildTab(
            "New page",
            index === activeNoteTabIndex,
            () =>
              showDefaultNotePage({
                preserveOpenTabs: true,
                tabIndex: index,
              }),
            () => closeNoteTab(index),
          ),
        );
        return;
      }

      if (noteId === DRAFT_NOTE_TAB_ID) {
        tabsContainer.appendChild(
          buildTab(
            "United",
            index === activeNoteTabIndex,
            () =>
              showDraftNotePage({
                preserveOpenTabs: true,
                tabIndex: index,
              }),
            () => closeNoteTab(index),
          ),
        );
        return;
      }

      const note = notes.find((item) => item.id === noteId);
      if (!note) return;

      tabsContainer.appendChild(
        buildTab(
          note.title,
          index === activeNoteTabIndex,
          () =>
            selectNote(note.id, {
              preserveOpenTabs: true,
              tabIndex: index,
            }),
          () => closeNoteTab(index),
        ),
      );
    });
  } else if (activeView === "todo" && openTodoFileIds.length > 0) {
    openTodoFileIds.forEach((todoFileId, index) => {
      const todoFile = todoFiles.find((file) => file.id === todoFileId);
      if (!todoFile) return;

      tabsContainer.appendChild(
        buildTab(
          todoFile.title,
          index === activeTodoTabIndex,
          () =>
            selectTodoFile(todoFile.id, {
              preserveOpenTabs: true,
              tabIndex: index,
            }),
          () => closeTodoTab(index),
        ),
      );
    });
  } else {
    const placeholder = document.createElement("span");
    placeholder.className = "file-tab empty";
    placeholder.textContent = "No file open";
    tabsContainer.appendChild(placeholder);
  }

  const addButton = document.createElement("button");
  addButton.type = "button";
  addButton.className = "tab-add-button";
  addButton.title = activeView === "todo" ? "New to-do" : "New note";
  addButton.innerHTML = '<span class="icon plus-icon"></span>';
  addButton.addEventListener("click", () => {
    if (activeView === "todo") {
      void createNewTodoFile();
      return;
    }

    openDraftNoteTab();
  });

  openFileTabs.append(tabsContainer, addButton);

  const defaultNotePageIsActive =
    activeView === "notes" &&
    !selectedNoteId &&
    openNoteIds[activeNoteTabIndex] === DEFAULT_NOTE_TAB_ID;
  const targetSlot =
    activeView === "todo"
      ? todoTabsSlot
      : defaultNotePageIsActive
        ? welcomeTabsSlot
        : editorTabsSlot;
  if (targetSlot && openFileTabs.parentElement !== targetSlot) {
    targetSlot.appendChild(openFileTabs);
  }
}

function renderTodoFilesSidebar() {
  if (!todoSidebarList) return;

  todoSidebarList.innerHTML = "";

  const filteredTodos = todoFiles;

  // Group todos by folder
  const foldersInTodos = new Set(
    todoFiles.map((t) => t.folder).filter(Boolean),
  );
  const allFolders = Array.from(
    new Set([...foldersInTodos, ...emptyTodoFolders]),
  ).sort();

  const todosByFolder = {};
  allFolders.forEach((f) => {
    todosByFolder[f] = filteredTodos.filter((t) => t.folder === f);
  });

  const rootTodos = filteredTodos.filter((t) => !t.folder);

  if (todoFiles.length === 0 && emptyTodoFolders.size === 0) {
    const empty = document.createElement("p");
    empty.className = "todo-sidebar-empty";
    empty.textContent = "No to-do files.";
    todoSidebarList.appendChild(empty);
    return;
  }

  const fragment = document.createDocumentFragment();

  // Render Folders
  allFolders.forEach((folderName) => {
    const folderTodos = todosByFolder[folderName] || [];
    const isCollapsed = collapsedTodoFolders.has(folderName);

    const folderGroup = document.createElement("div");
    folderGroup.className = "folder-group";

    const isFolderActive = folderTodos.some(
      (todoFile) => todoFile.id === selectedTodoFileId,
    );
    const header = document.createElement("div");
    header.className = `folder-header${isFolderActive ? " active" : ""}`;
    header.setAttribute("role", "button");
    header.setAttribute("aria-expanded", !isCollapsed);

    const chevron = document.createElement("span");
    chevron.className = `chevron-icon${isCollapsed ? " collapsed" : ""}`;

    const folderIcon = document.createElement("span");
    folderIcon.className = "folder-icon";

    const title = document.createElement("span");
    title.className = "folder-title";
    title.textContent = folderName;

    if (folderName === renameFolderName) {
      title.setAttribute("contenteditable", "true");
      title.setAttribute("spellcheck", "false");
      title.classList.add("folder-title-editing");
      title.addEventListener("click", (e) => e.stopPropagation());
      const commitInline = async () => {
        if (!title.isConnected) return;
        const newName = title.textContent.trim();
        const captured = folderName;
        renameFolderName = null;
        title.removeAttribute("contenteditable");
        title.classList.remove("folder-title-editing");
        await commitFolderRename(captured, newName, "todo");
      };
      title.addEventListener("blur", commitInline);
      title.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          title.blur();
        } else if (e.key === "Escape") {
          e.preventDefault();
          renameFolderName = null;
          title.textContent = folderName;
          title.blur();
        }
      });
      requestAnimationFrame(() => {
        title.focus();
        selectElementText(title);
      });
    }

    const countBadge = document.createElement("span");
    countBadge.className = "folder-count-badge";
    countBadge.textContent = folderTodos.length;

    const actions = document.createElement("div");
    actions.className = "folder-actions";

    const plusBtn = document.createElement("button");
    plusBtn.className = "folder-action-button";
    plusBtn.title = "New to-do file in folder";
    plusBtn.innerHTML = "+";
    plusBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      void createNewTodoFile(folderName);
    });

    const renameBtn = document.createElement("button");
    renameBtn.className = "folder-action-button";
    renameBtn.title = "Rename folder";
    renameBtn.innerHTML = "✎";
    renameBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      void renameFolder(folderName, "todo");
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "folder-action-button danger";
    deleteBtn.title = "Delete folder";
    deleteBtn.innerHTML = "×";
    deleteBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      void deleteFolder(folderName, "todo");
    });

    actions.append(plusBtn, renameBtn, deleteBtn);
    header.append(chevron, folderIcon, title, countBadge, actions);

    header.addEventListener("click", () => {
      if (isCollapsed) {
        collapsedTodoFolders.delete(folderName);
      } else {
        collapsedTodoFolders.add(folderName);
      }
      renderTodoFilesSidebar();
    });

    header.addEventListener("dragover", (e) => {
      e.preventDefault();
      header.classList.add("drag-over");
    });
    header.addEventListener("dragleave", () => {
      header.classList.remove("drag-over");
    });
    header.addEventListener("drop", async (e) => {
      e.preventDefault();
      header.classList.remove("drag-over");
      const todoId = e.dataTransfer.getData("text/plain");
      if (!todoId) return;

      const todoFile = todoFiles.find((t) => t.id === todoId);
      if (todoFile && todoFile.folder !== folderName) {
        todoFile.folder = folderName;
        emptyTodoFolders.delete(folderName);
        todoFiles = await persistTodoFiles(todoFiles);
        renderTodoFilesSidebar();
        if (selectedTodoFileId === todoId) {
          selectTodoFile(todoId);
        }
      }
    });

    folderGroup.appendChild(header);

    const contents = document.createElement("div");
    contents.className = `folder-contents${isCollapsed ? " collapsed" : ""}`;

    folderTodos.forEach((todoFile) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = `todo-sidebar-item${todoFile.id === selectedTodoFileId ? " active" : ""}`;
      item.draggable = true;
      item.innerHTML = `
        <strong>${escapeHtml(todoFile.title)}</strong>
        <span>${todoFile.items?.length || 0} tasks</span>
      `;
      item.addEventListener("click", (event) => {
        handlePrimaryFileOpen(event, () => selectTodoFile(todoFile.id));
      });
      attachFileContextMenu(item, { type: "todo", id: todoFile.id });
      item.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("text/plain", todoFile.id);
        e.dataTransfer.effectAllowed = "move";
      });
      contents.appendChild(item);
    });

    folderGroup.appendChild(contents);
    fragment.appendChild(folderGroup);
  });

  // Render root level todos
  rootTodos.forEach((todoFile) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = `todo-sidebar-item${todoFile.id === selectedTodoFileId ? " active" : ""}`;
    item.draggable = true;
    item.innerHTML = `
      <strong>${escapeHtml(todoFile.title)}</strong>
      <span>${todoFile.items?.length || 0} tasks</span>
    `;
    item.addEventListener("click", (event) => {
      handlePrimaryFileOpen(event, () => selectTodoFile(todoFile.id));
    });
    attachFileContextMenu(item, { type: "todo", id: todoFile.id });
    item.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/plain", todoFile.id);
      e.dataTransfer.effectAllowed = "move";
    });
    fragment.appendChild(item);
  });

  todoSidebarList.appendChild(fragment);

  if (renameTodoFileButton) {
    renameTodoFileButton.disabled = !selectedTodoFileId;
  }
  if (deleteTodoFileButton) {
    deleteTodoFileButton.disabled = !selectedTodoFileId;
  }
  if (moveTodoFileButton) {
    moveTodoFileButton.disabled = !selectedTodoFileId;
  }
}

function renderTagsTodoFileList() {
  if (!tagsTodoFileList) return;

  tagsTodoFileList.innerHTML = "";
  if (todoFiles.length === 0) {
    const empty = document.createElement("p");
    empty.className = "todo-sidebar-empty";
    empty.textContent = "No to-do files.";
    tagsTodoFileList.appendChild(empty);
    return;
  }

  ensureSelectedTagTodoFileId();
  const fragment = document.createDocumentFragment();
  todoFiles.forEach((todoFile) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = `todo-sidebar-item${
      todoFile.id === selectedTagTodoFileId ? " active" : ""
    }`;
    item.innerHTML = `
      <strong>${escapeHtml(todoFile.title)}</strong>
      <span>${todoFile.items?.length || 0} tasks</span>
    `;
    item.addEventListener("click", () => {
      selectedTagTodoFileId = todoFile.id;
      renderTagsTodoFileList();
      renderTagSettings();
    });
    fragment.appendChild(item);
  });

  tagsTodoFileList.appendChild(fragment);
}

function normalizeTodoText(text) {
  return String(text ?? "")
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function startTodoTextEdit(todoId, label) {
  const originalText = label.textContent || "";
  const input = document.createElement("input");
  input.type = "text";
  input.className = "todo-edit-input";
  input.value = originalText;
  input.setAttribute("spellcheck", "false");

  const finishEdit = async (save = true) => {
    const nextValue = save ? normalizeTodoText(input.value) : originalText;
    if (save && nextValue) {
      await updateTodoText(todoId, nextValue);
    } else if (!save) {
      label.textContent = originalText;
      input.replaceWith(label);
    } else {
      label.textContent = originalText;
      input.replaceWith(label);
    }
  };

  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void finishEdit(true);
    } else if (event.key === "Escape") {
      event.preventDefault();
      void finishEdit(false);
    }
  });

  input.addEventListener(
    "blur",
    () => {
      void finishEdit(true);
    },
    { once: true },
  );

  label.replaceWith(input);
  input.focus();
  input.select();
}

async function updateTodoText(todoId, text) {
  if (!selectedTodoFileId) return;

  const safeText = normalizeTodoText(text);
  if (!safeText) return;

  todoFiles = await persistTodoFiles(
    todoFiles.map((todoFile) =>
      todoFile.id !== selectedTodoFileId
        ? todoFile
        : {
            ...todoFile,
            items: todoFile.items.map((item) =>
              item.id === todoId ? { ...item, text: safeText } : item,
            ),
            updatedAt: new Date().toISOString(),
          },
    ),
  );
  renderTodoItems();
  renderTodoFilesSidebar();
}

function renderTodoItems() {
  if (!todoList || !todoViewTitle) return;

  const selectedFile = todoFiles.find(
    (todoFile) => todoFile.id === selectedTodoFileId,
  );
  if (!selectedFile) {
    todoViewTitle.textContent = "Tasks";
    todoViewTitle.removeAttribute("contenteditable");
    todoList.innerHTML = "";
    if (todoWelcome) todoWelcome.hidden = false;
    if (todoShell) todoShell.hidden = true;
    return;
  }

  if (todoWelcome) todoWelcome.hidden = true;
  if (todoShell) todoShell.hidden = false;

  todoViewTitle.textContent = selectedFile.title;
  todoViewTitle.setAttribute("contenteditable", "true");
  todoViewTitle.setAttribute("spellcheck", "false");
  todoList.innerHTML = "";

  if (!selectedFile.items?.length) {
    const empty = document.createElement("li");
    empty.className = "todo-empty";
    empty.textContent = "No tasks in this list.";
    todoList.appendChild(empty);
    return;
  }

  const fragment = document.createDocumentFragment();
  selectedFile.items.forEach((item) => {
    const todoItem = document.createElement("li");
    todoItem.dataset.todoId = item.id;
    const priority = normalizeTodoPriority(item.priority);
    todoItem.className = [
      "todo-item",
      item.completed ? "done" : "",
      priority ? `priority-${priority}` : "",
    ]
      .filter(Boolean)
      .join(" ");

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = Boolean(item.completed);
    checkbox.addEventListener("change", () => void toggleTodo(item.id));

    const label = document.createElement("span");
    label.className = "todo-text";
    label.textContent = item.text;
    label.addEventListener("dblclick", () => startTodoTextEdit(item.id, label));

    const priorityBadge = priority
      ? (() => {
          const badge = document.createElement("span");
          badge.className = `todo-priority-badge priority-${priority}`;
          badge.textContent =
            priority === "high"
              ? "High"
              : priority === "low"
                ? "Low"
                : "Medium";
          badge.title = "Click to remove priority";
          badge.style.cursor = "pointer";
          badge.addEventListener("click", (event) => {
            event.stopPropagation();
            event.preventDefault();
            void removeTodoBadge(item.id, "priority");
          });
          return badge;
        })()
      : null;

    const dueBadge = item.dueTime
      ? (() => {
          const badge = document.createElement("span");
          badge.className = "todo-due-badge";
          badge.textContent = item.dueTime;
          badge.title = "Click to remove due time";
          badge.style.cursor = "pointer";
          badge.addEventListener("click", (event) => {
            event.stopPropagation();
            event.preventDefault();
            void removeTodoBadge(item.id, "due");
          });
          return badge;
        })()
      : null;

    const tagBadges = Array.isArray(item.tags)
      ? item.tags.filter(Boolean).map((tagValue) => {
          const label =
            String(tagValue).split(":").pop().trim() || String(tagValue);
          const badge = document.createElement("span");
          badge.className = "todo-tag-badge";
          const dot = document.createElement("span");
          dot.className = "tag-color-dot";
          dot.style.backgroundColor = findTagColorByValue(tagValue);
          const text = document.createElement("span");
          text.textContent = label;
          badge.append(dot, text);
          badge.title = "Click to remove tag";
          badge.style.cursor = "pointer";
          badge.addEventListener("click", (event) => {
            event.stopPropagation();
            event.preventDefault();
            void removeTodoBadge(item.id, "tag", tagValue);
          });
          return badge;
        })
      : [];

    const tagBadgeRow = tagBadges.length
      ? (() => {
          const row = document.createElement("div");
          row.className = "todo-tag-badge-row";
          tagBadges.forEach((badge) => row.appendChild(badge));
          return row;
        })()
      : null;

    const menuButton = document.createElement("button");
    menuButton.type = "button";
    menuButton.className = "todo-menu-button";
    menuButton.title = "More actions";
    menuButton.setAttribute("aria-label", "More actions");

    const menuIcon = document.createElement("img");
    menuIcon.src = new URL(
      "./Icos/three-dots-vertical.svg",
      import.meta.url,
    ).href;
    menuIcon.alt = "";
    menuIcon.className = "todo-menu-icon";
    menuButton.appendChild(menuIcon);

    menuButton.addEventListener("click", (event) => {
      event.stopPropagation();
      showTodoItemContextMenu(event, { todoId: item.id });
    });

    todoItem.append(
      checkbox,
      label,
      ...(priorityBadge ? [priorityBadge] : []),
      ...(dueBadge ? [dueBadge] : []),
      menuButton,
      ...(tagBadgeRow ? [tagBadgeRow] : []),
    );
    fragment.appendChild(todoItem);
  });

  todoList.appendChild(fragment);
}

function findSelectedTodoItem(todoId) {
  if (!selectedTodoFileId) return null;
  const todoFile = todoFiles.find(
    (todoFile) => todoFile.id === selectedTodoFileId,
  );
  return todoFile?.items.find((item) => item.id === todoId) ?? null;
}

async function moveTodoItem(todoId, direction) {
  if (!selectedTodoFileId) return;

  todoFiles = await persistTodoFiles(
    todoFiles.map((todoFile) => {
      if (todoFile.id !== selectedTodoFileId) return todoFile;
      const index = todoFile.items.findIndex((item) => item.id === todoId);
      if (index === -1) return todoFile;
      const nextIndex = direction === "up" ? index - 1 : index + 1;
      if (nextIndex < 0 || nextIndex >= todoFile.items.length) return todoFile;
      const newItems = [...todoFile.items];
      const [movedItem] = newItems.splice(index, 1);
      newItems.splice(nextIndex, 0, movedItem);
      return {
        ...todoFile,
        items: newItems,
        updatedAt: new Date().toISOString(),
      };
    }),
  );

  renderTodoItems();
  renderTodoFilesSidebar();
}

async function duplicateTodoItem(todoId) {
  if (!selectedTodoFileId) return;

  todoFiles = await persistTodoFiles(
    todoFiles.map((todoFile) => {
      if (todoFile.id !== selectedTodoFileId) return todoFile;
      const index = todoFile.items.findIndex((item) => item.id === todoId);
      if (index === -1) return todoFile;
      const item = todoFile.items[index];
      const duplicate = {
        ...item,
        id: createFileId(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const newItems = [...todoFile.items];
      newItems.splice(index + 1, 0, duplicate);
      return {
        ...todoFile,
        items: newItems,
        updatedAt: new Date().toISOString(),
      };
    }),
  );

  renderTodoItems();
  renderTodoFilesSidebar();
}

function findTodoLabelElement(todoId) {
  if (!todoList) return null;
  return todoList.querySelector(
    `li.todo-item[data-todo-id="${todoId}"] .todo-text`,
  );
}

function editTodoItem(todoId) {
  const label = findTodoLabelElement(todoId);
  if (!label) return;
  startTodoTextEdit(todoId, label);
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

async function updateTodoPriority(todoId, priority) {
  if (!selectedTodoFileId) return;

  const normalizedPriority = normalizeTodoPriority(priority);
  todoFiles = await persistTodoFiles(
    todoFiles.map((todoFile) =>
      todoFile.id !== selectedTodoFileId
        ? todoFile
        : {
            ...todoFile,
            items: todoFile.items.map((item) => {
              if (item.id !== todoId) return item;

              const nextItem = { ...item };
              if (normalizedPriority) {
                nextItem.priority = normalizedPriority;
              } else {
                delete nextItem.priority;
              }

              return nextItem;
            }),
            updatedAt: new Date().toISOString(),
          },
    ),
  );
  renderTodoItems();
  renderTodoFilesSidebar();
}

async function updateTodoDueTime(todoId, dueTime) {
  if (!selectedTodoFileId) return;

  const nextDueTime = String(dueTime ?? "").trim();
  todoFiles = await persistTodoFiles(
    todoFiles.map((todoFile) =>
      todoFile.id !== selectedTodoFileId
        ? todoFile
        : {
            ...todoFile,
            items: todoFile.items.map((item) => {
              if (item.id !== todoId) return item;

              const nextItem = { ...item };
              if (nextDueTime) {
                nextItem.dueTime = nextDueTime;
              } else {
                delete nextItem.dueTime;
              }

              return nextItem;
            }),
            updatedAt: new Date().toISOString(),
          },
    ),
  );
  renderTodoItems();
  renderTodoFilesSidebar();
}

async function removeTodoBadge(todoId, type, value = null) {
  if (!selectedTodoFileId || !todoId) return;

  todoFiles = await persistTodoFiles(
    todoFiles.map((todoFile) =>
      todoFile.id !== selectedTodoFileId
        ? todoFile
        : {
            ...todoFile,
            items: todoFile.items.map((item) => {
              if (item.id !== todoId) return item;

              const nextItem = { ...item };

              if (type === "priority") {
                delete nextItem.priority;
              } else if (type === "due") {
                delete nextItem.dueTime;
              } else if (type === "tag" && value) {
                const currentTags = Array.isArray(nextItem.tags)
                  ? nextItem.tags.filter(Boolean)
                  : [];
                const nextTags = currentTags.filter((tag) => tag !== value);
                if (nextTags.length) {
                  nextItem.tags = nextTags;
                } else {
                  delete nextItem.tags;
                }
              }

              return nextItem;
            }),
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

async function updateTodoTags(todoId, tagValue) {
  if (!selectedTodoFileId || !todoId) return;

  todoFiles = await persistTodoFiles(
    todoFiles.map((todoFile) =>
      todoFile.id !== selectedTodoFileId
        ? todoFile
        : {
            ...todoFile,
            items: todoFile.items.map((item) => {
              if (item.id !== todoId) return item;

              const currentTags = Array.isArray(item.tags)
                ? item.tags.filter(Boolean)
                : [];
              if (!tagValue) {
                const { tags, ...itemWithoutTags } = item;
                return itemWithoutTags;
              }

              const hasTag = currentTags.includes(tagValue);
              const nextTags = hasTag
                ? currentTags.filter((tag) => tag !== tagValue)
                : [...currentTags, tagValue];

              return { ...item, tags: nextTags };
            }),
            updatedAt: new Date().toISOString(),
          },
    ),
  );
  renderTodoItems();
  renderTodoFilesSidebar();
}

async function createNewTodoFile(folderName = null) {
  const todoFile = createTodoDocument("United");
  if (folderName) {
    todoFile.folder = folderName;
    emptyTodoFolders.delete(folderName);
  }
  todoFiles = await persistTodoFiles([todoFile, ...todoFiles]);
  openTodoFileIds = [todoFile.id];
  activeTodoTabIndex = 0;
  selectedTodoFileId = todoFile.id;
  renderTodoFilesSidebar();
  renderTodoItems();
  renderOpenFileTabs();
  if (todoInput) todoInput.value = "";
  focusTodoTitle();
}

function selectTodoFile(
  todoFileId,
  { preserveOpenTabs = false, tabIndex = null } = {},
) {
  const todoFile = todoFiles.find((file) => file.id === todoFileId);
  if (!todoFile) return;

  if (preserveOpenTabs) {
    if (!openTodoFileIds.includes(todoFile.id)) {
      openTodoFileIds = [...openTodoFileIds, todoFile.id];
    }
    if (tabIndex !== null) {
      activeTodoTabIndex = tabIndex;
    }
  } else {
    openTodoFileIds = [todoFile.id];
    activeTodoTabIndex = 0;
  }

  selectedTodoFileId = todoFileId;
  renderTodoFilesSidebar();
  renderTodoItems();
  renderOpenFileTabs();
  persistUiState({ selectedTodoFileId: todoFileId, activeView: "todo" });
}

async function renameTodoFile() {
  if (!selectedTodoFileId) return;

  const selectedFile = todoFiles.find(
    (todoFile) => todoFile.id === selectedTodoFileId,
  );
  if (!selectedFile) return;

  showTextPrompt(
    "Rename To-do",
    "New to-do file name:",
    selectedFile.title,
    async (newName) => {
      if (!newName) return;
      todoFiles = await persistTodoFiles(
        todoFiles.map((todoFile) =>
          todoFile.id === selectedTodoFileId
            ? {
                ...todoFile,
                title: newName,
                updatedAt: new Date().toISOString(),
              }
            : todoFile,
        ),
      );
      renderTodoFilesSidebar();
      renderTodoItems();
    },
  );
}

function getSelectedTodoFile() {
  return todoFiles.find((todoFile) => todoFile.id === selectedTodoFileId);
}

function normalizeTodoTitle(title) {
  return String(title ?? "")
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function updateSelectedTodoTitle(title) {
  if (!selectedTodoFileId) return;

  const safeTitle = normalizeTodoTitle(title) || "United";
  todoFiles = todoFiles.map((todoFile) =>
    todoFile.id === selectedTodoFileId
      ? { ...todoFile, title: safeTitle, updatedAt: new Date().toISOString() }
      : todoFile,
  );
}

const saveTodoTitleDebounced = debounce(async () => {
  if (!selectedTodoFileId) return;

  todoFiles = await persistTodoFiles(todoFiles);
  renderTodoFilesSidebar();
  renderOpenFileTabs();
}, 120);

async function deleteTodoFile() {
  if (!selectedTodoFileId) return;
  if (!confirm("Delete the selected to-do file?")) return;

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
  if (tagSettingsView) tagSettingsView.hidden = true;
  notesSidebar.hidden = false;
  todoSidebar.hidden = true;
  if (tagsSidebar) tagsSidebar.hidden = true;
}

function showEditor() {
  welcome.hidden = true;
  editorView.hidden = false;
  todoView.hidden = true;
  if (tagSettingsView) tagSettingsView.hidden = true;
  notesSidebar.hidden = isSoloWindow ? true : false;
  todoSidebar.hidden = true;
  if (tagsSidebar) tagsSidebar.hidden = true;

  if (editorView) {
    editorView.hidden = false;
    editorView.style.display = "grid";
    editorView.style.visibility = "visible";
  }

  if (canvas) {
    canvas.hidden = false;
    canvas.style.display = "block";
    canvas.style.visibility = "visible";
    canvas.style.minHeight = "100%";
  }

  if (selectedRightNoteId) {
    editorView.classList.add("split");
    if (rightEditorColumn) rightEditorColumn.hidden = false;
  } else {
    editorView.classList.remove("split");
    if (rightEditorColumn) rightEditorColumn.hidden = true;
  }
}

function showTodoView() {
  activeView = "todo";
  welcome.hidden = true;
  editorView.hidden = true;
  todoView.hidden = false;
  if (tagSettingsView) tagSettingsView.hidden = true;
  notesSidebar.hidden = true;
  todoSidebar.hidden = isSoloWindow ? true : false;
  if (tagsSidebar) tagsSidebar.hidden = true;
  renderTodoFilesSidebar();
  renderTodoItems();
  railButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.view === "todo");
  });
  updateRailInk("todo");
  renderOpenFileTabs();
  persistUiState({ activeView: "todo" });
}

function showTagSettingsView() {
  activeView = "tags";
  welcome.hidden = true;
  editorView.hidden = true;
  todoView.hidden = true;
  if (tagSettingsView) tagSettingsView.hidden = false;
  notesSidebar.hidden = true;
  todoSidebar.hidden = true;
  if (tagsSidebar) tagsSidebar.hidden = isSoloWindow ? true : false;
  railButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.view === "tags");
  });
  updateRailInk("tags");
  selectedTagTodoFileId = selectedTodoFileId || todoFiles[0]?.id || null;
  renderTagsTodoFileList();
  renderTagSettings();
  persistUiState({ activeView: "tags" });
}

function showNotesView() {
  activeView = "notes";
  railButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.view === "notes");
  });
  updateRailInk("notes");

  if (selectedNoteId || selectedRightNoteId || isSoloWindow) {
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
  if (deleteButton) deleteButton.disabled = true;
  if (renameButton) renameButton.disabled = true;
  if (moveNoteButton) moveNoteButton.disabled = true;
  showWelcome();
  renderOpenFileTabs();
  persistUiState({ selectedNoteId: null, activeView: "notes" });
}

function showDefaultNotePage({
  preserveOpenTabs = false,
  tabIndex = null,
} = {}) {
  activeView = "notes";
  selectedNoteId = null;

  if (preserveOpenTabs) {
    if (!openNoteIds.includes(DEFAULT_NOTE_TAB_ID)) {
      openNoteIds = [...openNoteIds, DEFAULT_NOTE_TAB_ID];
    }
    if (tabIndex !== null) {
      activeNoteTabIndex = tabIndex;
    }
  } else {
    openNoteIds = [DEFAULT_NOTE_TAB_ID];
    activeNoteTabIndex = 0;
  }

  if (canvas) {
    canvas.innerText = "";
  }
  lastCanvasText = "";
  if (deleteButton) deleteButton.disabled = true;
  if (renameButton) renameButton.disabled = true;
  if (moveNoteButton) moveNoteButton.disabled = true;
  showWelcome();
  renderNotes("");
  renderOpenFileTabs();
  persistUiState({ selectedNoteId: null, activeView: "notes" });
}

function openDefaultNoteTab() {
  const existingIndex = openNoteIds.indexOf(DEFAULT_NOTE_TAB_ID);
  if (existingIndex >= 0) {
    showDefaultNotePage({
      preserveOpenTabs: true,
      tabIndex: existingIndex,
    });
    return;
  }

  openNoteIds = [...openNoteIds, DEFAULT_NOTE_TAB_ID];
  showDefaultNotePage({
    preserveOpenTabs: true,
    tabIndex: openNoteIds.length - 1,
  });
}

function showDraftNotePage({ preserveOpenTabs = false, tabIndex = null } = {}) {
  activeView = "notes";
  selectedNoteId = null;

  if (preserveOpenTabs) {
    if (!openNoteIds.includes(DRAFT_NOTE_TAB_ID)) {
      openNoteIds = [...openNoteIds, DRAFT_NOTE_TAB_ID];
    }
    if (tabIndex !== null) {
      activeNoteTabIndex = tabIndex;
    }
  } else {
    openNoteIds = [DRAFT_NOTE_TAB_ID];
    activeNoteTabIndex = 0;
  }

  const initialContent = draftNoteContent || "United";
  if (canvas) {
    canvas.hidden = false;
    canvas.innerText = initialContent;
    canvas.style.display = "block";
  }
  lastCanvasText = initialContent;
  if (deleteButton) deleteButton.disabled = true;
  if (renameButton) renameButton.disabled = true;
  if (moveNoteButton) moveNoteButton.disabled = true;
  showEditor();
  renderNotes("");
  renderOpenFileTabs();
  persistUiState({ selectedNoteId: null, activeView: "notes" });
  requestAnimationFrame(() => {
    canvas?.focus();
    selectTitleText();
  });
}

function openDraftNoteTab() {
  const existingIndex = openNoteIds.indexOf(DRAFT_NOTE_TAB_ID);
  if (existingIndex >= 0) {
    showDraftNotePage({
      preserveOpenTabs: true,
      tabIndex: existingIndex,
    });
    return;
  }

  draftNoteContent = "United";
  openNoteIds = openNoteIds.filter((id) => id !== DEFAULT_NOTE_TAB_ID);
  openNoteIds = [...openNoteIds, DRAFT_NOTE_TAB_ID];
  showDraftNotePage({
    preserveOpenTabs: true,
    tabIndex: openNoteIds.length - 1,
  });
}

async function promoteDraftNoteToFile(title, content) {
  const nextNotes = addNote(notes, title, content);
  const newNote = nextNotes[0];
  notes = await persistNotes(nextNotes);
  selectedNoteId = newNote.id;
  draftNoteContent = "";
  openNoteIds = openNoteIds.map((id) =>
    id === DRAFT_NOTE_TAB_ID ? newNote.id : id,
  );
  activeNoteTabIndex = openNoteIds.indexOf(newNote.id);
  selectNote(newNote.id, {
    preserveOpenTabs: true,
    tabIndex: activeNoteTabIndex,
  });
}

function resetTodoSelection() {
  selectedTodoFileId = null;
  if (todoInput) todoInput.value = "";
  showTodoView();
  persistUiState({ selectedTodoFileId: null, activeView: "todo" });
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

function selectElementText(element) {
  if (!element) return;

  const selection = window.getSelection();
  if (!selection) {
    element.focus();
    return;
  }

  const range = document.createRange();
  range.selectNodeContents(element);
  selection.removeAllRanges();
  selection.addRange(range);
  element.focus();
}

function focusTodoTitle() {
  if (!todoViewTitle) return;

  requestAnimationFrame(() => {
    selectElementText(todoViewTitle);
  });
}

function selectNote(
  noteId,
  { preserveOpenTabs = false, tabIndex = null } = {},
) {
  const note = notes.find((item) => item.id === noteId);
  if (!note) return;

  if (preserveOpenTabs) {
    if (!openNoteIds.includes(note.id)) {
      openNoteIds = [...openNoteIds, note.id];
    }
    if (tabIndex !== null) {
      activeNoteTabIndex = tabIndex;
    }
  } else {
    openNoteIds = [note.id];
    activeNoteTabIndex = 0;
  }

  selectedNoteId = note.id;
  const initialContent = buildEditorContent(note.title, note.content);
  if (canvas) {
    canvas.hidden = false;
    canvas.innerText = initialContent;
    canvas.style.display = "block";
  }
  lastCanvasText = initialContent;
  if (deleteButton) deleteButton.disabled = false;
  if (renameButton) renameButton.disabled = false;
  if (moveNoteButton) moveNoteButton.disabled = false;
  showEditor();
  requestAnimationFrame(() => {
    showEditor();
    if (canvas) {
      canvas.scrollTop = 0;
      canvas.focus();
    }
  });
  renderNotes("");
  renderOpenFileTabs();
  persistUiState({ selectedNoteId: note.id, activeView: "notes" });
}

const saveCanvasDebounced = debounce(async () => {
  if (
    !selectedNoteId &&
    openNoteIds[activeNoteTabIndex] === DRAFT_NOTE_TAB_ID
  ) {
    const editorText = lastCanvasText.replace(/\u00A0/g, " ");
    const { title, content } = extractTitleAndContent(editorText);
    draftNoteContent = editorText || "United";
    if (title !== "United") {
      await promoteDraftNoteToFile(title, content);
    }
    return;
  }

  if (!selectedNoteId) return;
  const editorText = lastCanvasText.replace(/\u00A0/g, " ");
  const { title, content } = extractTitleAndContent(editorText);
  notes = updateNote(notes, selectedNoteId, { title, content });
  await persistNotes(notes);
  renderNotes("");
}, 120);

const saveRightCanvasDebounced = debounce(async () => {
  if (!selectedRightNoteId) return;
  const editorText = rightCanvasLastText.replace(/\u00A0/g, " ");
  const { title, content } = extractTitleAndContent(editorText);
  notes = updateNote(notes, selectedRightNoteId, { title, content });
  await persistNotes(notes);
  renderNotes("");
  if (rightCanvasTitle) rightCanvasTitle.textContent = title;
}, 120);

async function createNewFile(folderName = null, { appendTab = false } = {}) {
  notes = addNote(notes, "United", "");
  if (folderName) {
    notes[0].folder = folderName;
    emptyNotesFolders.delete(folderName);
  }
  selectedNoteId = notes[0].id;
  notes = await persistNotes(notes);
  if (appendTab) {
    openNoteIds = openNoteIds.filter((id) => id !== DEFAULT_NOTE_TAB_ID);
    openNoteIds = [...openNoteIds, selectedNoteId];
    activeNoteTabIndex = openNoteIds.length - 1;
  } else {
    openNoteIds = [selectedNoteId];
    activeNoteTabIndex = 0;
  }
  selectNote(selectedNoteId, {
    preserveOpenTabs: appendTab,
    tabIndex: appendTab ? activeNoteTabIndex : null,
  });
  focusCanvasTitle();
}

async function renameSelected() {
  if (!selectedNoteId) return;
  const note = notes.find((n) => n.id === selectedNoteId);
  showTextPrompt(
    "Rename note",
    "New file name:",
    note.title,
    async (newName) => {
      if (!newName) return;
      notes = updateNote(notes, selectedNoteId, {
        title: newName,
        content: note.content,
      });
      notes = await persistNotes(notes);
      selectNote(selectedNoteId);
    },
  );
}

async function deleteSelectedNote() {
  if (!selectedNoteId) return;
  if (!confirm("Delete the selected file?")) return;
  notes = deleteNote(notes, selectedNoteId);
  notes = await persistNotes(notes);
  resetSelection();
  renderNotes();
}

newButton?.addEventListener("click", () => {
  void createNewFile();
});
panelNewButton?.addEventListener("click", () => {
  void createNewFile();
});
deleteButton?.addEventListener("click", () => {
  void deleteSelectedNote();
});
renameButton?.addEventListener("click", () => {
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

function handleContextMenuClick(event) {
  const item = event.target.closest(".context-menu-item");
  if (!item || (!contextMenuTarget && !todoContextMenuTarget)) return;

  const action = item.dataset.action;
  const fileMenuTarget = contextMenuTarget ? { ...contextMenuTarget } : null;
  const todoMenuTarget = todoContextMenuTarget
    ? { ...todoContextMenuTarget }
    : null;
  hideContextMenu();
  hideTodoItemContextMenu();

  if (fileMenuTarget) {
    const { type } = fileMenuTarget;
    if (action === "open-tab") {
      openContextTargetInNewTab(fileMenuTarget);
      return;
    }

    if (action === "open-right") {
      openContextTargetToRight(fileMenuTarget);
      return;
    }

    if (action === "open-window") {
      void openContextTargetInNewWindow(fileMenuTarget);
      return;
    }

    if (action === "copy") {
      void copyContextFile(fileMenuTarget);
      return;
    }

    if (action === "move") {
      selectContextTarget(fileMenuTarget);
      openMoveDialog(type === "note" ? "notes" : "todo");
      return;
    }

    if (action === "copy-path") {
      void copyContextFilePath(fileMenuTarget);
      return;
    }

    if (action === "show-explorer") {
      void showContextFileInFolder(fileMenuTarget);
      return;
    }

    if (type === "note") {
      if (action === "rename") void renameSelected();
      if (action === "delete") void deleteSelectedNote();
    } else {
      if (action === "rename") void renameTodoFile();
      if (action === "delete") void deleteTodoFile();
    }
    return;
  }

  if (todoMenuTarget) {
    const todoId = todoMenuTarget.todoId;
    if (action === "move-up") {
      void moveTodoItem(todoId, "up");
      return;
    }
    if (action === "move-down") {
      void moveTodoItem(todoId, "down");
      return;
    }
    if (action === "duplicate") {
      void duplicateTodoItem(todoId);
      return;
    }
    if (
      action === "priority-high" ||
      action === "priority-medium" ||
      action === "priority-low" ||
      action === "priority-none"
    ) {
      const priority =
        action === "priority-none" ? null : action.replace("priority-", "");
      void updateTodoPriority(todoId, priority);
      return;
    }
    if (action === "toggle-tag") {
      const tagValue = item.dataset.tag;
      void updateTodoTags(todoId, tagValue);
      return;
    }
    if (action === "set-due") {
      const dueTime = item.dataset.due ?? "";
      void updateTodoDueTime(todoId, dueTime);
      return;
    }
    if (action === "edit") {
      editTodoItem(todoId);
      return;
    }
    if (action === "delete") {
      void deleteTodo(todoId);
      return;
    }
    return;
  }
}

contextMenu?.addEventListener("click", handleContextMenuClick);
todoItemContextMenu?.addEventListener("click", handleContextMenuClick);
document.addEventListener("keydown", handleSubmenuTypeahead);
document.addEventListener("click", (event) => {
  if (
    (contextMenu &&
      !contextMenu.hidden &&
      !event.target.closest("#file-context-menu")) ||
    (todoItemContextMenu &&
      !todoItemContextMenu.hidden &&
      !event.target.closest("#todo-item-context-menu"))
  ) {
    hideContextMenu();
    hideTodoItemContextMenu();
  }
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    hideContextMenu();
    hideTodoItemContextMenu();
  }
});
todoInput?.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    void addTodo();
  }
});
todoViewTitle?.addEventListener("input", () => {
  updateSelectedTodoTitle(todoViewTitle.innerText);
  void saveTodoTitleDebounced();
});
todoViewTitle?.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    todoViewTitle.blur();
  }
});
todoViewTitle?.addEventListener("blur", () => {
  // If the element is hidden (due to switching views), ignore the blur event
  if (todoViewTitle.offsetWidth === 0 && todoViewTitle.offsetHeight === 0) {
    return;
  }
  const selectedFile = getSelectedTodoFile();
  if (!selectedFile) return;

  const safeTitle = normalizeTodoTitle(todoViewTitle.innerText) || "United";
  if (
    safeTitle !== selectedFile.title ||
    todoViewTitle.innerText !== safeTitle
  ) {
    todoViewTitle.textContent = safeTitle;
    updateSelectedTodoTitle(safeTitle);
  }
  void saveTodoTitleDebounced();
});

function searchNotesAndTodos(query) {
  const q = query.toLowerCase().trim();
  if (!q) {
    return {
      notes: notes,
      todos: todoFiles,
    };
  }

  const matchingNotes = notes.filter(
    (note) =>
      note.title.toLowerCase().includes(q) ||
      note.content.toLowerCase().includes(q),
  );

  const matchingTodos = todoFiles.filter(
    (todoFile) =>
      todoFile.title.toLowerCase().includes(q) ||
      todoFile.items.some((item) => item.text.toLowerCase().includes(q)),
  );

  return {
    notes: matchingNotes,
    todos: matchingTodos,
  };
}

function renderSearchResults() {
  const query = globalSearchInput?.value || "";
  const { notes: matchedNotes, todos: matchedTodos } =
    searchNotesAndTodos(query);

  const notesList = document.querySelector("#results-notes-list");
  const todosList = document.querySelector("#results-todos-list");
  const notesSection = document.querySelector("#results-notes-section");
  const todosSection = document.querySelector("#results-todos-section");
  const emptyState = document.querySelector("#search-empty-state");
  const queryHighlight = document.querySelector("#search-query-highlight");

  if (notesList) notesList.innerHTML = "";
  if (todosList) todosList.innerHTML = "";

  const totalResults = matchedNotes.length + matchedTodos.length;

  if (totalResults === 0) {
    if (notesSection) notesSection.hidden = true;
    if (todosSection) todosSection.hidden = true;
    if (emptyState) {
      emptyState.hidden = false;
      if (queryHighlight) queryHighlight.textContent = query;
    }
    return;
  }

  if (emptyState) emptyState.hidden = true;

  if (matchedNotes.length > 0) {
    if (notesSection) notesSection.hidden = false;
    matchedNotes.forEach((note) => {
      const item = document.createElement("div");
      item.className = "search-result-item";
      item.innerHTML = `
        <span class="icon file-stack-icon"></span>
        <span class="item-title">${escapeHtml(note.title)}</span>
      `;
      item.addEventListener("click", () => {
        selectNote(note.id);
        showNotesView();
        closeSearch();
      });
      notesList?.appendChild(item);
    });
  } else {
    if (notesSection) notesSection.hidden = true;
  }

  if (matchedTodos.length > 0) {
    if (todosSection) todosSection.hidden = false;
    matchedTodos.forEach((todo) => {
      const item = document.createElement("div");
      item.className = "search-result-item";
      item.innerHTML = `
        <span class="icon calendar-icon"></span>
        <span class="item-title">${escapeHtml(todo.title)}</span>
      `;
      item.addEventListener("click", () => {
        selectTodoFile(todo.id);
        showTodoView();
        closeSearch();
      });
      todosList?.appendChild(item);
    });
  } else {
    if (todosSection) todosSection.hidden = true;
  }
}

async function createFileFromSearchQuery(
  query = globalSearchInput?.value || "",
) {
  const trimmedQuery = String(query ?? "").trim();
  if (!trimmedQuery) {
    return false;
  }

  const { notes: matchedNotes, todos: matchedTodos } =
    searchNotesAndTodos(trimmedQuery);
  if (!shouldCreateFileFromSearch(trimmedQuery, matchedNotes, matchedTodos)) {
    return false;
  }

  notes = addNote(notes, trimmedQuery, "");
  selectedNoteId = notes[0].id;
  notes = await persistNotes(notes);
  selectNote(selectedNoteId);
  focusCanvasTitle();
  closeSearch();
  return true;
}

function openSearch() {
  if (!searchDialog) return;
  searchDialog.showModal();
  if (globalSearchInput) {
    globalSearchInput.value = "";
    globalSearchInput.focus();
  }
  renderSearchResults();
}

function closeSearch() {
  if (!searchDialog) return;
  searchDialog.close();
}

railButtons.forEach((button) => {
  button.addEventListener("click", () => {
    if (button.dataset.view === "todo") {
      showTodoView();
      return;
    }

    if (button.dataset.view === "tags") {
      showTagSettingsView();
      return;
    }

    showNotesView();
  });
});

initRailMorphHover();

focusSearchButtons.forEach((button) => {
  button.addEventListener("click", () => {
    openSearch();
  });
});

addTagCategoryButton?.addEventListener("click", () => {
  addTagCategory();
});

if (searchDialog) {
  closeSearchDialogButton?.addEventListener("click", () => {
    closeSearch();
  });

  globalSearchInput?.addEventListener("input", () => {
    renderSearchResults();
  });

  globalSearchInput?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.isComposing) {
      return;
    }

    event.preventDefault();
    void createFileFromSearchQuery(globalSearchInput.value);
  });

  if (!("closedBy" in HTMLDialogElement.prototype)) {
    searchDialog.addEventListener("click", (event) => {
      if (event.target !== searchDialog) return;
      const rect = searchDialog.getBoundingClientRect();
      const isDialogContent =
        rect.top <= event.clientY &&
        event.clientY <= rect.top + rect.height &&
        rect.left <= event.clientX &&
        event.clientX <= rect.left + rect.width;
      if (isDialogContent) return;
      closeSearch();
    });
  }
}

function updateSidebarToggleButtonState() {
  if (!toggleSidebarButton) return;

  const isCollapsed =
    appShell?.classList.contains("sidebar-collapsed") ?? false;
  toggleSidebarButton.setAttribute("aria-expanded", String(!isCollapsed));
  toggleSidebarButton.setAttribute(
    "title",
    isCollapsed ? "Show sidebar" : "Hide sidebar",
  );
}

updateSidebarToggleButtonState();

toggleSidebarButton?.addEventListener("click", () => {
  appShell?.classList.toggle("sidebar-collapsed");
  updateSidebarToggleButtonState();
});

document.addEventListener("keydown", (event) => {
  if (!event.ctrlKey || event.shiftKey || event.altKey || event.metaKey) return;

  if (event.key.toLowerCase() === "n") {
    event.preventDefault();
    void createNewFile();
  }

  if (event.key.toLowerCase() === "o") {
    event.preventDefault();
    openSearch();
  }
});

canvas?.addEventListener("input", () => {
  lastCanvasText = canvas.innerText;
  void saveCanvasDebounced();
});
canvas?.addEventListener("paste", () => {
  setTimeout(() => {
    lastCanvasText = canvas.innerText;
    void saveCanvasDebounced();
  }, 50);
});

rightCanvas?.addEventListener("input", () => {
  rightCanvasLastText = rightCanvas.innerText;
  void saveRightCanvasDebounced();
});
rightCanvas?.addEventListener("paste", () => {
  setTimeout(() => {
    rightCanvasLastText = rightCanvas.innerText;
    void saveRightCanvasDebounced();
  }, 50);
});

closeRightPaneButton?.addEventListener("click", () => {
  closeRightPane();
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

  return notes;
}

async function initApp() {
  const diskNotes = await loadNotesFromDisk();
  notes = await migrateLegacyNotesIfNeeded(diskNotes);
  todoFiles = await loadTodoFilesFromDisk();

  if (todoFiles.length === 0) {
    const defaultTodoFile = createTodoDocument("United");
    todoFiles = await persistTodoFiles([defaultTodoFile]);
  }

  const persistedState = readUiState();
  const restoredTodoFileId = todoFiles.find(
    (todoFile) => todoFile.id === persistedState.selectedTodoFileId,
  )?.id;
  const restoredNoteId = notes.find(
    (note) => note.id === persistedState.selectedNoteId,
  )?.id;
  const launchParams = launchQuery;
  const launchView = launchParams.get("view");
  const launchId = launchParams.get("id");

  if (launchView === "todo" && todoFiles.some((file) => file.id === launchId)) {
    selectedTodoFileId = launchId;
    showTodoView();
    return;
  }

  if (launchView === "notes" && launchId) {
    const targetNote = notes.find((note) => note.id === launchId);
    if (targetNote) {
      selectNote(targetNote.id);
      return;
    }

    if (isSoloWindow) {
      const fallbackNote = notes[0];
      if (fallbackNote) {
        selectedNoteId = fallbackNote.id;
        selectNote(fallbackNote.id);
      } else {
        showEditor();
        if (canvas) {
          canvas.innerText = "";
          canvas.style.display = "block";
          canvas.focus();
        }
      }
      return;
    }
  }

  if (persistedState.activeView === "todo") {
    selectedTodoFileId = restoredTodoFileId ?? null;
    renderTodoFilesSidebar();
    renderTodoItems();
    showTodoView();
    return;
  }

  if (persistedState.activeView === "tags") {
    renderNotes();
    renderTodoFilesSidebar();
    showTagSettingsView();
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
  renderOpenFileTabs();
}

// ==========================================
// Dialog Prompt Helper Functions
// ==========================================

let currentPromptCallback = null;

function showTextPrompt(title, label, defaultValue, callback) {
  if (!folderInputDialog || !dialogTextInput) return;

  if (inputDialogTitle) inputDialogTitle.textContent = title;
  if (inputDialogLabel) inputDialogLabel.textContent = label;
  dialogTextInput.value = defaultValue || "";
  currentPromptCallback = callback;

  folderInputDialog.showModal();
  setTimeout(() => dialogTextInput.focus(), 50);
}

folderInputForm?.addEventListener("submit", (e) => {
  e.preventDefault();
  const value = dialogTextInput.value.trim();
  folderInputDialog.close();
  if (currentPromptCallback) {
    currentPromptCallback(value);
    currentPromptCallback = null;
  }
});

cancelInputBtn?.addEventListener("click", () => {
  folderInputDialog.close();
  currentPromptCallback = null;
});

let deleteFolderCallback = null;

function showDeleteFolderPrompt(folderName, callback) {
  if (!folderDeleteDialog) return;
  if (deleteFolderNameDisplay)
    deleteFolderNameDisplay.textContent = `"${folderName}"`;
  deleteFolderCallback = callback;
  folderDeleteDialog.showModal();
}

deleteFolderAllBtn?.addEventListener("click", () => {
  folderDeleteDialog.close();
  if (deleteFolderCallback) {
    deleteFolderCallback("all");
    deleteFolderCallback = null;
  }
});

deleteFolderKeepBtn?.addEventListener("click", () => {
  folderDeleteDialog.close();
  if (deleteFolderCallback) {
    deleteFolderCallback("keep");
    deleteFolderCallback = null;
  }
});

cancelDeleteFolderBtn?.addEventListener("click", () => {
  folderDeleteDialog.close();
  deleteFolderCallback = null;
});

// ==========================================
// Folder Helper Functions & Event Listeners
// ==========================================

async function commitFolderRename(oldName, newName, type) {
  if (!newName || newName === oldName) {
    if (type === "notes") renderNotes("");
    else renderTodoFilesSidebar();
    return;
  }

  if (type === "notes") {
    notes = notes.map((n) =>
      n.folder === oldName ? { ...n, folder: newName } : n,
    );
    if (emptyNotesFolders.has(oldName)) {
      emptyNotesFolders.delete(oldName);
      emptyNotesFolders.add(newName);
    }
    notes = await persistNotes(notes);
    renderNotes("");
    if (selectedNoteId) {
      const activeNote = notes.find((n) => n.id === selectedNoteId);
      if (activeNote) selectNote(selectedNoteId);
    }
  } else {
    todoFiles = todoFiles.map((t) =>
      t.folder === oldName ? { ...t, folder: newName } : t,
    );
    if (emptyTodoFolders.has(oldName)) {
      emptyTodoFolders.delete(oldName);
      emptyTodoFolders.add(newName);
    }
    todoFiles = await persistTodoFiles(todoFiles);
    renderTodoFilesSidebar();
    if (selectedTodoFileId) {
      const activeTodo = todoFiles.find((t) => t.id === selectedTodoFileId);
      if (activeTodo) selectTodoFile(selectedTodoFileId);
    }
  }
}

async function renameFolder(oldName, type) {
  showTextPrompt(
    "Rename folder",
    "Enter the new folder name:",
    oldName,
    async (newName) => {
      await commitFolderRename(oldName, newName, type);
    },
  );
}

async function deleteFolder(folderName, type) {
  showDeleteFolderPrompt(folderName, async (action) => {
    if (action === "all") {
      if (type === "notes") {
        const notesToDelete = notes.filter((n) => n.folder === folderName);
        const isSelectedDeleted = notesToDelete.some(
          (n) => n.id === selectedNoteId,
        );
        notes = notes.filter((n) => n.folder !== folderName);
        emptyNotesFolders.delete(folderName);
        notes = await persistNotes(notes);
        if (isSelectedDeleted) {
          resetSelection();
        } else {
          renderNotes("");
        }
      } else {
        const todosToDelete = todoFiles.filter((t) => t.folder === folderName);
        const isSelectedDeleted = todosToDelete.some(
          (t) => t.id === selectedTodoFileId,
        );
        todoFiles = todoFiles.filter((t) => t.folder !== folderName);
        emptyTodoFolders.delete(folderName);
        todoFiles = await persistTodoFiles(todoFiles);
        if (isSelectedDeleted) {
          resetTodoSelection();
        } else {
          renderTodoFilesSidebar();
        }
      }
    } else if (action === "keep") {
      if (type === "notes") {
        notes = notes.map((n) =>
          n.folder === folderName ? { ...n, folder: null } : n,
        );
        emptyNotesFolders.delete(folderName);
        notes = await persistNotes(notes);
        renderNotes("");
        if (selectedNoteId) {
          const activeNote = notes.find((n) => n.id === selectedNoteId);
          if (activeNote) selectNote(selectedNoteId);
        }
      } else {
        todoFiles = todoFiles.map((t) =>
          t.folder === folderName ? { ...t, folder: null } : t,
        );
        emptyTodoFolders.delete(folderName);
        todoFiles = await persistTodoFiles(todoFiles);
        renderTodoFilesSidebar();
        if (selectedTodoFileId) {
          const activeTodo = todoFiles.find((t) => t.id === selectedTodoFileId);
          if (activeTodo) selectTodoFile(selectedTodoFileId);
        }
      }
    }
  });
}

let currentMoveType = null;

function openMoveDialog(type) {
  currentMoveType = type;
  if (!folderMoveDialog || !moveFolderSelect) return;

  moveFolderSelect.innerHTML = "";

  const rootOpt = document.createElement("option");
  rootOpt.value = "";
  rootOpt.textContent = "No folder (Root)";
  moveFolderSelect.appendChild(rootOpt);

  const folders =
    type === "notes"
      ? Array.from(
          new Set([
            ...notes.map((n) => n.folder).filter(Boolean),
            ...emptyNotesFolders,
          ]),
        ).sort()
      : Array.from(
          new Set([
            ...todoFiles.map((t) => t.folder).filter(Boolean),
            ...emptyTodoFolders,
          ]),
        ).sort();

  folders.forEach((folderName) => {
    const opt = document.createElement("option");
    opt.value = folderName;
    opt.textContent = folderName;
    moveFolderSelect.appendChild(opt);
  });

  const newOpt = document.createElement("option");
  newOpt.value = "__NEW_FOLDER__";
  newOpt.textContent = "+ Create new folder...";
  moveFolderSelect.appendChild(newOpt);

  const currentFile =
    type === "notes"
      ? notes.find((n) => n.id === selectedNoteId)
      : todoFiles.find((t) => t.id === selectedTodoFileId);

  if (currentFile && currentFile.folder) {
    moveFolderSelect.value = currentFile.folder;
  } else {
    moveFolderSelect.value = "";
  }

  folderMoveDialog.showModal();
}

// Event Listeners for Folders and Moving
function uniqueFolderName(base, taken) {
  let name = base;
  let i = 1;
  while (taken.has(name)) {
    name = `${base} ${i++}`;
  }
  return name;
}

newFolderButton?.addEventListener("click", () => {
  const taken = new Set([
    ...notes.map((n) => n.folder).filter(Boolean),
    ...emptyNotesFolders,
  ]);
  const name = uniqueFolderName("New folder", taken);
  emptyNotesFolders.add(name);
  renameFolderName = name;
  renderNotes();
});

newTodoFolderButton?.addEventListener("click", () => {
  const taken = new Set([
    ...todoFiles.map((t) => t.folder).filter(Boolean),
    ...emptyTodoFolders,
  ]);
  const name = uniqueFolderName("New folder", taken);
  emptyTodoFolders.add(name);
  renameFolderName = name;
  renderTodoFilesSidebar();
});

moveNoteButton?.addEventListener("click", () => {
  openMoveDialog("notes");
});

moveTodoFileButton?.addEventListener("click", () => {
  openMoveDialog("todo");
});

moveFolderSelect?.addEventListener("change", () => {
  if (moveFolderSelect.value === "__NEW_FOLDER__") {
    showTextPrompt(
      "New folder",
      "Enter the new folder name:",
      "",
      (newFolderName) => {
        if (newFolderName) {
          if (currentMoveType === "notes") {
            emptyNotesFolders.add(newFolderName);
          } else {
            emptyTodoFolders.add(newFolderName);
          }
          openMoveDialog(currentMoveType);
          moveFolderSelect.value = newFolderName;
        } else {
          moveFolderSelect.value = "";
        }
      },
    );
  }
});

folderMoveForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const targetFolder = moveFolderSelect.value || null;

  if (currentMoveType === "notes") {
    if (selectedNoteId) {
      notes = notes.map((n) =>
        n.id === selectedNoteId ? { ...n, folder: targetFolder } : n,
      );
      notes = await persistNotes(notes);
      renderNotes("");
      selectNote(selectedNoteId);
    }
  } else {
    if (selectedTodoFileId) {
      todoFiles = todoFiles.map((t) =>
        t.id === selectedTodoFileId ? { ...t, folder: targetFolder } : t,
      );
      todoFiles = await persistTodoFiles(todoFiles);
      renderTodoFilesSidebar();
      selectTodoFile(selectedTodoFileId);
    }
  }

  folderMoveDialog?.close();
});

cancelMoveBtn?.addEventListener("click", () => {
  folderMoveDialog?.close();
});

// Drag and drop for notes root list area
if (noteList) {
  noteList.addEventListener("dragover", (e) => {
    if (e.target === noteList || noteList.contains(e.target)) {
      e.preventDefault();
      if (!e.target.closest(".folder-header")) {
        noteList.classList.add("drag-over");
      } else {
        noteList.classList.remove("drag-over");
      }
    }
  });

  noteList.addEventListener("dragleave", () => {
    noteList.classList.remove("drag-over");
  });

  noteList.addEventListener("drop", async (e) => {
    noteList.classList.remove("drag-over");
    if (e.target.closest(".folder-header")) {
      return;
    }
    e.preventDefault();
    const noteId = e.dataTransfer.getData("text/plain");
    if (!noteId) return;

    const note = notes.find((n) => n.id === noteId);
    if (note && note.folder !== null) {
      note.folder = null;
      notes = await persistNotes(notes);
      renderNotes("");
      if (selectedNoteId === noteId) {
        selectNote(noteId);
      }
    }
  });
}

// Drag and drop for todo root list area
if (todoSidebarList) {
  todoSidebarList.addEventListener("dragover", (e) => {
    if (e.target === todoSidebarList || todoSidebarList.contains(e.target)) {
      e.preventDefault();
      if (!e.target.closest(".folder-header")) {
        todoSidebarList.classList.add("drag-over");
      } else {
        todoSidebarList.classList.remove("drag-over");
      }
    }
  });

  todoSidebarList.addEventListener("dragleave", () => {
    todoSidebarList.classList.remove("drag-over");
  });

  todoSidebarList.addEventListener("drop", async (e) => {
    todoSidebarList.classList.remove("drag-over");
    if (e.target.closest(".folder-header")) {
      return;
    }
    e.preventDefault();
    const todoId = e.dataTransfer.getData("text/plain");
    if (!todoId) return;

    const todoFile = todoFiles.find((t) => t.id === todoId);
    if (todoFile && todoFile.folder !== null) {
      todoFile.folder = null;
      todoFiles = await persistTodoFiles(todoFiles);
      renderTodoFilesSidebar();
      if (selectedTodoFileId === todoId) {
        selectTodoFile(todoId);
      }
    }
  });
}

window.addEventListener("resize", () => updateRailInk(activeView));

renderTagContextMenu();
void initApp();
