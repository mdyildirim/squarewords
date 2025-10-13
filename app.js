const BOARD_MIN_DIM = 4;
const BOARD_MAX_DIM = 6;
const BASE_IQ = 90;
const IQ_PER_WORD = 7;
const STREAK_BONUS = 3;
const GEMINI_MODEL = 'gemini-2.5-flash';
const LOG_TAG = '[SquareWords]';

const log = {
  info: (...args) => console.info(LOG_TAG, ...args),
  warn: (...args) => console.warn(LOG_TAG, ...args),
  error: (...args) => console.error(LOG_TAG, ...args),
  debug: (...args) => console.debug(LOG_TAG, ...args)
};

log.info('Client bundle parsed', { time: new Date().toISOString() });
window.addEventListener('load', () => {
  log.info('Page load complete', { time: new Date().toISOString() });
});
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
    'Today\'s grid is tuned for dreamers. Chase luminous patterns, stack quick wins, and your NeuroSpark IQ will skyrocket.',
  theme: 'Cosmic Curiosity'
};

const boardEl = document.querySelector('#board');
const wordListEl = document.querySelector('#wordList');
const currentWordEl = document.querySelector('#currentWord');
const wordsFoundEl = document.querySelector('#wordsFound');
const iqValueEl = document.querySelector('#iqValue');
const iqFillEl = document.querySelector('#iqFill');
const streakValueEl = document.querySelector('#streakValue');
const insightMessageEl = document.querySelector('#insightMessage');
const hintBtn = document.querySelector('#hintBtn');
const revealBtn = document.querySelector('#revealBtn');
const submitBtn = document.querySelector('#submitBtn');
const clearBtn = document.querySelector('#clearBtn');
const shuffleBtn = document.querySelector('#shuffleBtn');
const shareBtn = document.querySelector('#shareBtn');
const wordTemplate = document.querySelector('#wordTemplate');

const dragState = {
  active: false,
  pointerId: null,
  originTile: null
};

const state = {
  targetWords: [],
  insight: '',
  theme: '',
  boardLetters: [],
  gridDim: 5,
  selected: [],
  found: new Set(),
  wordItems: new Map(),
  iqScore: BASE_IQ,
  streak: 0,
  hintsUsed: 0,
  wordPlacements: []
};

async function fetchGeminiPuzzle() {
  const timerLabel = 'puzzle-fetch';
  try {
    log.info('Requesting puzzle from API endpoint');
    console.time(timerLabel);
    const response = await fetch('/api/puzzle', { cache: 'no-store' });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const puzzle = await response.json();
    console.timeEnd(timerLabel);
    log.info('Puzzle payload received', {
      wordCount: Array.isArray(puzzle.words) ? puzzle.words.length : 0
    });
    if (!Array.isArray(puzzle.words) || !puzzle.words.length) {
      throw new Error('Invalid words payload');
    }

    return {
      words: [...new Set(puzzle.words.map((word) => word.toLowerCase()))],
      insight: puzzle.insight || 'Lexicon locked and loaded—time to flex!',
      theme: puzzle.theme || 'Freestyle Flow'
    };
  } catch (error) {
    try {
      console.timeEnd(timerLabel);
    } catch (timerError) {
      log.debug('Timer already settled', timerError.message);
    }
    log.warn('Remote puzzle fetch failed, using fallback puzzle.', error);
    return {
      words: [...DEFAULT_PUZZLE.words],
      insight: DEFAULT_PUZZLE.insight,
      theme: DEFAULT_PUZZLE.theme
    };
  }
}

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function getNeighborIndices(index, gridDim) {
  const neighbors = [];
  const row = Math.floor(index / gridDim);
  const col = index % gridDim;
  for (let r = Math.max(0, row - 1); r <= Math.min(gridDim - 1, row + 1); r++) {
    for (let c = Math.max(0, col - 1); c <= Math.min(gridDim - 1, col + 1); c++) {
      if (r === row && c === col) continue;
      neighbors.push(r * gridDim + c);
    }
  }
  return neighbors;
}

function generateFallbackLayout(words) {
  log.warn('Falling back to frequency-based board layout');
  const letterRequirements = new Map();
  for (const word of words) {
    const counts = new Map();
    for (const char of word) {
      if (!/[A-Z]/.test(char)) continue;
      counts.set(char, (counts.get(char) || 0) + 1);
    }
    for (const [char, count] of counts.entries()) {
      letterRequirements.set(char, Math.max(letterRequirements.get(char) || 0, count));
    }
  }

  let letters = [];
  for (const [char, count] of letterRequirements.entries()) {
    letters.push(...Array.from({ length: count }, () => char));
  }

  const gridDim = Math.min(
    BOARD_MAX_DIM,
    Math.max(BOARD_MIN_DIM, Math.ceil(Math.sqrt(Math.max(letters.length, BOARD_MIN_DIM ** 2))))
  );
  const boardSlots = gridDim * gridDim;
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  while (letters.length < boardSlots) {
    letters.push(alphabet[Math.floor(Math.random() * alphabet.length)]);
  }
  shuffleArray(letters);

  return {
    letters: letters.slice(0, boardSlots),
    gridDim,
    placements: []
  };
}

