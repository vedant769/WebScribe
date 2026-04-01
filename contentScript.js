// WebNotes content script: injects a floating sidebar into web pages.

const NOTE_PREFIX = "note:";
const THEME_KEY = "settings:theme";

let sidebarContainer = null;
let sidebarVisible = false;
let sidebarSaveTimeoutId = null;

let sidebarTextarea = null;
let sidebarTagsInput = null;
let sidebarWordCount = null;
let sidebarSaveStatus = null;
let sidebarThemeToggle = null;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message !== "object") return;

  if (message.type === "toggleSidebar") {
    toggleSidebar();
  }
});

function toggleSidebar() {
  if (sidebarVisible) {
    hideSidebar();
  } else {
    showSidebar();
  }
}

function showSidebar() {
  if (!sidebarContainer) {
    createSidebar();
  }
  sidebarContainer.style.display = "flex";
  sidebarVisible = true;
  loadSidebarTheme();
  loadSidebarNote();
}

function hideSidebar() {
  if (!sidebarContainer) return;
  sidebarContainer.style.display = "none";
  sidebarVisible = false;
}

function createSidebar() {
  sidebarContainer = document.createElement("div");
  sidebarContainer.id = "webnotes-sidebar-container";

  sidebarContainer.innerHTML = `
    <div class="webnotes-sidebar">
      <div class="webnotes-sidebar-header">
        <div class="webnotes-sidebar-title">WebNotes</div>
        <div class="webnotes-sidebar-header-actions">
          <label class="webnotes-sidebar-toggle">
            <input type="checkbox" id="webnotesSidebarThemeToggle" />
            <span class="webnotes-sidebar-toggle-slider"></span>
          </label>
          <button class="webnotes-sidebar-close" title="Close sidebar">&times;</button>
        </div>
      </div>
      <div class="webnotes-sidebar-body">
        <textarea
          id="webnotesSidebarTextarea"
          class="webnotes-sidebar-textarea"
          placeholder="Write your note for this page..."
        ></textarea>
        <div class="webnotes-sidebar-meta-row">
          <div class="webnotes-sidebar-tags-wrapper">
            <label for="webnotesSidebarTags">Tags</label>
            <input
              id="webnotesSidebarTags"
              class="webnotes-sidebar-tags-input"
              type="text"
              placeholder="e.g. docs, research"
            />
          </div>
          <div class="webnotes-sidebar-meta-right">
            <span id="webnotesSidebarWordCount" class="webnotes-sidebar-wordcount">
              0 words
            </span>
            <span id="webnotesSidebarSaveStatus" class="webnotes-sidebar-savestatus"></span>
          </div>
        </div>
      </div>
    </div>
  `;

  document.documentElement.appendChild(sidebarContainer);

  sidebarTextarea = document.getElementById("webnotesSidebarTextarea");
  sidebarTagsInput = document.getElementById("webnotesSidebarTags");
  sidebarWordCount = document.getElementById("webnotesSidebarWordCount");
  sidebarSaveStatus = document.getElementById("webnotesSidebarSaveStatus");
  sidebarThemeToggle = document.getElementById("webnotesSidebarThemeToggle");

  const closeButton = sidebarContainer.querySelector(".webnotes-sidebar-close");
  closeButton.addEventListener("click", hideSidebar);

  sidebarTextarea.addEventListener("input", () => {
    updateSidebarWordCount();
    scheduleSidebarSave();
  });

  sidebarTagsInput.addEventListener("input", () => {
    scheduleSidebarSave();
  });

  sidebarThemeToggle.addEventListener("change", handleSidebarThemeToggle);

  // Basic drag handle for UX: dragging the sidebar by its header horizontally.
  const header = sidebarContainer.querySelector(".webnotes-sidebar-header");
  enableSidebarDrag(header, sidebarContainer);
}

function getSidebarNoteKey() {
  return NOTE_PREFIX + window.location.href;
}

function normalizeSidebarNote(raw) {
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

function loadSidebarNote() {
  const key = getSidebarNoteKey();
  chrome.storage.local.get(key, result => {
    const raw = result[key];
    const note = normalizeSidebarNote(raw);
    sidebarTextarea.value = note.content || "";
    sidebarTagsInput.value = (note.tags || []).join(", ");
    updateSidebarWordCount();
    clearSidebarSaveStatus();
  });
}

function getSidebarTagsFromInput() {
  const raw = sidebarTagsInput.value || "";
  return raw
    .split(",")
    .map(t => t.trim())
    .filter(Boolean);
}

function scheduleSidebarSave() {
  if (sidebarSaveTimeoutId) {
    clearTimeout(sidebarSaveTimeoutId);
  }
  sidebarSaveStatus.textContent = "Saving...";
  sidebarSaveStatus.classList.remove("webnotes-saved");

  sidebarSaveTimeoutId = setTimeout(() => {
    sidebarSaveTimeoutId = null;
    saveSidebarNote();
  }, 1000);
}

function saveSidebarNote() {
  const key = getSidebarNoteKey();
  const content = sidebarTextarea.value || "";
  const tags = getSidebarTagsFromInput();
  const now = Date.now();

  chrome.storage.local.get(key, result => {
    const existing = normalizeSidebarNote(result[key]);
    const note = {
      content,
      tags,
      createdAt: existing.createdAt || now,
      updatedAt: now
    };

    chrome.storage.local.set({ [key]: note }, () => {
      sidebarSaveStatus.textContent = "Saved";
      sidebarSaveStatus.classList.add("webnotes-saved");
    });
  });
}

function updateSidebarWordCount() {
  const text = (sidebarTextarea.value || "").trim();
  const words = text ? text.split(/\s+/).length : 0;
  sidebarWordCount.textContent = `${words} word${words === 1 ? "" : "s"}`;
}

function clearSidebarSaveStatus() {
  sidebarSaveStatus.textContent = "";
  sidebarSaveStatus.classList.remove("webnotes-saved");
}

// Sidebar theme is linked to the global WebNotes theme key.
function handleSidebarThemeToggle() {
  const isDark = !!sidebarThemeToggle.checked;
  if (isDark) {
    sidebarContainer.classList.add("webnotes-dark");
  } else {
    sidebarContainer.classList.remove("webnotes-dark");
  }
  chrome.storage.local.set({ [THEME_KEY]: isDark ? "dark" : "light" });
}

function loadSidebarTheme() {
  chrome.storage.local.get(THEME_KEY, result => {
    const theme = result[THEME_KEY] || "light";
    const isDark = theme === "dark";
    if (isDark) {
      sidebarContainer.classList.add("webnotes-dark");
    } else {
      sidebarContainer.classList.remove("webnotes-dark");
    }
    sidebarThemeToggle.checked = isDark;
  });
}

// Basic horizontal drag behavior for the sidebar container.
function enableSidebarDrag(handleEl, containerEl) {
  let isDragging = false;
  let startX = 0;
  let startRight = 0;

  handleEl.style.cursor = "move";

  handleEl.addEventListener("mousedown", e => {
    isDragging = true;
    startX = e.clientX;
    const rect = containerEl.getBoundingClientRect();
    startRight = window.innerWidth - rect.right;
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  });

  function onMouseMove(e) {
    if (!isDragging) return;
    const deltaX = e.clientX - startX;
    const newRight = Math.max(0, startRight - deltaX);
    containerEl.style.right = `${newRight}px`;
  }

  function onMouseUp() {
    if (!isDragging) return;
    isDragging = false;
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
  }
}

