import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const GEMINI_MODEL = 'gemini-2.5-flash';
const PORT = process.env.PORT || 3000;
const LOG_TAG = '[SquareWords:server]';

const log = {
  info: (...args) => console.info(LOG_TAG, ...args),
  warn: (...args) => console.warn(LOG_TAG, ...args),
  error: (...args) => console.error(LOG_TAG, ...args)
};

const DEFAULT_PUZZLE = {
  words: [
    'nebula',
    'orbit',
    'quartz',
    'mystic',
    'riddle',
    'pixel',
    'sonic',
    'lunar',
    'glyph',
    'vivid',
    'nova',
    'spark'
  ],
  insight:
    "Today's grid is tuned for dreamers. Chase luminous patterns, stack quick wins, and your NeuroSpark IQ will skyrocket.",
  theme: 'Cosmic Curiosity'
};

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(express.static(__dirname));

app.get('/api/puzzle', async (req, res) => {
  const requestId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const requestStart = Date.now();
  log.info('Incoming puzzle request', {
    requestId,
    time: new Date().toISOString(),
    ip: req.ip
  });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    log.warn('GEMINI_API_KEY missing, serving default puzzle', { requestId });
    res.json({
      words: [...DEFAULT_PUZZLE.words],
      insight: DEFAULT_PUZZLE.insight,
      theme: DEFAULT_PUZZLE.theme
    });
    log.info('Puzzle request completed with fallback data', {
      requestId,
      totalMs: Date.now() - requestStart
    });
    return;
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
  const prompt = `You are creating the daily puzzle for a mobile word-grid game similar to Boggle.\nReturn a strict JSON object with keys "words", "insight", and "theme".\n- "words" must be an array of 10 to 14 unique English nouns, verbs, or adjectives, each 4-7 letters long, lowercase.\n- "insight" must be a short (max 220 characters) hype message that references the theme and encourages the player.\n- "theme" must be 2-3 words describing the shared mood of the list.\nExample:\n{"words":["gleam","craft"],"insight":"...","theme":"Creative Spark"}\nRespond with JSON only.`;

  try {
    const remoteStart = Date.now();
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }]
          }
        ]
      })
    });

    log.info('Gemini response received', {
      requestId,
      status: response.status,
      latencyMs: Date.now() - remoteStart
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const payload = await response.json();
    const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!text) {
      throw new Error('No content returned');
    }

    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}');
    if (jsonStart === -1 || jsonEnd === -1) {
      throw new Error('Invalid JSON payload');
    }

    const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1));
    if (!Array.isArray(parsed.words) || !parsed.words.length) {
      throw new Error('Invalid words payload');
    }

    const uniqueWords = [...new Set(parsed.words.map((word) => word.toLowerCase()))];
    const result = {
      words: uniqueWords,
      insight: parsed.insight || 'Lexicon locked and loaded—time to flex!',
      theme: parsed.theme || 'Freestyle Flow'
    };
    log.info('Gemini payload parsed successfully', {
      requestId,
      wordCount: result.words.length
    });
    res.json(result);
  } catch (error) {
    log.error('Failed to fetch puzzle from Gemini', {
      requestId,
      message: error.message
    });
    res.json({
      words: [...DEFAULT_PUZZLE.words],
      insight: DEFAULT_PUZZLE.insight,
      theme: DEFAULT_PUZZLE.theme
    });
    log.warn('Served fallback puzzle after Gemini failure', { requestId });
  } finally {
    log.info('Puzzle request completed', {
      requestId,
      totalMs: Date.now() - requestStart
    });
  }
});

app.listen(PORT, () => {
  log.info(`Server listening on port ${PORT}`);
});
