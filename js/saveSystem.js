// Persistence layer — saves/loads progress to localStorage so the game
// resumes exactly where the player left off across browser sessions.

const SAVE_KEY = 'apex-drive-save-v1';

const DEFAULT_SAVE = {
  version: 1,
  unlockedLevel: 0,      // index of highest unlocked level
  currentLevel: 0,       // level the player was last on (for "Continue")
  bestTimes: {},         // { levelId: milliseconds }
  totalRaces: 0,
  settings: {
    cameraMode: 'chase',
  },
};

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

export const SaveSystem = {
  _data: null,

  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        // Merge with defaults so new fields don't break old saves.
        this._data = { ...deepClone(DEFAULT_SAVE), ...parsed };
        this._data.bestTimes = { ...parsed.bestTimes };
        this._data.settings = { ...DEFAULT_SAVE.settings, ...(parsed.settings || {}) };
      } else {
        this._data = deepClone(DEFAULT_SAVE);
      }
    } catch (e) {
      console.warn('Save corrupted, starting fresh.', e);
      this._data = deepClone(DEFAULT_SAVE);
    }
    return this._data;
  },

  save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this._data));
    } catch (e) {
      console.warn('Could not persist save.', e);
    }
  },

  get data() {
    if (!this._data) this.load();
    return this._data;
  },

  // --- progress helpers ---
  getUnlockedLevel() { return this.data.unlockedLevel; },
  isUnlocked(index) { return index <= this.data.unlockedLevel; },

  setCurrentLevel(index) {
    this.data.currentLevel = index;
    this.save();
  },

  unlockLevel(index) {
    if (index > this.data.unlockedLevel) {
      this.data.unlockedLevel = index;
      this.save();
    }
  },

  getBestTime(levelId) {
    return this.data.bestTimes[levelId] ?? null;
  },

  // Returns true if this is a new best time.
  recordTime(levelId, ms) {
    this.data.totalRaces += 1;
    const prev = this.data.bestTimes[levelId];
    let isBest = false;
    if (prev == null || ms < prev) {
      this.data.bestTimes[levelId] = ms;
      isBest = true;
    }
    this.save();
    return isBest;
  },

  resetProgress() {
    this._data = deepClone(DEFAULT_SAVE);
    this.save();
  },
};
