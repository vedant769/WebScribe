# WebScribe

> A Chrome extension for taking contextual notes tied to each webpage you visit.

---

## ✨ Features

- 📝 Take notes directly tied to any webpage
- 🔍 Search through your notes
- 💾 Auto-saves as you type
- 🎨 Modern dark-themed UI
- 📌 Sidebar for quick in-page annotations
- 🖊️ Highlight and annotate text on any page

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
├── annotations.js          # Text highlight & annotation logic
├── annotations.css         # Annotation overlay styles
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