function tryPlaceWordOnBoard(word, board, gridDim) {
  const totalCells = board.length;
  const uppercase = word.toUpperCase();
  const startCandidates = [];
  for (let i = 0; i < totalCells; i++) {
    const cell = board[i];
    if (cell === null || cell === uppercase[0]) {
      startCandidates.push(i);
    }
  }
  shuffleArray(startCandidates);

  for (const start of startCandidates) {
    const path = new Array(uppercase.length);
    const visited = new Set();

    const search = (index, depth) => {
      const letter = uppercase[depth];
      const current = board[index];
      if (current !== null && current !== letter) {
        return false;
      }

      path[depth] = index;
      visited.add(index);

      if (depth === uppercase.length - 1) {
        return true;
      }

      const neighbors = shuffleArray(getNeighborIndices(index, gridDim));
      for (const neighbor of neighbors) {
        if (visited.has(neighbor)) continue;
        if (search(neighbor, depth + 1)) {
          return true;
        }
      }

      visited.delete(index);
      return false;
    };

    if (search(start, 0)) {
      path.forEach((cellIndex, position) => {
        board[cellIndex] = uppercase[position];
      });
      return path;
    }
  }

  return null;
}

function generateBoardLayout(words) {
  const uppercaseWords = words
    .map((word) => word.toUpperCase())
    .filter((word) => /^[A-Z]+$/.test(word));
  if (uppercaseWords.length !== words.length) {
    log.warn('Filtered non-alphabetic entries from word list', {
      original: words.length,
      sanitized: uppercaseWords.length
    });
  }
  const sortedWords = [...uppercaseWords].sort((a, b) => b.length - a.length);
  const longest = sortedWords[0]?.length || BOARD_MIN_DIM;
  const minDim = Math.max(BOARD_MIN_DIM, Math.ceil(Math.sqrt(longest)));
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  for (let gridDim = minDim; gridDim <= BOARD_MAX_DIM; gridDim++) {
    for (let attempt = 0; attempt < 60; attempt++) {
      const board = Array(gridDim * gridDim).fill(null);
      const placements = [];
      let success = true;

      for (const word of sortedWords) {
        const path = tryPlaceWordOnBoard(word, board, gridDim);
        if (!path) {
          success = false;
          break;
        }
        placements.push({ word, path });
      }

      if (success) {
        const letters = board.map((cell) => cell ?? alphabet[Math.floor(Math.random() * alphabet.length)]);
        log.info('Generated structured board layout', { gridDim, attempt: attempt + 1 });
        return { letters, gridDim, placements };
      }
    }
  }

  return generateFallbackLayout(sortedWords);
}

function renderBoard() {
  boardEl.innerHTML = '';
  document.documentElement.style.setProperty('--board-size', state.gridDim);
  state.selected = [];
  updateCurrentWord();

  state.boardLetters.forEach((letter, index) => {
    const tile = document.createElement('button');
    tile.type = 'button';
    tile.className = 'tile';
    tile.textContent = letter;
    tile.dataset.index = index;
    tile.setAttribute('aria-label', `Letter ${letter}`);
    tile.addEventListener('pointerdown', (event) => handlePointerDown(event, tile, index));
    tile.addEventListener('pointerenter', (event) => handlePointerEnter(event, tile, index));
    boardEl.appendChild(tile);
  });

  if (state.wordPlacements.length) {
    log.info('Board rendered with placements');
    console.table(
      state.wordPlacements.map((placement) => ({
        word: placement.word,
        path: placement.path.join(' → ')
      }))
    );
  } else {
    log.info('Board rendered without placement metadata');
  }
}

function updateCurrentWord(message) {
  if (message) {
    currentWordEl.textContent = message;
    return;
  }
  const word = state.selected.map((index) => state.boardLetters[index]).join('');
  currentWordEl.textContent = word ? word : 'Tap or swipe tiles to build a word';
}

function clearSelection(options = {}) {
  state.selected = [];
  boardEl.querySelectorAll('.tile').forEach((tile) => tile.classList.remove('active'));
  if (options.silent) {
    updateCurrentWord();
  } else {
    updateCurrentWord('Start a fresh path.');
  }
}

