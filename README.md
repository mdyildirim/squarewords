# SquareWords IQ

SquareWords IQ is a mobile-first, Gemini-powered twist on the classic word grid challenge. Each session uses the Gemini 2.5 Flash model to spin up a themed list of words, invite you to explore a shimmering letter board, and boost your evolving NeuroSpark IQ score.

## Features

- **Gemini 2.5 Flash generation** – fetch a new theme, word list, and hype insight on every load (or fall back to an offline puzzle).
- **Elegant, mobile-ready UI** – clean neon-glass aesthetic that works beautifully on phones and desktops.
- **Interactive word grid** – tap or swipe adjacent tiles to build and submit words from the themed quest list.
- **NeuroSpark IQ meter** – watch your IQ climb with every discovery and streak bonus.
- **Smart assistance** – request hints, shuffle the grid, or reveal the full list when you are stuck.
- **Shareable wins** – broadcast your triumph through the Web Share API or instant clipboard copies.

## Getting started

1. Install dependencies and start the Express server (the server also serves the static assets):

   ```bash
   npm install
   GEMINI_API_KEY=your-key-here npm start
   ```

   Open [http://localhost:3000](http://localhost:3000) in your browser.

2. Tap or swipe across adjacent tiles to build words, press **Submit**, and keep your streak alive to chase the highest IQ.

### Gemini API requirements

- Create an API key at [Google AI Studio](https://aistudio.google.com/).
- Enable access to the **gemini-2.5-flash** model.
- Store the key in the `GEMINI_API_KEY` environment variable before starting the server. The browser never sees the raw key—the Express backend proxies requests to Gemini.

## Development notes

- Static assets (`index.html`, `styles.css`, `app.js`) are served by a lightweight Express proxy (`server.js`).
- The game requests up to 14 words between four and seven letters to keep the board playable.
- The insight panel doubles as a motivational feed to keep players engaged.

Enjoy the lexical adventure!
