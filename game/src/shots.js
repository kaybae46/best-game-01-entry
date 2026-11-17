// The screenshot scenes behind ?shot=start|play|surge|end. Each one plays the real rules
// forward from a fresh world for a fixed number of steps, steered by a simple autopilot —
// chase the nearest pollen, keep clear of the wisps, dash through one when it closes in —
// so the frame is what a real game looks like and the same seed always gives the same
// frame. The end scene's pilot is careless on purpose (no dash, no dodging), so it is
// caught out once the garden fills with wisps, as a hurried player is.
import { FIELD, STEP } from './config.js';
import { EVENT_OVER } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 24;
const SURGE_SECONDS = 38;
const END_LIMIT_SECONDS = 600;
const FLEE_DISTANCE = 200;
const DASH_DISTANCE = 100;

function nearest(state, pool, predicate) {
  let best = null;
  let bestDistance = Infinity;
  for (const item of pool) {
    if (!item.active || (predicate && !predicate(item))) continue;
    const dx = item.x - state.moth.x;
    const dy = item.y - state.moth.y;
    const distance = dx * dx + dy * dy;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = item;
    }
  }
  return best === null ? null : { item: best, distance: Math.sqrt(bestDistance) };
}

/**
 * Steer the moth: toward the nearest pollen, away from the nearest wisp inside the
 * flee distance. `bold` also dashes through a wisp that gets too close.
 */
function autopilot(state, bold) {
  const moth = state.moth;
  let x = 0;
  let y = 0;
  const orb = nearest(state, state.orbs);
  if (orb !== null) {
    const dx = orb.item.x - moth.x;
    const dy = orb.item.y - moth.y;
    const distance = orb.distance || 1;
    x += (dx / distance) * 1.0;
    y += (dy / distance) * 1.0;
  }
  const wisp = nearest(state, state.wisps);
  let dash = false;
  if (wisp !== null && wisp.distance < FLEE_DISTANCE) {
    const dx = moth.x - wisp.item.x;
    const dy = moth.y - wisp.item.y;
    const distance = wisp.distance || 1;
    const weight = 2.4 * (1 - wisp.distance / FLEE_DISTANCE) + 0.6;
    x += (dx / distance) * weight;
    y += (dy / distance) * weight;
    if (bold && wisp.distance < DASH_DISTANCE && moth.dashCooldown <= 0 && state.light > 30) {
      dash = true;
    }
  }
  if (x === 0 && y === 0) return { x: 0, y: 0, dash: false };
  const length = Math.hypot(x, y);
  const steer = { x: x / length, y: y / length, dash: false };
  if (dash) {
    // Dash through the wisp, not away from it: the burst shatters it.
    const dx = wisp.item.x - moth.x;
    const dy = wisp.item.y - moth.y;
    const distance = wisp.distance || 1;
    steer.x = dx / distance;
    steer.y = dy / distance;
    steer.dash = true;
  }
  return steer;
}

/**
 * A careless pilot for the end scene: it chases pollen and only flinches when a wisp is
 * almost on it, never dashing — so it lasts a little, then is caught out once the garden
 * fills with wisps, as a hurried player is.
 */
function carelessPilot(state) {
  const moth = state.moth;
  const orb = nearest(state, state.orbs);
  let x = 0;
  let y = 0;
  if (orb !== null) {
    const dx = orb.item.x - moth.x;
    const dy = orb.item.y - moth.y;
    const distance = orb.distance || 1;
    x += dx / distance;
    y += dy / distance;
  }
  const wisp = nearest(state, state.wisps);
  if (wisp !== null && wisp.distance < 80) {
    const dx = moth.x - wisp.item.x;
    const dy = moth.y - wisp.item.y;
    const distance = wisp.distance || 1;
    x += (dx / distance) * 2;
    y += (dy / distance) * 2;
  }
  if (x === 0 && y === 0) return { x: 0, y: 0, dash: false };
  const length = Math.hypot(x, y);
  return { x: x / length, y: y / length, dash: false };
}

/**
 * Set `world` to the named scene (start, play, surge or end; any other name is start) and
 * return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'surge' && name !== 'end') {
    for (let index = 0; index < START_SECONDS / STEP; index += 1) world.step(STEP, 0, 0, false, true);
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'end') {
    for (let index = 0; index < END_LIMIT_SECONDS / STEP; index += 1) {
      const steer = carelessPilot(world.state);
      if (world.step(STEP, steer.x, steer.y, false, false) & EVENT_OVER) break;
    }
    return { screen: SCREEN_OVER, best: world.state.score };
  }
  const seconds = name === 'surge' ? SURGE_SECONDS : PLAY_SECONDS;
  for (let index = 0; index < seconds / STEP; index += 1) {
    const steer = autopilot(world.state, true);
    if (world.step(STEP, steer.x, steer.y, steer.dash, false) & EVENT_OVER) break;
  }
  return { screen: SCREEN_PLAY, best: world.state.score };
}