function handlePointerDown(event, tile, index) {
  if (tile.classList.contains('disabled')) return;

  event.preventDefault();

  if (state.selected[state.selected.length - 1] === index) {
    state.selected.pop();
    tile.classList.remove('active');
    updateCurrentWord();
    return;
  }

  const alreadySelected = state.selected.includes(index);
  const continuation = !alreadySelected && state.selected.length > 0 && isAdjacent(index);

  if (!continuation || alreadySelected) {
    clearSelection({ silent: true });
  }

  selectTile(tile, index);

  dragState.active = true;
  dragState.pointerId = event.pointerId;
  dragState.originTile = tile;
  tile.setPointerCapture?.(event.pointerId);
  document.addEventListener('pointermove', handlePointerMove);
  document.addEventListener('pointerup', handlePointerUp);
  document.addEventListener('pointercancel', handlePointerUp);
}

function handlePointerEnter(event, tile, index) {
  if (!dragState.active || dragState.pointerId !== event.pointerId) {
    return;
  }

  processTileInteraction(tile, index);
}

function handlePointerUp(event) {
  if (!dragState.active || dragState.pointerId !== event.pointerId) {
    return;
  }

  dragState.active = false;
  dragState.pointerId = null;
  dragState.originTile?.releasePointerCapture?.(event.pointerId);
  dragState.originTile = null;
  document.removeEventListener('pointermove', handlePointerMove);
  document.removeEventListener('pointerup', handlePointerUp);
  document.removeEventListener('pointercancel', handlePointerUp);
}

function handlePointerMove(event) {
  if (!dragState.active || dragState.pointerId !== event.pointerId) {
    return;
  }

  const element = document.elementFromPoint(event.clientX, event.clientY);
  if (!element) return;
  const tile = element.closest('.tile');
  if (!tile) return;
  const index = Number.parseInt(tile.dataset.index, 10);
  if (Number.isNaN(index)) return;

  processTileInteraction(tile, index);
}

function processTileInteraction(tile, index) {
  if (tile.classList.contains('disabled')) return;
  if (state.selected[state.selected.length - 1] === index) {
    return;
  }

  const backtrackIndex = state.selected[state.selected.length - 2];
  if (typeof backtrackIndex === 'number' && backtrackIndex === index) {
    const removed = state.selected.pop();
    const removedTile = boardEl.querySelector(`[data-index="${removed}"]`);
    if (removedTile) {
      removedTile.classList.remove('active');
    }
    updateCurrentWord();
    return;
  }

  selectTile(tile, index, { silentFail: true });
}

function selectTile(tile, index, options = {}) {
  const { silentFail = false } = options;

  if (tile.classList.contains('disabled')) return false;

  if (state.selected.includes(index)) {
    return false;
  }

  if (!isAdjacent(index)) {
    if (!silentFail) {
      flashMessage('Connect adjacent tiles only.');
    }
    return false;
  }

  state.selected.push(index);
  tile.classList.add('active');
  updateCurrentWord();
  return true;
}

function isAdjacent(index) {
  const lastIndex = state.selected[state.selected.length - 1];
  if (typeof lastIndex !== 'number') {
    return true;
  }

  const { gridDim } = state;
  const row = Math.floor(index / gridDim);
  const col = index % gridDim;
  const lastRow = Math.floor(lastIndex / gridDim);
  const lastCol = lastIndex % gridDim;
  return Math.abs(row - lastRow) <= 1 && Math.abs(col - lastCol) <= 1;
}

function submitWord() {
  const guess = state.selected.map((index) => state.boardLetters[index]).join('').toLowerCase();
  if (!guess) {
    flashMessage('Select letters to make a word.');
    return;
  }
  clearSelection();

  if (state.found.has(guess)) {
    flashMessage('You already banked that word.');
    return;
  }

  if (!state.targetWords.includes(guess)) {
    state.streak = 0;
    updateStreak();
    flashMessage('Nice try! That word is not on today\'s list.');
    return;
  }

  state.found.add(guess);
  updateWordListItem(guess, true);
  state.streak += 1;
  updateStreak();
  updateIqScore();
  updateWordsFound();
  flashMessage(`✨ ${guess.toUpperCase()} unlocked!`);

  if (state.found.size === state.targetWords.length) {
    flashMessage('You solved the entire vault!');
  }
}

function updateIqScore() {
  const boost = state.found.size * IQ_PER_WORD + Math.max(0, state.streak - 1) * STREAK_BONUS;
  state.iqScore = BASE_IQ + boost;
  iqValueEl.textContent = state.iqScore;
  const meterWidth = Math.min(100, ((state.iqScore - BASE_IQ) / (IQ_PER_WORD * state.targetWords.length + 80)) * 100 + 20);
  iqFillEl.style.width = `${meterWidth}%`;
  iqFillEl.parentElement.setAttribute('aria-valuenow', state.iqScore);
}

function updateStreak() {
  streakValueEl.textContent = state.streak;
}

function updateWordsFound() {
  wordsFoundEl.textContent = `${state.found.size}/${state.targetWords.length}`;
}

