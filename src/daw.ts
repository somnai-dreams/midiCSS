// midiCSS — the document IS the song.
// Notes are <b> elements placed with grid-area (grid row = pitch, grid column =
// 16th-note step). Tempo, waveforms, volumes and velocities live in CSS custom
// properties. This script is only a player/editor over that markup; saving
// re-serializes the live document back into an .html file.

type Engine = {
  ctx: AudioContext;
  out: GainNode;
  duck: GainNode; // everything except kicks routes through here; kicks dip it
  verb: GainNode; // shared reverb bus
  echo: GainNode; // shared tempo-synced ping-pong echo bus
  echoDelay: DelayNode;
  echoDelay2: DelayNode;
  noise: AudioBuffer;
  kickCurve: Float32Array<ArrayBuffer>; // hard saturation curve shared by kick voices
  waves: { [name: string]: PeriodicWave | undefined }; // custom --wave values
};
type Drag = { el: HTMLElement; mode: "move" | "resize"; grab: number };
type NoteBox = {
  step: number;
  len: number;
  midi: number;
  vel: number;
  el: HTMLElement | null; // source element (null for pseudo-element notes)
  pseudo: string | null; // "::before"/"::after" when the note is a pseudo
};
type Chip = { chip: HTMLButtonElement; trk: HTMLElement };

const ROWS = 48;
const TOP_MIDI = 83; // row 1 = B5 … row 48 = C2
const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

const docEl = document.documentElement;
const rollFound = document.querySelector("#roll");
const wrapFound = document.querySelector("#wrap");
if (rollFound instanceof HTMLElement && wrapFound instanceof HTMLElement) {
  init(rollFound, wrapFound);
}

