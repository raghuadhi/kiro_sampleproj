import * as THREE from 'three';
import * as THREE from 'three';
import { Car } from './car.js';
import { Track } from './track.js';
import { Environment } from './environment.js';
import { Input } from './input.js';
import { HUD } from './hud.js';
import { getLevel, LEVELS } from './levels.js';
import { SaveSystem } from './saveSystem.js';

const STATE = {
  COUNTDOWN: 'countdown',
  RACING: 'racing',
  PAUSED: 'paused',
  FINISHED: 'finished',
};

export class Game {
  constructor(canvas, callbacks = {}) {
    this.canvas = canvas;
    this.callbacks = callbacks; // { onLevelComplete, onPauseMenu }

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, 1, 0.1, 2000);

    this.input = new Input();
    this.hud = new HUD();

    this.car = null;
    this.track = null;
    this.environment = null;

    this.levelIndex = 0;
    this.level = null;
    this.state = STATE.COUNTDOWN;

    // lap tracking
    this.currentLap = 1;
    this.nextCheckpoint = 0;
    this.visitedThisLap = 0;
    this.raceTime = 0;
    this.countdownTime = 0;
    this.wrongWayTime = 0;

    this._camPos = new THREE.Vector3();
    this._camLook = new THREE.Vector3();
    this.clock = new THREE.Clock();
    this.running = false;

    this.input.onReset(() => this._resetCarToTrack());
    this.input.onPause(() => this.togglePause());

