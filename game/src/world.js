// The game's rules and state, with no drawing and no browser in it: the moth and its light,
// the pollen it feeds on, the shadow wisps that hunt it, the power-ups, the particles, the
// waves. step() advances one fixed step and returns what happened as bit flags, so the caller
// can react (sound, announcements) without the world knowing about screens or sound. The
// pools are allocated once, at boot; nothing here allocates after createWorld returns.
import {
  COMBO, FIELD, LIGHT, LIVES, MOTH, ORB, POOL_SIZE, POWERUP, WAVE, WISP,
} from './config.js';

export const KIND_ORB = 0;
export const KIND_GOLD = 1;
export const KIND_WISP_CHASER = 2;
export const KIND_WISP_DRIFTER = 3;
export const KIND_POWER_MAGNET = 4;
export const KIND_POWER_SHIELD = 5;
export const KIND_POWER_SLOW = 6;

export const EVENT_PICKUP = 1;
export const EVENT_GOLD = 2;
export const EVENT_SHATTER = 4;
export const EVENT_HIT = 8;
export const EVENT_OVER = 16;
export const EVENT_WAVE = 32;
export const EVENT_POWER = 64;
export const EVENT_DASH = 128;

const POWER_KINDS = [KIND_POWER_MAGNET, KIND_POWER_SHIELD, KIND_POWER_SLOW];
const TWO_PI = Math.PI * 2;

