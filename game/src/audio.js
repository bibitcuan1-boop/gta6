// All sound is synthesized with the WebAudio API — no audio files, no
// network. A master gain sits at half volume, mutable with M. The audio
// context is created only after the player clicks a title-screen button,
// as browsers require. Every effect is a tiny helper; nothing here can
// throw if audio is unavailable.

export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;
  let engineOsc = null;
  let engineGain = null;
  let engineFilter = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenHigh = true;
  let sirenT = 0;
  let padOsc = [];
  let padGain = null;
  let padT = 0;
  let padStep = 0;

  const PAD_CHORDS = [
    [110, 164.8, 220, 277.2],
    [98, 146.8, 196, 246.9],
    [87.3, 130.8, 174.6, 220],
    [103.8, 155.6, 207.7, 261.6],
  ];

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
    } catch { return false; }
    return !!ctx;
  }

  function noiseBuffer(seconds) {
    const len = Math.max(1, Math.floor(ctx.sampleRate * seconds));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  function burst(seconds, filterFreq, gainVal, type = 'lowpass') {
    if (!ensure()) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(seconds);
    const filt = ctx.createBiquadFilter();
    filt.type = type;
    filt.frequency.value = filterFreq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gainVal, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + seconds);
    src.connect(filt); filt.connect(g); g.connect(master);
    src.start(t); src.stop(t + seconds);
  }

  function tone(freq, dur, type, gainVal, slideTo) {
    if (!ensure()) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gainVal, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur);
  }

  function notes(list, type, gainVal, gap) {
    if (!ensure()) return;
    list.forEach((freq, i) => {
      const t = ctx.currentTime + i * gap;
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gainVal, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
      o.connect(g); g.connect(master);
      o.start(t); o.stop(t + 0.35);
    });
  }

  return {
    // Call from a user gesture (title button). Starts engine + pad loops.
    unlock() {
      if (!ensure()) return;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      if (!engineOsc) {
        engineOsc = ctx.createOscillator();
        engineOsc.type = 'sawtooth';
        engineOsc.frequency.value = 50;
        engineFilter = ctx.createBiquadFilter();
        engineFilter.type = 'lowpass';
        engineFilter.frequency.value = 420;
        engineGain = ctx.createGain();
        engineGain.gain.value = 0;
        engineOsc.connect(engineFilter); engineFilter.connect(engineGain); engineGain.connect(master);
        engineOsc.start();
      }
      if (!padOsc.length) {
        padGain = ctx.createGain();
        padGain.gain.value = 0.05;
        padGain.connect(master);
        padOsc = PAD_CHORDS[0].map((f) => {
          const o = ctx.createOscillator();
          o.type = 'triangle';
          o.frequency.value = f;
          o.connect(padGain);
          o.start();
          return o;
        });
      }
      if (!sirenOsc) {
        sirenOsc = ctx.createOscillator();
        sirenOsc.type = 'sine';
        sirenOsc.frequency.value = 720;
        sirenGain = ctx.createGain();
        sirenGain.gain.value = 0;
        sirenOsc.connect(sirenGain); sirenGain.connect(master);
        sirenOsc.start();
      }
    },

    shot() { burst(0.12, 1800, 0.5, 'highpass'); tone(220, 0.1, 'square', 0.25, 60); },
    punch() { burst(0.09, 300, 0.5); },
    pickup() { notes([660, 880], 'sine', 0.22, 0.09); },
    cash() { notes([523, 659, 784], 'triangle', 0.22, 0.09); },
    jobStart() { notes([392, 523, 659], 'triangle', 0.22, 0.11); },
    jobDone() { notes([523, 659, 784, 1047, 1319], 'triangle', 0.22, 0.11); },
    busted() { notes([392, 311, 233], 'sawtooth', 0.2, 0.22); },
    crash() { burst(0.35, 240, 0.6); },
    door() { tone(180, 0.07, 'square', 0.18, 120); },
    click() { tone(1200, 0.05, 'sine', 0.15); },
    reload() { tone(500, 0.05, 'square', 0.12, 700); },

    setMuted(m) {
      muted = m;
      if (master && ctx) master.gain.setTargetAtTime(m ? 0 : 0.5, ctx.currentTime, 0.05);
    },
    get isMuted() { return muted; },

    // Engine pitch follows speed: 0 = idle, 1 = top speed.
    setEngine(speed01, driving) {
      if (!engineOsc || !ctx) return;
      const target = driving ? 0.05 + speed01 * 0.06 : 0.0;
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.08);
      engineOsc.frequency.setTargetAtTime(50 + speed01 * 140, ctx.currentTime, 0.08);
    },

    // Two-tone siren, quiet, growing slightly louder with the wanted level.
    updateSiren(dt, stars) {
      if (!sirenOsc || !ctx) return;
      sirenT += dt;
      if (sirenT > 0.6) {
        sirenT = 0;
        sirenHigh = !sirenHigh;
        sirenOsc.frequency.setTargetAtTime(sirenHigh ? 720 : 540, ctx.currentTime, 0.05);
      }
      const vol = stars > 0 ? 0.02 + stars * 0.006 : 0;
      sirenGain.gain.setTargetAtTime(vol, ctx.currentTime, 0.2);
    },

    // Slow ambient pad: the chord changes every six seconds.
    updatePad(dt) {
      if (!padOsc.length || !ctx) return;
      padT += dt;
      if (padT >= 6) {
        padT = 0;
        padStep = (padStep + 1) % PAD_CHORDS.length;
        const chord = PAD_CHORDS[padStep];
        padOsc.forEach((o, i) => o.frequency.setTargetAtTime(chord[i], ctx.currentTime, 0.8));
      }
    },
  };
}
