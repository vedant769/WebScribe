// WebNotes popup logic: URL-based notes, auto-save, search, export, dark mode, sidebar toggle.

const NOTE_PREFIX = "note:";
const THEME_KEY = "settings:theme";

let currentUrl = "";
let saveTimeoutId = null;
let currentView = "editor";

const els = {};

document.addEventListener("DOMContentLoaded", initPopup);

function initPopup() {
  cacheElements();
  attachEventListeners();
  loadTheme();
  loadCurrentTabNote();
  setView("editor");
}

function cacheElements() {
  els.siteDomain = document.getElementById("siteDomain");
  els.siteFavicon = document.getElementById("siteFavicon");

  els.noteTextarea = document.getElementById("noteTextarea");
  els.tagsInput = document.getElementById("tagsInput");
  els.wordCount = document.getElementById("wordCount");
  els.saveStatus = document.getElementById("saveStatus");
  els.deleteBtn = document.getElementById("deleteBtn");
  els.themeToggle = document.getElementById("themeToggle");
  els.searchInput = document.getElementById("searchInput");
  els.searchResults = document.getElementById("searchResults");
  els.historyResults = document.getElementById("historyResults");
  els.exportBtn = document.getElementById("exportBtn");
  els.toggleSidebarBtn = document.getElementById("toggleSidebarBtn");

  els.lastSaved = document.getElementById("lastSaved");
  els.saveBtn = document.getElementById("saveBtn");

  els.viewEditor = document.getElementById("viewEditor");
  els.viewAllNotes = document.getElementById("viewAllNotes");
  els.viewHistory = document.getElementById("viewHistory");
  els.viewSettings = document.getElementById("viewSettings");

  els.settingsBtn = document.getElementById("settingsBtn");
  els.tabEditorBtn = document.getElementById("tabEditorBtn");
  els.tabAllBtn = document.getElementById("tabAllBtn");
  els.tabHistoryBtn = document.getElementById("tabHistoryBtn");
}

function attachEventListeners() {
  els.noteTextarea.addEventListener("input", () => {
    updateWordCount();
    scheduleSave();
  });

  els.tagsInput.addEventListener("input", () => {
    scheduleSave();
  });

  els.deleteBtn.addEventListener("click", handleDelete);

  els.themeToggle.addEventListener("change", handleThemeToggle);

  els.searchInput.addEventListener("input", handleSearchInput);

  els.exportBtn.addEventListener("click", exportNotesAsText);

  els.toggleSidebarBtn.addEventListener("click", toggleSidebarOnCurrentTab);

  els.saveBtn.addEventListener("click", () => {
    // Immediate save (still keeps debounced autosave)
    if (saveTimeoutId) {
      clearTimeout(saveTimeoutId);
      saveTimeoutId = null;
    }
    els.saveStatus.textContent = "Saving...";
    els.saveStatus.classList.remove("saved");
    saveNote();
  });

  els.tabEditorBtn.addEventListener("click", () => setView("editor"));
  els.tabAllBtn.addEventListener("click", () => setView("all"));
  els.tabHistoryBtn.addEventListener("click", () => setView("history"));
  els.settingsBtn.addEventListener("click", () => setView("settings"));
}

function getNoteKey(url) {
  return NOTE_PREFIX + url;
}

function normalizeNote(raw) {
  if (!raw) return { content: "", tags: [], createdAt: Date.now(), updatedAt: Date.now() };
  if (typeof raw === "string") {
    return {
      content: raw,
      tags: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
  }
  return {
    content: raw.content || "",
    tags: Array.isArray(raw.tags) ? raw.tags : [],
    createdAt: raw.createdAt || Date.now(),
    updatedAt: raw.updatedAt || Date.now()
  };
}

function loadCurrentTabNote() {
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    const tab = tabs && tabs[0];
    if (!tab || !tab.url) return;
    currentUrl = tab.url;
    setHeaderForUrl(currentUrl);

    const key = getNoteKey(currentUrl);
    chrome.storage.local.get(key, result => {
      const raw = result[key];
      const note = normalizeNote(raw);
      els.noteTextarea.value = note.content || "";
      els.tagsInput.value = (note.tags || []).join(", ");
      updateWordCount();
      clearSaveStatus();
      updateLastSaved(note.updatedAt);
    });
  });
}

