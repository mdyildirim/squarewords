# SquareWords IQ

SquareWords IQ is a mobile-first, Gemini-powered twist on the classic word grid challenge. Each session uses the Gemini 2.5 Flash model to spin up a themed list of words, invite you to explore a shimmering letter board, and boost your evolving NeuroSpark IQ score.

## Features

- **Gemini 2.5 Flash generation** – fetch a new theme, word list, and hype insight on every load (or fall back to an offline puzzle).
- **Elegant, mobile-ready UI** – clean neon-glass aesthetic that works beautifully on phones and desktops.
- **Interactive word grid** – tap adjacent tiles to build and submit words from the themed quest list.
- **NeuroSpark IQ meter** – watch your IQ climb with every discovery and streak bonus.
- **Smart assistance** – request hints, shuffle the grid, or reveal the full list when you are stuck.
- **Shareable wins** – broadcast your triumph through the Web Share API or instant clipboard copies.

## Getting started

1. Serve the project with any static file server:

   ```bash
   python3 -m http.server 5173
   ```

   Then open [http://localhost:5173](http://localhost:5173) in your browser.

2. Click the **Gemini API** button to store your Google Gemini API key locally (saved in `localStorage`). If you skip this step the game will load the fallback puzzle.

3. Tap tiles to build words, press **Submit**, and keep your streak alive to chase the highest IQ.

### Gemini API requirements

- Create an API key at [Google AI Studio](https://aistudio.google.com/).
- Enable access to the **gemini-2.5-flash** model.
- The key never leaves your browser and can be cleared with the Gemini API dialog.

## Development notes

- All assets are static (`index.html`, `styles.css`, `app.js`).
- The game requests up to 14 words between four and seven letters to keep the board playable.
- The insight panel doubles as a motivational feed to keep players engaged.

Enjoy the lexical adventure!
