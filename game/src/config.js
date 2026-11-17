// MOTHLIGHT — every tuning number and colour in one place. The playfield is a fixed
// 1280x720 logical area; the renderer scales it to the window, so no rule below depends on
// the screen size. The moth's glow is its life: it burns down, and pollen feeds it back.
export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const MOTH = {
  radius: 13,
  accel: 2600,
  maxSpeed: 430,
  drag: 3.2,
  dashSpeed: 980,
  dashTime: 0.18,
  dashCooldown: 1.1,
  dashCost: 8,
  invulnerable: 1.6,
};

/** The light the moth carries: 0..100. It drains, pollen feeds it, dash burns it. */
export const LIGHT = {
  max: 100,
  start: 80,
  drain: 1.5,
  drainPerWave: 0.12,
  orbGain: 10,
  goldGain: 26,
  shatterGain: 5,
  hitLoss: 20,
  emptyRefill: 55,
};

export const ORB = {
  radius: 9,
  fall: 34,
  fallJitter: 16,
  sway: 26,
  interval: 0.85,
  intervalScale: 0.94,
  minInterval: 0.34,
  goldChance: 0.08,
  points: 10,
  goldPoints: 30,
};

/** Shadow wisps: chasers hunt the moth, drifters wander and block the way. */
export const WISP = {
  radius: 16,
  chaserSpeed: 118,
  chaserPerWave: 11,
  drifterSpeed: 66,
  interval: 2.4,
  intervalScale: 0.9,
  minInterval: 0.85,
  chaserChance: 0.55,
  shatterPoints: 25,
};

/** Power-ups drift down slowly; one is offered every so often, cycling the three kinds. */
export const POWERUP = {
  radius: 14,
  fall: 42,
  interval: 13,
  magnetSeconds: 8,
  slowSeconds: 6,
  slowFactor: 0.45,
};

/** A combo grows while pollen keeps coming within the window; a hit or a lapse resets it. */
export const COMBO = { window: 2.5, max: 8 };

/** Seconds of play per wave; the last wave is where growth stops. */
export const WAVE = { seconds: 20, max: 10, bonus: 50 };

export const LIVES = 3;

/** How many particles can exist at once; the pool is allocated once, at boot. */
export const POOL_SIZE = 256;

export const PALETTE = {
  backdrop: '#070a14',
  skyTop: '#0b1026',
  skyBottom: '#131a33',
  ground: '#0e1424',
  grass: '#16213a',
  mothBody: '#f5e9c8',
  mothWing: '#ffd97a',
  mothWingEdge: '#ff9d5c',
  glow: '#ffd97a',
  orb: '#ffe9a3',
  orbCore: '#fff7d6',
  gold: '#ffb347',
  wisp: '#3a2b52',
  wispEye: '#ff5d7a',
  wispDrifter: '#2c3a5e',
  powerMagnet: '#7ee7ff',
  powerShield: '#9dff8a',
  powerSlow: '#d9a7ff',
  panel: '#10182b',
  panelEdge: '#2a3a5e',
  text: '#f2f0e4',
  muted: '#9aa5c0',
  danger: '#ff5d7a',
  lightBar: '#ffd97a',
  lightBarLow: '#ff5d7a',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'mothlight.best';
