# WebScribe

> A Chrome extension for taking contextual notes tied to each webpage you visit.

---

## ✨ Features

### 📝 Page Notes
- Write notes directly tied to any webpage URL
- Auto-saves as you type with debounced saving
- Tag your notes for easy organization
- Word count displayed in real time

### 🖊️ Text Annotations
- Select any text on a page and click **"Add note"** to annotate it
- Highlighted text is preserved with a gold underline
- Hover over highlights to view the note and **delete** annotations you no longer need
- Annotations are stored per-page and persist across sessions

### 🔍 Search & History
- **All Notes** — search across every saved note and annotation
- **History** — view recent notes filtered to the current tab
- Annotation cards show a 📌 badge and the quoted selected text
- Click an annotation in History to **scroll to it on the page** with a 2× blink effect
- Click a note from a different page to open it in a new tab

### 🎨 Theming
- Toggle between **light** and **dark** themes
- Theme syncs across popup, sidebar, and in-page annotations in real time

### 📤 Export
- Export all notes as a `.txt` file from the All Notes tab

### 📌 Sidebar
- In-page floating sidebar for quick note-taking without opening the popup

---

## 📁 Project Structure

```
WebScribe/
├── icons/                  # Extension icons
│   ├── icon16.png          # 16×16 toolbar icon
│   ├── icon32.png          # 32×32 icon
│   ├── icon48.png          # 48×48 extensions page icon
│   ├── icon128.png         # 128×128 store / install icon
│   └── screen.png          # Original source logo
│
├── manifest.json           # Chrome extension manifest (MV3)
├── popup.html              # Extension popup UI
├── popup.css               # Popup styles
├── popup.js                # Popup logic & note management
├── background.js           # Service worker (context menus, events)
├── contentScript.js        # Injected into pages (sidebar trigger)
├── annotations.js          # Text highlight, annotation & delete logic
├── annotations.css         # Annotation overlay & tooltip styles
├── sidebar.css             # Sidebar panel styles
│
├── .gitignore
├── LICENSE
└── README.md
```

---

## 🚀 Installation (Load Unpacked)

1. Clone or download this repository
2. Open Chrome and go to `chrome://extensions`
3. Enable **Developer mode** (top right toggle)
4. Click **Load unpacked**
5. Select the `WebScribe` root folder
6. The WebScribe icon will appear in your toolbar

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Extension API | Chrome MV3 |
| UI | HTML, CSS (Vanilla) |
| Logic | JavaScript (Vanilla) |
| Storage | Chrome Storage API |

---

## 📄 License

[MIT](LICENSE)
