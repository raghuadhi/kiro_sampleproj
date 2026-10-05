// Level definitions. Each level is a closed-loop track described by a list of
// 2D control points (x, z). The TrackBuilder turns these into 3D geometry,
// and the game derives checkpoints + start position from them.
//
// Difficulty escalates: longer tracks, tighter turns, more laps, different
// times of day and scenery themes for variety ("adventurous" feel).

export const LEVELS = [
  {
    id: 'sunset-circuit',
    name: 'Sunset Circuit',
    difficulty: 'Easy',
    laps: 2,
    roadWidth: 14,
    theme: {
      sky: 0xffb27a, horizon: 0xff7e5f, ground: 0x3b7a3b,
      fog: 0xffb27a, fogDensity: 0.0025, sunColor: 0xffd9a0,
      sunPos: [-120, 60, -80], ambient: 0.55,
    },
    // Gentle oval
    points: [
      [0, -120], [60, -110], [100, -70], [110, 0],
      [100, 70], [60, 110], [0, 120], [-60, 110],
      [-100, 70], [-110, 0], [-100, -70], [-60, -110],
    ],
  },
  {
    id: 'canyon-run',
    name: 'Canyon Run',
    difficulty: 'Easy',
    laps: 3,
    roadWidth: 13,
    theme: {
      sky: 0x89b7e0, horizon: 0xcfe3f2, ground: 0xb57d4a,
      fog: 0xbcd3e8, fogDensity: 0.0022, sunColor: 0xffffff,
      sunPos: [100, 90, 60], ambient: 0.6,
    },
    points: [
      [0, -140], [80, -130], [130, -80], [120, -10],
      [150, 60], [90, 120], [10, 140], [-70, 125],
      [-130, 70], [-120, -10], [-140, -80], [-80, -135],
    ],
  },
  {
    id: 'night-city',
    name: 'Neon City',
    difficulty: 'Medium',
    laps: 3,
    roadWidth: 12,
    theme: {
      sky: 0x0a0f26, horizon: 0x1b2452, ground: 0x151a2e,
      fog: 0x0a0f26, fogDensity: 0.004, sunColor: 0x6a7cff,
      sunPos: [-60, 80, -40], ambient: 0.35, neon: true,
    },
    points: [
      [0, -150], [70, -150], [120, -110], [120, -40],
      [70, -10], [120, 50], [120, 120], [40, 150],
      [-50, 140], [-120, 110], [-100, 30], [-140, -40],
      [-120, -110], [-60, -150],
    ],
  },
  {
    id: 'alpine-pass',
    name: 'Alpine Pass',
    difficulty: 'Medium',
    laps: 3,
    roadWidth: 11,
    theme: {
      sky: 0xa9d2f0, horizon: 0xe8f4ff, ground: 0xf0f4f8,
      fog: 0xdceefc, fogDensity: 0.003, sunColor: 0xffffff,
      sunPos: [120, 110, -60], ambient: 0.65,
    },
    points: [
      [0, -160], [90, -150], [160, -100], [140, -20],
      [180, 50], [120, 110], [150, 170], [60, 180],
      [-30, 160], [-110, 140], [-90, 50], [-160, 10],
      [-150, -80], [-80, -150],
    ],
  },
  {
    id: 'desert-storm',
    name: 'Desert Storm',
    difficulty: 'Hard',
    laps: 4,
    roadWidth: 11,
    theme: {
      sky: 0xe8c07a, horizon: 0xf5deb3, ground: 0xd9a85a,
      fog: 0xe8c88a, fogDensity: 0.0045, sunColor: 0xfff2cc,
      sunPos: [80, 70, 100], ambient: 0.6,
    },
    points: [
      [0, -170], [100, -160], [150, -110], [110, -40],
      [170, 20], [200, 90], [120, 140], [40, 130],
      [-20, 180], [-110, 160], [-100, 70], [-170, 30],
      [-140, -60], [-180, -120], [-90, -160],
    ],
  },
  {
    id: 'apex-grand',
    name: 'Apex Grand Prix',
    difficulty: 'Hard',
    laps: 4,
    roadWidth: 10,
    theme: {
      sky: 0x12183a, horizon: 0x2a3570, ground: 0x1a1f33,
      fog: 0x12183a, fogDensity: 0.0035, sunColor: 0x9db0ff,
      sunPos: [-100, 100, 80], ambient: 0.4, neon: true,
    },
    points: [
      [0, -190], [90, -180], [160, -140], [150, -70],
      [210, -20], [180, 60], [230, 120], [140, 170],
      [50, 160], [0, 200], [-80, 180], [-160, 150],
      [-130, 60], [-200, 20], [-170, -70], [-210, -130],
      [-120, -170], [-50, -190],
    ],
  },
];

export function getLevel(index) {
  return LEVELS[Math.max(0, Math.min(index, LEVELS.length - 1))];
}