    window.addEventListener('resize', () => this._resize());
    this._resize();
  }

  _resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  loadLevel(index) {
    this._disposeLevel();

    this.levelIndex = index;
    this.level = getLevel(index);
    SaveSystem.setCurrentLevel(index);

    this.environment = new Environment(this.scene, this.level.theme);

    this.track = new Track(this.level);
    this.scene.add(this.track.group);

    this.car = new Car(0xff3b2f);
    this.scene.add(this.car.group);

    // reset race state
    this.currentLap = 1;
    this.nextCheckpoint = 1; // 0 is start; need to pass others then return
    this.visitedThisLap = 0;
    this.raceTime = 0;
    this.wrongWayTime = 0;

    this._resetCarToTrack();

    // HUD
    this.hud.setLevel(this.level.name);
    this.hud.setLap(1, this.level.laps);
    this.hud.setTime(0);
    this.hud.setBest(SaveSystem.getBestTime(this.level.id));
    this.hud.setSpeed(0);
    this.hud.show();

    // place camera immediately behind car
    this._updateCamera(1);

    this._startCountdown();
  }

  _resetCarToTrack() {
    if (!this.car || !this.track) return;
    this.car.reset(this.track.startPosition, this.track.startHeading);
    // reset checkpoint chain to avoid cheating a lap after respawn
    this.nextCheckpoint = 1;
    this.visitedThisLap = 0;
  }

  _startCountdown() {
    this.state = STATE.COUNTDOWN;
    this.countdownTime = 3.0;
    this.hud.showCountdown('3');
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.clock.start();
    this._loop();
  }

  stop() {
    this.running = false;
  }

  togglePause() {
    if (this.state === STATE.RACING) {
      this.state = STATE.PAUSED;
      if (this.callbacks.onPauseMenu) this.callbacks.onPauseMenu(true);
    } else if (this.state === STATE.PAUSED) {
      this.resume();
    }
  }

  resume() {
    if (this.state === STATE.PAUSED) {
      this.state = STATE.RACING;
      if (this.callbacks.onPauseMenu) this.callbacks.onPauseMenu(false);
    }
  }

  restartLevel() {
    this.resume();
    this.loadLevel(this.levelIndex);
  }

  _loop() {
    if (!this.running) return;
    requestAnimationFrame(() => this._loop());

    const dt = this.clock.getDelta();
    this._update(dt);
    this.renderer.render(this.scene, this.camera);
  }

  _update(dt) {
    if (this.state === STATE.COUNTDOWN) {
      this.countdownTime -= dt;
      if (this.countdownTime > 0) {
        const n = Math.ceil(this.countdownTime);
        this.hud.showCountdown(n === 0 ? 'GO!' : String(n));
      } else {
        this.hud.showCountdown('GO!');
        setTimeout(() => this.hud.hideCountdown(), 500);
        this.state = STATE.RACING;
      }
      // let the car settle; camera follows
      this.car.update(dt, { throttle: 0, steer: 0, brake: 0 });
      this._updateCamera(dt);
      return;
    }

    if (this.state === STATE.PAUSED || this.state === STATE.FINISHED) {
      return; // freeze
    }

    // RACING
    const controls = this.input.getControls();
    this.car.update(dt, controls);
    this.raceTime += dt * 1000;

    this._checkOffTrack();
    this._checkCheckpoints();

    this.hud.setSpeed(this.car.getSpeedKmh());
    this.hud.setTime(this.raceTime);

    this._updateCamera(dt);
  }

  _checkOffTrack() {
    // Soft penalty: slow the car when far off the road centerline.
    const dist = this.track.distanceFromRoad(this.car.position);
    const limit = this.track.roadWidth / 2 + 3;
    if (dist > limit) {
      this.car.speed *= 0.96; // grass drag
    }
  }

  _checkCheckpoints() {
    const cps = this.track.checkpoints;
    const total = cps.length;
    const cp = cps[this.nextCheckpoint];
    const d = cp.pos.distanceTo(this.car.position);

    if (d < this.track.roadWidth / 2 + 6) {
      this.nextCheckpoint = (this.nextCheckpoint + 1) % total;
      this.visitedThisLap++;

      // completed a full loop back to checkpoint 0
      if (this.nextCheckpoint === 0 && this.visitedThisLap >= total - 1) {
        this._completeLap();
      }
    }

    // Wrong-way detection: compare car forward with checkpoint direction
    const forward = new THREE.Vector3(Math.sin(this.car.heading), 0, Math.cos(this.car.heading));
    const dot = forward.dot(cp.dir);
    if (this.car.getSpeedKmh() > 15 && dot < -0.4) {
      this.wrongWayTime += 1;
      if (this.wrongWayTime > 10) this.hud.setWrongWay(true);
    } else {
      this.wrongWayTime = 0;
      this.hud.setWrongWay(false);
    }
  }

  _completeLap() {
    this.visitedThisLap = 0;
    if (this.currentLap >= this.level.laps) {
      this._finishRace();
    } else {
      this.currentLap++;
      this.hud.setLap(this.currentLap, this.level.laps);
    }
  }

  _finishRace() {
    this.state = STATE.FINISHED;
    this.hud.setWrongWay(false);
    const ms = this.raceTime;
    const isBest = SaveSystem.recordTime(this.level.id, ms);

    // unlock next level
    const nextIndex = this.levelIndex + 1;
    if (nextIndex < LEVELS.length) SaveSystem.unlockLevel(nextIndex);

    if (this.callbacks.onLevelComplete) {
      this.callbacks.onLevelComplete({
        levelIndex: this.levelIndex,
        time: ms,
        best: SaveSystem.getBestTime(this.level.id),
        isBest,
        hasNext: nextIndex < LEVELS.length,
      });
    }
  }

  _updateCamera(dt) {
    const mode = SaveSystem.data.settings.cameraMode || 'chase';
    const car = this.car;
    const back = 9.5;
    const height = 4.4;

    const forward = new THREE.Vector3(Math.sin(car.heading), 0, Math.cos(car.heading));
    const desired = new THREE.Vector3()
      .copy(car.position)
      .addScaledVector(forward, -back)
      .add(new THREE.Vector3(0, height, 0));

    // speed-based pull-back for sense of velocity
    const speedPull = Math.min(car.getSpeedKmh() / 280, 1) * 2.5;
    desired.addScaledVector(forward, -speedPull);

    const lerp = 1 - Math.pow(0.0015, dt); // smooth, frame-rate independent
    this._camPos.lerp(desired, lerp);
    this.camera.position.copy(this._camPos);

    const lookTarget = new THREE.Vector3()
      .copy(car.position)
      .addScaledVector(forward, 6)
      .add(new THREE.Vector3(0, 1.2, 0));
    this._camLook.lerp(lookTarget, lerp);
    this.camera.lookAt(this._camLook);
  }

  _disposeLevel() {
    if (this.track) { this.scene.remove(this.track.group); this.track.dispose(); this.track = null; }
    if (this.car) { this.scene.remove(this.car.group); this.car.dispose(); this.car = null; }
    if (this.environment) { this.environment.dispose(); this.environment = null; }
    // clear lights
    const toRemove = [];
    this.scene.traverse((o) => { if (o.isLight) toRemove.push(o); });
    toRemove.forEach((l) => this.scene.remove(l));
  }

  quitToMenu() {
    this.state = STATE.FINISHED;
    this.hud.hide();
    this._disposeLevel();
  }
}

export { STATE };