function init(roll: HTMLElement, wrap: HTMLElement): void {
  // ---- reading the song out of CSS ----------------------------------------
  const cssNum = (el: Element, prop: string, fallback: number): number => {
    const v = parseFloat(getComputedStyle(el).getPropertyValue(prop));
    return Number.isFinite(v) ? v : fallback;
  };
  const cssStr = (el: Element, prop: string): string =>
    getComputedStyle(el).getPropertyValue(prop).trim();
  const clamp = (v: number, lo: number, hi: number): number =>
    Math.min(Math.max(v, lo), hi);

  const bpm = (): number => cssNum(docEl, "--bpm", 120);
  const steps = (): number => Math.max(1, Math.round(cssNum(roll, "--steps", 64)));
  const cellW = (): number => cssNum(docEl, "--cw", 18);
  const rowH = (): number => cssNum(docEl, "--rh", 16);
  const stepSec = (): number => 15 / bpm(); // one 16th note

  const tracks = (): HTMLElement[] => {
    const found: HTMLElement[] = [];
    for (const t of roll.querySelectorAll(".trk")) {
      if (t instanceof HTMLElement) found.push(t);
    }
    return found;
  };

  // Editing reads/writes the inline grid placement — the markup itself.
  const gridBox = (b: HTMLElement): NoteBox | null => {
    const row = parseInt(b.style.gridRowStart, 10);
    const c1 = parseInt(b.style.gridColumnStart, 10);
    if (!Number.isFinite(row) || !Number.isFinite(c1)) return null;
    const c2 = parseInt(b.style.gridColumnEnd, 10);
    const vel = parseFloat(getComputedStyle(b).getPropertyValue("--vel"));
    return {
      step: c1 - 1,
      len: Number.isFinite(c2) ? Math.max(c2 - c1, 1) : 1,
      midi: TOP_MIDI - (row - 1),
      vel: Number.isFinite(vel) ? vel : 1,
      el: b,
      pseudo: null,
    };
  };

  // Playback reads rendered geometry + computed style: a note sounds exactly
  // where (and how) it is painted. Media queries, :has() toggles, nth-child
  // rules and transforms therefore all change the music. Fractional positions
  // are kept (translateX = micro-timing, translateY = transposition); values
  // within rounding noise of the grid are snapped back onto it.
  const snap = (v: number): number => {
    const r = Math.round(v);
    return Math.abs(v - r) < 0.02 ? r : v;
  };
  const geoBox = (b: HTMLElement): NoteBox | null => {
    const r = b.getBoundingClientRect();
    if (r.width < 0.5 || r.height < 0.5) return null; // display:none plays nothing
    const base = roll.getBoundingClientRect();
    const vel = parseFloat(getComputedStyle(b).getPropertyValue("--vel"));
    return {
      step: snap((r.left - base.left) / cellW()),
      len: snap(r.width / cellW()),
      midi: snap(TOP_MIDI - ((r.top + r.height / 2 - base.top) / rowH() - 0.5)),
      vel: Number.isFinite(vel) ? vel : 1,
      el: b,
      pseudo: null,
    };
  };
  const setBox = (b: HTMLElement, step: number, len: number, midi: number): void => {
    const row = TOP_MIDI - midi + 1;
    b.style.gridArea = `${row}/${step + 1}/${row + 1}/${step + 1 + len}`;
  };

  // Pseudo-elements as notes: a .trk's ::before/::after with content and a
  // grid-area is a grid item — a note that exists only in a stylesheet.
  // Pseudos have no rect API, so geometry is reconstructed from computed grid
  // lines plus the transform matrix (translate = swing/detune, scaleX =
  // length), matching the idioms the geometry reader hears on real notes.
  const PSEUDOS = ["::before", "::after"];
  const pseudoBox = (trk: HTMLElement, which: string): NoteBox | null => {
    const ps = getComputedStyle(trk, which);
    if (ps.content === "none" || ps.content === "normal" || ps.display === "none") return null;
    const row = parseInt(ps.gridRowStart, 10);
    const c1 = parseInt(ps.gridColumnStart, 10);
    if (!Number.isFinite(row) || !Number.isFinite(c1)) return null;
    const c2 = parseInt(ps.gridColumnEnd, 10);
    const span = Number.isFinite(c2) ? Math.max(c2 - c1, 1) : 1;
    let dx = 0;
    let dy = 0;
    let sx = 1;
    const tf = ps.transform;
    if (tf.startsWith("matrix(")) {
      const p = tf.slice(7, -1).split(",").map((v) => parseFloat(v));
      sx = p[0] ?? 1;
      dx = p[4] ?? 0;
      dy = p[5] ?? 0;
    }
    const vel = parseFloat(ps.getPropertyValue("--vel"));
    return {
      step: snap(c1 - 1 + dx / cellW()),
      len: snap(span * sx),
      midi: snap(TOP_MIDI - (row - 1) - dy / rowH()),
      vel: Number.isFinite(vel) ? vel : 1,
      el: null,
      pseudo: which,
    };
  };

  // Geometry cache — memoization, not a second source of truth. Static tracks
  // are swept at most every CACHE_TTL seconds; any DOM mutation, input/change
  // event, hash or viewport change invalidates instantly, and tracks with
  // running animations or transitions bypass the cache entirely so scheduled
  // timing keeps gliding. Sounding voices never use it (updateVoices always
  // reads fresh geometry), so live bending is unaffected.
  const CACHE_TTL = 2; // seconds, audio clock
  let cacheGen = 0;
  let cacheJitter = 0; // staggers expiry so multi-track sweeps don't align
  type BoxCache = { gen: number; at: number; ttl: number; animated: boolean; boxes: NoteBox[] };
  const boxCache = new WeakMap<HTMLElement, BoxCache>();
  const bumpCache = (): void => {
    cacheGen++;
  };
  new MutationObserver((muts) => {
    for (const m of muts) {
      const t = m.target;
      const el = t instanceof Element ? t : t.parentElement;
      if (el !== null && el.closest("[data-chrome]") !== null) continue; // playhead/toolbar churn
      cacheGen++;
      return;
    }
  }).observe(docEl, { subtree: true, childList: true, attributes: true, characterData: true });
  window.addEventListener("input", bumpCache, true);
  window.addEventListener("change", bumpCache, true);
  window.addEventListener("hashchange", bumpCache);
  window.addEventListener("resize", bumpCache);

  const trackBoxes = (trk: HTMLElement, now: number): NoteBox[] => {
    const hit = boxCache.get(trk);
    if (hit !== undefined && !hit.animated && hit.gen === cacheGen && now - hit.at < hit.ttl) {
      return hit.boxes;
    }
    const boxes: NoteBox[] = [];
    for (const b of trk.children) {
      if (!(b instanceof HTMLElement) || b.tagName !== "B") continue;
      const nb = geoBox(b);
      if (nb) boxes.push(nb);
    }
    for (const which of PSEUDOS) {
      const nb = pseudoBox(trk, which);
      if (nb) boxes.push(nb);
    }
    const animated = trk.getAnimations({ subtree: true }).length > 0;
    boxCache.set(trk, { gen: cacheGen, at: now, ttl: CACHE_TTL + (cacheJitter++ % 8) * 0.17, animated, boxes });
    return boxes;
  };

  const ensureTrack = (): HTMLElement => {
    const t = tracks()[0];
    if (t) return t;
    const s = document.createElement("section");
    s.className = "trk";
    s.dataset.name = "Track 1";
    s.style.cssText = "--wave:square;--vol:0.3;--hue:200";
    roll.append(s);
    return s;
  };
  let live: HTMLElement = ensureTrack();

  // ---- audio ---------------------------------------------------------------
  let engine: Engine | null = null;
  const audio = (): Engine => {
    if (engine) return engine;
    const ctx = new AudioContext();
    const comp = ctx.createDynamicsCompressor();
    comp.connect(ctx.destination);
    // gentle tanh saturation glues the mix before the compressor
    const sat = ctx.createWaveShaper();
    const curve = new Float32Array(1024);
    for (let i = 0; i < curve.length; i++) {
      const x = (i / (curve.length - 1)) * 2 - 1;
      curve[i] = Math.tanh(1.5 * x) / Math.tanh(1.5);
    }
    sat.curve = curve;
    sat.oversample = "2x";
    sat.connect(comp);
    const out = ctx.createGain();
    out.gain.value = 0.85;
    out.connect(sat);
    // duck bus: the sidechain — everything except kicks routes through it,
    // and each kick dips it by --duck (the pump)
    const duck = ctx.createGain();
    duck.gain.value = 1;
    duck.connect(out);
    // reverb bus: generated stereo impulse response, ~2.2s exponential decay
    const ir = ctx.createBuffer(2, Math.floor(ctx.sampleRate * 2.2), ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < d.length; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2.6);
      }
    }
    const convolver = ctx.createConvolver();
    convolver.buffer = ir;
    const verb = ctx.createGain();
    verb.gain.value = 0.9;
    verb.connect(convolver);
    convolver.connect(duck);
    // ping-pong echo: left tap, then right, feeding back through both
    const echo = ctx.createGain();
    const echoDelay = ctx.createDelay(3);
    const echoDelay2 = ctx.createDelay(3);
    const et = stepSec() * cssNum(docEl, "--echo-time", 3);
    echoDelay.delayTime.value = et;
    echoDelay2.delayTime.value = et;
    const pL = ctx.createStereoPanner();
    pL.pan.value = -0.6;
    const pR = ctx.createStereoPanner();
    pR.pan.value = 0.6;
    const damp = ctx.createBiquadFilter();
    damp.type = "lowpass";
    damp.frequency.value = 3200;
    const fb = ctx.createGain();
    fb.gain.value = 0.45;
    echo.connect(echoDelay);
    echoDelay.connect(pL);
    pL.connect(duck);
    echoDelay.connect(echoDelay2);
    echoDelay2.connect(pR);
    pR.connect(duck);
    echoDelay2.connect(damp);
    damp.connect(fb);
    fb.connect(echoDelay);
    // hard curve for kick saturation (per-voice shapers share it)
    const kickCurve = new Float32Array(512);
    for (let i = 0; i < kickCurve.length; i++) {
      const x = (i / (kickCurve.length - 1)) * 2 - 1;
      kickCurve[i] = Math.tanh(3 * x) / Math.tanh(3);
    }
    const noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    // custom wavetables: extra vocabulary for --wave, defined as harmonic
    // spectra (normalized, so loudness stays consistent across waves)
    const mkWave = (harmonics: number[]): PeriodicWave => {
      const re = new Float32Array(harmonics.length + 1);
      const im = new Float32Array(harmonics.length + 1);
      for (let i = 0; i < harmonics.length; i++) im[i + 1] = harmonics[i] ?? 0;
      return ctx.createPeriodicWave(re, im);
    };
    const pulse = (duty: number): number[] => {
      const h: number[] = [];
      for (let n = 1; n <= 24; n++) h.push((2 / (n * Math.PI)) * Math.sin(Math.PI * n * duty));
      return h;
    };
    const waves: { [name: string]: PeriodicWave | undefined } = {
      pulse25: mkWave(pulse(0.25)),
      pulse125: mkWave(pulse(0.125)),
      organ: mkWave([1, 0.9, 0.75, 0.4, 0.1, 0.25, 0.05, 0.18, 0, 0.05]),
      ep: mkWave([1, 0.35, 0.12, 0.28, 0.05, 0.02, 0.09, 0.01]),
      brass: mkWave([1, 0.68, 0.58, 0.34, 0.26, 0.18, 0.13, 0.09, 0.06, 0.04, 0.025, 0.015]),
      glass: mkWave([1, 0, 0.05, 0.45, 0, 0.02, 0, 0, 0.28, 0, 0, 0.12]),
    };
    // pre-warm the OS speech service so a voice track's first utterance
    // doesn't stall the main thread mid-playback
    if (typeof speechSynthesis !== "undefined") speechSynthesis.getVoices();
    engine = { ctx, out, duck, verb, echo, echoDelay, echoDelay2, noise, kickCurve, waves };
    return engine;
  };

  // Synth params are CSS custom properties on the track (all registered, so
  // all animatable): --spread = unison detune in cents (two oscillators),
  // --cutoff = lowpass Hz (0 = off), --attack/--release = envelope seconds.
  // Tonal voices stay live after scheduling: updateVoices re-reads their
  // geometry and track volume while they sound, so CSS that moves or fades a
  // note mid-flight is heard as a pitch bend or a fade. --wave:voice tracks
  // speak their notes' text content instead of synthesizing.
  type Voice = { trk: HTMLElement; nb: NoteBox; oscs: OscillatorNode[]; lvl: GainNode; mul: number; until: number };
  let voices: Voice[] = [];

  const playNote = (trk: HTMLElement, nb: NoteBox, when: number, dur: number): void => {
    const { ctx, out, noise } = audio();
    const vol = cssNum(trk, "--vol", 0.3) * nb.vel;
    if (vol <= 0) return;
    const wave = cssStr(trk, "--wave");
    if (wave === "voice") {
      if (typeof speechSynthesis === "undefined") return;
      const text = nb.el === null ? "" : (nb.el.textContent ?? "").trim();
      if (text === "") return;
      window.setTimeout(() => {
        // drop rather than queue: a backed-up TTS engine stalls the tab
        if (!playing || speechSynthesis.speaking || speechSynthesis.pending) return;
        const u = new SpeechSynthesisUtterance(text);
        u.pitch = clamp(Math.pow(2, (nb.midi - 60) / 12), 0, 2);
        u.rate = 0.9;
        u.volume = clamp(vol * 2, 0, 1);
        speechSynthesis.speak(u);
      }, Math.max((when - ctx.currentTime) * 1000, 0));
      return;
    }
    const freq = 440 * Math.pow(2, (nb.midi - 69) / 12);
    const cutBase = cssNum(trk, "--cutoff", 0);
    // velocity opens the filter — louder notes are brighter, like a real synth
    const cutoff = cutBase > 0 ? cutBase * (0.6 + 0.4 * Math.min(nb.vel, 1.25)) : 0;
    const env = ctx.createGain(); // envelope shape, normalized 0..1
    const lvl = ctx.createGain(); // level (vol × vel), kept live by updateVoices
    env.connect(lvl);
    // stereo: track --pan plus keyboard tracking (--width) — high notes sit
    // right, low notes left, like a piano
    const pan = ctx.createStereoPanner();
    pan.pan.value = clamp(
      cssNum(trk, "--pan", 0) + ((nb.midi - 64) / 64) * cssNum(trk, "--width", 0.3),
      -1,
      1,
    );
    lvl.connect(pan);
    // kicks bypass the duck bus (they're the ones doing the ducking)
    const { duck } = audio();
    const kickish = wave === "noise" && nb.midi < 50;
    pan.connect(kickish ? out : duck);
    const { verb, echo } = audio();
    const vAmt = cssNum(trk, "--verb", 0.15);
    if (vAmt > 0) {
      const vs = ctx.createGain();
      vs.gain.value = vAmt;
      pan.connect(vs);
      vs.connect(verb);
    }
    const eAmt = cssNum(trk, "--echo", 0);
    if (eAmt > 0) {
      const es = ctx.createGain();
      es.gain.value = eAmt;
      pan.connect(es);
      es.connect(echo);
    }
    if (wave === "clap") {
      // 909-style clap: three fast noise bursts, then the body
      lvl.gain.value = vol;
      const src = ctx.createBufferSource();
      src.buffer = noise;
      src.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = clamp(freq * 5, 400, 8000);
      bp.Q.value = 1.1;
      src.connect(bp);
      bp.connect(env);
      env.gain.setValueAtTime(0, when);
      for (const t of [0, 0.012, 0.026]) {
        env.gain.setValueAtTime(0.95, when + t);
        env.gain.exponentialRampToValueAtTime(0.05, when + t + 0.011);
      }
      env.gain.setValueAtTime(0.8, when + 0.03);
      env.gain.exponentialRampToValueAtTime(0.004, when + 0.2);
      src.start(when, (when * 6.31) % 0.9); // per-hit noise variance
      src.stop(when + 0.25);
    } else if (wave === "noise") {
      // drums chosen by register: <50 kick, 50-62 tom (pitched), 63-75 snare,
      // 76-79 open hat, 80+ closed hat — the format stays "pitch = which drum"
      lvl.gain.value = vol;
      if (nb.midi < 50) {
        // kick: saturated sine with a fast pitch drop + noise click.
        // Each kick dips the duck bus — the sidechain pump (--duck depth).
        const depth = clamp(cssNum(docEl, "--duck", 0), 0, 0.9);
        if (depth > 0) {
          duck.gain.setTargetAtTime(1 - depth, when, 0.012);
          duck.gain.setTargetAtTime(1, when + 0.07, 0.09);
        }
        const { kickCurve } = audio();
        const shp = ctx.createWaveShaper();
        shp.curve = kickCurve;
        shp.connect(env);
        const osc = ctx.createOscillator();
        osc.frequency.setValueAtTime(freq * 5, when);
        osc.frequency.exponentialRampToValueAtTime(Math.max(freq, 35), when + 0.05);
        osc.connect(shp);
        const click = ctx.createBufferSource();
        click.buffer = noise;
        const cg = ctx.createGain();
        cg.gain.setValueAtTime(0.35, when);
        cg.gain.exponentialRampToValueAtTime(0.004, when + 0.02);
        click.connect(cg);
        cg.connect(env);
        env.gain.setValueAtTime(0, when);
        env.gain.linearRampToValueAtTime(1, when + 0.004);
        env.gain.exponentialRampToValueAtTime(0.004, when + 0.3);
        osc.start(when);
        osc.stop(when + 0.35);
        click.start(when, (when * 3.31) % 0.9); // per-hit click variance
        click.stop(when + 0.04);
      } else if (nb.midi >= 76) {
        // hats: noise sizzle over a small metallic stack pushed above the
        // cowbell zone. Per-hit variance — buffer offset, partial detune,
        // decay and brightness all derive from the schedule time, so no two
        // hits are identical.
        const decay = (nb.midi >= 80 ? 0.05 : 0.25) * (0.85 + ((when * 131) % 0.3));
        lvl.gain.value = vol * 0.7;
        const hp = ctx.createBiquadFilter();
        hp.type = "highpass";
        hp.frequency.value = clamp(freq * 5.5, 3000, 12000) * (0.8 + 0.4 * Math.min(nb.vel, 1));
        hp.connect(env);
        const src = ctx.createBufferSource();
        src.buffer = noise;
        src.loop = true;
        const ng = ctx.createGain();
        ng.gain.value = 0.85;
        src.connect(ng);
        ng.connect(hp);
        src.start(when, (when * 7.13) % 0.9);
        src.stop(when + decay + 0.05);
        const mg = ctx.createGain();
        mg.gain.value = 0.4;
        mg.connect(hp);
        const base = clamp(freq * 2.2, 600, 2200);
        const detuneSeed = ((when * 997) % 60) - 30;
        for (const r of [1, 1.2312, 1.342, 1.6532, 1.9523, 2.1523]) {
          const o = ctx.createOscillator();
          o.type = "square";
          o.frequency.value = base * r * 2;
          o.detune.value = detuneSeed * r;
          o.connect(mg);
          o.start(when);
          o.stop(when + decay + 0.05);
        }
        env.gain.setValueAtTime(0, when);
        env.gain.linearRampToValueAtTime(1, when + 0.002);
        env.gain.exponentialRampToValueAtTime(0.004, when + decay);
      } else {
        // toms (50-62): pitched resonant bodies. snares (63-75): two bands —
        // a bright snap over the rattle, plus a tone body
        const tomy = nb.midi < 63;
        const decay = tomy ? 0.25 : 0.14;
        const src = ctx.createBufferSource();
        src.buffer = noise;
        src.loop = true;
        const bp = ctx.createBiquadFilter();
        bp.type = "bandpass";
        bp.frequency.value = clamp(freq * 5, 120, 12000);
        bp.Q.value = 0.7;
        src.connect(bp);
        let tail: AudioNode = bp;
        if (cutoff > 0) {
          const lp = ctx.createBiquadFilter();
          lp.type = "lowpass";
          lp.frequency.value = clamp(cutoff, 40, 18000);
          tail.connect(lp);
          tail = lp;
        }
        tail.connect(env);
        if (!tomy) {
          const hp = ctx.createBiquadFilter();
          hp.type = "highpass";
          hp.frequency.value = 4000;
          src.connect(hp);
          const sg = ctx.createGain();
          sg.gain.setValueAtTime(0.8, when);
          sg.gain.exponentialRampToValueAtTime(0.01, when + 0.06);
          hp.connect(sg);
          sg.connect(env);
        }
        const tone = ctx.createOscillator();
        tone.type = "triangle";
        tone.frequency.value = freq;
        const tg = ctx.createGain();
        tg.gain.setValueAtTime(tomy ? 0.7 : 0.5, when);
        tg.gain.exponentialRampToValueAtTime(0.004, when + (tomy ? 0.16 : 0.08));
        tone.connect(tg);
        tg.connect(env);
        tone.start(when);
        tone.stop(when + (tomy ? 0.2 : 0.1));
        env.gain.setValueAtTime(0, when);
        env.gain.linearRampToValueAtTime(1, when + 0.003);
        env.gain.exponentialRampToValueAtTime(0.004, when + decay);
        src.start(when, (when * 5.07) % 0.9); // per-hit noise variance
        src.stop(when + decay + 0.05);
      }
    } else {
      const attack = clamp(cssNum(trk, "--attack", 0.005), 0.001, Math.max(dur - 0.02, 0.02));
      const release = clamp(cssNum(trk, "--release", 0.04), 0.005, 2);
      const spread = cssNum(trk, "--spread", 0);
      let dest: AudioNode = env;
      if (cutoff > 0) {
        const lp = ctx.createBiquadFilter();
        lp.type = "lowpass";
        const fenv = cssNum(trk, "--fenv", 0);
        if (fenv > 0) {
          // per-note filter envelope: sweep open, settle back (subtractive pluck)
          lp.Q.value = 0.9;
          lp.frequency.setValueAtTime(clamp(cutoff * 0.3, 40, 18000), when);
          lp.frequency.exponentialRampToValueAtTime(clamp(cutoff * (1 + fenv), 40, 18000), when + 0.04);
          lp.frequency.exponentialRampToValueAtTime(clamp(cutoff, 40, 18000), when + 0.2);
        } else {
          lp.Q.value = 0.5;
          lp.frequency.value = clamp(cutoff, 40, 18000);
        }
        lp.connect(env);
        dest = lp;
      }
      const { waves } = audio();
      const custom = waves[wave];
      const type: OscillatorType =
        wave === "triangle" || wave === "square" || wave === "sawtooth" ? wave : "sine";
      const detunes = spread > 0 ? [-spread / 2, spread / 2] : [0];
      const mul = detunes.length > 1 ? 0.65 : 1;
      lvl.gain.value = vol * mul;
      const end = when + Math.max(dur - 0.01, 0.05);
      env.gain.setValueAtTime(0, when);
      env.gain.linearRampToValueAtTime(1, when + attack);
      env.gain.linearRampToValueAtTime(0.75, Math.max(end - 0.02, when + attack));
      env.gain.linearRampToValueAtTime(0, end + release);
      const oscs: OscillatorNode[] = [];
      for (const det of detunes) {
        const osc = ctx.createOscillator();
        if (custom) osc.setPeriodicWave(custom);
        else osc.type = type;
        osc.frequency.value = freq;
        osc.detune.value = det;
        osc.connect(dest);
        osc.start(when);
        osc.stop(end + release + 0.05);
        oscs.push(osc);
      }
      const vib = cssNum(trk, "--vibrato", 0);
      if (vib > 0) {
        // vibrato fades in after the onset, like a player settling on a note
        const lfo = ctx.createOscillator();
        lfo.frequency.value = Math.max(cssNum(trk, "--vib-rate", 5), 0.1);
        const depth = ctx.createGain();
        depth.gain.setValueAtTime(0, when);
        depth.gain.linearRampToValueAtTime(vib, when + 0.25);
        lfo.connect(depth);
        for (const o of oscs) depth.connect(o.detune);
        lfo.start(when);
        lfo.stop(end + release + 0.05);
      }
      voices.push({ trk, nb, oscs, lvl, mul, until: end + release });
    }
  };

  // The layout is a live controller, not just a score: while a voice sounds,
  // keep re-reading where its note is painted and how loud its track is.
  const updateVoices = (now: number): void => {
    voices = voices.filter((v) => v.until > now);
    for (const v of voices) {
      const cur =
        v.nb.el !== null ? geoBox(v.nb.el) : v.nb.pseudo !== null ? pseudoBox(v.trk, v.nb.pseudo) : null;
      if (!cur) {
        v.lvl.gain.setTargetAtTime(0, now, 0.05); // note removed or display:none
        continue;
      }
      const freq = 440 * Math.pow(2, (cur.midi - 69) / 12);
      for (const o of v.oscs) o.frequency.setTargetAtTime(freq, now, 0.04);
      v.lvl.gain.setTargetAtTime(cssNum(v.trk, "--vol", 0.3) * cur.vel * v.mul, now, 0.08);
    }
  };

  // ---- chrome (rebuilt every load, stripped on save) -----------------------
  for (const stale of document.querySelectorAll("[data-chrome]")) stale.remove();

  const ph = document.createElement("div");
  ph.id = "ph";
  ph.dataset.chrome = "1";
  roll.append(ph);

  const keys = document.createElement("div");
  keys.id = "keys";
  keys.dataset.chrome = "1";
  for (let row = 1; row <= ROWS; row++) {
    const midi = TOP_MIDI - (row - 1);
    const name = NAMES[midi % 12] ?? "";
    const cell = document.createElement("div");
    if (name.includes("#")) cell.className = "bk";
    if (name === "C") {
      cell.className = "c";
      cell.textContent = "C" + String(Math.floor(midi / 12) - 1);
    }
    keys.append(cell);
  }
  wrap.prepend(keys);

  // live song-css editor: the arrangement stylesheet is part of the document,
  // so edits here are applied (and heard) immediately and persist through save.
  const songCss = ((): HTMLStyleElement => {
    const found = document.querySelector("style#songcss");
    if (found instanceof HTMLStyleElement) return found;
    const s = document.createElement("style");
    s.id = "songcss";
    document.head.append(s);
    return s;
  })();

  const cssPanel = document.createElement("aside");
  cssPanel.id = "csspanel";
  cssPanel.dataset.chrome = "1";
  const cssHead = document.createElement("header");
  cssHead.textContent = "song css — edits apply live and save with the file";
  const cssArea = document.createElement("textarea");
  cssArea.spellcheck = false;
  cssArea.value = songCss.textContent ?? "";
  cssArea.addEventListener("input", () => {
    songCss.textContent = cssArea.value;
  });
  cssArea.addEventListener("keydown", (e) => {
    if (e.key === "Escape") cssArea.blur();
    if (e.key !== "Tab") return;
    e.preventDefault();
    cssArea.setRangeText("  ", cssArea.selectionStart, cssArea.selectionEnd, "end");
    songCss.textContent = cssArea.value;
  });
  cssPanel.append(cssHead, cssArea);
  document.body.append(cssPanel);

  const button = (label: string, onClick: () => void): HTMLButtonElement => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.addEventListener("click", onClick);
    return b;
  };
  const labeled = (text: string, input: HTMLElement): HTMLLabelElement => {
    const l = document.createElement("label");
    l.append(text, input);
    return l;
  };
  const numInput = (value: number, min: number, max: number, onChange: (v: number) => void): HTMLInputElement => {
    const i = document.createElement("input");
    i.type = "number";
    i.min = String(min);
    i.max = String(max);
    i.value = String(value);
    i.addEventListener("change", () => {
      const v = clamp(parseFloat(i.value), min, max);
      if (Number.isFinite(v)) {
        i.value = String(v);
        onChange(v);
      }
    });
    return i;
  };

  const bar = document.createElement("header");
  bar.id = "bar";
  bar.dataset.chrome = "1";

  const playBtn = button("▶ play", () => toggle());
  playBtn.id = "play";

  const bpmIn = numInput(bpm(), 40, 300, (v) => {
    docEl.style.setProperty("--bpm", String(v));
  });
  const stepsIn = numInput(steps(), 16, 256, (v) => {
    roll.style.setProperty("--steps", String(v));
  });

  const chips: Chip[] = [];
  for (const trk of tracks()) {
    const chip = button(trk.dataset.name ?? "track", () => setLive(trk));
    chip.className = "chip";
    chip.style.setProperty("--hue", String(cssNum(trk, "--hue", 0)));
    chips.push({ chip, trk });
  }

  const waveSel = document.createElement("select");
  for (const w of ["sine", "triangle", "square", "sawtooth", "pulse25", "pulse125", "organ", "ep", "brass", "glass", "noise", "clap", "voice"]) {
    const o = document.createElement("option");
    o.value = w;
    o.textContent = w;
    waveSel.append(o);
  }
  waveSel.addEventListener("change", () => {
    live.style.setProperty("--wave", waveSel.value);
  });

  const volIn = document.createElement("input");
  volIn.type = "range";
  volIn.min = "0";
  volIn.max = "1";
  volIn.step = "0.05";
  volIn.addEventListener("input", () => {
    live.style.setProperty("--vol", volIn.value);
  });

  const titleIn = document.createElement("input");
  titleIn.type = "text";
  titleIn.value = document.title;
  titleIn.addEventListener("input", () => {
    document.title = titleIn.value;
  });

  const cssBtn = button("{ } css", () => {
    const open = !cssPanel.classList.contains("open");
    cssPanel.classList.toggle("open", open);
    document.body.classList.toggle("css-open", open);
    cssBtn.classList.toggle("on", open);
    if (open) {
      cssPanel.style.top = `${wrap.getBoundingClientRect().top}px`;
      cssArea.focus();
    }
  });
  cssBtn.id = "cssbtn";

  const hint = document.createElement("span");
  hint.className = "hint";
  hint.textContent = "draw: drag · move: drag note · resize: right edge · delete: alt-click · space: play";

  bar.append(
    playBtn,
    labeled("bpm", bpmIn),
    labeled("steps", stepsIn),
    ...chips.map((c) => c.chip),
    labeled("wave", waveSel),
    labeled("vol", volIn),
    labeled("song", titleIn),
    cssBtn,
    button("save .html", () => save()),
    hint,
  );
  document.body.prepend(bar);

  function setLive(trk: HTMLElement): void {
    live = trk;
    for (const t of tracks()) t.classList.toggle("live", t === trk);
    for (const c of chips) c.chip.classList.toggle("on", c.trk === trk);
    const w = cssStr(trk, "--wave");
    waveSel.value = w === "" ? "sine" : w;
    volIn.value = String(cssNum(trk, "--vol", 0.3));
  }

  // ---- transport -----------------------------------------------------------
  let playing = false;
  let startAt = 0;
  let nextStep = 0;
  let timer = 0;
  let lastSd = 0;

  function tick(): void {
    const { ctx, echoDelay, echoDelay2 } = audio();
    const sd = stepSec();
    if (sd !== lastSd) {
      // --bpm changed (input, media query, mixer) — rebase so position holds
      if (lastSd > 0) startAt += nextStep * (lastSd - sd);
      lastSd = sd;
      // keep the echo bus tempo-synced
      const et = sd * cssNum(docEl, "--echo-time", 3);
      echoDelay.delayTime.setTargetAtTime(et, ctx.currentTime, 0.1);
      echoDelay2.delayTime.setTargetAtTime(et, ctx.currentTime, 0.1);
    }
    const n = steps();
    // form: expose the loop pass on <html> so CSS can write song structure.
    // Set BEFORE scheduling so pass rules apply to the notes being scheduled;
    // clamped so the pre-roll before startAt doesn't read as the final pass.
    const form = Math.max(1, Math.round(cssNum(docEl, "--form", 1)));
    if (form > 1) {
      const t = Math.max(0, ctx.currentTime - startAt);
      const pass = Math.floor(t / (sd * n)) % form;
      if (docEl.dataset.pass !== String(pass)) docEl.dataset.pass = String(pass);
    } else if (docEl.dataset.pass !== undefined) {
      delete docEl.dataset.pass;
    }
    while (playing && startAt + nextStep * sd < ctx.currentTime + 0.18) {
      for (const trk of tracks()) {
        // per-track --loop wraps a track at its own length (polymeter);
        // 0/unset means the global loop
        const lv = Math.round(cssNum(trk, "--loop", 0));
        const L = lv >= 1 ? lv : n;
        const sL = nextStep % L;
        const boxes = trackBoxes(trk, ctx.currentTime);
        for (const nb of boxes) {
          // loop time is modular: a note transformed past the loop edge
          // wraps around (this is what makes full phase-drifts seamless)
          const w = ((nb.step % L) + L) % L;
          if (w >= sL && w < sL + 1) {
            playNote(trk, nb, startAt + (nextStep + w - sL) * sd, nb.len * sd);
          }
        }
      }
      nextStep++;
    }
    updateVoices(ctx.currentTime);
  }

  function frame(): void {
    if (!playing || !engine) return;
    const t = (engine.ctx.currentTime - startAt) / stepSec();
    const x = (t < 0 ? 0 : t % steps()) * cellW();
    ph.style.transform = `translateX(${x}px)`;
    requestAnimationFrame(frame);
  }

  function play(): void {
    const { ctx } = audio();
    void ctx.resume();
    playing = true;
    startAt = ctx.currentTime + 0.06;
    nextStep = 0;
    lastSd = 0;
    tick();
    timer = window.setInterval(tick, 30);
    docEl.classList.add("playing"); // transport-synced start for song animations
    playBtn.textContent = "■ stop";
    playBtn.classList.add("on");
    ph.style.display = "block";
    requestAnimationFrame(frame);
  }

  function stop(): void {
    playing = false;
    window.clearInterval(timer);
    voices = [];
    if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
    delete docEl.dataset.pass;
    docEl.classList.remove("playing");
    playBtn.textContent = "▶ play";
    playBtn.classList.remove("on");
    ph.style.display = "none";
  }

  function toggle(): void {
    if (playing) stop();
    else play();
  }

  // ---- editing -------------------------------------------------------------
  let drag: Drag | null = null;

  const cellAt = (e: PointerEvent): { col: number; row: number } => {
    const r = roll.getBoundingClientRect();
    const col = clamp(Math.floor((e.clientX - r.left) / cellW()) + 1, 1, steps());
    const row = clamp(Math.floor((e.clientY - r.top) / rowH()) + 1, 1, ROWS);
    return { col, row };
  };

  roll.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    const t = e.target;
    const { col, row } = cellAt(e);
    if (t instanceof HTMLElement && t.tagName === "B" && t.parentElement === live) {
      if (e.altKey) {
        t.remove();
        return;
      }
      const nb = gridBox(t);
      if (!nb) return;
      const rect = t.getBoundingClientRect();
      drag = {
        el: t,
        mode: e.clientX > rect.right - 8 ? "resize" : "move",
        grab: col - (nb.step + 1),
      };
    } else {
      const b = document.createElement("b");
      setBox(b, col - 1, 1, TOP_MIDI - (row - 1));
      live.append(b);
      drag = { el: b, mode: "resize", grab: 0 };
    }
    if (e.isTrusted) roll.setPointerCapture(e.pointerId);
    e.preventDefault();
  });

  roll.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const { col, row } = cellAt(e);
    const nb = gridBox(drag.el);
    if (!nb) return;
    if (drag.mode === "move") {
      const step = clamp(col - drag.grab - 1, 0, steps() - nb.len);
      setBox(drag.el, step, nb.len, TOP_MIDI - (row - 1));
    } else {
      const len = clamp(col - nb.step, 1, steps() - nb.step);
      setBox(drag.el, nb.step, len, nb.midi);
    }
  });

  roll.addEventListener("pointerup", () => {
    if (!drag) return;
    const nb = geoBox(drag.el);
    drag = null;
    if (nb) {
      const { ctx } = audio();
      playNote(live, nb, ctx.currentTime + 0.01, Math.min(nb.len * stepSec(), 0.35));
    }
  });

  roll.addEventListener("contextmenu", (e) => {
    const t = e.target;
    if (t instanceof HTMLElement && t.tagName === "B" && t.parentElement === live) {
      e.preventDefault();
      t.remove();
    }
  });

  window.addEventListener("keydown", (e) => {
    if (e.code !== "Space") return;
    const t = e.target;
    if (t instanceof HTMLInputElement || t instanceof HTMLSelectElement || t instanceof HTMLTextAreaElement) return;
    e.preventDefault();
    toggle();
  });

  // ---- save: the document serializes itself --------------------------------
  function save(): void {
    if (playing) stop();
    const clone = docEl.cloneNode(true);
    if (!(clone instanceof HTMLElement)) return;
    for (const el of clone.querySelectorAll("[data-chrome]")) el.remove();
    for (const el of clone.querySelectorAll(".live")) el.classList.remove("live");
    clone.classList.remove("playing");
    clone.removeAttribute("data-pass");
    const bodyClone = clone.querySelector("body");
    if (bodyClone) bodyClone.classList.remove("css-open");
    const file = "<!DOCTYPE html>\n" + clone.outerHTML;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([file], { type: "text/html" }));
    a.download = (document.title.trim() || "song").replace(/[^\w-]+/g, "-").toLowerCase() + ".html";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // ---- boot ----------------------------------------------------------------
  setLive(live);
  wrap.scrollTop = Math.max(0, 28 * rowH() - wrap.clientHeight / 2);
}
