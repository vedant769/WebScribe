// In-page text annotations for each URL.
// Stores per-page annotations in chrome.storage.local using a serialized Range.
// Key format: "annotations:<pageUrl>" → Array<Annotation>
//
// Annotation:
// {
//   id: string,
//   text: string,       // selected text
//   note: string,       // user note
//   createdAt: number,
//   startPath: number[],
//   endPath: number[],
//   startOffset: number,
//   endOffset: number
// }

const WebScribe_ANNOT_PREFIX = "annotations:" + window.location.href;
const WebScribe_THEME_KEY = "settings:theme";

// Current theme state: "light" or "dark"
let WebScribeCurrentTheme = "light";

// Reused DOM elements for UI
let WebScribeAddNoteButton = null;
let WebScribeNotePopup = null;
let WebScribeNotePopupTextarea = null;
let WebScribeCurrentSelectionRange = null; // Range for which we are creating a note

// Debounced re-application (for dynamic pages, if used)
let WebScribeRestoreScheduled = false;

// Initialize after DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", WebScribeInitAnnotations);
} else {
  WebScribeInitAnnotations();
}

function WebScribeInitAnnotations() {
  WebScribeLoadTheme(() => {
    WebScribeCreateFloatingButton();
    WebScribeCreateNotePopup();
    WebScribeHookSelectionEvents();
    WebScribeRestoreAnnotationsForPage();
    WebScribeListenForThemeChanges();
  });
}

/**
 * Loads the saved theme from chrome.storage.local.
 */
function WebScribeLoadTheme(callback) {
  chrome.storage.local.get(WebScribe_THEME_KEY, result => {
    WebScribeCurrentTheme = result[WebScribe_THEME_KEY] || "light";
    if (callback) callback();
  });
}

/**
 * Listens for theme changes made in the popup settings (real-time sync).
 */
function WebScribeListenForThemeChanges() {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local" && changes[WebScribe_THEME_KEY]) {
      WebScribeCurrentTheme = changes[WebScribe_THEME_KEY].newValue || "light";
      WebScribeApplyThemeToAllElements();
    }
  });
}

/**
 * Returns true if the current theme is light.
 */
function WebScribeIsLightTheme() {
  return WebScribeCurrentTheme !== "dark";
}

/**
 * Applies or removes the .ws-light class on an element based on the current theme.
 */
function WebScribeApplyThemeClass(element) {
  if (!element) return;
  if (WebScribeIsLightTheme()) {
    element.classList.add("ws-light");
  } else {
    element.classList.remove("ws-light");
  }
}

/**
 * Updates theme class on all annotation UI elements (button, popup, highlights).
 */
function WebScribeApplyThemeToAllElements() {
  WebScribeApplyThemeClass(WebScribeAddNoteButton);
  WebScribeApplyThemeClass(WebScribeNotePopup);

  // Update all existing highlight spans
  const highlights = document.querySelectorAll(".WebScribe-annotation-highlight");
  highlights.forEach(el => WebScribeApplyThemeClass(el));

  // Update all tooltips
  const tooltips = document.querySelectorAll(".WebScribe-hover-tooltip");
  tooltips.forEach(el => WebScribeApplyThemeClass(el));
}

/**
 * Creates the floating "Add note" button (hidden by default).
 */
function WebScribeCreateFloatingButton() {
  WebScribeAddNoteButton = document.createElement("button");
  WebScribeAddNoteButton.textContent = "Add note";
  WebScribeAddNoteButton.className = "WebScribe-add-note-btn";
  WebScribeApplyThemeClass(WebScribeAddNoteButton);
  WebScribeAddNoteButton.style.display = "none";

  WebScribeAddNoteButton.addEventListener("click", WebScribeOnAddNoteClicked);
  document.documentElement.appendChild(WebScribeAddNoteButton);
}

/**
 * Creates the small note input popup (hidden by default).
 */
function WebScribeCreateNotePopup() {
  WebScribeNotePopup = document.createElement("div");
  WebScribeNotePopup.className = "WebScribe-note-popup";
  WebScribeApplyThemeClass(WebScribeNotePopup);
  WebScribeNotePopup.style.display = "none";

  const textarea = document.createElement("textarea");
  textarea.placeholder = "Write a note for this selection...";
  WebScribeNotePopupTextarea = textarea;

  const actions = document.createElement("div");
  actions.className = "WebScribe-note-popup-actions";

  const btnSave = document.createElement("button");
  btnSave.textContent = "Save";
  btnSave.className = "WebScribe-note-popup-btn save";
  btnSave.addEventListener("click", WebScribeOnSaveAnnotation);

  const btnCancel = document.createElement("button");
  btnCancel.textContent = "Cancel";
  btnCancel.className = "WebScribe-note-popup-btn cancel";
  btnCancel.addEventListener("click", () => {
    WebScribeHideNotePopup();
  });

  actions.appendChild(btnCancel);
  actions.appendChild(btnSave);

  WebScribeNotePopup.appendChild(textarea);
  WebScribeNotePopup.appendChild(actions);

  document.documentElement.appendChild(WebScribeNotePopup);
}

