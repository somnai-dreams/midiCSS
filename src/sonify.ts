// midiCSS sonify — paste into any website's devtools console and listen to
// the page. The viewport is the score: left edge = time (one sweep per loop),
// vertical position = pitch (continuous, i.e. microtonal), element width =
// duration, tag = instrument, text color chroma = velocity. The DOM is
// re-read every pass, so scrolling remixes the page live.
// Escape stops it; pasting again toggles it off.

(() => {
  const g = globalThis as { __sonify?: { stop: () => void } };
  if (g.__sonify) {
    g.__sonify.stop();
    return;
  }

  const LOOP_SEC = 4; // one viewport sweep
  const STEPS = 32; // time quantization per loop (pitch stays continuous)
  const MIDI_LO = 33;
  const MIDI_HI = 86;
  const MAX_NOTES = 240;

  type Inst = { wave: OscillatorType; vol: number; maxDur: number };
  const TAGS: { [tag: string]: Inst | undefined } = {
    H1: { wave: "square", vol: 0.3, maxDur: 1.5 },
    H2: { wave: "square", vol: 0.26, maxDur: 1.2 },
    H3: { wave: "square", vol: 0.22, maxDur: 1.0 },
    H4: { wave: "square", vol: 0.18, maxDur: 0.8 },
    A: { wave: "triangle", vol: 0.16, maxDur: 0.25 },
    BUTTON: { wave: "square", vol: 0.22, maxDur: 0.3 },
    INPUT: { wave: "triangle", vol: 0.18, maxDur: 0.4 },
    TEXTAREA: { wave: "triangle", vol: 0.18, maxDur: 0.6 },
    IMG: { wave: "sawtooth", vol: 0.14, maxDur: 2.5 },
    VIDEO: { wave: "sawtooth", vol: 0.18, maxDur: 3 },
    SVG: { wave: "sawtooth", vol: 0.12, maxDur: 1.5 },
    P: { wave: "sine", vol: 0.12, maxDur: 2 },
    LI: { wave: "triangle", vol: 0.12, maxDur: 0.5 },
    CODE: { wave: "triangle", vol: 0.15, maxDur: 0.6 },
    PRE: { wave: "sine", vol: 0.14, maxDur: 2.5 },
    BLOCKQUOTE: { wave: "sine", vol: 0.14, maxDur: 2 },
    TD: { wave: "triangle", vol: 0.1, maxDur: 0.3 },
    TH: { wave: "triangle", vol: 0.12, maxDur: 0.3 },
  };
  const SELECTOR = "h1,h2,h3,h4,a,button,input,textarea,img,video,svg,p,li,code,pre,blockquote,td,th";

  const clamp = (v: number, lo: number, hi: number): number => Math.min(Math.max(v, lo), hi);

  const ctx = new AudioContext();
  const comp = ctx.createDynamicsCompressor();
  comp.connect(ctx.destination);
  const master = ctx.createGain();
  master.gain.value = 0.6;
  master.connect(comp);

  type Note = { el: Element; t: number; midi: number; dur: number; wave: OscillatorType; vol: number; vel: number };

  const collect = (): Note[] => {
    const vw = innerWidth;
    const vh = innerHeight;
    const notes: Note[] = [];
    for (const el of document.querySelectorAll(SELECTOR)) {
      if (notes.length >= MAX_NOTES) break;
      const inst = TAGS[el.tagName.toUpperCase()];
      if (!inst) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) continue;
      if (r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || parseFloat(cs.opacity) === 0) continue;
      const x01 = clamp(r.left / vw, 0, 1);
      const t = STEPS > 0 ? (Math.round(x01 * STEPS) / STEPS) * LOOP_SEC : x01 * LOOP_SEC;
      const y01 = clamp((r.top + r.height / 2) / vh, 0, 1);
      const rgb = cs.color.match(/\d+(\.\d+)?/g);
      const a = parseFloat(rgb?.[0] ?? "128");
      const b = parseFloat(rgb?.[1] ?? "128");
      const c = parseFloat(rgb?.[2] ?? "128");
      const chroma = (Math.max(a, b, c) - Math.min(a, b, c)) / 255; // colorful = louder
      notes.push({
        el,
        t,
        midi: MIDI_HI - y01 * (MIDI_HI - MIDI_LO),
        dur: clamp((r.width / vw) * LOOP_SEC, 0.08, inst.maxDur),
        wave: inst.wave,
        vol: inst.vol,
        vel: 0.45 + 0.55 * chroma,
      });
    }
    return notes;
  };

  const voice = (n: Note, when: number): void => {
    const env = ctx.createGain();
    env.connect(master);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 2400;
    lp.Q.value = 0.5;
    lp.connect(env);
    const freq = 440 * Math.pow(2, (n.midi - 69) / 12);
    const end = when + n.dur;
    const lvl = n.vol * n.vel;
    env.gain.setValueAtTime(0, when);
    env.gain.linearRampToValueAtTime(lvl, when + 0.012);
    env.gain.linearRampToValueAtTime(lvl * 0.7, Math.max(end - 0.03, when + 0.02));
    env.gain.linearRampToValueAtTime(0, end + 0.09);
    const dets = n.wave === "sine" ? [0] : [-2.5, 2.5];
    for (const d of dets) {
      const o = ctx.createOscillator();
      o.type = n.wave;
      o.frequency.value = freq;
      o.detune.value = d;
      o.connect(lp);
      o.start(when);
      o.stop(end + 0.15);
    }
  };

  const flash = (el: Element, dur: number): void => {
    el.animate(
      [
        { boxShadow: "0 0 0 2px rgba(255, 0, 128, 0.85)" },
        { boxShadow: "0 0 0 2px rgba(255, 0, 128, 0)" },
      ],
      { duration: clamp(dur * 1000, 200, 1200) },
    );
  };

  let stopped = false;
  let scheduledThrough = ctx.currentTime + 0.15;

  const schedulePass = (passStart: number): void => {
    scheduledThrough = passStart + LOOP_SEC;
    for (const n of collect()) {
      const when = passStart + n.t;
      voice(n, when);
      window.setTimeout(() => {
        if (!stopped) flash(n.el, n.dur);
      }, Math.max((when - ctx.currentTime) * 1000, 0));
    }
  };
  schedulePass(scheduledThrough);
  const timer = window.setInterval(() => {
    if (ctx.currentTime > scheduledThrough - 0.3) schedulePass(scheduledThrough);
  }, 120);

  const ph = document.createElement("div");
  ph.style.cssText =
    "position:fixed;top:0;bottom:0;left:0;width:2px;background:#f0a;box-shadow:0 0 8px #f0a;z-index:2147483647;pointer-events:none";
  document.body.append(ph);
  const frame = (): void => {
    if (stopped) return;
    const pos = (ctx.currentTime - (scheduledThrough - LOOP_SEC)) / LOOP_SEC;
    const p = pos < 0 ? pos + 1 : pos % 1;
    ph.style.left = `${p * innerWidth}px`;
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  const stop = (): void => {
    stopped = true;
    window.clearInterval(timer);
    window.removeEventListener("keydown", onKey, true);
    ph.remove();
    void ctx.close();
    delete g.__sonify;
    console.log("%cmidiCSS sonify: stopped", "color:#f0a");
  };
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === "Escape") stop();
  };
  window.addEventListener("keydown", onKey, true);
  g.__sonify = { stop };

  if (ctx.state === "suspended") {
    void ctx.resume();
    window.addEventListener("pointerdown", () => void ctx.resume(), { once: true });
    console.log("%cmidiCSS sonify: if silent, click the page once", "color:#f0a");
  }
  console.log(
    "%cmidiCSS sonify: listening to this page — scroll to remix · Escape to stop · paste again to toggle",
    "color:#f0a;font-weight:bold",
  );
})();
