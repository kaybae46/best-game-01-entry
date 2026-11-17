// Sound, synthesized live with WebAudio: no audio files, nothing to load. Every sound is
// guarded — before the first user gesture there is no audio context at all, and a browser
// that refuses one simply stays silent. Mute is a toggle the game keeps for the visit.
export function createAudio() {
  let context = null;
  let master = null;
  let muted = false;
  let pad = null;

  /** Create the context on a user gesture; callers check nothing, they just play. */
  function ensure() {
    if (context !== null) {
      if (context.state === 'suspended') context.resume().catch(() => {});
      return;
    }
    try {
      const AudioContext = window.AudioContext ?? window.webkitAudioContext;
      if (!AudioContext) return;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(context.destination);
      startPad();
    } catch {
      context = null;
    }
  }

  /** A very quiet two-note night pad under everything, so the garden never feels dead. */
  function startPad() {
    try {
      const gain = context.createGain();
      gain.gain.value = 0.035;
      gain.connect(master);
      const first = context.createOscillator();
      first.type = 'sine';
      first.frequency.value = 110;
      const second = context.createOscillator();
      second.type = 'sine';
      second.frequency.value = 164.81;
      const lfo = context.createOscillator();
      lfo.frequency.value = 0.07;
      const lfoGain = context.createGain();
      lfoGain.gain.value = 0.015;
      lfo.connect(lfoGain);
      lfoGain.connect(gain.gain);
      first.connect(gain);
      second.connect(gain);
      first.start();
      second.start();
      lfo.start();
      pad = { gain, first, second, lfo };
    } catch {
      pad = null;
    }
  }

  function tone(frequency, duration, type, volume, when = 0, slideTo = 0) {
    if (context === null || master === null) return;
    try {
      const at = context.currentTime + when;
      const oscillator = context.createOscillator();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, at);
      if (slideTo > 0) oscillator.frequency.exponentialRampToValueAtTime(slideTo, at + duration);
      const gain = context.createGain();
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(volume, at + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
      oscillator.connect(gain);
      gain.connect(master);
      oscillator.start(at);
      oscillator.stop(at + duration + 0.05);
    } catch {
      // A sound that fails to play is never worth crashing the game over.
    }
  }

  function noise(duration, volume, fromFrequency, toFrequency) {
    if (context === null || master === null) return;
    try {
      const at = context.currentTime;
      const length = Math.max(1, Math.floor(context.sampleRate * duration));
      const buffer = context.createBuffer(1, length, context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let index = 0; index < length; index += 1) data[index] = Math.random() * 2 - 1;
      const source = context.createBufferSource();
      source.buffer = buffer;
      const filter = context.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(fromFrequency, at);
      filter.frequency.exponentialRampToValueAtTime(Math.max(40, toFrequency), at + duration);
      filter.Q.value = 0.9;
      const gain = context.createGain();
      gain.gain.setValueAtTime(volume, at);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      source.start(at);
      source.stop(at + duration + 0.05);
    } catch {
      // As above: silence beats a crash.
    }
  }

  return {
    ensure,
    setMuted(next) {
      muted = next;
      if (master !== null) master.gain.value = muted ? 0 : 0.5;
    },
    isMuted() {
      return muted;
    },
    /** A pickup blip that climbs with the combo, so a streak sounds like a streak. */
    pickup(combo) {
      const base = 520 * 2 ** ((Math.min(combo, 8) - 1) / 12);
      tone(base, 0.14, 'sine', 0.22, 0, base * 1.5);
    },
    gold() {
      tone(784, 0.12, 'sine', 0.2);
      tone(1175, 0.2, 'sine', 0.2, 0.07);
    },
    shatter() {
      noise(0.22, 0.3, 2400, 300);
      tone(220, 0.18, 'triangle', 0.18, 0, 90);
    },
    hit() {
      tone(140, 0.3, 'sawtooth', 0.25, 0, 55);
      noise(0.18, 0.2, 500, 120);
    },
    dash() {
      noise(0.16, 0.16, 900, 3200);
    },
    power() {
      tone(660, 0.1, 'sine', 0.2);
      tone(880, 0.1, 'sine', 0.2, 0.08);
      tone(1320, 0.18, 'sine', 0.18, 0.16);
    },
    wave() {
      tone(523, 0.14, 'sine', 0.18);
      tone(784, 0.22, 'sine', 0.18, 0.12);
    },
    start() {
      tone(392, 0.12, 'sine', 0.2);
      tone(523, 0.12, 'sine', 0.2, 0.1);
      tone(659, 0.2, 'sine', 0.2, 0.2);
    },
    over() {
      tone(392, 0.25, 'sine', 0.2);
      tone(311, 0.25, 'sine', 0.2, 0.22);
      tone(233, 0.5, 'sine', 0.2, 0.44);
    },
  };
}
