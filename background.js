// WebNotes background service worker: context menu "Add to Notes" for selected text.

const NOTE_PREFIX = "note:";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "webnotes-add-selection",
    title: "Add to WebNotes",
    contexts: ["selection"]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== "webnotes-add-selection") return;
  if (!info.selectionText || !tab || !tab.url) return;

  const url = tab.url;
  const selectedText = info.selectionText.trim();
  if (!selectedText) return;

  const key = NOTE_PREFIX + url;

  chrome.storage.local.get(key, result => {
    const raw = result[key];
    const existing = normalizeNote(raw);
    const now = Date.now();

    const prefix = existing.content ? existing.content + "\n\n" : "";
    const appendedSnippet = `➤ ${selectedText}`;

    const updated = {
      content: prefix + appendedSnippet,
      tags: existing.tags || [],
      createdAt: existing.createdAt || now,
      updatedAt: now
    };

    chrome.storage.local.set({ [key]: updated }, () => {
      // Optional: could notify content script to show a toast.
    });
  });
});

// Matches the popup/content-script logic so the structure is consistent.
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