/**
 * Hooks selection-related events to show/hide the floating button.
 */
function WebScribeHookSelectionEvents() {
  document.addEventListener("mouseup", WebScribeHandleSelectionChange);
  document.addEventListener("keyup", WebScribeHandleSelectionChange);

  // Hide UI when clicking elsewhere
  document.addEventListener("mousedown", event => {
    if (
      WebScribeAddNoteButton &&
      WebScribeNotePopup &&
      !WebScribeAddNoteButton.contains(event.target) &&
      !WebScribeNotePopup.contains(event.target)
    ) {
      WebScribeHideAddNoteButton();
      WebScribeHideNotePopup();
    }
  });

  // On scroll, hide the button (position may no longer be correct)
  window.addEventListener("scroll", () => {
    WebScribeHideAddNoteButton();
    WebScribeHideNotePopup();
  });
}

/**
 * Handles a potential new selection and shows/hides the "Add note" button.
 */
function WebScribeHandleSelectionChange() {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    WebScribeHideAddNoteButton();
    return;
  }

  const range = selection.getRangeAt(0);

  // Ignore empty or whitespace-only selections
  const selectedText = selection.toString().trim();
  if (!selectedText) {
    WebScribeHideAddNoteButton();
    return;
  }

  // For simplicity and robustness of highlighting, only support
  // selections that stay within a single text node.
  if (
    range.startContainer !== range.endContainer ||
    range.startContainer.nodeType !== Node.TEXT_NODE
  ) {
    WebScribeHideAddNoteButton();
    return;
  }

  // Store the range for later use when user clicks "Add note"
  WebScribeCurrentSelectionRange = range.cloneRange();

  // Position the floating button near the selection
  const rect = range.getBoundingClientRect();
  WebScribePositionAddNoteButton(rect);
}

/**
 * Positions the floating "Add note" button near the given selection rect.
 */
function WebScribePositionAddNoteButton(rect) {
  const button = WebScribeAddNoteButton;
  if (!button) return;
  button.style.display = "block";

  const top = rect.top + window.scrollY - button.offsetHeight - 6;
  const left = rect.left + window.scrollX;

  button.style.top = `${Math.max(0, top)}px`;
  button.style.left = `${Math.max(0, left)}px`;
}

/**
 * Event handler when user clicks "Add note" for the current selection.
 */
function WebScribeOnAddNoteClicked() {
  if (!WebScribeCurrentSelectionRange) {
    WebScribeHideAddNoteButton();
    return;
  }

  const rect = WebScribeCurrentSelectionRange.getBoundingClientRect();
  const top = rect.bottom + window.scrollY + 4;
  const left = rect.left + window.scrollX;

  WebScribeNotePopup.style.top = `${Math.max(0, top)}px`;
  WebScribeNotePopup.style.left = `${Math.max(0, left)}px`;
  WebScribeNotePopupTextarea.value = "";
  WebScribeNotePopup.style.display = "block";
  WebScribeNotePopupTextarea.focus();
}

/**
 * Saves the annotation into chrome.storage.local and highlights the selected text.
 */
