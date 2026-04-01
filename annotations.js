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

const WEBNOTES_ANNOT_PREFIX = "annotations:" + window.location.href;

// Reused DOM elements for UI
let webnotesAddNoteButton = null;
let webnotesNotePopup = null;
let webnotesNotePopupTextarea = null;
let webnotesCurrentSelectionRange = null; // Range for which we are creating a note

// Debounced re-application (for dynamic pages, if used)
let webnotesRestoreScheduled = false;

// Initialize after DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", webnotesInitAnnotations);
} else {
  webnotesInitAnnotations();
}

function webnotesInitAnnotations() {
  webnotesCreateFloatingButton();
  webnotesCreateNotePopup();
  webnotesHookSelectionEvents();
  webnotesRestoreAnnotationsForPage();
}

/**
 * Creates the floating "Add note" button (hidden by default).
 */
function webnotesCreateFloatingButton() {
  webnotesAddNoteButton = document.createElement("button");
  webnotesAddNoteButton.textContent = "Add note";
  webnotesAddNoteButton.className = "webnotes-add-note-btn";
  webnotesAddNoteButton.style.display = "none";

  webnotesAddNoteButton.addEventListener("click", webnotesOnAddNoteClicked);
  document.documentElement.appendChild(webnotesAddNoteButton);
}

/**
 * Creates the small note input popup (hidden by default).
 */
function webnotesCreateNotePopup() {
  webnotesNotePopup = document.createElement("div");
  webnotesNotePopup.className = "webnotes-note-popup";
  webnotesNotePopup.style.display = "none";

  const textarea = document.createElement("textarea");
  textarea.placeholder = "Write a note for this selection...";
  webnotesNotePopupTextarea = textarea;

  const actions = document.createElement("div");
  actions.className = "webnotes-note-popup-actions";

  const btnSave = document.createElement("button");
  btnSave.textContent = "Save";
  btnSave.className = "webnotes-note-popup-btn save";
  btnSave.addEventListener("click", webnotesOnSaveAnnotation);

  const btnCancel = document.createElement("button");
  btnCancel.textContent = "Cancel";
  btnCancel.className = "webnotes-note-popup-btn cancel";
  btnCancel.addEventListener("click", () => {
    webnotesHideNotePopup();
  });

  actions.appendChild(btnCancel);
  actions.appendChild(btnSave);

  webnotesNotePopup.appendChild(textarea);
  webnotesNotePopup.appendChild(actions);

  document.documentElement.appendChild(webnotesNotePopup);
}

/**
 * Hooks selection-related events to show/hide the floating button.
 */
function webnotesHookSelectionEvents() {
  document.addEventListener("mouseup", webnotesHandleSelectionChange);
  document.addEventListener("keyup", webnotesHandleSelectionChange);

  // Hide UI when clicking elsewhere
  document.addEventListener("mousedown", event => {
    if (
      webnotesAddNoteButton &&
      webnotesNotePopup &&
      !webnotesAddNoteButton.contains(event.target) &&
      !webnotesNotePopup.contains(event.target)
    ) {
      webnotesHideAddNoteButton();
      webnotesHideNotePopup();
    }
  });

  // On scroll, hide the button (position may no longer be correct)
  window.addEventListener("scroll", () => {
    webnotesHideAddNoteButton();
    webnotesHideNotePopup();
  });
}

/**
 * Handles a potential new selection and shows/hides the "Add note" button.
 */
function webnotesHandleSelectionChange() {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    webnotesHideAddNoteButton();
    return;
  }

  const range = selection.getRangeAt(0);

  // Ignore empty or whitespace-only selections
  const selectedText = selection.toString().trim();
  if (!selectedText) {
    webnotesHideAddNoteButton();
    return;
  }

  // For simplicity and robustness of highlighting, only support
  // selections that stay within a single text node.
  if (
    range.startContainer !== range.endContainer ||
    range.startContainer.nodeType !== Node.TEXT_NODE
  ) {
    webnotesHideAddNoteButton();
    return;
  }

  // Store the range for later use when user clicks "Add note"
  webnotesCurrentSelectionRange = range.cloneRange();

  // Position the floating button near the selection
  const rect = range.getBoundingClientRect();
  webnotesPositionAddNoteButton(rect);
}

/**
 * Positions the floating "Add note" button near the given selection rect.
 */