function flashMessage(text) {
  updateCurrentWord(text);
  setTimeout(() => updateCurrentWord(), 1800);
}

function updateWordList(words) {
  wordListEl.innerHTML = '';
  state.wordItems.clear();
  const sorted = [...words].sort((a, b) => a.localeCompare(b));
  sorted.forEach((word) => {
    const clone = wordTemplate.content.firstElementChild.cloneNode(true);
    clone.querySelector('.word').textContent = word.toUpperCase();
    clone.querySelector('.status').textContent = 'Locked';
    clone.dataset.word = word;
    state.wordItems.set(word, clone);
    wordListEl.appendChild(clone);
  });
}

function updateWordListItem(word, found) {
  const item = state.wordItems.get(word);
  if (!item) return;
  if (found) {
    item.classList.add('found');
    item.querySelector('.status').textContent = 'Found';
  } else {
    item.classList.remove('found');
    item.querySelector('.status').textContent = 'Revealed';
  }
}

function provideHint() {
  const remaining = state.targetWords.filter((word) => !state.found.has(word));
  if (!remaining.length) {
    flashMessage('All words solved—no hints needed!');
    return;
  }
  state.hintsUsed += 1;
  const pick = remaining[Math.floor(Math.random() * remaining.length)];
  const hint = `${pick.slice(0, Math.min(3, pick.length - 1)).toUpperCase()}… (${pick.length} letters)`;
  flashMessage(`Hint ${state.hintsUsed}: ${hint}`);
}

function revealAll() {
  state.targetWords.forEach((word) => {
    if (!state.found.has(word)) {
      updateWordListItem(word, false);
    }
  });
  flashMessage('Puzzle revealed. Ready for a fresh run?');
}

function shuffleBoard() {
  for (let i = state.boardLetters.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [state.boardLetters[i], state.boardLetters[j]] = [state.boardLetters[j], state.boardLetters[i]];
  }
  state.wordPlacements = [];
  renderBoard();
  flashMessage('Grid remixed. Follow the flow!');
  log.info('Board shuffled and placement metadata cleared');
}

async function shareProgress() {
  const percentage = state.targetWords.length
    ? Math.round((state.found.size / state.targetWords.length) * 100)
    : 0;
  const text = `I\'m playing SquareWords IQ (${state.theme}) and hit ${state.iqScore} IQ with ${percentage}% of the board cracked!`;
  const shareData = {
    title: 'SquareWords IQ',
    text,
    url: window.location.href
  };

  if (navigator.share) {
    try {
      await navigator.share(shareData);
    } catch (error) {
      console.warn('Share canceled', error);
    }
    return;
  }

  try {
    await navigator.clipboard.writeText(`${text}\n${window.location.href}`);
    flashMessage('Link copied—spread the genius!');
  } catch (error) {
    console.warn('Clipboard failed', error);
    flashMessage('Could not share automatically. Copy manually!');
  }
}

async function loadPuzzle() {
  log.info('Puzzle load started');
  console.time('puzzle-bootstrap');
  boardEl.classList.add('loading');
  insightMessageEl.textContent = 'Generating a fresh puzzle…';
  const puzzle = await fetchGeminiPuzzle();
  boardEl.classList.remove('loading');

  state.targetWords = puzzle.words.map((word) => word.toLowerCase());
  state.insight = puzzle.insight;
  state.theme = puzzle.theme;
  state.found.clear();
  state.selected = [];
  state.hintsUsed = 0;
  state.streak = 0;
  state.iqScore = BASE_IQ;

  const { letters, gridDim, placements } = generateBoardLayout(state.targetWords);
  state.boardLetters = letters;
  state.gridDim = gridDim;
  state.wordPlacements = placements;

  insightMessageEl.innerHTML = `<strong>${state.theme}</strong> — ${state.insight}`;
  updateWordList(state.targetWords);
  renderBoard();
  updateWordsFound();
  updateIqScore();
  updateStreak();
  console.timeEnd('puzzle-bootstrap');
  log.info('Puzzle ready', {
    gridDim: state.gridDim,
    targetWords: state.targetWords.length
  });
}

function registerEvents() {
  submitBtn.addEventListener('click', submitWord);
  clearBtn.addEventListener('click', () => clearSelection());
  hintBtn.addEventListener('click', provideHint);
  revealBtn.addEventListener('click', revealAll);
  shuffleBtn.addEventListener('click', shuffleBoard);
  shareBtn.addEventListener('click', shareProgress);
  document.addEventListener('keydown', (event) => {
    const target = event.target;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
      return;
    }
    if (event.key === 'Enter') {
      submitWord();
    } else if (event.key === 'Backspace' || event.key === 'Escape') {
      clearSelection();
    }
  });
}

function bootstrap() {
  log.info('Bootstrap invoked');
  registerEvents();
  loadPuzzle();
}

bootstrap();
