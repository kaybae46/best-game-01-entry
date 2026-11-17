// Drawing only: the world's state and the current screen in, pixels out. The 1280x720
// playfield is scaled to fit the window and centred, the margin filled with the backdrop
// colour. The moth glows — its light is drawn as a radial gradient whose reach follows the
// lamp — and everything else is flat shapes and canvas text. Text that holds a number is
// rebuilt only when the number changes, so a frame allocates nothing.
import { COMBO, FIELD, FONT, LIGHT, LIVES, MOTH, PALETTE } from './config.js';
import {
  KIND_GOLD, KIND_POWER_MAGNET, KIND_POWER_SHIELD, KIND_POWER_SLOW, KIND_WISP_CHASER,
} from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

const PANEL = { width: 640, top: 150, line: 32, bottom: 64 };

function cachedLabel(prefix) {
  let value = -1;
  let text = '';
  return function label(next) {
    if (next !== value) {
      value = next;
      text = prefix + next;
    }
    return text;
  };
}

/** A fixed starfield, seeded once so the night sky never rearranges itself. */
function makeStars(count) {
  let a = 20261117;
  const next = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const stars = [];
  for (let index = 0; index < count; index += 1) {
    stars.push({ x: next() * FIELD.width, y: next() * FIELD.height * 0.7, size: 0.6 + next() * 1.4, twinkle: next() * Math.PI * 2 });
  }
  return stars;
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const stars = makeStars(90);
  const scoreLabel = cachedLabel('SCORE ');
  const waveLabel = cachedLabel('WAVE ');
  const comboLabel = cachedLabel('×');
  const finalLabel = cachedLabel('Score ');
  const bestLabel = cachedLabel('Best ');
  const waveReachedLabel = cachedLabel('Wave ');
  const orbsLabel = cachedLabel('Pollen ');
  const shatteredLabel = cachedLabel('Wisps shattered ');
  let lastWave = 1;
  let bannerUntil = 0;

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align) {
    if (!fonts.has(size)) fonts.set(size, `${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align;
    context.fillText(value, x, y);
  }

  function drawBackground(state, now) {
    const gradient = context.createLinearGradient(0, 0, 0, FIELD.height);
    gradient.addColorStop(0, PALETTE.skyTop);
    gradient.addColorStop(1, PALETTE.skyBottom);
    context.fillStyle = gradient;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    for (const star of stars) {
      const alpha = 0.35 + 0.3 * Math.sin(now / 900 + star.twinkle);
      context.globalAlpha = Math.max(0.05, alpha);
      context.fillStyle = '#dfe6ff';
      context.fillRect(star.x, star.y, star.size, star.size);
    }
    context.globalAlpha = 1;
    // Distant fireflies drift on their own slow paths.
    for (const fly of state.fireflies) {
      const alpha = 0.25 + 0.45 * (0.5 + 0.5 * Math.sin(now / 700 + fly.phase));
      context.globalAlpha = alpha;
      context.fillStyle = '#cfe8a3';
      context.beginPath();
      context.arc(fly.x + Math.sin(now / 2400 + fly.phase) * 18, fly.y + Math.cos(now / 3100 + fly.phase) * 12, fly.size, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
    // A low hill of grass the moth flies above.
    context.fillStyle = PALETTE.ground;
    context.beginPath();
    context.moveTo(0, FIELD.height);
    context.lineTo(0, FIELD.height - 46);
    for (let x = 0; x <= FIELD.width; x += 64) {
      context.quadraticCurveTo(x + 32, FIELD.height - 46 - ((x / 64) % 2 === 0 ? 26 : 12), x + 64, FIELD.height - 46);
    }
    context.lineTo(FIELD.width, FIELD.height);
    context.closePath();
    context.fill();
  }

  function drawOrb(orb, now) {
    const pulse = 1 + 0.18 * Math.sin(now / 260 + orb.phase);
    const radius = orb.radius * pulse;
    const glow = context.createRadialGradient(orb.x, orb.y, 0, orb.x, orb.y, radius * 3.2);
    const colour = orb.kind === KIND_GOLD ? PALETTE.gold : PALETTE.orb;
    glow.addColorStop(0, colour);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    context.globalAlpha = 0.5;
    context.fillStyle = glow;
    context.beginPath();
    context.arc(orb.x, orb.y, radius * 3.2, 0, Math.PI * 2);
    context.fill();
    context.globalAlpha = 1;
    context.fillStyle = PALETTE.orbCore;
    context.beginPath();
    context.arc(orb.x, orb.y, radius * 0.62, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = colour;
    context.beginPath();
    context.arc(orb.x, orb.y, radius, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.orbCore;
    context.beginPath();
    context.arc(orb.x, orb.y, radius * 0.55, 0, Math.PI * 2);
    context.fill();
  }

  function drawWisp(wisp, now) {
    const wobble = 1 + 0.08 * Math.sin(now / 300 + wisp.wobble);
    const radius = wisp.radius * wobble;
    const smoke = context.createRadialGradient(wisp.x, wisp.y, radius * 0.2, wisp.x, wisp.y, radius * 1.9);
    smoke.addColorStop(0, wisp.kind === KIND_WISP_CHASER ? PALETTE.wisp : PALETTE.wispDrifter);
    smoke.addColorStop(1, 'rgba(0,0,0,0)');
    context.globalAlpha = 0.85;
    context.fillStyle = smoke;
    context.beginPath();
    context.arc(wisp.x, wisp.y, radius * 1.9, 0, Math.PI * 2);
    context.fill();
    context.globalAlpha = 1;
    context.fillStyle = wisp.kind === KIND_WISP_CHASER ? '#241a38' : '#1a2438';
    context.beginPath();
    context.arc(wisp.x, wisp.y, radius, 0, Math.PI * 2);
    context.fill();
    // Two eyes, watching the moth.
    const eyeGap = radius * 0.42;
    const eyeY = wisp.y - radius * 0.12;
    context.fillStyle = PALETTE.wispEye;
    context.beginPath();
    context.arc(wisp.x - eyeGap, eyeY, radius * 0.2, 0, Math.PI * 2);
    context.arc(wisp.x + eyeGap, eyeY, radius * 0.2, 0, Math.PI * 2);
    context.fill();
  }

  function drawPower(power, now) {
    const bob = Math.sin(now / 320 + power.x) * 3;
    const y = power.y + bob;
    const ring = power.kind === KIND_POWER_MAGNET ? PALETTE.powerMagnet
      : power.kind === KIND_POWER_SHIELD ? PALETTE.powerShield : PALETTE.powerSlow;
    context.strokeStyle = ring;
    context.lineWidth = 2.5;
    context.beginPath();
    context.arc(power.x, y, power.radius + 4, 0, Math.PI * 2);
    context.stroke();
    context.fillStyle = ring;
    context.textBaseline = 'middle';
    if (power.kind === KIND_POWER_MAGNET) {
      // A four-point star: pollen flies to you.
      context.beginPath();
      for (let point = 0; point < 8; point += 1) {
        const angle = (point / 8) * Math.PI * 2 - Math.PI / 2;
        const radius = point % 2 === 0 ? 11 : 4.5;
        const px = power.x + Math.cos(angle) * radius;
        const py = y + Math.sin(angle) * radius;
        if (point === 0) context.moveTo(px, py);
        else context.lineTo(px, py);
      }
      context.closePath();
      context.fill();
    } else if (power.kind === KIND_POWER_SHIELD) {
      context.beginPath();
      context.arc(power.x, y, 8, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = PALETTE.panel;
      context.beginPath();
      context.arc(power.x, y, 4, 0, Math.PI * 2);
      context.fill();
    } else {
      // An hourglass: the hunt slows down.
      context.beginPath();
      context.moveTo(power.x - 8, y - 9);
      context.lineTo(power.x + 8, y - 9);
      context.lineTo(power.x - 8, y + 9);
      context.lineTo(power.x + 8, y + 9);
      context.closePath();
      context.fill();
    }
  }

  function drawMoth(state, now) {
    const moth = state.moth;
    // Blink while invulnerable after a hit: hidden on every other tenth of a second.
    if (moth.invulnerable > 0 && Math.floor(moth.invulnerable * 10) % 2 === 0) return;
    const lightFraction = state.light / LIGHT.max;
    const glowRadius = 70 + lightFraction * 150;
    const glow = context.createRadialGradient(moth.x, moth.y, 0, moth.x, moth.y, glowRadius);
    glow.addColorStop(0, 'rgba(255, 217, 122, 0.34)');
    glow.addColorStop(0.55, 'rgba(255, 217, 122, 0.12)');
    glow.addColorStop(1, 'rgba(255, 217, 122, 0)');
    context.fillStyle = glow;
    context.beginPath();
    context.arc(moth.x, moth.y, glowRadius, 0, Math.PI * 2);
    context.fill();

    context.save();
    context.translate(moth.x, moth.y);
    context.rotate(moth.angle + Math.PI / 2);
    // Wings flap: each wing is an ellipse that narrows as it beats.
    const flap = Math.sin(moth.wing);
    const wingSpread = 0.55 + 0.45 * Math.abs(flap);
    context.fillStyle = PALETTE.mothWing;
    context.beginPath();
    context.ellipse(-11, -2, 13 * wingSpread, 17, -0.5, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.ellipse(11, -2, 13 * wingSpread, 17, 0.5, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.mothWingEdge;
    context.beginPath();
    context.ellipse(-11, 8, 7 * wingSpread, 9, -0.4, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.ellipse(11, 8, 7 * wingSpread, 9, 0.4, 0, Math.PI * 2);
    context.fill();
    // Body and antennae.
    context.fillStyle = PALETTE.mothBody;
    context.beginPath();
    context.ellipse(0, 0, 5.5, 13, 0, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = PALETTE.mothBody;
    context.lineWidth = 1.6;
    context.beginPath();
    context.moveTo(-3, -12);
    context.quadraticCurveTo(-8, -20, -11, -22);
    context.moveTo(3, -12);
    context.quadraticCurveTo(8, -20, 11, -22);
    context.stroke();
    context.restore();

    // A shield, when one is held, rings the moth.
    if (state.shield) {
      context.strokeStyle = PALETTE.powerShield;
      context.lineWidth = 2.5;
      context.globalAlpha = 0.7 + 0.3 * Math.sin(now / 200);
      context.beginPath();
      context.arc(moth.x, moth.y, MOTH.radius + 12, 0, Math.PI * 2);
      context.stroke();
      context.globalAlpha = 1;
    }
    // Dash cooldown: a small arc that fills as the dash comes back.
    if (moth.dashCooldown > 0) {
      const fraction = 1 - moth.dashCooldown / MOTH.dashCooldown;
      context.strokeStyle = 'rgba(255, 217, 122, 0.8)';
      context.lineWidth = 3;
      context.beginPath();
      context.arc(moth.x, moth.y, MOTH.radius + 7, -Math.PI / 2, -Math.PI / 2 + fraction * Math.PI * 2);
      context.stroke();
    }
  }

  function drawParticles(state) {
    for (const particle of state.particles) {
      if (!particle.active) continue;
      context.globalAlpha = Math.max(0, particle.life / particle.maxLife);
      context.fillStyle = particle.color;
      context.beginPath();
      context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
  }

  function drawHud(state, now, options) {
    context.textBaseline = 'top';
    text(scoreLabel(state.score), 24, 18, 30, PALETTE.text, 'left');
    if (state.combo > 1) {
      text(`${comboLabel(state.combo)} COMBO`, 24, 56, 22, PALETTE.gold, 'left');
      const width = 120 * (state.comboTimer / COMBO.window);
      context.fillStyle = 'rgba(255, 179, 71, 0.35)';
      context.fillRect(24, 84, 120, 5);
      context.fillStyle = PALETTE.gold;
      context.fillRect(24, 84, Math.max(0, width), 5);
    }
    text(waveLabel(state.wave), FIELD.width / 2, 18, 30, PALETTE.text, 'center');
    // Lives: little moths, lit while held.
    const lifeGap = 30;
    const firstLife = FIELD.width - 24 - LIVES * lifeGap;
    text('LIVES', firstLife - 12, 18, 22, PALETTE.muted, 'right');
    for (let life = 0; life < LIVES; life += 1) {
      const cx = firstLife + life * lifeGap + 12;
      context.fillStyle = life < state.lives ? PALETTE.mothWing : 'rgba(154, 165, 192, 0.25)';
      context.beginPath();
      context.ellipse(cx - 6, 34, 6, 9, -0.5, 0, Math.PI * 2);
      context.ellipse(cx + 6, 34, 6, 9, 0.5, 0, Math.PI * 2);
      context.fill();
    }
    // The lamp: a bar that burns down, red and pulsing when it runs low.
    const barWidth = 220;
    const barX = FIELD.width - 24 - barWidth;
    const barY = 62;
    const low = state.light < 25;
    text('LIGHT', barX - 10, barY - 2, 20, low ? PALETTE.danger : PALETTE.muted, 'right');
    context.fillStyle = 'rgba(255, 255, 255, 0.12)';
    context.fillRect(barX, barY, barWidth, 12);
    const fill = Math.max(0, state.light / LIGHT.max) * barWidth;
    context.fillStyle = low && Math.floor(now / 240) % 2 === 0 ? PALETTE.lightBarLow : PALETTE.lightBar;
    context.fillRect(barX, barY, fill, 12);
    // Active effects, named small under the lamp.
    const effects = [];
    if (state.magnetTimer > 0) effects.push(`MAGNET ${Math.ceil(state.magnetTimer)}s`);
    if (state.slowTimer > 0) effects.push(`SLOW ${Math.ceil(state.slowTimer)}s`);
    if (state.shield) effects.push('SHIELD');
    if (effects.length > 0) text(effects.join('  ·  '), barX + barWidth, barY + 20, 18, PALETTE.muted, 'right');
    // A fresh player gets one line of help, then it gets out of the way.
    if (state.elapsed < 5) {
      context.globalAlpha = Math.max(0, 1 - state.elapsed / 5);
      text('Mouse or WASD to fly  ·  Space or click to dash  ·  P to pause  ·  M to mute', FIELD.width / 2, FIELD.height - 40, 20, PALETTE.muted, 'center');
      context.globalAlpha = 1;
    }
    // Wave banner: a big centre flash when a wave turns (not in a staged screenshot,
    // where the wave has already turned long before the frame is taken).
    if (state.wave !== lastWave) {
      lastWave = state.wave;
      bannerUntil = now + 1600;
    }
    if (!options.noBanner && now < bannerUntil && state.elapsed > 1) {
      const alpha = Math.min(1, (bannerUntil - now) / 500);
      context.globalAlpha = alpha;
      text(`WAVE ${state.wave}`, FIELD.width / 2, FIELD.height / 2 - 120, 56, PALETTE.text, 'center');
      context.globalAlpha = 1;
    }
  }

  function drawPanel(title, lines, prompt) {
    const height = PANEL.top + lines.length * PANEL.line + PANEL.bottom;
    const x = (FIELD.width - PANEL.width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = 'rgba(7, 10, 20, 0.55)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, PANEL.width, height);
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 2;
    context.strokeRect(x, y, PANEL.width, height);
    context.textBaseline = 'alphabetic';
    text(title, FIELD.width / 2, y + 82, 52, PALETTE.text, 'center');
    for (let index = 0; index < lines.length; index += 1) {
      text(lines[index], FIELD.width / 2, y + PANEL.top + index * PANEL.line, 22, PALETTE.muted, 'center');
    }
    text(prompt, FIELD.width / 2, y + height - 38, 24, PALETTE.mothWing, 'center');
  }

  const TITLE_LINES = [
    'A moth. A lamp. A garden going dark.',
    'Gather pollen to feed your light — let it die and you fall.',
    'Dash through shadow wisps to shatter them. Chain pollen for combos.',
    'Mouse or WASD to fly · Space or click to dash · P to pause · M to mute',
    '',
  ];
  const PAUSED_LINES = ['The garden waits for you.'];
  const OVER_LINES = ['', '', '', ''];

  /** Paint one frame: the field, then the HUD or a panel for the screen the game is on. */
  function draw(state, screen, best, options = {}) {
    const now = performance.now();
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    const shake = state.shake * 9;
    const shakeX = shake === 0 ? 0 : (Math.random() - 0.5) * shake;
    const shakeY = shake === 0 ? 0 : (Math.random() - 0.5) * shake;
    context.setTransform(view.scale, 0, 0, view.scale, view.x + shakeX * view.scale, view.y + shakeY * view.scale);
    drawBackground(state, now);
    for (const orb of state.orbs) if (orb.active) drawOrb(orb, now);
    for (const power of state.powers) if (power.active) drawPower(power, now);
    for (const wisp of state.wisps) if (wisp.active) drawWisp(wisp, now);
    drawMoth(state, now);
    drawParticles(state);
    if (screen === SCREEN_TITLE) {
      TITLE_LINES[4] = bestLabel(best);
      drawPanel('MOTHLIGHT', TITLE_LINES, 'Press Space or click to fly');
      return;
    }
    drawHud(state, now, options);
    if (screen === SCREEN_PAUSED) drawPanel('Paused', PAUSED_LINES, 'Press P to fly on');
    else if (screen === SCREEN_OVER) {
      OVER_LINES[0] = finalLabel(state.score);
      OVER_LINES[1] = bestLabel(best);
      OVER_LINES[2] = waveReachedLabel(state.wave);
      OVER_LINES[3] = `${orbsLabel(state.orbsCollected)}  ·  ${shatteredLabel(state.wispsShattered)}`;
      drawPanel('The light went out', OVER_LINES, 'Press Space or click to fly again');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}