function WebScribeOnSaveAnnotation() {
  if (!WebScribeCurrentSelectionRange) {
    WebScribeHideNotePopup();
    WebScribeHideAddNoteButton();
    return;
  }

  const noteText = (WebScribeNotePopupTextarea.value || "").trim();
  if (!noteText) {
    WebScribeHideNotePopup();
    WebScribeHideAddNoteButton();
    return;
  }

  const selectionText = WebScribeCurrentSelectionRange.toString();
  if (!selectionText.trim()) {
    WebScribeHideNotePopup();
    WebScribeHideAddNoteButton();
    return;
  }

  const { startContainer, startOffset, endOffset } = WebScribeCurrentSelectionRange;
  const startPath = WebScribeGetNodePath(document.body, startContainer);
  const endPath = WebScribeGetNodePath(document.body, startContainer); // same text node

  if (!startPath || !endPath) {
    WebScribeHideNotePopup();
    WebScribeHideAddNoteButton();
    return;
  }

  const annotation = {
    id: WebScribeGenerateAnnotationId(),
    text: selectionText,
    note: noteText,
    createdAt: Date.now(),
    startPath,
    endPath,
    startOffset,
    endOffset
  };

  chrome.storage.local.get(WebScribe_ANNOT_PREFIX, data => {
    const existing = Array.isArray(data[WebScribe_ANNOT_PREFIX])
      ? data[WebScribe_ANNOT_PREFIX]
      : [];
    existing.push(annotation);
    chrome.storage.local.set({ [WebScribe_ANNOT_PREFIX]: existing }, () => {
      try {
        WebScribeApplyHighlightForAnnotation(annotation);
      } catch (err) {
        // Ignore highlight errors; data is still saved
      } finally {
        WebScribeHideNotePopup();
        WebScribeHideAddNoteButton();
        WebScribeCurrentSelectionRange = null;
      }
    });
  });
}

function WebScribeHideAddNoteButton() {
  if (WebScribeAddNoteButton) {
    WebScribeAddNoteButton.style.display = "none";
  }
}

function WebScribeHideNotePopup() {
  if (WebScribeNotePopup) {
    WebScribeNotePopup.style.display = "none";
  }
}

/**
 * Generates a reasonably unique string ID for each annotation.
 */
function WebScribeGenerateAnnotationId() {
  return (
    Date.now().toString(36) +
    "-" +
    Math.random().toString(36).slice(2, 8)
  );
}

/**
 * Computes a path of childIndexes from root → target node.
 */
function WebScribeGetNodePath(root, target) {
  const path = [];
  let node = target;
  while (node && node !== root) {
    const parent = node.parentNode;
    if (!parent) {
      return null;
    }
    const index = Array.prototype.indexOf.call(parent.childNodes, node);
    if (index === -1) {
      return null;
    }
    path.unshift(index);
    node = parent;
  }
  if (node !== root) {
    return null;
  }
  return path;
}

/**
 * Given a path array, traverses from root to find the node.
 */
function WebScribeGetNodeFromPath(root, path) {
  let node = root;
  for (let i = 0; i < path.length; i++) {
    const idx = path[i];
    if (!node.childNodes || idx >= node.childNodes.length) {
      return null;
    }
    node = node.childNodes[idx];
  }
  return node;
}

/**
 * Applies a highlight span for a given annotation, and adds tooltip with note.
 */
function WebScribeApplyHighlightForAnnotation(annotation) {
  const { startPath, startOffset, endOffset, id, note } = annotation;

  const startNode = WebScribeGetNodeFromPath(document.body, startPath);
  if (!startNode || startNode.nodeType !== Node.TEXT_NODE) return;

  const endNode = startNode; // single-node selection

  if (
    startOffset < 0 ||
    endOffset > startNode.textContent.length ||
    startOffset >= endOffset
  ) {
    return;
  }

  const range = document.createRange();
  range.setStart(startNode, startOffset);
  range.setEnd(endNode, endOffset);

  const span = document.createElement("span");
  span.className = "WebScribe-annotation-highlight";
  WebScribeApplyThemeClass(span);
  span.dataset.annotationId = id;
  span.dataset.note = note;
  span.title = note; // native tooltip

  try {
    range.surroundContents(span);
  } catch (e) {
    // If surroundContents fails (e.g., invalid range), skip for safety
  }
}

/**
 * Restores all annotations for this page URL from storage and highlights them.
 */
function WebScribeRestoreAnnotationsForPage() {
  chrome.storage.local.get(WebScribe_ANNOT_PREFIX, data => {
    const annotations = Array.isArray(data[WebScribe_ANNOT_PREFIX])
      ? data[WebScribe_ANNOT_PREFIX]
      : [];

    for (const annotation of annotations) {
      try {
        WebScribeApplyHighlightForAnnotation(annotation);
      } catch (err) {
        // Ignore failed highlights for individual annotations
      }
    }
  });
}

/**
 * Optional: for very dynamic pages, call this after large DOM changes
 * to attempt reapplying highlights.
 */
function WebScribeScheduleRestoreAnnotations() {
  if (WebScribeRestoreScheduled) return;
  WebScribeRestoreScheduled = true;
  setTimeout(() => {
    WebScribeRestoreScheduled = false;
    WebScribeRestoreAnnotationsForPage();
  }, 1000);
}