function distanceSquared(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

export function createWorld(random) {
  const moth = {
    x: FIELD.width / 2, y: FIELD.height / 2, vx: 0, vy: 0,
    angle: -Math.PI / 2, wing: 0, invulnerable: 0, dashTime: 0, dashCooldown: 0,
    dashX: 0, dashY: -1,
  };
  const orbs = [];
  for (let index = 0; index < 48; index += 1) {
    orbs.push({ active: false, kind: KIND_ORB, x: 0, y: 0, radius: ORB.radius, speed: 0, sway: 0, phase: 0 });
  }
  const wisps = [];
  for (let index = 0; index < 32; index += 1) {
    wisps.push({ active: false, kind: KIND_WISP_CHASER, x: 0, y: 0, vx: 0, vy: 0, radius: WISP.radius, speed: 0, wobble: 0 });
  }
  const powers = [];
  for (let index = 0; index < 6; index += 1) {
    powers.push({ active: false, kind: KIND_POWER_MAGNET, x: 0, y: 0, radius: POWERUP.radius, speed: 0 });
  }
  const particles = [];
  for (let index = 0; index < POOL_SIZE; index += 1) {
    particles.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 2, color: '#ffffff' });
  }
  const fireflies = [];
  for (let index = 0; index < 26; index += 1) {
    fireflies.push({
      x: random() * FIELD.width, y: random() * FIELD.height,
      phase: random() * TWO_PI, speed: 0.2 + random() * 0.5, size: 1 + random() * 2,
    });
  }
  const state = {
    moth, orbs, wisps, powers, particles, fireflies,
    score: 0, combo: 0, comboTimer: 0, lives: LIVES, light: LIGHT.start,
    wave: 1, elapsed: 0, orbsCollected: 0, wispsShattered: 0, powersCollected: 0,
    shield: false, magnetTimer: 0, slowTimer: 0, shake: 0,
    orbTimer: 0.4, wispTimer: 2.2, powerTimer: POWERUP.interval, powerIndex: 0, time: 0,
  };

  function reset() {
    moth.x = FIELD.width / 2;
    moth.y = FIELD.height * 0.62;
    moth.vx = 0;
    moth.vy = 0;
    moth.angle = -Math.PI / 2;
    moth.wing = 0;
    moth.invulnerable = 0;
    moth.dashTime = 0;
    moth.dashCooldown = 0;
    for (const orb of orbs) orb.active = false;
    for (const wisp of wisps) wisp.active = false;
    for (const power of powers) power.active = false;
    for (const particle of particles) particle.active = false;
    state.score = 0;
    state.combo = 0;
    state.comboTimer = 0;
    state.lives = LIVES;
    state.light = LIGHT.start;
    state.wave = 1;
    state.elapsed = 0;
    state.orbsCollected = 0;
    state.wispsShattered = 0;
    state.powersCollected = 0;
    state.shield = false;
    state.magnetTimer = 0;
    state.slowTimer = 0;
    state.shake = 0;
    state.orbTimer = 0.4;
    state.wispTimer = 2.2;
    state.powerTimer = POWERUP.interval;
    state.powerIndex = 0;
    state.time = 0;
  }

  function free(pool) {
    for (let index = 0; index < pool.length; index += 1) if (!pool[index].active) return pool[index];
    return null;
  }

  function burst(x, y, color, count, speed) {
    for (let index = 0; index < count; index += 1) {
      const particle = free(particles);
      if (particle === null) return;
      const angle = random() * TWO_PI;
      const velocity = speed * (0.3 + random() * 0.7);
      particle.active = true;
      particle.x = x;
      particle.y = y;
      particle.vx = Math.cos(angle) * velocity;
      particle.vy = Math.sin(angle) * velocity;
      particle.maxLife = 0.4 + random() * 0.5;
      particle.life = particle.maxLife;
      particle.size = 1.5 + random() * 2.5;
      particle.color = color;
    }
  }

  function spawnOrb() {
    const orb = free(orbs);
    if (orb === null) return;
    orb.active = true;
    orb.kind = random() < ORB.goldChance ? KIND_GOLD : KIND_ORB;
    orb.x = 30 + random() * (FIELD.width - 60);
    orb.y = -20;
    orb.radius = orb.kind === KIND_GOLD ? ORB.radius + 3 : ORB.radius;
    orb.speed = ORB.fall + random() * ORB.fallJitter;
    orb.sway = ORB.sway * (0.5 + random());
    orb.phase = random() * TWO_PI;
  }

  function spawnWisp() {
    const wisp = free(wisps);
    if (wisp === null) return;
    const chaser = random() < WISP.chaserChance;
    wisp.active = true;
    wisp.kind = chaser ? KIND_WISP_CHASER : KIND_WISP_DRIFTER;
    // Chasers slip in from the edges; drifters drift down from above.
    if (chaser) {
      const side = random() < 0.5 ? 0 : FIELD.width;
      wisp.x = side === 0 ? -20 : FIELD.width + 20;
      wisp.y = 60 + random() * (FIELD.height - 160);
    } else {
      wisp.x = 30 + random() * (FIELD.width - 60);
      wisp.y = -20;
    }
    wisp.vx = 0;
    wisp.vy = 0;
    wisp.radius = WISP.radius;
    wisp.speed = (chaser ? WISP.chaserSpeed : WISP.drifterSpeed)
      + WISP.chaserPerWave * (state.wave - 1) * (chaser ? 1 : 0.5);
    wisp.wobble = random() * TWO_PI;
  }

  function spawnPower() {
    const power = free(powers);
    if (power === null) return;
    power.active = true;
    power.kind = POWER_KINDS[state.powerIndex % POWER_KINDS.length];
    state.powerIndex += 1;
    power.x = 60 + random() * (FIELD.width - 120);
    power.y = -20;
    power.radius = POWERUP.radius;
    power.speed = POWERUP.fall;
  }

  function orbInterval() {
    return Math.max(ORB.minInterval, ORB.interval * ORB.intervalScale ** (state.wave - 1));
  }

  function wispInterval() {
    return Math.max(WISP.minInterval, WISP.interval * WISP.intervalScale ** (state.wave - 1));
  }

  function loseLife(events, reason) {
    state.lives -= 1;
    state.combo = 0;
    state.comboTimer = 0;
    state.shake = 1;
    moth.invulnerable = MOTH.invulnerable;
    if (state.lives <= 0) return events | EVENT_HIT | EVENT_OVER;
    return events | EVENT_HIT;
  }

  /**
   * One fixed step. `steer` is a -1..1 vector, `wantDash` a fresh dash press. With
   * `harmless` set (the title screen's backdrop) pollen falls, nothing hunts, nothing
   * scores, and the moth drifts on its own — a living scene behind the title.
   */
  function step(dt, steerX, steerY, wantDash, harmless) {
    let events = 0;
    state.time += dt;
    state.elapsed += dt;
    const wave = Math.min(WAVE.max, 1 + Math.floor(state.elapsed / WAVE.seconds));
    if (wave !== state.wave) {
      state.wave = wave;
      state.score += WAVE.bonus * wave;
      events |= EVENT_WAVE;
    }

    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) state.combo = 0;
    }
    if (moth.invulnerable > 0) moth.invulnerable = Math.max(0, moth.invulnerable - dt);
    if (moth.dashCooldown > 0) moth.dashCooldown = Math.max(0, moth.dashCooldown - dt);
    if (state.magnetTimer > 0) state.magnetTimer = Math.max(0, state.magnetTimer - dt);
    if (state.slowTimer > 0) state.slowTimer = Math.max(0, state.slowTimer - dt);
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 2.2);

    // The light burns down; an empty lamp costs a life and relights, dimmer.
    if (!harmless) {
      state.light -= (LIGHT.drain + LIGHT.drainPerWave * (state.wave - 1)) * dt;
      if (state.light <= 0) {
        state.light = LIGHT.emptyRefill;
        burst(moth.x, moth.y, '#ff5d7a', 18, 160);
        events = loseLife(events);
        if (events & EVENT_OVER) return events;
      }
    }

    // Steering: the moth accelerates toward the steer, drags to a stop without one.
    if (harmless) {
      const t = state.time * 0.45;
      const targetX = FIELD.width / 2 + Math.cos(t) * 220;
      const targetY = FIELD.height * 0.55 + Math.sin(t * 1.3) * 90;
      const dx = targetX - moth.x;
      const dy = targetY - moth.y;
      const distance = Math.hypot(dx, dy) || 1;
      moth.vx += (dx / distance) * MOTH.accel * 0.4 * dt;
      moth.vy += (dy / distance) * MOTH.accel * 0.4 * dt;
    } else if (moth.dashTime > 0) {
      moth.vx = moth.dashX * MOTH.dashSpeed;
      moth.vy = moth.dashY * MOTH.dashSpeed;
    } else {
      moth.vx += steerX * MOTH.accel * dt;
      moth.vy += steerY * MOTH.accel * dt;
    }
    if (moth.dashTime <= 0) {
      const drag = Math.max(0, 1 - MOTH.drag * dt);
      moth.vx *= drag;
      moth.vy *= drag;
      const speed = Math.hypot(moth.vx, moth.vy);
      if (speed > MOTH.maxSpeed) {
        moth.vx = (moth.vx / speed) * MOTH.maxSpeed;
        moth.vy = (moth.vy / speed) * MOTH.maxSpeed;
      }
    }
    moth.x = Math.min(FIELD.width - MOTH.radius, Math.max(MOTH.radius, moth.x + moth.vx * dt));
    moth.y = Math.min(FIELD.height - MOTH.radius, Math.max(MOTH.radius, moth.y + moth.vy * dt));
    const speed = Math.hypot(moth.vx, moth.vy);
    if (speed > 40) {
      const target = Math.atan2(moth.vy, moth.vx);
      let difference = target - moth.angle;
      while (difference > Math.PI) difference -= TWO_PI;
      while (difference < -Math.PI) difference += TWO_PI;
      moth.angle += difference * Math.min(1, dt * 10);
    }
    moth.wing += dt * (6 + speed * 0.02);
    if (moth.dashTime > 0) {
      moth.dashTime -= dt;
      if (moth.dashTime <= 0) moth.invulnerable = Math.max(moth.invulnerable, 0.12);
    }

    // A dash is a burst of speed that burns light and shatters wisps it touches.
    if (!harmless && wantDash && moth.dashTime <= 0 && moth.dashCooldown <= 0 && state.light >= MOTH.dashCost) {
      let dx = steerX;
      let dy = steerY;
      if (dx === 0 && dy === 0) {
        dx = Math.cos(moth.angle);
        dy = Math.sin(moth.angle);
      }
      const length = Math.hypot(dx, dy) || 1;
      moth.dashX = dx / length;
      moth.dashY = dy / length;
      moth.dashTime = MOTH.dashTime;
      moth.dashCooldown = MOTH.dashCooldown;
      state.light -= MOTH.dashCost;
      burst(moth.x, moth.y, '#ffd97a', 10, 120);
      events |= EVENT_DASH;
    }

    // Spawning: pollen always, wisps only in play, power-ups on their own slow clock.
    state.orbTimer -= dt;
    if (state.orbTimer <= 0) {
      spawnOrb();
      state.orbTimer += orbInterval();
    }
    if (!harmless) {
      state.wispTimer -= dt;
      if (state.wispTimer <= 0) {
        spawnWisp();
        state.wispTimer += wispInterval();
      }
      state.powerTimer -= dt;
      if (state.powerTimer <= 0) {
        spawnPower();
        state.powerTimer += POWERUP.interval;
      }
    }

    // Pollen drifts down with a sway; a magnet pulls it toward the moth.
    for (const orb of orbs) {
      if (!orb.active) continue;
      orb.phase += dt * 2;
      orb.y += orb.speed * dt;
      orb.x += Math.sin(orb.phase) * orb.sway * dt;
      if (state.magnetTimer > 0) {
        const dx = moth.x - orb.x;
        const dy = moth.y - orb.y;
        const distance = Math.hypot(dx, dy) || 1;
        const pull = 420 * (1 - Math.min(1, distance / 320));
        orb.x += (dx / distance) * pull * dt;
        orb.y += (dy / distance) * pull * dt;
      }
      if (orb.y > FIELD.height + 30) {
        orb.active = false;
        continue;
      }
      if (harmless) continue;
      const reach = orb.radius + MOTH.radius + 6;
      if (distanceSquared(orb.x, orb.y, moth.x, moth.y) > reach * reach) continue;
      orb.active = false;
      state.combo = state.comboTimer > 0 ? Math.min(COMBO.max, state.combo + 1) : 1;
      state.comboTimer = COMBO.window;
      state.orbsCollected += 1;
      if (orb.kind === KIND_GOLD) {
        state.score += ORB.goldPoints * state.combo;
        state.light = Math.min(LIGHT.max, state.light + LIGHT.goldGain);
        burst(orb.x, orb.y, '#ffb347', 14, 150);
        events |= EVENT_GOLD;
      } else {
        state.score += ORB.points * state.combo;
        state.light = Math.min(LIGHT.max, state.light + LIGHT.orbGain);
        burst(orb.x, orb.y, '#ffe9a3', 8, 110);
        events |= EVENT_PICKUP;
      }
    }

    // Wisps: chasers steer at the moth, drifters wander. A dash shatters them; a touch
    // without one costs a life (a shield spends itself instead).
    const slow = state.slowTimer > 0 ? POWERUP.slowFactor : 1;
    for (const wisp of wisps) {
      if (!wisp.active) continue;
      wisp.wobble += dt * 2;
      if (wisp.kind === KIND_WISP_CHASER) {
        const dx = moth.x - wisp.x;
        const dy = moth.y - wisp.y;
        const distance = Math.hypot(dx, dy) || 1;
        const pull = wisp.speed * slow;
        wisp.vx += (dx / distance) * pull * 3 * dt;
        wisp.vy += (dy / distance) * pull * 3 * dt;
        const wispSpeed = Math.hypot(wisp.vx, wisp.vy);
        if (wispSpeed > wisp.speed * slow) {
          wisp.vx = (wisp.vx / wispSpeed) * wisp.speed * slow;
          wisp.vy = (wisp.vy / wispSpeed) * wisp.speed * slow;
        }
      } else {
        wisp.vy = wisp.speed * 0.7 * slow;
        wisp.vx = Math.sin(wisp.wobble) * 60 * slow;
      }
      wisp.x += wisp.vx * dt;
      wisp.y += wisp.vy * dt;
      if (wisp.x < -60 || wisp.x > FIELD.width + 60 || wisp.y > FIELD.height + 60) {
        wisp.active = false;
        continue;
      }
      if (harmless) continue;
      const reach = wisp.radius + MOTH.radius;
      if (distanceSquared(wisp.x, wisp.y, moth.x, moth.y) > reach * reach) continue;
      if (moth.dashTime > 0) {
        wisp.active = false;
        state.wispsShattered += 1;
        state.score += WISP.shatterPoints * Math.max(1, state.combo);
        state.light = Math.min(LIGHT.max, state.light + LIGHT.shatterGain);
        burst(wisp.x, wisp.y, '#c9a7ff', 20, 200);
        events |= EVENT_SHATTER;
      } else if (moth.invulnerable > 0) {
        // A touch while invulnerable passes through: no hit, no shatter.
      } else if (state.shield) {
        state.shield = false;
        wisp.active = false;
        state.wispsShattered += 1;
        state.score += WISP.shatterPoints;
        burst(wisp.x, wisp.y, '#9dff8a', 16, 170);
        events |= EVENT_SHATTER;
      } else {
        wisp.active = false;
        // A hit costs a life and dims the lamp; a lamp knocked out relights dim at
        // once — the hit already took its life, so it never takes a second one.
        state.light -= LIGHT.hitLoss;
        if (state.light <= 0) state.light = LIGHT.emptyRefill;
        burst(moth.x, moth.y, '#ff5d7a', 22, 210);
        moth.vx = (moth.x - wisp.x) * 6;
        moth.vy = (moth.y - wisp.y) * 6;
        events = loseLife(events);
        if (events & EVENT_OVER) return events;
      }
    }

    // Power-ups fall slowly; touching one spends it at once.
    for (const power of powers) {
      if (!power.active) continue;
      power.y += power.speed * dt;
      if (power.y > FIELD.height + 30) {
        power.active = false;
        continue;
      }
      if (harmless) continue;
      const reach = power.radius + MOTH.radius + 4;
      if (distanceSquared(power.x, power.y, moth.x, moth.y) > reach * reach) continue;
      power.active = false;
      state.powersCollected += 1;
      if (power.kind === KIND_POWER_MAGNET) state.magnetTimer = POWERUP.magnetSeconds;
      else if (power.kind === KIND_POWER_SHIELD) state.shield = true;
      else state.slowTimer = POWERUP.slowSeconds;
      burst(power.x, power.y, '#ffffff', 12, 130);
      events |= EVENT_POWER;
    }

    for (const particle of particles) {
      if (!particle.active) continue;
      particle.life -= dt;
      if (particle.life <= 0) {
        particle.active = false;
        continue;
      }
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= Math.max(0, 1 - 2.4 * dt);
      particle.vy *= Math.max(0, 1 - 2.4 * dt);
    }

    return events;
  }

  reset();
  return { state, reset, step, burst };
}
