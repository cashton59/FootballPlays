# 🏈 Football Play Creator

A 6-on-6 flag football play designer built with **React + Vite**. Draw routes, place players, save plays, and print formatted play sheets — all in the browser.

## Features

- Place circle or square players in any color
- Draw straight, dashed (motion), and smooth curved routes
- Arrow / T-bar / dot / no-marker route endings
- Select & drag players to reposition
- Erase tool for players and routes
- Unlimited undo (Ctrl+Z)
- Save & reload plays (persisted in `localStorage`)
- Duplicate & rename saved plays
- Print preview — 4-per-page (2×2) or 6-per-page (2×3), landscape

## Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Start the dev server
npm run dev

# 3. Open http://localhost:5173
```

## Build for Production

```bash
npm run build
# Output is in /dist
```

## Project Structure

```
football-play-creator/
├── index.html
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── package.json
└── src/
    ├── main.jsx       ← React entry point
    ├── index.css      ← Tailwind base styles
    └── App.jsx        ← Full Football Play Creator component
```

## Notes

- Plays are stored in `localStorage` under the key `fpc-plays`.
- The canvas is 630×470px — it scales down on smaller screens via `maxWidth: 100%`.
- Print via **Ctrl+P / Cmd+P** while the Print Preview overlay is open for best results.