function scheduleSave() {
  if (!currentUrl) return;
  if (saveTimeoutId) {
    clearTimeout(saveTimeoutId);
  }
  els.saveStatus.textContent = "Saving...";
  els.saveStatus.classList.remove("saved");

  // Debounced auto-save (1 second after typing stops)
  saveTimeoutId = setTimeout(() => {
    saveTimeoutId = null;
    saveNote();
  }, 1000);
}

function getTagsFromInput() {
  const raw = els.tagsInput.value || "";
  return raw
    .split(",")
    .map(t => t.trim())
    .filter(Boolean);
}

function saveNote() {
  if (!currentUrl) return;
  const key = getNoteKey(currentUrl);
  const content = els.noteTextarea.value || "";
  const tags = getTagsFromInput();
  const now = Date.now();

  chrome.storage.local.get(key, result => {
    const existing = normalizeNote(result[key]);
    const note = {
      content,
      tags,
      createdAt: existing.createdAt || now,
      updatedAt: now
    };

    chrome.storage.local.set({ [key]: note }, () => {
      els.saveStatus.textContent = "Saved";
      els.saveStatus.classList.add("saved");
      updateLastSaved(now);
    });
  });
}

function handleDelete() {
  if (!currentUrl) return;
  const key = getNoteKey(currentUrl);
  chrome.storage.local.remove(key, () => {
    els.noteTextarea.value = "";
    els.tagsInput.value = "";
    updateWordCount();
    els.saveStatus.textContent = "Deleted";
    els.saveStatus.classList.add("saved");
    updateLastSaved(null);
  });
}

function updateWordCount() {
  const text = (els.noteTextarea.value || "").trim();
  const words = text ? text.split(/\s+/).length : 0;
  els.wordCount.textContent = `${words} word${words === 1 ? "" : "s"}`;
}

function clearSaveStatus() {
  els.saveStatus.textContent = "";
  els.saveStatus.classList.remove("saved");
}

function handleThemeToggle() {
  const isDark = !!els.themeToggle.checked;
  if (isDark) {
    document.body.classList.add("dark");
  } else {
    document.body.classList.remove("dark");
  }
  chrome.storage.local.set({ [THEME_KEY]: isDark ? "dark" : "light" });
}

function loadTheme() {
  chrome.storage.local.get(THEME_KEY, result => {
    const theme = result[THEME_KEY] || "light";
    const isDark = theme === "dark";
    els.themeToggle.checked = isDark;
    if (isDark) {
      document.body.classList.add("dark");
    } else {
      document.body.classList.remove("dark");
    }
  });
}

