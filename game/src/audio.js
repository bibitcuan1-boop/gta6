// All sound is synthesized with WebAudio — no audio files, no network.
// Engine hum, sirens, gunshots, pickups, jingles and a slow ambient pad loop.
export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;
  let engineOsc = null;
  let engineGain = null;
  let padNodes = null;
  let sirenTimer = 0;

  function ensure() {
    if (ctx) return true;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      return true;
    } catch { return false; }
  }
  function unlock() { if (ensure() && ctx.state === 'suspended') ctx.resume().catch(() => {}); }
  function tone(freq, dur, type, vol, slideTo) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(vol || 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, vol, filterFreq) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = filterFreq || 1800;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol || 0.3, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t);
  }

  return {
    unlock,
    setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : 0.5; },
    isMuted() { return muted; },
    shoot() { noise(0.14, 0.5, 2600); tone(180, 0.09, 'square', 0.22, 60); },
    punch() { noise(0.08, 0.25, 900); },
    pickup() { tone(660, 0.1, 'sine', 0.25); setTimeout(() => tone(990, 0.14, 'sine', 0.25), 90); },
    cash() { tone(880, 0.08, 'triangle', 0.25); setTimeout(() => tone(1174, 0.1, 'triangle', 0.25), 80); setTimeout(() => tone(1568, 0.16, 'triangle', 0.25), 160); },
    missionStart() { [523, 659, 784].forEach((f, i) => setTimeout(() => tone(f, 0.22, 'triangle', 0.28), i * 130)); },
    missionDone() { [523, 659, 784, 1046, 1318].forEach((f, i) => setTimeout(() => tone(f, 0.28, 'triangle', 0.3), i * 120)); },
    busted() { [392, 330, 262].forEach((f, i) => setTimeout(() => tone(f, 0.35, 'sawtooth', 0.18), i * 180)); },
    crash() { noise(0.3, 0.5, 700); },
    door() { tone(220, 0.08, 'square', 0.12, 140); },
    click() { tone(1200, 0.05, 'square', 0.12); },
    siren(dt, wanted) {
      if (!ensure() || muted || wanted < 1) return;
      sirenTimer += dt;
      const phase = (sirenTimer % 1.2) < 0.6 ? 720 : 540;
      if (!this._sirenOsc) {
        const o = ctx.createOscillator(); const g = ctx.createGain();
        o.type = 'sine'; o.frequency.value = phase; g.gain.value = 0.045;
        o.connect(g); g.connect(master); o.start();
        this._sirenOsc = o; this._sirenGain = g;
      }
      this._sirenOsc.frequency.setTargetAtTime(phase, ctx.currentTime, 0.05);
      this._sirenGain.gain.setTargetAtTime(0.04 + wanted * 0.006, ctx.currentTime, 0.2);
    },
    stopSiren() {
      if (this._sirenOsc) { try { this._sirenOsc.stop(); } catch {} this._sirenOsc = null; }
    },
    engine(speed01, on) {
      if (!ensure() || muted) return;
      if (!on) {
        if (engineGain) engineGain.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
        return;
      }
      if (!engineOsc) {
        engineOsc = ctx.createOscillator(); engineGain = ctx.createGain();
        engineOsc.type = 'sawtooth'; engineOsc.frequency.value = 55;
        engineGain.gain.value = 0.0;
        const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420;
        engineOsc.connect(f); f.connect(engineGain); engineGain.connect(master);
        engineOsc.start();
      }
      engineOsc.frequency.setTargetAtTime(50 + speed01 * 140, ctx.currentTime, 0.08);
      engineGain.gain.setTargetAtTime(0.03 + speed01 * 0.05, ctx.currentTime, 0.1);
    },
    startPad() {
      if (!ensure() || padNodes || muted) return;
      const notes = [110, 164.8, 220, 277.2];
      const gains = [];
      for (const n of notes) {
        const o = ctx.createOscillator(); const g = ctx.createGain();
        o.type = 'triangle'; o.frequency.value = n; g.gain.value = 0.018;
        o.connect(g); g.connect(master); o.start();
        gains.push({ o, g });
      }
      padNodes = gains;
      let step = 0;
      const tick = () => {
        if (!padNodes) return;
        step += 1;
        const chord = [[110, 164.8, 220], [98, 146.8, 196], [123.5, 185, 246.9], [110, 164.8, 261.6]][step % 4];
        padNodes.forEach((node, i) => node.o.frequency.setTargetAtTime(chord[i % chord.length], ctx.currentTime, 1.5));
        setTimeout(tick, 6000);
      };
      setTimeout(tick, 6000);
    },
  };
}
