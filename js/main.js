import { Game } from './game.js';
import { SaveSystem } from './saveSystem.js';
import { LEVELS } from './levels.js';
import { formatTime } from './hud.js';

// ---- Screen helpers ----
const screens = {
  loading: document.getElementById('loading'),
  mainMenu: document.getElementById('main-menu'),
  levelSelect: document.getElementById('level-select'),
  pause: document.getElementById('pause-menu'),
  complete: document.getElementById('level-complete'),
};

function show(el) { el.classList.remove('hidden'); }
function hide(el) { el.classList.add('hidden'); }
function hideAllMenus() {
  hide(screens.mainMenu);
  hide(screens.levelSelect);
  hide(screens.pause);
  hide(screens.complete);
}

// ---- Boot ----
SaveSystem.load();

const canvas = document.getElementById('game-canvas');
let game = null;

function ensureGame() {
  if (!game) {
    game = new Game(canvas, {
      onLevelComplete: showLevelComplete,
      onPauseMenu: (open) => {
        if (open) show(screens.pause);
        else hide(screens.pause);
      },
    });
    game.start();
  }
  return game;
}

// ---- Main menu ----
document.getElementById('btn-play').addEventListener('click', () => {
  const idx = SaveSystem.data.currentLevel ?? 0;
  startLevel(idx);
});

document.getElementById('btn-levels').addEventListener('click', () => {
  buildLevelGrid();
  hideAllMenus();
  show(screens.levelSelect);
});

document.getElementById('btn-reset').addEventListener('click', () => {
  if (confirm('Reset all progress and best times? This cannot be undone.')) {
    SaveSystem.resetProgress();
    buildLevelGrid();
    alert('Progress reset.');
  }
});

// ---- Level select ----
document.getElementById('btn-levels-back').addEventListener('click', () => {
  hideAllMenus();
  show(screens.mainMenu);
});

function buildLevelGrid() {
  const grid = document.getElementById('level-grid');
  grid.innerHTML = '';
  LEVELS.forEach((lvl, i) => {
    const unlocked = SaveSystem.isUnlocked(i);
    const best = SaveSystem.getBestTime(lvl.id);
    const card = document.createElement('div');
    card.className = 'level-card' + (unlocked ? '' : ' locked');
    card.innerHTML = `
      <div class="lvl-num">LEVEL ${i + 1}</div>
      <div class="lvl-name">${lvl.name}</div>
      <div class="lvl-diff" style="color:${diffColor(lvl.difficulty)}">${lvl.difficulty} · ${lvl.laps} laps</div>
      <div class="lvl-best">Best: ${formatTime(best)}</div>
      ${unlocked ? '' : '<div class="lock-icon">🔒</div>'}
    `;
    if (unlocked) {
      card.addEventListener('click', () => startLevel(i));
    }
    grid.appendChild(card);
  });
}

function diffColor(d) {
  if (d === 'Easy') return '#34d399';
  if (d === 'Medium') return '#fbbf24';
  return '#f87171';
}

// ---- Start / flow ----
function startLevel(index) {
  try {
    hideAllMenus();
    ensureGame();
    game.loadLevel(index);
  } catch (err) {
    showError('loadLevel(' + index + ') failed:\n' + (err && err.stack ? err.stack : err));
    console.error(err);
  }
}

function showLevelComplete(result) {
  const statsEl = document.getElementById('complete-stats');
  statsEl.innerHTML = `
    <div class="stat-row"><span>Your Time</span><span>${formatTime(result.time)}</span></div>
    <div class="stat-row"><span>Best Time</span><span>${formatTime(result.best)}</span></div>
    ${result.isBest ? '<div class="new-best">★ NEW BEST TIME ★</div>' : ''}
  `;

  const nextBtn = document.getElementById('btn-next');
  nextBtn.style.display = result.hasNext ? '' : 'none';
  nextBtn.onclick = () => {
    hide(screens.complete);
    startLevel(result.levelIndex + 1);
  };

  document.getElementById('btn-replay').onclick = () => {
    hide(screens.complete);
    startLevel(result.levelIndex);
  };

  document.getElementById('btn-complete-menu').onclick = () => {
    hide(screens.complete);
    game.quitToMenu();
    show(screens.mainMenu);
  };

  show(screens.complete);
}

// ---- Pause menu ----
document.getElementById('btn-resume').addEventListener('click', () => {
  hide(screens.pause);
  game.resume();
});
document.getElementById('btn-restart').addEventListener('click', () => {
  hide(screens.pause);
  game.restartLevel();
});
document.getElementById('btn-quit').addEventListener('click', () => {
  hide(screens.pause);
  game.quitToMenu();
  show(screens.mainMenu);
});

// ---- Reveal main menu ----
// This module only executes after Three.js and all imports have resolved, so
// by the time we get here the engine is ready. Reveal the menu right away
// (don't wait on window 'load', which also blocks on images/subresources).
function revealMenu() {
  hide(screens.loading);
  buildLevelGrid();
  show(screens.mainMenu);
}
// brief delay purely so the logo is visible for a moment
setTimeout(revealMenu, 400);

// Surface any uncaught errors as a visible overlay (helps diagnose a blank
// screen, which otherwise fails silently once the menu is hidden).
function showError(msg) {
  let box = document.getElementById('error-overlay');
  if (!box) {
    box = document.createElement('div');
    box.id = 'error-overlay';
    box.style.cssText =
      'position:fixed;left:0;right:0;bottom:0;z-index:9999;background:rgba(120,0,0,0.92);' +
      'color:#fff;font:13px/1.5 monospace;padding:14px 18px;white-space:pre-wrap;max-height:40vh;overflow:auto;';
    document.body.appendChild(box);
  }
  box.textContent = 'Game error:\n' + msg;
}

window.addEventListener('error', (e) => {
  showError((e.message || 'unknown') + '\n' + (e.error && e.error.stack ? e.error.stack : ''));
});
window.addEventListener('unhandledrejection', (e) => {
  showError('Promise rejection: ' + (e.reason && e.reason.stack ? e.reason.stack : e.reason));
});