function webnotesPositionAddNoteButton(rect) {
  const button = webnotesAddNoteButton;
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
function webnotesOnAddNoteClicked() {
  if (!webnotesCurrentSelectionRange) {
    webnotesHideAddNoteButton();
    return;
  }

  const rect = webnotesCurrentSelectionRange.getBoundingClientRect();
  const top = rect.bottom + window.scrollY + 4;
  const left = rect.left + window.scrollX;

  webnotesNotePopup.style.top = `${Math.max(0, top)}px`;
  webnotesNotePopup.style.left = `${Math.max(0, left)}px`;
  webnotesNotePopupTextarea.value = "";
  webnotesNotePopup.style.display = "block";
  webnotesNotePopupTextarea.focus();
}

/**
 * Saves the annotation into chrome.storage.local and highlights the selected text.
 */
function webnotesOnSaveAnnotation() {
  if (!webnotesCurrentSelectionRange) {
    webnotesHideNotePopup();
    webnotesHideAddNoteButton();
    return;
  }

  const noteText = (webnotesNotePopupTextarea.value || "").trim();
  if (!noteText) {
    webnotesHideNotePopup();
    webnotesHideAddNoteButton();
    return;
  }

  const selectionText = webnotesCurrentSelectionRange.toString();
  if (!selectionText.trim()) {
    webnotesHideNotePopup();
    webnotesHideAddNoteButton();
    return;
  }

  const { startContainer, startOffset, endOffset } = webnotesCurrentSelectionRange;
  const startPath = webnotesGetNodePath(document.body, startContainer);
  const endPath = webnotesGetNodePath(document.body, startContainer); // same text node

  if (!startPath || !endPath) {
    webnotesHideNotePopup();
    webnotesHideAddNoteButton();
    return;
  }

  const annotation = {
    id: webnotesGenerateAnnotationId(),
    text: selectionText,
    note: noteText,
    createdAt: Date.now(),
    startPath,
    endPath,
    startOffset,
    endOffset
  };

  chrome.storage.local.get(WEBNOTES_ANNOT_PREFIX, data => {
    const existing = Array.isArray(data[WEBNOTES_ANNOT_PREFIX])
      ? data[WEBNOTES_ANNOT_PREFIX]
      : [];
    existing.push(annotation);
    chrome.storage.local.set({ [WEBNOTES_ANNOT_PREFIX]: existing }, () => {
      try {
        webnotesApplyHighlightForAnnotation(annotation);
      } catch (err) {
        // Ignore highlight errors; data is still saved
      } finally {
        webnotesHideNotePopup();
        webnotesHideAddNoteButton();
        webnotesCurrentSelectionRange = null;
      }
    });
  });
}

function webnotesHideAddNoteButton() {
  if (webnotesAddNoteButton) {
    webnotesAddNoteButton.style.display = "none";
  }
}

function webnotesHideNotePopup() {
  if (webnotesNotePopup) {
    webnotesNotePopup.style.display = "none";
  }
}

/**
 * Generates a reasonably unique string ID for each annotation.
 */
function webnotesGenerateAnnotationId() {
  return (
    Date.now().toString(36) +
    "-" +
    Math.random().toString(36).slice(2, 8)
  );
}

/**
 * Computes a path of childIndexes from root → target node.
 */
function webnotesGetNodePath(root, target) {
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
function webnotesGetNodeFromPath(root, path) {
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
function webnotesApplyHighlightForAnnotation(annotation) {
  const { startPath, startOffset, endOffset, id, note } = annotation;

  const startNode = webnotesGetNodeFromPath(document.body, startPath);
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
  span.className = "webnotes-annotation-highlight";
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
function webnotesRestoreAnnotationsForPage() {
  chrome.storage.local.get(WEBNOTES_ANNOT_PREFIX, data => {
    const annotations = Array.isArray(data[WEBNOTES_ANNOT_PREFIX])
      ? data[WEBNOTES_ANNOT_PREFIX]
      : [];

    for (const annotation of annotations) {
      try {
        webnotesApplyHighlightForAnnotation(annotation);
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
function webnotesScheduleRestoreAnnotations() {
  if (webnotesRestoreScheduled) return;
  webnotesRestoreScheduled = true;
  setTimeout(() => {
    webnotesRestoreScheduled = false;
    webnotesRestoreAnnotationsForPage();
  }, 1000);
}

