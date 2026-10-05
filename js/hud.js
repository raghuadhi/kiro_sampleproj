// HUD controller — updates the on-screen chips (lap, timer, speed, best time,
// countdown, wrong-way warning). Pure DOM, no Three.js.

export function formatTime(ms) {
  if (ms == null || !isFinite(ms)) return '--:--.--';
  const totalSec = ms / 1000;
  const m = Math.floor(totalSec / 60);
  const s = Math.floor(totalSec % 60);
  const cs = Math.floor((ms % 1000) / 10);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

export class HUD {
  constructor() {
    this.el = {
      root: document.getElementById('hud'),
      lap: document.getElementById('lap-counter'),
      level: document.getElementById('level-name'),
      timer: document.getElementById('timer'),
      best: document.getElementById('best-time'),
      speed: document.getElementById('speed-value'),
      countdown: document.getElementById('countdown'),
      wrongWay: document.getElementById('wrong-way'),
    };
  }

  show() { this.el.root.classList.remove('hidden'); }
  hide() { this.el.root.classList.add('hidden'); }

  setLevel(name) { this.el.level.textContent = name; }
  setLap(cur, total) { this.el.lap.textContent = `Lap ${cur}/${total}`; }
  setTime(ms) { this.el.timer.textContent = formatTime(ms); }
  setBest(ms) { this.el.best.textContent = `Best: ${formatTime(ms)}`; }
  setSpeed(kmh) { this.el.speed.textContent = String(Math.round(kmh)); }

  showCountdown(value) {
    this.el.countdown.classList.remove('hidden');
    this.el.countdown.textContent = value;
  }
  hideCountdown() { this.el.countdown.classList.add('hidden'); }

  setWrongWay(on) {
    this.el.wrongWay.classList.toggle('hidden', !on);
  }
}