// Simple HTML escaping for safe rendering in results
function escapeHtml(str) {
  return (str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

let searchDebounceId = null;

function handleSearchInput() {
  const query = els.searchInput.value || "";
  if (searchDebounceId) {
    clearTimeout(searchDebounceId);
  }
  searchDebounceId = setTimeout(() => {
    performSearch(query);
  }, 200);
}

function performSearch(query) {
  els.searchResults.innerHTML = "";
  const trimmed = query.trim();
  if (!trimmed) {
    return;
  }

  const lower = trimmed.toLowerCase();

  chrome.storage.local.get(null, items => {
    const matches = [];

    Object.entries(items || {}).forEach(([key, value]) => {
      if (!key.startsWith(NOTE_PREFIX)) return;
      const url = key.slice(NOTE_PREFIX.length);
      const note = normalizeNote(value);
      const haystack = (
        (note.content || "") +
        " " +
        (note.tags || []).join(" ")
      ).toLowerCase();

      if (haystack.includes(lower)) {
        matches.push({ url, note });
      }
    });

    matches.sort((a, b) => (b.note.updatedAt || 0) - (a.note.updatedAt || 0));

    matches.slice(0, 30).forEach(match => {
      const container = document.createElement("div");
      container.className = "search-result";

      const snippetSource = match.note.content || "";
      const snippet = snippetSource.length > 140
        ? snippetSource.slice(0, 140) + "…"
        : snippetSource;

      const tags = (match.note.tags || []).join(", ");

      container.innerHTML = `
        <div class="search-result-url">${escapeHtml(match.url)}</div>
        <div class="search-result-snippet">${escapeHtml(snippet || "(empty)")}</div>
        ${
          tags
            ? `<div class="search-result-tags">${escapeHtml(tags)}</div>`
            : ""
        }
      `;

      // Clicking a result opens the URL in a new tab
      container.addEventListener("click", () => {
        chrome.tabs.create({ url: match.url });
      });

      els.searchResults.appendChild(container);
    });
  });
}

function exportNotesAsText() {
  chrome.storage.local.get(null, items => {
    const lines = [];
    lines.push("WebNotes Export");
    lines.push(new Date().toString());
    lines.push("========================================");
    lines.push("");

    Object.entries(items || {}).forEach(([key, value]) => {
      if (!key.startsWith(NOTE_PREFIX)) return;
      const url = key.slice(NOTE_PREFIX.length);
      const note = normalizeNote(value);
      const tags = (note.tags || []).join(", ");
      const updated = note.updatedAt ? new Date(note.updatedAt).toString() : "";

      lines.push(`URL: ${url}`);
      if (tags) lines.push(`Tags: ${tags}`);
      if (updated) lines.push(`Last Updated: ${updated}`);
      lines.push("----------------------------------------");
      lines.push(note.content || "(empty)");
      lines.push("");
    });

    const text = lines.join("\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "webnotes_export.txt";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });
}

function toggleSidebarOnCurrentTab() {
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    const tab = tabs && tabs[0];
    if (!tab || !tab.id) return;
    chrome.tabs.sendMessage(tab.id, { type: "toggleSidebar" });
  });
}

function setHeaderForUrl(url) {
  try {
    const u = new URL(url);
    els.siteDomain.textContent = u.hostname || "this page";
  } catch {
    els.siteDomain.textContent = "this page";
  }

  // Built-in Chrome favicon endpoint (no external requests)
  els.siteFavicon.src = `chrome://favicon2/?size=32&url=${encodeURIComponent(url)}`;
}

function updateLastSaved(updatedAt) {
  if (!updatedAt) {
    els.lastSaved.textContent = "—";
    return;
  }
  const d = new Date(updatedAt);
  // Compact and readable in popup
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  els.lastSaved.textContent = time;
}

function setView(view) {
  currentView = view;

  els.viewEditor.classList.toggle("wn-view--active", view === "editor");
  els.viewAllNotes.classList.toggle("wn-view--active", view === "all");
  els.viewHistory.classList.toggle("wn-view--active", view === "history");
  els.viewSettings.classList.toggle("wn-view--active", view === "settings");

  els.tabEditorBtn.classList.toggle("wn-tab--active", view === "editor");
  els.tabAllBtn.classList.toggle("wn-tab--active", view === "all");
  els.tabHistoryBtn.classList.toggle("wn-tab--active", view === "history");

  if (view === "history") {
    renderHistory();
  }
  if (view === "all") {
    // clear results if empty query
    if (!((els.searchInput.value || "").trim())) {
      els.searchResults.innerHTML = "";
    }
  }

  // Accessibility state
  els.tabEditorBtn.setAttribute("aria-selected", view === "editor" ? "true" : "false");
  els.tabAllBtn.setAttribute("aria-selected", view === "all" ? "true" : "false");
  els.tabHistoryBtn.setAttribute("aria-selected", view === "history" ? "true" : "false");
}

function renderHistory() {
  els.historyResults.innerHTML = "";

  chrome.storage.local.get(null, items => {
    const entries = [];
    Object.entries(items || {}).forEach(([key, value]) => {
      if (!key.startsWith(NOTE_PREFIX)) return;
      const url = key.slice(NOTE_PREFIX.length);
      const note = normalizeNote(value);
      const updatedAt = note.updatedAt || 0;
      // only show items that have content
      if ((note.content || "").trim() || (note.tags || []).length) {
        entries.push({ url, note, updatedAt });
      }
    });

    entries.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

    const top = entries.slice(0, 12);
    if (top.length === 0) {
      const empty = document.createElement("div");
      empty.className = "wn-hint";
      empty.textContent = "No recent notes yet.";
      els.historyResults.appendChild(empty);
      return;
    }

    top.forEach(entry => {
      const container = document.createElement("div");
      container.className = "search-result";

      const snippetSource = entry.note.content || "";
      const snippet = snippetSource.length > 140 ? snippetSource.slice(0, 140) + "…" : snippetSource;
      const tags = (entry.note.tags || []).join(", ");

      container.innerHTML = `
        <div class="search-result-url">${escapeHtml(entry.url)}</div>
        <div class="search-result-snippet">${escapeHtml(snippet || "(empty)")}</div>
        ${tags ? `<div class="search-result-tags">${escapeHtml(tags)}</div>` : ""}
      `;

      container.addEventListener("click", () => chrome.tabs.create({ url: entry.url }));
      els.historyResults.appendChild(container);
    });
  });
}

