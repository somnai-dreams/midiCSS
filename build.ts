// Assembles playable song files: strips types from src/daw.ts, inlines it with
// src/style.css into src/template.html, and renders each song's note markup,
// arrangement stylesheet and css-only mixer. Every output file is
// self-contained — song, player and editor in one .html.
export {};

type SongNote = { m: number; s: number; l: number; v?: number; w?: string };
type TrackDef = {
  name: string;
  wave: string;
  vol: number;
  hue: number;
  synth?: string; // extra track props: --spread/--cutoff/--attack/--release/--loop
  anchorPrefix?: string; // emit anchor-name:--<prefix><i> per note (anchor positioning)
  blanks?: number; // emit N empty <b> elements (placed by stylesheet rules)
  followPrefix?: string; // blanks get position-anchor:--<prefix><i>
  notes: SongNote[];
};
type Song = {
  file: string;
  title: string;
  bpm: number;
  steps: number;
  css: string;
  mixer: string;
  tracks: TrackDef[];
};

// m, s and l may all be fractional: the off-grid remainder is encoded as an
// inline transform — the player reads pitch and timing from rendered geometry.
// One row = one semitone (translateY: 1px ≈ 6 cents, microtonality); one
// column = one 16th (translateX = swing/micro-timing); scaleX = off-grid
// note lengths (triplets).
const track = (t: TrackDef): string => {
  const items = t.notes.map((n, i) => {
    const mInt = Math.round(n.m);
    const dm = n.m - mInt;
    const sInt = Math.floor(n.s);
    const ds = n.s - sInt;
    const span = Math.max(1, Math.round(n.l));
    const dl = n.l / span;
    const row = 84 - mInt;
    const vel = n.v === undefined ? "" : `;--vel:${n.v}`;
    const tx = Math.abs(ds) < 0.001 ? "0px" : `calc(var(--cw) * ${ds.toFixed(4)})`;
    const ty = Math.abs(dm) < 0.001 ? "0px" : `calc(var(--rh) * ${(-dm).toFixed(4)})`;
    const sc = Math.abs(dl - 1) < 0.001 ? "" : ` scaleX(${dl.toFixed(4)})`;
    const det = tx === "0px" && ty === "0px" && sc === ""
      ? ""
      : `;transform-origin:left;transform:translate(${tx},${ty})${sc}`;
    const anchor = t.anchorPrefix === undefined ? "" : `;anchor-name:--${t.anchorPrefix}${i}`;
    return `  <b style="grid-area:${row}/${sInt + 1}/${row + 1}/${sInt + 1 + span}${vel}${det}${anchor}">${n.w ?? ""}</b>`;
  });
  if (t.blanks !== undefined) {
    for (let i = 0; i < t.blanks; i++) {
      const follow = t.followPrefix === undefined ? "" : ` style="position-anchor:--${t.followPrefix}${i}"`;
      items.push(`  <b${follow}></b>`);
    }
  }
  const synth = t.synth === undefined ? "" : `;${t.synth}`;
  return [
    `<section class="trk" data-name="${t.name}" style="--wave:${t.wave};--vol:${t.vol};--hue:${t.hue}${synth}">`,
    ...items,
    `</section>`,
  ].join("\n");
};

// ============================================================================
// demo song — "midiCSS demo" (4 bars, Am F C G, 112bpm)
// ============================================================================

const demoLead: SongNote[] = [
  { m: 69, s: 0, l: 2 }, { m: 71, s: 2, l: 2 }, { m: 72, s: 4, l: 2 }, { m: 76, s: 6, l: 2 },
  { m: 81, s: 8, l: 4 }, { m: 79, s: 12, l: 2 }, { m: 76, s: 14, l: 2 },
  { m: 77, s: 16, l: 4 }, { m: 76, s: 20, l: 2 }, { m: 72, s: 22, l: 2 },
  { m: 69, s: 24, l: 4 }, { m: 72, s: 28, l: 4 },
  { m: 76, s: 32, l: 4 }, { m: 79, s: 36, l: 2 }, { m: 76, s: 38, l: 2 },
  { m: 72, s: 40, l: 4 }, { m: 74, s: 44, l: 4 },
  { m: 71, s: 48, l: 4 }, { m: 74, s: 52, l: 2 }, { m: 71, s: 54, l: 2 },
  { m: 67, s: 56, l: 4 }, { m: 69, s: 60, l: 4 },
];

const demoBass: SongNote[] = [
  { m: 45, s: 0, l: 3 }, { m: 45, s: 4, l: 3 }, { m: 45, s: 8, l: 3 }, { m: 45, s: 12, l: 2 }, { m: 57, s: 14, l: 2 },
  { m: 41, s: 16, l: 3 }, { m: 41, s: 20, l: 3 }, { m: 41, s: 24, l: 3 }, { m: 41, s: 28, l: 2 }, { m: 53, s: 30, l: 2 },
  { m: 48, s: 32, l: 3 }, { m: 48, s: 36, l: 3 }, { m: 48, s: 40, l: 3 }, { m: 48, s: 44, l: 2 }, { m: 55, s: 46, l: 2 },
  { m: 43, s: 48, l: 3 }, { m: 43, s: 52, l: 3 }, { m: 43, s: 56, l: 3 }, { m: 47, s: 60, l: 4 },
];

const demoPad: SongNote[] = [
  { m: 57, s: 0, l: 16 }, { m: 60, s: 0, l: 16 }, { m: 64, s: 0, l: 16 },
  { m: 53, s: 16, l: 16 }, { m: 57, s: 16, l: 16 }, { m: 60, s: 16, l: 16 },
  { m: 55, s: 32, l: 16 }, { m: 60, s: 32, l: 16 }, { m: 64, s: 32, l: 16 },
  { m: 55, s: 48, l: 16 }, { m: 59, s: 48, l: 16 }, { m: 62, s: 48, l: 16 },
];

const demoDrums: SongNote[] = [];
for (let i = 0; i < 32; i++) demoDrums.push({ m: 83, s: i * 2, l: 1, v: i % 2 === 0 ? 0.4 : 0.22 });
for (const s of [4, 12, 20, 28, 36, 44, 52, 60]) demoDrums.push({ m: 67, s, l: 1, v: 0.9 });
for (const s of [0, 8, 16, 24, 32, 40, 48, 56]) demoDrums.push({ m: 43, s, l: 1, v: 1 });

const DEMO_CSS = `
/* ========== SONG ARRANGEMENT — this is song data, not player code ==========
   Open the { } css editor in the toolbar to edit this block live.
   Playback reads computed style and rendered geometry, so any CSS here
   changes the music. !important is needed where the base value is an inline
   style on the element (inline beats stylesheets otherwise). */

/* responsive arrangement: narrow viewport gets a slower mix */
@media (max-width: 700px) {
  html { --bpm: 92 !important; }
}

/* accessibility as arrangement: calmer version, no drums */
@media (prefers-reduced-motion: reduce) {
  html { --bpm: 84 !important; }
  .trk[data-name="Drums"] { --vol: 0 !important; }
}

body:has(#mute-lead:checked)  .trk[data-name="Lead"]  { --vol: 0 !important; filter: grayscale(1) brightness(0.6); }
body:has(#mute-bass:checked)  .trk[data-name="Bass"]  { --vol: 0 !important; filter: grayscale(1) brightness(0.6); }
body:has(#mute-pad:checked)   .trk[data-name="Pad"]   { --vol: 0 !important; filter: grayscale(1) brightness(0.6); }
body:has(#mute-drums:checked) .trk[data-name="Drums"] { --vol: 0 !important; filter: grayscale(1) brightness(0.6); }

/* geometry IS the music: move the layout, transpose the song */
body:has(#oct-lead:checked) .trk[data-name="Lead"] { transform: translateY(calc(var(--rh) * -12)); }

/* swing: nudge the offbeat hats (first 32 drum notes) a third of a step late */
body:has(#swing:checked) .trk[data-name="Drums"] b:nth-child(-n+32):nth-child(even) { transform: translateX(calc(var(--cw) / 3)); }

/* automation: @keyframes are automation lanes (html.playing starts them in
   sync with the transport). The pad swells across the loop. */
html.playing .trk[data-name="Pad"] {
  animation: pad-swell calc(var(--steps) * 15s / var(--bpm)) linear infinite;
}
@keyframes pad-swell { 0%, 100% { --vol: 0.03; } 50% { --vol: 0.22; } }

/* breathing tempo — rubato as a rule; the player rebases live.
   Spec quirk: animating --bpm "taints" it, which pauses any other animation
   whose duration references var(--bpm) (the pad swell) until breathe is off. */
html.playing:has(#breathe:checked) { animation: breathe 16s ease-in-out infinite; }
@keyframes breathe { 0%, 100% { --bpm: 104; } 50% { --bpm: 124; } }

/* phase: the lead slides one full loop forward over two minutes, passing
   through every alignment against the other tracks before locking back in.
   Loop time is modular — the player wraps notes past the edge. */
html.playing:has(#phase:checked) .trk[data-name="Lead"] {
  animation: phase-drift 120s linear infinite;
}
@keyframes phase-drift {
  from { transform: translateX(0); }
  to { transform: translateX(calc(var(--steps) * var(--cw))); }
}

/* echo: anchor-positioned shadow notes. Each Shadow <b> is anchored to a Lead
   note (CSS anchor positioning) an octave down — drag a lead note and its
   echo travels with it, in layout and in sound. The section is position:static
   so the shadows' containing block is #roll, which contains the anchors
   (anchor resolution requires that). */
.trk[data-name="Shadow"] { position: static; }
.trk[data-name="Shadow"] b { display: none; }
body:has(#echo:checked) .trk[data-name="Shadow"] b {
  display: block;
  position: absolute;
  top: calc(anchor(top) + var(--rh) * 12);
  left: anchor(left);
  width: anchor-size(width);
  height: calc(var(--rh) - 2px);
}

/* sing: the Vox track speaks its notes' text via speechSynthesis */
body:has(#sing:checked) .trk[data-name="Vox"] { --vol: 0.5 !important; }

/* mutes fade instead of cutting (transitions work on registered properties) */
.trk { transition: --vol 1.2s ease; }

/* standing motion — the anti-MIDI layer. Every voice gets a per-note filter
   pluck (--fenv default), the whole band breathes ±4 cents, and the lead's
   filter wanders. microtape animates \`translate\`, which composes with the
   transform rules, so transform-based toggles keep working. The loud
   versions of these stay toggles. */
.trk { --fenv: 0.6; }
html.playing .trk { animation: microtape 23s ease-in-out infinite; }
@keyframes microtape {
  0%, 100% { translate: 0 0; }
  33% { translate: 0 calc(var(--rh) * -0.045); }
  66% { translate: 0 calc(var(--rh) * 0.035); }
}
html.playing .trk[data-name="Lead"] { animation: cutdrift 9.3s ease-in-out infinite, microtape 23s ease-in-out infinite; }
@keyframes cutdrift { 0%, 100% { --cutoff: 2100; } 50% { --cutoff: 3900; } }
`;

const DEMO_MIXER = `
<span>css-only:</span>
<label><input type="checkbox" id="mute-lead"> mute lead</label>
<label><input type="checkbox" id="mute-bass"> mute bass</label>
<label><input type="checkbox" id="mute-pad"> mute pad</label>
<label><input type="checkbox" id="mute-drums"> mute drums</label>
<label><input type="checkbox" id="oct-lead"> lead +8va</label>
<label><input type="checkbox" id="swing"> swing</label>
<label><input type="checkbox" id="breathe"> breathe</label>
<label><input type="checkbox" id="phase"> phase</label>
<label><input type="checkbox" id="echo"> echo</label>
<label><input type="checkbox" id="sing"> sing</label>
`;

const demo: Song = {
  file: "midicss.html",
  title: "midiCSS demo",
  bpm: 112,
  steps: 64,
  css: DEMO_CSS,
  mixer: DEMO_MIXER,
  tracks: [
    { name: "Lead", wave: "pulse25", vol: 0.22, hue: 205, synth: "--cutoff:2800;--verb:0.22;--echo:0.25;--vibrato:10", anchorPrefix: "L", notes: demoLead },
    { name: "Bass", wave: "triangle", vol: 0.35, hue: 145, synth: "--verb:0.08;--width:0.12", notes: demoBass },
    { name: "Pad", wave: "sawtooth", vol: 0.1, hue: 285, synth: "--attack:0.06;--cutoff:1400;--verb:0.42;--width:0.5", notes: demoPad },
    { name: "Drums", wave: "noise", vol: 0.45, hue: 35, synth: "--verb:0.15", notes: demoDrums },
    { name: "Shadow", wave: "triangle", vol: 0.12, hue: 50, blanks: 22, followPrefix: "L", notes: [] },
    {
      name: "Vox", wave: "voice", vol: 0, hue: 0,
      notes: [
        { m: 69, s: 0, l: 8, w: "cas" }, { m: 65, s: 16, l: 8, w: "cade" },
        { m: 67, s: 32, l: 8, w: "of" }, { m: 71, s: 48, l: 8, w: "style" },
      ],
    },
  ],
};

// ============================================================================
// PIXEL BLOOM — anamanaguchi-style chiptune. D major, 172bpm, 16 bars.
// A section (bars 1–8): anthem hook over D A Bm G / D A G A.
// B section (bars 9–16): soaring lift over G A Bm A / G A D A, 16th arps,
// snare fills relaunching each section. Two pulse channels in diatonic
// thirds, NES-style triangle bass pumping root/octave eighths.
// ============================================================================

// lead: D5=74 E5=76 F#5=78 G5=79 A5=81 B5=83 C#5=73 B4=71 A4=69
const bloomLead: SongNote[] = [
  // A section — hook
  { m: 78, s: 0, l: 2 }, { m: 79, s: 2, l: 2 }, { m: 81, s: 4, l: 4 },
  { m: 78, s: 8, l: 2 }, { m: 74, s: 10, l: 2 }, { m: 76, s: 12, l: 4 },
  { m: 73, s: 16, l: 2 }, { m: 76, s: 18, l: 2 }, { m: 81, s: 20, l: 4 },
  { m: 79, s: 24, l: 2 }, { m: 78, s: 26, l: 2 }, { m: 76, s: 28, l: 4 },
  { m: 78, s: 32, l: 2 }, { m: 79, s: 34, l: 2 }, { m: 81, s: 36, l: 2 },
  { m: 83, s: 38, l: 4 }, { m: 81, s: 42, l: 2 }, { m: 78, s: 44, l: 4 },
  { m: 79, s: 48, l: 4 }, { m: 78, s: 52, l: 2 }, { m: 76, s: 54, l: 2 },
  { m: 74, s: 56, l: 4 }, { m: 76, s: 60, l: 2 }, { m: 78, s: 62, l: 2 },
  // hook again, varied ending
  { m: 78, s: 64, l: 2 }, { m: 79, s: 66, l: 2 }, { m: 81, s: 68, l: 4 },
  { m: 78, s: 72, l: 2 }, { m: 74, s: 74, l: 2 }, { m: 76, s: 76, l: 4 },
  { m: 73, s: 80, l: 2 }, { m: 76, s: 82, l: 2 }, { m: 81, s: 84, l: 4 },
  { m: 83, s: 88, l: 2 }, { m: 81, s: 90, l: 2 }, { m: 79, s: 92, l: 4 },
  { m: 79, s: 96, l: 2 }, { m: 81, s: 98, l: 2 }, { m: 83, s: 100, l: 4 },
  { m: 81, s: 104, l: 2 }, { m: 79, s: 106, l: 2 }, { m: 78, s: 108, l: 4 },
  { m: 76, s: 112, l: 6 }, { m: 74, s: 118, l: 2 }, { m: 73, s: 120, l: 4 },
  // B section — soar
  { m: 74, s: 128, l: 4 }, { m: 76, s: 132, l: 2 }, { m: 78, s: 134, l: 2 }, { m: 79, s: 136, l: 8 },
  { m: 81, s: 144, l: 6 }, { m: 79, s: 150, l: 2 }, { m: 78, s: 152, l: 4 }, { m: 76, s: 156, l: 4 },
  { m: 78, s: 160, l: 4 }, { m: 79, s: 164, l: 4 }, { m: 81, s: 168, l: 8 },
  { m: 83, s: 176, l: 4 }, { m: 81, s: 180, l: 4 }, { m: 79, s: 184, l: 2 }, { m: 78, s: 186, l: 2 }, { m: 76, s: 188, l: 4 },
  { m: 79, s: 192, l: 4 }, { m: 81, s: 196, l: 4 }, { m: 83, s: 200, l: 8 },
  { m: 81, s: 208, l: 4 }, { m: 83, s: 212, l: 2 }, { m: 81, s: 214, l: 2 },
  { m: 79, s: 216, l: 4 }, { m: 78, s: 220, l: 2 }, { m: 76, s: 222, l: 2 },
  { m: 78, s: 224, l: 8 }, { m: 79, s: 232, l: 2 }, { m: 81, s: 234, l: 2 }, { m: 83, s: 236, l: 4 },
  { m: 81, s: 240, l: 6 }, { m: 79, s: 246, l: 2 }, { m: 76, s: 248, l: 4 },
];

// second pulse: diatonic thirds below the lead's held notes
const bloomHarm: SongNote[] = [
  { m: 78, s: 4, l: 4 }, { m: 73, s: 12, l: 4 },
  { m: 78, s: 20, l: 4 }, { m: 73, s: 28, l: 4 },
  { m: 79, s: 38, l: 4 }, { m: 74, s: 44, l: 4 },
  { m: 76, s: 48, l: 4 }, { m: 71, s: 56, l: 4 },
  { m: 78, s: 68, l: 4 }, { m: 73, s: 76, l: 4 },
  { m: 78, s: 84, l: 4 }, { m: 76, s: 92, l: 4 },
  { m: 79, s: 100, l: 4 }, { m: 74, s: 108, l: 4 },
  { m: 73, s: 112, l: 6 }, { m: 69, s: 120, l: 4 },
  { m: 71, s: 128, l: 4 }, { m: 76, s: 136, l: 8 },
  { m: 78, s: 144, l: 6 }, { m: 74, s: 152, l: 4 }, { m: 73, s: 156, l: 4 },
  { m: 74, s: 160, l: 4 }, { m: 76, s: 164, l: 4 }, { m: 78, s: 168, l: 8 },
  { m: 79, s: 176, l: 4 }, { m: 78, s: 180, l: 4 }, { m: 73, s: 188, l: 4 },
  { m: 76, s: 192, l: 4 }, { m: 78, s: 196, l: 4 }, { m: 79, s: 200, l: 8 },
  { m: 78, s: 208, l: 4 }, { m: 76, s: 216, l: 4 },
  { m: 74, s: 224, l: 8 }, { m: 79, s: 236, l: 4 },
  { m: 78, s: 240, l: 6 }, { m: 73, s: 248, l: 4 },
];

// NES triangle bass: root/octave eighths; hand-written walks into each section
const BLOOM_ROOTS = [38, 45, 47, 43, 38, 45, 43, 45, 43, 45, 47, 45, 43, 45, 38, 45];
const bloomBass: SongNote[] = [];
for (let bar = 0; bar < 16; bar++) {
  if (bar === 7 || bar === 15) continue; // walk bars below
  const r = BLOOM_ROOTS[bar] ?? 38;
  for (let i = 0; i < 8; i++) {
    bloomBass.push({ m: i % 2 === 0 ? r : r + 12, s: bar * 16 + i * 2, l: 2 });
  }
}
// bar 8: pump on A, then F#2 leading into the B section's G
bloomBass.push(
  { m: 45, s: 112, l: 2 }, { m: 57, s: 114, l: 2 }, { m: 45, s: 116, l: 2 }, { m: 57, s: 118, l: 2 },
  { m: 45, s: 120, l: 2 }, { m: 57, s: 122, l: 2 }, { m: 42, s: 124, l: 2 }, { m: 42, s: 126, l: 2 },
);
// bar 16: walk A → B → C# resolving to D at the loop point
bloomBass.push(
  { m: 45, s: 240, l: 2 }, { m: 57, s: 242, l: 2 }, { m: 45, s: 244, l: 2 }, { m: 57, s: 246, l: 2 },
  { m: 45, s: 248, l: 2 }, { m: 47, s: 250, l: 2 }, { m: 49, s: 252, l: 4 },
);

// arp channel: chord tones cycling — eighths in A section, sixteenths in B,
// last four bars an octave up where range allows
const CH_D = [62, 66, 69, 74];
const CH_A = [57, 61, 64, 69];
const CH_BM = [59, 62, 66, 71];
const CH_G = [55, 59, 62, 67];
const CH_G8 = [67, 71, 74, 79];
const CH_A8 = [69, 73, 76, 81];
const BLOOM_ARPS = [CH_D, CH_A, CH_BM, CH_G, CH_D, CH_A, CH_G, CH_A, CH_G, CH_A, CH_BM, CH_A, CH_G8, CH_A8, CH_D, CH_A8];
const bloomArp: SongNote[] = [];
for (let bar = 0; bar < 16; bar++) {
  const chord = BLOOM_ARPS[bar] ?? CH_D;
  if (bar < 8) {
    for (let i = 0; i < 8; i++) bloomArp.push({ m: chord[i % 4] ?? 62, s: bar * 16 + i * 2, l: 2 });
  } else {
    for (let i = 0; i < 16; i++) bloomArp.push({ m: chord[i % 4] ?? 62, s: bar * 16 + i, l: 1 });
  }
}

// noise channel: kick 41, snare 67, hat 83, crash-ish boom 48
const bloomDrums: SongNote[] = [];
for (let bar = 0; bar < 16; bar++) {
  const o = bar * 16;
  const fill = bar === 7 || bar === 15;
  const hatStep = bar >= 12 ? 1 : 2; // 16th hats for the last four bars
  for (let s = 0; s < 16; s += hatStep) {
    bloomDrums.push({ m: 83, s: o + s, l: 1, v: s % 4 === 0 ? 0.45 : 0.25 });
  }
  for (const k of fill ? [0, 4, 8] : [0, 4, 8, 12]) bloomDrums.push({ m: 41, s: o + k, l: 1, v: 1 });
  for (const sn of [4, 12]) {
    if (!(fill && sn === 12)) bloomDrums.push({ m: 67, s: o + sn, l: 1, v: 0.9 });
  }
}
// snare fills into each section
bloomDrums.push({ m: 67, s: 124, l: 1, v: 0.5 }, { m: 67, s: 125, l: 1, v: 0.65 }, { m: 67, s: 126, l: 1, v: 0.8 }, { m: 67, s: 127, l: 1, v: 1 });
bloomDrums.push({ m: 67, s: 250, l: 1, v: 0.4 }, { m: 67, s: 252, l: 1, v: 0.6 }, { m: 67, s: 253, l: 1, v: 0.7 }, { m: 67, s: 254, l: 1, v: 0.85 }, { m: 67, s: 255, l: 1, v: 1 });
// crashes at section starts
bloomDrums.push({ m: 48, s: 0, l: 2, v: 0.9 }, { m: 48, s: 128, l: 2, v: 0.9 }, { m: 48, s: 192, l: 2, v: 0.8 });

const BLOOM_CSS = `
/* ========== PIXEL BLOOM — arrangement (song data, edit live via { } css) == */

/* phones get the chiptune slightly unplugged */
@media (max-width: 700px) {
  html { --bpm: 156 !important; }
}
@media (prefers-reduced-motion: reduce) {
  html { --bpm: 140 !important; }
  .trk[data-name="Drums"] { --vol: 0.15 !important; }
}

body:has(#mute-lead:checked)  .trk[data-name="Lead"]    { --vol: 0 !important; filter: grayscale(1) brightness(0.6); }
body:has(#mute-harm:checked)  .trk[data-name="Harmony"] { --vol: 0 !important; filter: grayscale(1) brightness(0.6); }
body:has(#mute-arp:checked)   .trk[data-name="Arp"]     { --vol: 0 !important; filter: grayscale(1) brightness(0.6); }
body:has(#mute-bass:checked)  .trk[data-name="Bass"]    { --vol: 0 !important; filter: grayscale(1) brightness(0.6); }
body:has(#mute-drums:checked) .trk[data-name="Drums"]   { --vol: 0 !important; filter: grayscale(1) brightness(0.6); }

/* night mode is the parallel minor: D major's scale degrees 3, 6, 7
   (F#, B, C#) drop one semitone. Notes are selected BY PITCH via attribute
   substring match on their grid row — pitch-class selectors. Drums excluded
   (their rows are percussion, not harmony). */
@media (prefers-color-scheme: dark) {
  .trk:not([data-name="Drums"]) b[style*="grid-area:1/"],
  .trk:not([data-name="Drums"]) b[style*="grid-area:13/"],
  .trk:not([data-name="Drums"]) b[style*="grid-area:25/"],
  .trk:not([data-name="Drums"]) b[style*="grid-area:37/"],
  .trk:not([data-name="Drums"]) b[style*="grid-area:6/"],
  .trk:not([data-name="Drums"]) b[style*="grid-area:18/"],
  .trk:not([data-name="Drums"]) b[style*="grid-area:30/"],
  .trk:not([data-name="Drums"]) b[style*="grid-area:42/"],
  .trk:not([data-name="Drums"]) b[style*="grid-area:11/"],
  .trk:not([data-name="Drums"]) b[style*="grid-area:23/"],
  .trk:not([data-name="Drums"]) b[style*="grid-area:35/"],
  .trk:not([data-name="Drums"]) b[style*="grid-area:47/"] {
    transform: translateY(var(--rh)) !important;
  }
}

/* arrangement states in the URL: pixel-bloom.html#finale is shareable and
   togglable with plain <a> links — :target as a remix selector */
html:has(#finale:target) { --bpm: 196 !important; }
body:has(#finale:target) .trk[data-name="Lead"] { transform: translateY(calc(var(--rh) * -12)); }

/* hyper: final-lap mode */
html:has(#hyper:checked) { --bpm: 192 !important; }

/* daydream: the same song, asleep — pulses soften to triangles */
html:has(#dream:checked) { --bpm: 126 !important; }
body:has(#dream:checked) .trk[data-name="Lead"],
body:has(#dream:checked) .trk[data-name="Harmony"] { --wave: triangle !important; }
body:has(#dream:checked) .trk[data-name="Drums"] { --vol: 0.12 !important; }
body:has(#dream:checked) .trk[data-name="Arp"] { --vol: 0.04 !important; }

/* the arp blooms and recedes across the loop */
html.playing .trk[data-name="Arp"] {
  animation: bloom calc(var(--steps) * 15s / var(--bpm)) ease-in-out infinite;
}
@keyframes bloom { 0%, 100% { --vol: 0.045; } 50% { --vol: 0.1; } }

.trk { transition: --vol 1.2s ease; }

/* standing motion: filter plucks, ±4-cent breath, lead filter wander */
.trk { --fenv: 0.6; }
html.playing .trk { animation: microtape 23s ease-in-out infinite; }
@keyframes microtape {
  0%, 100% { translate: 0 0; }
  33% { translate: 0 calc(var(--rh) * -0.045); }
  66% { translate: 0 calc(var(--rh) * 0.035); }
}
html.playing .trk[data-name="Lead"] { animation: cutdrift 9.3s ease-in-out infinite, microtape 23s ease-in-out infinite; }
@keyframes cutdrift { 0%, 100% { --cutoff: 2400; } 50% { --cutoff: 4400; } }
html { --duck: 0.2; }
`;

const BLOOM_MIXER = `
<span>css-only:</span>
<label><input type="checkbox" id="mute-lead"> mute lead</label>
<label><input type="checkbox" id="mute-harm"> mute harmony</label>
<label><input type="checkbox" id="mute-arp"> mute arp</label>
<label><input type="checkbox" id="mute-bass"> mute bass</label>
<label><input type="checkbox" id="mute-drums"> mute drums</label>
<label><input type="checkbox" id="hyper"> hyper</label>
<label><input type="checkbox" id="dream"> daydream</label>
<a href="#finale">#finale</a>
<a href="#">#reset</a>
<i id="finale" hidden></i>
`;

const bloom: Song = {
  file: "pixel-bloom.html",
  title: "PIXEL BLOOM",
  bpm: 172,
  steps: 256,
  css: BLOOM_CSS,
  mixer: BLOOM_MIXER,
  tracks: [
    { name: "Lead", wave: "pulse25", vol: 0.2, hue: 200, synth: "--cutoff:3200;--spread:5;--verb:0.2;--echo:0.28", notes: bloomLead },
    { name: "Harmony", wave: "pulse125", vol: 0.11, hue: 320, synth: "--cutoff:2600;--spread:5;--verb:0.3;--pan:-0.2", notes: bloomHarm },
    { name: "Arp", wave: "square", vol: 0.07, hue: 265, synth: "--cutoff:2200;--echo:0.22;--pan:0.15;--width:0.5", notes: bloomArp },
    { name: "Bass", wave: "triangle", vol: 0.4, hue: 145, synth: "--cutoff:900;--verb:0.05;--width:0.1", notes: bloomBass },
    { name: "Drums", wave: "noise", vol: 0.5, hue: 35, synth: "--verb:0.12", notes: bloomDrums },
  ],
};

// ============================================================================
// GHOST RATIO — spectral / just-intonation piece. 88bpm, 8 bars, D spectrum.
// The harmonic series of D2 (partials 2–13) unfolds in pure just intonation:
// partial 5 is 14 cents flat of equal temperament, partial 7 is 31 cents flat,
// partial 11 sits dead between G and G#. A "ghost" copy of the spectrum plays
// 4 steps late and 12 cents sharp, beating against it at ~1.5–4.6Hz. A
// quarter-tone (24-TET) line snakes over the top. CSS animations with
// incommensurate periods (47s, 31s, 24s vs a 21.8s loop) keep it from ever
// repeating exactly.
// ============================================================================

const PARTIAL = (n: number): number => 38 + 12 * Math.log2(n);

type Spectral = { n: number; s: number; l: number };
const spectrum: Spectral[] = [
  { n: 2, s: 0, l: 32 }, { n: 3, s: 8, l: 32 }, { n: 4, s: 16, l: 32 }, { n: 5, s: 24, l: 40 },
  { n: 6, s: 32, l: 32 }, { n: 7, s: 40, l: 40 }, { n: 8, s: 48, l: 32 }, { n: 9, s: 56, l: 24 },
  { n: 10, s: 64, l: 32 }, { n: 11, s: 72, l: 24 }, { n: 12, s: 80, l: 24 }, { n: 13, s: 88, l: 24 },
  { n: 3, s: 96, l: 32 }, { n: 5, s: 100, l: 28 }, { n: 7, s: 104, l: 24 },
  { n: 9, s: 112, l: 16 }, { n: 11, s: 116, l: 12 }, { n: 13, s: 120, l: 8 },
];

const ratioPartials: SongNote[] = spectrum.map((p) => ({
  m: PARTIAL(p.n), s: p.s, l: p.l, v: +(1.1 / Math.sqrt(p.n)).toFixed(2),
}));
const ratioGhost: SongNote[] = spectrum.map((p) => ({
  m: PARTIAL(p.n) + 0.12, s: p.s + 4, l: p.l, v: +(0.85 / Math.sqrt(p.n)).toFixed(2),
}));

const ratioFund: SongNote[] = [
  { m: 38, s: 0, l: 64, v: 1 },
  { m: 38, s: 64, l: 64, v: 1 },
  { m: 45, s: 96, l: 32, v: 0.5 },
];

// 24-TET line, maqam-rast-ish on D: neutral third (F half-sharp, 77.5) and
// neutral sixth (B half-flat, 82.5)
const ratioQuarter: SongNote[] = [
  { m: 74, s: 48, l: 4, v: 0.9 }, { m: 76, s: 52, l: 2, v: 0.8 }, { m: 77.5, s: 54, l: 4, v: 1 },
  { m: 79, s: 58, l: 2, v: 0.8 }, { m: 77.5, s: 60, l: 4, v: 0.9 },
  { m: 81, s: 64, l: 6, v: 1 }, { m: 82.5, s: 70, l: 2, v: 0.85 }, { m: 81, s: 72, l: 4, v: 0.9 }, { m: 79, s: 76, l: 4, v: 0.85 },
  { m: 82.5, s: 80, l: 4, v: 1 }, { m: 81, s: 84, l: 2, v: 0.8 }, { m: 79, s: 86, l: 2, v: 0.8 },
  { m: 77.5, s: 88, l: 4, v: 0.9 }, { m: 76, s: 92, l: 2, v: 0.75 }, { m: 74, s: 94, l: 2, v: 0.8 },
  { m: 77.5, s: 96, l: 6, v: 0.95 }, { m: 79, s: 102, l: 2, v: 0.8 }, { m: 81, s: 104, l: 8, v: 1 },
  { m: 79, s: 112, l: 4, v: 0.85 }, { m: 77.5, s: 116, l: 2, v: 0.8 }, { m: 76, s: 118, l: 2, v: 0.75 },
  { m: 74, s: 120, l: 8, v: 0.95 },
];

// sparse industrial pulse; hats cycle every 7 steps against 16-step bars
const ratioPulse: SongNote[] = [];
for (const s of [0, 20, 32, 52, 64, 84, 96, 116]) ratioPulse.push({ m: 41, s, l: 1, v: 1 });
for (const s of [24, 56, 88, 120]) ratioPulse.push({ m: 60, s, l: 1, v: 0.55 });
for (let i = 0; i * 7 < 128; i++) ratioPulse.push({ m: 79, s: i * 7, l: 1, v: i % 2 === 0 ? 0.38 : 0.22 });

const RATIO_CSS = `
/* ========== GHOST RATIO — arrangement (edit live via { } css) ==========
   Pitch is geometry: one row = one semitone, so translateY detunes in cents.
   Every period below is incommensurate with the 21.8s loop — the beating
   patterns never line up the same way twice. */

@media (max-width: 700px) {
  html { --bpm: 72 !important; }
}

body:has(#mute-fund:checked)    .trk[data-name="Fundamental"] { --vol: 0 !important; filter: grayscale(1) brightness(0.6); }
body:has(#mute-part:checked)    .trk[data-name="Partials"]    { --vol: 0 !important; filter: grayscale(1) brightness(0.6); }
body:has(#mute-ghost:checked)   .trk[data-name="Ghost"]       { --vol: 0 !important; filter: grayscale(1) brightness(0.6); }
body:has(#mute-quarter:checked) .trk[data-name="Quarter"]     { --vol: 0 !important; filter: grayscale(1) brightness(0.6); }
body:has(#mute-pulse:checked)   .trk[data-name="Pulse"]       { --vol: 0 !important; filter: grayscale(1) brightness(0.6); }

/* the ghost spectrum drifts a third of a semitone either way over 47s —
   the beat rates against the true partials slowly evolve */
html.playing .trk[data-name="Ghost"] { animation: drift 47s ease-in-out infinite; }
@keyframes drift {
  0%, 100% { transform: translateY(0); }
  25% { transform: translateY(calc(var(--rh) * -0.31)); }
  75% { transform: translateY(calc(var(--rh) * 0.31)); }
}

/* collapse: scaleY folds the whole harmonic series toward D5 (the origin row)
   and lets it bloom back open — harmonicity breathing into near-unison */
html.playing:has(#collapse:checked) .trk[data-name="Partials"] {
  animation: collapse 24s ease-in-out infinite;
  transform-origin: 50% calc(var(--rh) * 9.5);
}
@keyframes collapse { 0%, 100% { transform: scaleY(1); } 50% { transform: scaleY(0.06); } }

/* comb: the quarter-tone line slips up to 3 steps early and back over 31s */
html.playing:has(#comb:checked) .trk[data-name="Quarter"] { animation: comb 31s ease-in-out infinite; }
@keyframes comb { 0%, 100% { transform: translateX(0); } 50% { transform: translateX(calc(var(--cw) * -3)); } }

/* summon: notes that exist only in this stylesheet — the player hears a
   track's ::before/::after if it has content and a grid-area. A D3 drone
   for the whole loop, and an A3 ghost (12 cents sharp) for the second half. */
body:has(#summon:checked) .trk[data-name="Fundamental"]::after {
  content: "";
  grid-area: 34 / 1 / 35 / 129;
  --vel: 0.5;
}
body:has(#summon:checked) .trk[data-name="Ghost"]::before {
  content: "";
  grid-area: 27 / 65 / 28 / 129;
  --vel: 0.45;
  transform: translateY(calc(var(--rh) * -0.12));
}

/* seance: 66bpm, every voice a pure sine */
html:has(#seance:checked) { --bpm: 66 !important; }
body:has(#seance:checked) .trk:not([data-name="Pulse"]) { --wave: sine !important; }

/* gaze: a scroll-driven animation maps the roll's vertical scroll position to
   the fundamental's volume — you hear what you're looking at. Scroll down to
   the bass register and the drone rises to meet you. */
html:has(#gaze:checked) .trk[data-name="Fundamental"] {
  animation: gaze auto linear both;
  animation-timeline: scroll(nearest);
}
@keyframes gaze { 0% { --vol: 0.08; } 100% { --vol: 0.7; } }

/* the roll itself trips */
html.playing #roll { animation: hue 45s linear infinite; }
@keyframes hue { to { filter: hue-rotate(360deg); } }

.trk { transition: --vol 1.5s ease; }

/* standing motion: filter plucks, ±4-cent breath, quarter-line filter wander */
.trk { --fenv: 0.6; }
html.playing .trk { animation: microtape 23s ease-in-out infinite; }
@keyframes microtape {
  0%, 100% { translate: 0 0; }
  33% { translate: 0 calc(var(--rh) * -0.045); }
  66% { translate: 0 calc(var(--rh) * 0.035); }
}
html.playing .trk[data-name="Quarter"] { animation: cutdrift 9.3s ease-in-out infinite, microtape 23s ease-in-out infinite; }
@keyframes cutdrift { 0%, 100% { --cutoff: 1200; } 50% { --cutoff: 2300; } }
`;

const RATIO_MIXER = `
<span>css-only:</span>
<label><input type="checkbox" id="mute-fund"> mute fundamental</label>
<label><input type="checkbox" id="mute-part"> mute partials</label>
<label><input type="checkbox" id="mute-ghost"> mute ghost</label>
<label><input type="checkbox" id="mute-quarter"> mute quarter</label>
<label><input type="checkbox" id="mute-pulse"> mute pulse</label>
<label><input type="checkbox" id="collapse"> collapse</label>
<label><input type="checkbox" id="summon"> summon</label>
<label><input type="checkbox" id="gaze"> gaze</label>
<label><input type="checkbox" id="comb"> comb</label>
<label><input type="checkbox" id="seance"> seance</label>
`;

const ratio: Song = {
  file: "ghost-ratio.html",
  title: "GHOST RATIO",
  bpm: 88,
  steps: 128,
  css: RATIO_CSS,
  mixer: RATIO_MIXER,
  tracks: [
    { name: "Fundamental", wave: "sine", vol: 0.5, hue: 15, synth: "--attack:0.1;--release:0.5;--verb:0.2;--width:0", notes: ratioFund },
    { name: "Partials", wave: "sine", vol: 0.16, hue: 185, synth: "--attack:0.25;--release:0.6;--verb:0.55;--width:0.6", notes: ratioPartials },
    { name: "Ghost", wave: "triangle", vol: 0.12, hue: 285, synth: "--attack:0.15;--release:0.5;--verb:0.5;--pan:-0.15", notes: ratioGhost },
    { name: "Quarter", wave: "organ", vol: 0.13, hue: 330, synth: "--cutoff:1600;--attack:0.03;--echo:0.35;--verb:0.25;--vibrato:8", notes: ratioQuarter },
    { name: "Pulse", wave: "noise", vol: 0.5, hue: 45, synth: "--verb:0.2", notes: ratioPulse },
  ],
};

// ============================================================================
// BLUE 31 — microtonal jazz. 132bpm, 12-bar minor blues in G, swung.
// Swing is encoded as fractional steps (the "and" lands at 2/3 of the beat),
// triplets as fractional lengths. The microtones are the ones jazz actually
// uses: blue thirds at the quarter-tone (70.5), septimal dominant sevenths
// 31 cents flat (the "31"), just major thirds 14 cents flat in the comping,
// and quarter-tone passing notes in the walking bass.
// ============================================================================

// rootless voicings, just intonation relative to each chord root
const GM7 = [58.16, 62.02, 65.18, 69.04];
const CM7 = [51.16, 55.02, 58.18, 62.04];
const G7 = [58.86, 62.02, 64.69, 69.04];
const C7 = [63.86, 67.02, 69.69];
const D7 = [65.86, 69.02, 71.69];

// horn: blue thirds (70.5), blue fifth (73.5), septimal sevenths (76.69)
const blueHorn: SongNote[] = [
  { m: 67, s: 0, l: 2, v: 0.85 }, { m: 70.5, s: 2.67, l: 1.33, v: 0.9 }, { m: 72, s: 4, l: 4, v: 0.95 },
  { m: 74, s: 10.67, l: 1.33, v: 0.8 }, { m: 76.69, s: 12, l: 2.67, v: 1 },
  { m: 75, s: 16, l: 2, v: 0.9 }, { m: 72, s: 18.67, l: 1.33, v: 0.8 }, { m: 67, s: 20, l: 6, v: 0.85 },
  { m: 70, s: 32, l: 2, v: 0.8 }, { m: 70.5, s: 34.67, l: 1.33, v: 0.85 }, { m: 72, s: 36, l: 2, v: 0.9 },
  { m: 73.5, s: 38.67, l: 1.33, v: 0.95 }, { m: 74, s: 40, l: 4, v: 0.95 },
  { m: 70, s: 44, l: 2, v: 0.8 }, { m: 67, s: 46.67, l: 1.33, v: 0.75 },
  { m: 70.86, s: 48, l: 2, v: 0.9 }, { m: 74, s: 50.67, l: 1.33, v: 0.85 }, { m: 76.69, s: 52, l: 4, v: 1 },
  { m: 75, s: 64, l: 2, v: 0.85 }, { m: 77, s: 66.67, l: 1.33, v: 0.85 }, { m: 79, s: 68, l: 4, v: 0.95 },
  { m: 75, s: 72, l: 2, v: 0.85 }, { m: 72, s: 74.67, l: 1.33, v: 0.8 },
  { m: 75.86, s: 80, l: 2, v: 0.9 }, { m: 74, s: 82.67, l: 1.33, v: 0.8 }, { m: 72, s: 84, l: 6, v: 0.85 },
  { m: 79, s: 96, l: 1.33, v: 0.9 }, { m: 79, s: 97.33, l: 1.33, v: 0.7 }, { m: 79, s: 98.67, l: 1.33, v: 0.8 },
  { m: 76.69, s: 100, l: 4, v: 0.95 }, { m: 74, s: 104, l: 2, v: 0.8 },
  { m: 73.5, s: 106.67, l: 1.33, v: 0.9 }, { m: 72, s: 108, l: 4, v: 0.85 },
  { m: 70, s: 112, l: 2, v: 0.8 }, { m: 67, s: 114.67, l: 1.33, v: 0.75 }, { m: 70, s: 116, l: 2, v: 0.8 },
  { m: 69.02, s: 124, l: 1.33, v: 0.75 }, { m: 71.69, s: 125.33, l: 1.33, v: 0.8 }, { m: 74, s: 126.67, l: 1.33, v: 0.85 },
  { m: 77.86, s: 128, l: 2.67, v: 0.95 }, { m: 76.04, s: 130.67, l: 1.33, v: 0.8 }, { m: 74, s: 132, l: 4, v: 0.9 },
  { m: 71.69, s: 136, l: 2.67, v: 0.9 }, { m: 69, s: 138.67, l: 1.33, v: 0.8 },
  { m: 69.69, s: 144, l: 2.67, v: 0.9 }, { m: 67.02, s: 146.67, l: 1.33, v: 0.8 }, { m: 63.86, s: 148, l: 4, v: 0.85 },
  { m: 67, s: 160, l: 2, v: 0.8 }, { m: 70.5, s: 162.67, l: 1.33, v: 0.9 }, { m: 72, s: 164, l: 2, v: 0.85 },
  { m: 74, s: 166.67, l: 1.33, v: 0.85 }, { m: 76.69, s: 168, l: 2.67, v: 0.95 },
  { m: 74, s: 170.67, l: 1.33, v: 0.8 }, { m: 72, s: 172, l: 4, v: 0.85 },
  { m: 70.5, s: 176, l: 2, v: 0.85 }, { m: 69, s: 178.67, l: 1.33, v: 0.8 }, { m: 67, s: 180, l: 2, v: 0.8 },
  { m: 65.86, s: 182.67, l: 1.33, v: 0.85 }, { m: 67, s: 184, l: 6, v: 0.9 },
];

// comping: Charleston rhythm — downbeat stab, then the swung "and" of 2
const BLUE_BARS = [GM7, CM7, GM7, G7, CM7, C7, GM7, GM7, D7, C7, GM7, D7];
const blueKeys: SongNote[] = [];
for (let bar = 0; bar < 12; bar++) {
  const chord = BLUE_BARS[bar] ?? GM7;
  const o = bar * 16;
  for (const m of chord) blueKeys.push({ m, s: o, l: 2, v: 0.7 });
  for (const m of chord) blueKeys.push({ m, s: o + 6.67, l: 1.33, v: 0.9 });
}
// anticipations of the next chord on the swung "a" of beat 4
for (const m of CM7) blueKeys.push({ m, s: 62.67, l: 1.33, v: 0.8 });
for (const m of D7) blueKeys.push({ m, s: 126.67, l: 1.33, v: 0.8 });
for (const m of GM7) blueKeys.push({ m, s: 190.67, l: 1.33, v: 0.8 });

// walking bass, quarter notes; 46.86/51.86/53.86 are just thirds,
// 48.5 is a quarter-tone slide into C
const BLUE_WALK = [
  43, 46, 50, 49, 48, 46, 45, 44, 43, 46, 48, 50, 43, 46.86, 50, 49,
  48, 51, 55, 53, 48, 51.86, 45, 44, 43, 46, 50, 53, 43, 45, 47, 49,
  50, 53.86, 57, 48.5, 48, 51.86, 55, 46, 43, 46, 48, 45, 50, 48, 47, 44,
];
const blueBass: SongNote[] = BLUE_WALK.map((m, i) => ({ m, s: i * 4, l: 3, v: i % 2 === 0 ? 1 : 0.8 }));

// kit: swing ride (ding | ding-ga), feathered kick, hat foot on 2 & 4
const blueDrums: SongNote[] = [];
for (let bar = 0; bar < 12; bar++) {
  const o = bar * 16;
  blueDrums.push(
    { m: 81, s: o, l: 1, v: 0.5 }, { m: 81, s: o + 4, l: 1, v: 0.45 }, { m: 81, s: o + 6.67, l: 1, v: 0.28 },
    { m: 81, s: o + 8, l: 1, v: 0.5 }, { m: 81, s: o + 12, l: 1, v: 0.45 }, { m: 81, s: o + 14.67, l: 1, v: 0.28 },
    { m: 71, s: o + 4, l: 1, v: 0.35 }, { m: 71, s: o + 12, l: 1, v: 0.35 },
    { m: 40, s: o, l: 1, v: 0.4 }, { m: 40, s: o + 8, l: 1, v: 0.35 },
  );
  if (bar % 2 === 1) blueDrums.push({ m: 64, s: o + 10.67, l: 1, v: 0.25 });
}
blueDrums.push({ m: 64, s: 188, l: 1, v: 0.45 }, { m: 64, s: 189.33, l: 1, v: 0.6 }, { m: 64, s: 190.67, l: 1, v: 0.75 });

const BLUE_CSS = `
/* ========== BLUE 31 — arrangement (edit live via { } css) ==========
   Swing and microtones are inline transforms on the notes themselves:
   translateX = timing (the "and" of each beat lands at 2/3), translateY =
   cents (blue thirds at the quarter-tone, sevenths 31 cents flat). */

@media (max-width: 700px) {
  html { --bpm: 112 !important; }
}

body:has(#mute-horn:checked)  .trk[data-name="Horn"]  { --vol: 0 !important; filter: grayscale(1) brightness(0.6); }
body:has(#mute-keys:checked)  .trk[data-name="Keys"]  { --vol: 0 !important; filter: grayscale(1) brightness(0.6); }
body:has(#mute-bass:checked)  .trk[data-name="Bass"]  { --vol: 0 !important; filter: grayscale(1) brightness(0.6); }
body:has(#mute-drums:checked) .trk[data-name="Drums"] { --vol: 0 !important; filter: grayscale(1) brightness(0.6); }

/* the A/B test: strip every transform and hear the same chart played
   straight, in 12-TET, dead on the grid. This is what you'd lose. */
body:has(#quantize:checked) .trk b { transform: none !important; margin: 0 !important; }

/* the keys' filter slowly opens and closes (--cutoff is a registered number) */
html.playing .trk[data-name="Keys"] { animation: sweep 23s ease-in-out infinite; }
@keyframes sweep { 0%, 100% { --cutoff: 700; } 50% { --cutoff: 2600; } }

/* dither: co-prime nth-child cycles (3,5,7,11 — period 1155) hand every note
   its own pseudo-random ±cents and ±milliseconds. Margins, not transforms,
   so it stacks on top of each note's own swing and detune. */
body:has(#dither:checked) .trk b:nth-child(3n)    { margin-left: 1.5px; margin-top: -1px; }
body:has(#dither:checked) .trk b:nth-child(5n+1)  { margin-left: -1px; margin-top: 1.2px; }
body:has(#dither:checked) .trk b:nth-child(7n+2)  { margin-left: 2px; margin-top: 0.8px; }
body:has(#dither:checked) .trk b:nth-child(11n+4) { margin-left: 0.5px; margin-top: -1.4px; }

/* drunk: the horn's whole sense of time drifts and recovers over 13s */
html.playing:has(#drunk:checked) .trk[data-name="Horn"] { animation: drunk 13s ease-in-out infinite; }
@keyframes drunk {
  0%, 100% { transform: translateX(calc(var(--cw) * -0.25)); }
  50% { transform: translateX(calc(var(--cw) * 0.45)); }
}

/* tape: the whole band warbles together — relative tuning stays intact
   (declared after drunk, so it wins on the Horn when both are on) */
html.playing:has(#tape:checked) #roll .trk { animation: warble 17s ease-in-out infinite; }
@keyframes warble {
  0%, 100% { transform: translateY(0); }
  30% { transform: translateY(calc(var(--rh) * -0.15)); }
  70% { transform: translateY(calc(var(--rh) * 0.12)); }
}

html:has(#uptempo:checked) { --bpm: 176 !important; }

.trk { transition: --vol 1.2s ease; }

/* standing motion: filter plucks, ±4-cent breath, horn filter wander */
.trk { --fenv: 0.6; }
html.playing .trk { animation: microtape 23s ease-in-out infinite; }
@keyframes microtape {
  0%, 100% { translate: 0 0; }
  33% { translate: 0 calc(var(--rh) * -0.045); }
  66% { translate: 0 calc(var(--rh) * 0.035); }
}
html.playing .trk[data-name="Horn"] { animation: cutdrift 9.3s ease-in-out infinite, microtape 23s ease-in-out infinite; }
@keyframes cutdrift { 0%, 100% { --cutoff: 1400; } 50% { --cutoff: 2600; } }
`;

const BLUE_MIXER = `
<span>css-only:</span>
<label><input type="checkbox" id="mute-horn"> mute horn</label>
<label><input type="checkbox" id="mute-keys"> mute keys</label>
<label><input type="checkbox" id="mute-bass"> mute bass</label>
<label><input type="checkbox" id="mute-drums"> mute drums</label>
<label><input type="checkbox" id="quantize"> quantize (12-tet, no swing)</label>
<label><input type="checkbox" id="dither"> dither</label>
<label><input type="checkbox" id="drunk"> drunk</label>
<label><input type="checkbox" id="tape"> tape</label>
<label><input type="checkbox" id="uptempo"> uptempo</label>
`;

const blue: Song = {
  file: "blue-31.html",
  title: "BLUE 31",
  bpm: 132,
  steps: 192,
  css: BLUE_CSS,
  mixer: BLUE_MIXER,
  tracks: [
    { name: "Horn", wave: "brass", vol: 0.17, hue: 25, synth: "--cutoff:1800;--spread:6;--attack:0.02;--release:0.08;--verb:0.28;--echo:0.15;--vibrato:14;--vib-rate:5.5", notes: blueHorn },
    { name: "Keys", wave: "ep", vol: 0.09, hue: 280, synth: "--cutoff:1300;--spread:5;--attack:0.012;--verb:0.25;--width:0.5", notes: blueKeys },
    { name: "Bass", wave: "triangle", vol: 0.45, hue: 140, synth: "--cutoff:800;--attack:0.01;--verb:0.07;--width:0.1", notes: blueBass },
    { name: "Drums", wave: "noise", vol: 0.45, hue: 50, synth: "--verb:0.18", notes: blueDrums },
  ],
};

// ============================================================================
// BLOOM 31 — chiptune jazz fusion: PIXEL BLOOM's pulse-wave euphoria playing
// BLUE 31's microtonal language. 152bpm swung 12-bar jazz blues in D
// (D7 G7 D7 D7 | G7 G7 D7 B7 | Em7 A7 D7 A7) with quarter-tone blue thirds
// (77.5, 72.5), septimal sevenths (71.69, 76.69, 68.69), just-intonation
// arpeggios, and a walking bass that climbs through the crack between C and
// C# (48.5) on the turnaround.
// ============================================================================

// JI arp chord tones, octave 3-4 window
const AD7 = [62, 65.86, 69.02, 71.69];
const AG7 = [55, 58.86, 62.02, 64.69];
const AB7 = [59, 62.86, 66.02, 68.69];
const AEM7 = [52, 55.16, 59.02, 62.18];
const AA7 = [57, 60.86, 64.02, 66.69];

const b31Lead: SongNote[] = [
  { m: 74, s: 0, l: 2, v: 0.9 }, { m: 77.5, s: 2.67, l: 1.33, v: 0.95 }, { m: 78, s: 4, l: 2, v: 0.85 },
  { m: 81, s: 6.67, l: 1.33, v: 0.9 }, { m: 83, s: 8, l: 4, v: 1 }, { m: 78, s: 12, l: 2, v: 0.85 }, { m: 76.04, s: 14.67, l: 1.33, v: 0.8 },
  { m: 76.69, s: 16, l: 4, v: 0.95 }, { m: 74, s: 20, l: 2, v: 0.85 }, { m: 71.69, s: 22.67, l: 1.33, v: 0.85 },
  { m: 67, s: 24, l: 4, v: 0.85 }, { m: 70.5, s: 30.67, l: 1.33, v: 0.8 },
  { m: 71.69, s: 32, l: 2.67, v: 0.9 }, { m: 69, s: 34.67, l: 1.33, v: 0.8 }, { m: 65.86, s: 36, l: 2, v: 0.85 },
  { m: 69, s: 38.67, l: 1.33, v: 0.8 }, { m: 74, s: 40, l: 4, v: 0.9 },
  { m: 78, s: 48, l: 1.33, v: 0.85 }, { m: 81, s: 49.33, l: 1.33, v: 0.9 }, { m: 83, s: 50.67, l: 1.33, v: 0.95 },
  { m: 81, s: 52, l: 2, v: 0.85 }, { m: 78, s: 54.67, l: 1.33, v: 0.8 }, { m: 77.5, s: 56, l: 4, v: 1 },
  { m: 74, s: 60, l: 2, v: 0.85 }, { m: 71.69, s: 62.67, l: 1.33, v: 0.8 },
  { m: 70.5, s: 64, l: 2.67, v: 0.95 }, { m: 67, s: 66.67, l: 1.33, v: 0.8 }, { m: 64.69, s: 68, l: 4, v: 0.9 },
  { m: 67, s: 72, l: 2, v: 0.8 }, { m: 70.5, s: 74.67, l: 1.33, v: 0.85 },
  { m: 74, s: 80, l: 2, v: 0.85 }, { m: 76.69, s: 82.67, l: 1.33, v: 0.9 }, { m: 79, s: 84, l: 4, v: 0.95 },
  { m: 76.69, s: 88, l: 2.67, v: 0.9 }, { m: 74, s: 90.67, l: 1.33, v: 0.8 },
  { m: 78, s: 96, l: 2, v: 0.85 }, { m: 77.5, s: 98.67, l: 1.33, v: 0.9 }, { m: 74, s: 100, l: 2, v: 0.85 },
  { m: 71.69, s: 102.67, l: 1.33, v: 0.85 }, { m: 69, s: 104, l: 4, v: 0.85 }, { m: 71, s: 110.67, l: 1.33, v: 0.8 },
  { m: 68.69, s: 112, l: 2.67, v: 0.95 }, { m: 66.02, s: 114.67, l: 1.33, v: 0.85 }, { m: 62.86, s: 116, l: 4, v: 0.9 },
  { m: 71, s: 120, l: 2, v: 0.8 }, { m: 74.18, s: 122.67, l: 1.33, v: 0.85 },
  { m: 74.18, s: 128, l: 4, v: 0.9 }, { m: 71.02, s: 132, l: 2, v: 0.85 }, { m: 67.16, s: 134.67, l: 1.33, v: 0.85 },
  { m: 64.02, s: 136, l: 4, v: 0.85 },
  { m: 72.86, s: 144, l: 2.67, v: 0.9 }, { m: 76.02, s: 146.67, l: 1.33, v: 0.85 }, { m: 72.5, s: 148, l: 4, v: 1 },
  { m: 69, s: 152, l: 4, v: 0.85 },
  { m: 74, s: 160, l: 1.33, v: 0.85 }, { m: 78, s: 161.33, l: 1.33, v: 0.9 }, { m: 81, s: 162.67, l: 1.33, v: 0.95 },
  { m: 83, s: 164, l: 4, v: 1 }, { m: 81, s: 168, l: 2, v: 0.9 }, { m: 77.5, s: 170.67, l: 1.33, v: 0.9 }, { m: 78, s: 172, l: 4, v: 0.9 },
  { m: 76.02, s: 176, l: 2, v: 0.85 }, { m: 74, s: 178.67, l: 1.33, v: 0.8 }, { m: 72.86, s: 180, l: 2, v: 0.85 },
  { m: 71, s: 182.67, l: 1.33, v: 0.8 }, { m: 69, s: 184, l: 6, v: 0.9 },
];

const b31Harm: SongNote[] = [
  { m: 78, s: 8, l: 4, v: 0.85 }, { m: 74, s: 16, l: 4, v: 0.8 }, { m: 62.02, s: 24, l: 4, v: 0.8 },
  { m: 69.02, s: 40, l: 4, v: 0.8 }, { m: 74, s: 56, l: 4, v: 0.85 }, { m: 58.86, s: 68, l: 4, v: 0.8 },
  { m: 76, s: 84, l: 4, v: 0.8 }, { m: 65.86, s: 104, l: 4, v: 0.8 }, { m: 59, s: 116, l: 4, v: 0.8 },
  { m: 71.02, s: 128, l: 4, v: 0.8 }, { m: 59.02, s: 136, l: 4, v: 0.8 }, { m: 69, s: 148, l: 4, v: 0.85 },
  { m: 78, s: 164, l: 4, v: 0.85 }, { m: 64.02, s: 184, l: 6, v: 0.8 },
];

// swung JI arps: chiptune glue outlining the jazz changes
const B31_ARPS = [AD7, AG7, AD7, AD7, AG7, AG7, AD7, AB7, AEM7, AA7, AD7, AA7];
const b31Arp: SongNote[] = [];
for (let bar = 0; bar < 12; bar++) {
  const chord = B31_ARPS[bar] ?? AD7;
  for (let i = 0; i < 8; i++) {
    const swung = i % 2 === 1;
    b31Arp.push({
      m: chord[i % 4] ?? 62,
      s: bar * 16 + i * 2 + (swung ? 0.67 : 0),
      l: swung ? 1.33 : 2,
      v: swung ? 0.7 : 0.9,
    });
  }
}

// walking bass: quarters, just thirds on the dominants, quarter-tone slides
const B31_WALK = [
  38, 42, 45, 44, 43, 47, 45, 40, 38, 42, 45, 47, 50, 48, 45, 44,
  43, 46.86, 50, 48, 43, 41, 40, 39, 38, 42, 45, 47, 47, 51, 54, 53,
  52, 50, 48, 47, 45, 49, 52, 51, 50, 45, 42, 40, 45, 47, 48.5, 49,
];
const b31Bass: SongNote[] = B31_WALK.map((m, i) => ({ m, s: i * 4, l: 3, v: i % 2 === 0 ? 1 : 0.8 }));

// electro-swing kit: dance kick under a swing ride
const b31Drums: SongNote[] = [];
for (let bar = 0; bar < 12; bar++) {
  const o = bar * 16;
  b31Drums.push(
    { m: 81, s: o, l: 1, v: 0.5 }, { m: 81, s: o + 4, l: 1, v: 0.45 }, { m: 81, s: o + 6.67, l: 1, v: 0.28 },
    { m: 81, s: o + 8, l: 1, v: 0.5 }, { m: 81, s: o + 12, l: 1, v: 0.45 }, { m: 81, s: o + 14.67, l: 1, v: 0.28 },
    { m: 71, s: o + 4, l: 1, v: 0.35 }, { m: 71, s: o + 12, l: 1, v: 0.35 },
    { m: 41, s: o, l: 1, v: 1 }, { m: 41, s: o + 8, l: 1, v: 0.9 },
    { m: 67, s: o + 4, l: 1, v: 0.9 }, { m: 67, s: o + 12, l: 1, v: 0.9 },
  );
  if (bar % 4 === 3) b31Drums.push({ m: 41, s: o + 10.67, l: 1, v: 0.75 });
  else if (bar % 2 === 1) b31Drums.push({ m: 64, s: o + 10.67, l: 1, v: 0.25 });
}
b31Drums.push({ m: 48, s: 0, l: 2, v: 0.85 }, { m: 48, s: 128, l: 2, v: 0.8 });
b31Drums.push({ m: 67, s: 188, l: 1, v: 0.5 }, { m: 67, s: 189.33, l: 1, v: 0.65 }, { m: 67, s: 190.67, l: 1, v: 0.85 });

const B31_CSS = `
/* ========== BLOOM 31 — arrangement (edit live via { } css) ========== */

@media (max-width: 700px) {
  html { --bpm: 132 !important; }
}

body:has(#mute-lead:checked)  .trk[data-name="Lead"]    { --vol: 0 !important; filter: grayscale(1) brightness(0.6); }
body:has(#mute-harm:checked)  .trk[data-name="Harmony"] { --vol: 0 !important; filter: grayscale(1) brightness(0.6); }
body:has(#mute-arp:checked)   .trk[data-name="Arp"]     { --vol: 0 !important; filter: grayscale(1) brightness(0.6); }
body:has(#mute-bass:checked)  .trk[data-name="Bass"]    { --vol: 0 !important; filter: grayscale(1) brightness(0.6); }
body:has(#mute-drums:checked) .trk[data-name="Drums"]   { --vol: 0 !important; filter: grayscale(1) brightness(0.6); }

/* the A/B: strip swing and microtones, hear the dead 12-TET grid version */
body:has(#quantize:checked) .trk b { transform: none !important; margin: 0 !important; }

/* dither: co-prime nth-child margins — pseudo-random ±cents/±ms per note */
body:has(#dither:checked) .trk b:nth-child(3n)    { margin-left: 1.5px; margin-top: -1px; }
body:has(#dither:checked) .trk b:nth-child(5n+1)  { margin-left: -1px; margin-top: 1.2px; }
body:has(#dither:checked) .trk b:nth-child(7n+2)  { margin-left: 2px; margin-top: 0.8px; }
body:has(#dither:checked) .trk b:nth-child(11n+4) { margin-left: 0.5px; margin-top: -1.4px; }

/* acid: the walking bass goes sawtooth and squelches */
body:has(#acid:checked) .trk[data-name="Bass"] { --wave: sawtooth !important; }
html.playing:has(#acid:checked) .trk[data-name="Bass"] { animation: acid31 3.1s ease-in-out infinite; }
@keyframes acid31 { 0%, 100% { --cutoff: 300; } 50% { --cutoff: 3200; } }

/* bloom-31.html#finale — the shareable ending: faster, lead up an octave */
html:has(#finale:target) { --bpm: 176 !important; }
body:has(#finale:target) .trk[data-name="Lead"] { transform: translateY(calc(var(--rh) * -12)); }

.trk { transition: --vol 1.2s ease; }

/* standing motion: filter plucks, ±4-cent breath, lead filter wander */
.trk { --fenv: 0.6; }
html.playing .trk { animation: microtape 23s ease-in-out infinite; }
@keyframes microtape {
  0%, 100% { translate: 0 0; }
  33% { translate: 0 calc(var(--rh) * -0.045); }
  66% { translate: 0 calc(var(--rh) * 0.035); }
}
html.playing .trk[data-name="Lead"] { animation: cutdrift 9.3s ease-in-out infinite, microtape 23s ease-in-out infinite; }
@keyframes cutdrift { 0%, 100% { --cutoff: 1800; } 50% { --cutoff: 3400; } }
html { --duck: 0.25; }
`;

const B31_MIXER = `
<span>css-only:</span>
<label><input type="checkbox" id="mute-lead"> mute lead</label>
<label><input type="checkbox" id="mute-harm"> mute harmony</label>
<label><input type="checkbox" id="mute-arp"> mute arp</label>
<label><input type="checkbox" id="mute-bass"> mute bass</label>
<label><input type="checkbox" id="mute-drums"> mute drums</label>
<label><input type="checkbox" id="quantize"> quantize</label>
<label><input type="checkbox" id="dither"> dither</label>
<label><input type="checkbox" id="acid"> acid</label>
<a href="#finale">#finale</a>
<a href="#">#reset</a>
<i id="finale" hidden></i>
`;

const bloom31: Song = {
  file: "bloom-31.html",
  title: "BLOOM 31",
  bpm: 152,
  steps: 192,
  css: B31_CSS,
  mixer: B31_MIXER,
  tracks: [
    { name: "Lead", wave: "brass", vol: 0.18, hue: 205, synth: "--cutoff:2400;--spread:6;--attack:0.015;--release:0.08;--verb:0.22;--echo:0.3;--vibrato:10", notes: b31Lead },
    { name: "Harmony", wave: "ep", vol: 0.11, hue: 320, synth: "--cutoff:2000;--spread:5;--attack:0.02;--verb:0.3;--pan:-0.2", notes: b31Harm },
    { name: "Arp", wave: "pulse125", vol: 0.065, hue: 265, synth: "--cutoff:2600;--echo:0.25;--width:0.5", notes: b31Arp },
    { name: "Bass", wave: "triangle", vol: 0.42, hue: 145, synth: "--cutoff:850;--attack:0.008;--verb:0.06;--fenv:1.2;--width:0.1", notes: b31Bass },
    { name: "Drums", wave: "noise", vol: 0.48, hue: 35, synth: "--verb:0.15", notes: b31Drums },
  ],
};

// ============================================================================
// PHANTOM MASS — a wall of sound. ~176 mostly-sustained notes whose music is
// the interference between them, not the notes themselves:
// · Pedal: D2/D3/A2 cluster detuned ±5 cents — slow beating surf
// · Wall: just-intonation partials 2-13 of D, each as a 3-note cluster
//   (exact, ±8 cents) — Niblock-style shimmer, drifting ±10 cents on a 47s
//   cycle (the live engine bends the SUSTAINED tones, not just new ones)
// · Ghostwall: the same series +12 cents, drifting the other way
// · Canon: one 8-note melody in 14 staggered copies across 3 octaves, each
//   copy a few cents off — Ligeti micropolyphony, a cloud with a shape
// · Phantom: the psychoacoustic trick. A sustained G5 plus a partner tone
//   spaced EXACTLY a bass note's frequency above it — your ear synthesizes
//   the difference tone. The bassline D-E-A-F#-G-B-A-D is played by nothing.
//   Toggle "naked" to solo the pair and check the bass is still there.
// ============================================================================

const massPedal: SongNote[] = [
  { m: 38, s: 0, l: 128, v: 1 }, { m: 38.06, s: 0, l: 128, v: 0.8 }, { m: 37.94, s: 0, l: 128, v: 0.8 },
  { m: 45, s: 0, l: 128, v: 0.7 }, { m: 45.05, s: 0, l: 128, v: 0.6 },
  { m: 50, s: 0, l: 128, v: 0.5 }, { m: 49.95, s: 0, l: 128, v: 0.5 },
];

const massWall: SongNote[] = [];
const massGhost: SongNote[] = [];
for (let n = 2; n <= 13; n++) {
  const base = 38 + 12 * Math.log2(n);
  const v = +(1.15 / Math.sqrt(n)).toFixed(2);
  for (const d of [0, 0.08, -0.08]) massWall.push({ m: base + d, s: 0, l: 128, v });
  massGhost.push({ m: base + 0.12, s: 0, l: 128, v });
}

// micropolyphony: one melody, 14 staggered copies, 3 octaves, unique detunes
const CANON_M = [74, 76, 78, 81, 79, 78, 76, 74];
const CANON_L = [8, 8, 8, 12, 8, 8, 8, 12];
const massCanon: SongNote[] = [];
for (let c = 0; c < 14; c++) {
  const oct = c % 3 === 0 ? 0 : c % 3 === 1 ? -12 : -24;
  const cents = (((c * 7) % 23) - 11) / 100;
  let s = c * 4;
  for (let i = 0; i < 8; i++) {
    massCanon.push({ m: (CANON_M[i] ?? 74) + oct + cents, s, l: CANON_L[i] ?? 8, v: 0.5 });
    s += CANON_L[i] ?? 8;
  }
}

// difference-tone bassline: partner = base + (bass Hz), pitch computed exactly
const PHANTOM_HZ = [146.83, 164.81, 110, 185, 98, 123.47, 110, 146.83]; // D3 E3 A2 F#3 G2 B2 A2 D3
const massPhantom: SongNote[] = [{ m: 79, s: 0, l: 128, v: 1 }];
const phantomBaseHz = 440 * Math.pow(2, (79 - 69) / 12);
for (let i = 0; i < PHANTOM_HZ.length; i++) {
  const hz = PHANTOM_HZ[i] ?? 110;
  massPhantom.push({ m: 69 + 12 * Math.log2((phantomBaseHz + hz) / 440), s: i * 16, l: 16, v: 1 });
}

const MASS_CSS = `
/* ========== PHANTOM MASS — arrangement (edit live via { } css) ==========
   The music is the interference. Drift animations bend the standing wall
   (the engine re-reads sustained voices' geometry live); their periods
   (47s, 31s, 29s, 23s) are incommensurate with the 24s loop. */

body:has(#mute-pedal:checked)   .trk[data-name="Pedal"]     { --vol: 0 !important; filter: grayscale(1) brightness(0.5); }
body:has(#mute-wall:checked)    .trk[data-name="Wall"]      { --vol: 0 !important; filter: grayscale(1) brightness(0.5); }
body:has(#mute-ghost:checked)   .trk[data-name="Ghostwall"] { --vol: 0 !important; filter: grayscale(1) brightness(0.5); }
body:has(#mute-canon:checked)   .trk[data-name="Canon"]     { --vol: 0 !important; filter: grayscale(1) brightness(0.5); }
body:has(#mute-phantom:checked) .trk[data-name="Phantom"]   { --vol: 0 !important; filter: grayscale(1) brightness(0.5); }

/* naked: solo the phantom pair — the bassline you still hear is played by
   nothing; it is a difference tone made inside your ear */
body:has(#naked:checked) .trk:not([data-name="Phantom"]) { --vol: 0 !important; filter: grayscale(1) brightness(0.5); }

/* the wall breathes: pitch drift + volume swell, opposing directions */
html.playing .trk[data-name="Wall"] {
  animation: drift-a 47s ease-in-out infinite, swell-a 29s ease-in-out infinite;
}
@keyframes drift-a {
  0%, 100% { transform: translateY(calc(var(--rh) * -0.1)); }
  50% { transform: translateY(calc(var(--rh) * 0.1)); }
}
@keyframes swell-a { 0%, 100% { --vol: 0.055; } 50% { --vol: 0.11; } }

html.playing .trk[data-name="Ghostwall"] {
  animation: drift-b 31s ease-in-out infinite, swell-b 23s ease-in-out infinite;
}
@keyframes drift-b {
  0%, 100% { transform: translateY(calc(var(--rh) * 0.12)); }
  50% { transform: translateY(calc(var(--rh) * -0.12)); }
}
@keyframes swell-b { 0%, 100% { --vol: 0.06; } 50% { --vol: 0.03; } }

/* still: freeze all motion — hear the wall as a fixed object */
body:has(#still:checked) .trk[data-name="Wall"],
body:has(#still:checked) .trk[data-name="Ghostwall"] { animation: none !important; }

/* collapse: the whole spectrum folds toward D and blooms back open;
   sustained tones bend live as their geometry compresses */
html.playing:has(#collapse:checked) .trk[data-name="Wall"],
html.playing:has(#collapse:checked) .trk[data-name="Ghostwall"] {
  animation: collapse-m 36s ease-in-out infinite;
  transform-origin: 50% calc(var(--rh) * 9.5);
}
@keyframes collapse-m { 0%, 100% { transform: scaleY(1); } 50% { transform: scaleY(0.05); } }

.trk { transition: --vol 2s ease; }

/* standing motion: filter plucks, ±4-cent breath, canon filter wander */
.trk { --fenv: 0.6; }
html.playing .trk { animation: microtape 23s ease-in-out infinite; }
@keyframes microtape {
  0%, 100% { translate: 0 0; }
  33% { translate: 0 calc(var(--rh) * -0.045); }
  66% { translate: 0 calc(var(--rh) * 0.035); }
}
html.playing .trk[data-name="Canon"] { animation: cutdrift 9.3s ease-in-out infinite, microtape 23s ease-in-out infinite; }
@keyframes cutdrift { 0%, 100% { --cutoff: 1300; } 50% { --cutoff: 2500; } }
`;

const MASS_MIXER = `
<span>css-only:</span>
<label><input type="checkbox" id="mute-pedal"> mute pedal</label>
<label><input type="checkbox" id="mute-wall"> mute wall</label>
<label><input type="checkbox" id="mute-ghost"> mute ghostwall</label>
<label><input type="checkbox" id="mute-canon"> mute canon</label>
<label><input type="checkbox" id="mute-phantom"> mute phantom</label>
<label><input type="checkbox" id="naked"> naked (phantom only)</label>
<label><input type="checkbox" id="still"> still</label>
<label><input type="checkbox" id="collapse"> collapse</label>
`;

const mass: Song = {
  file: "phantom-mass.html",
  title: "PHANTOM MASS",
  bpm: 80,
  steps: 128,
  css: MASS_CSS,
  mixer: MASS_MIXER,
  tracks: [
    { name: "Pedal", wave: "sine", vol: 0.32, hue: 20, synth: "--attack:0.8;--release:1.8;--verb:0.25;--width:0", notes: massPedal },
    { name: "Wall", wave: "sine", vol: 0.08, hue: 190, synth: "--attack:1.5;--release:1.8;--verb:0.5;--width:0.7", notes: massWall },
    { name: "Ghostwall", wave: "triangle", vol: 0.05, hue: 280, synth: "--attack:1.2;--release:1.5;--verb:0.5;--pan:-0.2", notes: massGhost },
    { name: "Canon", wave: "square", vol: 0.045, hue: 320, synth: "--cutoff:1800;--attack:0.15;--release:0.4;--verb:0.45;--echo:0.2;--width:0.6", notes: massCanon },
    { name: "Phantom", wave: "sine", vol: 0.2, hue: 60, synth: "--attack:0.3;--release:0.8;--verb:0.03;--width:0", notes: massPhantom },
  ],
};

// ============================================================================
// HAMMERS — a wall of small notes. ~2,200 short percussive hits at 132bpm
// over a 15s loop, D-pentatonic over I-vi-IV-V. Every attack is a SWARM:
// mallet hits are 5-note microtonal clusters (±22 cents wide), bass hits are
// root+octave+fifth stacks, strums are 10-note two-octave cascades every
// beat, and a layer of high pentatonic rain falls off-grid. 10–20
// simultaneous attacks at any moment; the chorus is made of actual notes.
// The melody is emergent: accents rotate on a 5-cycle against the 6-note
// pitch cycle against 16-step bars (coprime wheels). "shift" re-lights the
// accents on a 7-cycle and a different melody emerges from the same notes.
// ============================================================================

// deterministic scatter, ±amt, varied by index
const scat = (i: number, amt: number): number => (((i * 37) % 97) / 97 - 0.5) * 2 * amt;

// a microtonal cluster of `size` notes spread ±spread semitones around center
const cluster = (
  out: SongNote[],
  center: number,
  size: number,
  spread: number,
  s: number,
  l: number,
  v: number,
  seed: number,
): void => {
  for (let j = 0; j < size; j++) {
    const off = size === 1 ? 0 : ((j / (size - 1)) * 2 - 1) * spread;
    out.push({
      m: center + off + scat(seed + j, 0.04),
      s: Math.max(0, s + scat(seed * 3 + j, 0.05)),
      l,
      v: v * (1 - 0.06 * j),
    });
  }
};

const CYC_A = [62, 66, 69, 74, 71, 64]; // D4 F#4 A4 D5 B4 E4
const CYC_B = [69, 74, 76, 78, 81, 78, 76]; // A4 D5 E5 F#5 A5 F#5 E5
const hamA: SongNote[] = [];
const hamB: SongNote[] = [];
for (let i = 0; i < 128; i++) {
  cluster(hamA, CYC_A[i % 6] ?? 62, 5, 0.22, i, 1, i % 5 === 0 ? 0.9 : 0.38, i * 17);
  cluster(hamB, CYC_B[i % 7] ?? 69, 5, 0.25, i + 0.5, 1, i % 4 === 0 ? 0.6 : 0.26, i * 23 + 7);
}

// rain: high pentatonic droplets, two per step, falling well off the grid
const PENT_HI = [74, 76, 78, 81, 83];
const hamRain: SongNote[] = [];
for (let i = 0; i < 128; i++) {
  for (let j = 0; j < 2; j++) {
    hamRain.push({
      m: (PENT_HI[(i * 7 + j * 3) % 5] ?? 78) + scat(i * 2 + j, 0.12),
      s: Math.max(0, i + scat(i * 13 + j * 5, 0.35)),
      l: 1,
      v: 0.28 + ((i * 31 + j) % 3) * 0.1,
    });
  }
}

// bass: 8ths, each hit a root+octave+fifth stack — D D Bm Bm G G A A
const HAM_ROOTS = [38, 47, 43, 45];
const hamBass: SongNote[] = [];
for (let i = 0; i < 64; i++) {
  const step = i * 2;
  const root = HAM_ROOTS[Math.floor(step / 32) % 4] ?? 38;
  const r = i % 2 === 0 ? root : root + 12;
  hamBass.push({ m: r + scat(i, 0.02), s: step, l: 1, v: i % 2 === 0 ? 1 : 0.7 });
  hamBass.push({ m: r + 12 + scat(i + 50, 0.03), s: step, l: 1, v: 0.5 });
  hamBass.push({ m: r + 7.02 + scat(i + 99, 0.03), s: step, l: 1, v: 0.35 });
}

// strums: 10-note two-octave cascades every beat, 0.1 steps between notes
const HAM_CHORDS = [
  [50, 57, 62, 66, 69],
  [47, 54, 59, 62, 66],
  [43, 50, 55, 59, 62],
  [45, 52, 57, 61, 64],
];
const hamStrum: SongNote[] = [];
for (let k = 0; k < 32; k++) {
  const s0 = k * 4;
  const base = HAM_CHORDS[Math.floor(s0 / 32) % 4] ?? [];
  const tones = [...base, ...base.map((m) => m + 12)];
  for (let j = 0; j < tones.length; j++) {
    const m = tones[j] ?? 62;
    if (m > 83) continue;
    hamStrum.push({ m: m + scat(k * 11 + j, 0.05), s: s0 + j * 0.1, l: 2, v: 0.6 - j * 0.035 });
  }
}

const hamKit: SongNote[] = [];
for (let i = 0; i < 128; i++) {
  const v = [0.5, 0.18, 0.32, 0.18][i % 4] ?? 0.3;
  hamKit.push({ m: 80, s: i, l: 1, v });
}
for (let b = 0; b < 8; b++) {
  hamKit.push({ m: 41, s: b * 16, l: 1, v: 0.85 }, { m: 41, s: b * 16 + 8, l: 1, v: 0.5 });
  hamKit.push({ m: 64, s: b * 16 + 4, l: 1, v: 0.55 }, { m: 64, s: b * 16 + 12, l: 1, v: 0.6 });
}

const HAM_CSS = `
/* ========== HAMMERS — arrangement (edit live via { } css) ========== */

body:has(#mute-mala:checked)  .trk[data-name="MalletA"] { --vol: 0 !important; filter: grayscale(1) brightness(0.6); }
body:has(#mute-malb:checked)  .trk[data-name="MalletB"] { --vol: 0 !important; filter: grayscale(1) brightness(0.6); }
body:has(#mute-bells:checked) .trk[data-name="Bells"]   { --vol: 0 !important; filter: grayscale(1) brightness(0.6); }
body:has(#mute-bass:checked)  .trk[data-name="Bass"]    { --vol: 0 !important; filter: grayscale(1) brightness(0.6); }
body:has(#mute-strum:checked) .trk[data-name="Strum"]   { --vol: 0 !important; filter: grayscale(1) brightness(0.6); }
body:has(#mute-kit:checked)   .trk[data-name="Kit"]     { --vol: 0 !important; filter: grayscale(1) brightness(0.6); }

/* quantize: strip the micro-scatter and the strum rolls — hear the machine */
body:has(#quantize:checked) .trk b { transform: none !important; }

/* shift: re-light the accents on a 7-cycle — a different melody emerges
   from exactly the same notes */
body:has(#shift:checked) .trk[data-name="MalletA"] b { --vel: 0.35 !important; }
body:has(#shift:checked) .trk[data-name="MalletA"] b:nth-child(7n+3) { --vel: 1 !important; }

/* cathedral: drown the hammers */
body:has(#cathedral:checked) .trk { --verb: 0.55 !important; }

html:has(#hyper:checked) { --bpm: 152 !important; }

.trk { transition: --vol 1.2s ease; }

/* standing motion: filter plucks, ±4-cent breath, malletA filter wander */
.trk { --fenv: 0.6; }
html.playing .trk { animation: microtape 23s ease-in-out infinite; }
@keyframes microtape {
  0%, 100% { translate: 0 0; }
  33% { translate: 0 calc(var(--rh) * -0.045); }
  66% { translate: 0 calc(var(--rh) * 0.035); }
}
html.playing .trk[data-name="MalletA"] { animation: cutdrift 9.3s ease-in-out infinite, microtape 23s ease-in-out infinite; }
@keyframes cutdrift { 0%, 100% { --cutoff: 2100; } 50% { --cutoff: 3900; } }
html { --duck: 0.3; }
`;

const HAM_MIXER = `
<span>css-only:</span>
<label><input type="checkbox" id="mute-mala"> mute malletA</label>
<label><input type="checkbox" id="mute-malb"> mute malletB</label>
<label><input type="checkbox" id="mute-bells"> mute bells</label>
<label><input type="checkbox" id="mute-bass"> mute bass</label>
<label><input type="checkbox" id="mute-strum"> mute strum</label>
<label><input type="checkbox" id="mute-kit"> mute kit</label>
<label><input type="checkbox" id="quantize"> quantize</label>
<label><input type="checkbox" id="shift"> shift accents</label>
<label><input type="checkbox" id="cathedral"> cathedral</label>
<label><input type="checkbox" id="hyper"> hyper</label>
`;

const hammers: Song = {
  file: "hammers.html",
  title: "HAMMERS",
  bpm: 132,
  steps: 128,
  css: HAM_CSS,
  mixer: HAM_MIXER,
  tracks: [
    { name: "MalletA", wave: "ep", vol: 0.08, hue: 200, synth: "--cutoff:2800;--attack:0.002;--release:0.07;--verb:0.25;--width:0.6", notes: hamA },
    { name: "MalletB", wave: "pulse25", vol: 0.05, hue: 320, synth: "--cutoff:2400;--attack:0.002;--release:0.06;--verb:0.3;--width:0.7", notes: hamB },
    { name: "Bells", wave: "glass", vol: 0.08, hue: 60, synth: "--attack:0.002;--release:0.3;--verb:0.5;--width:0.8", notes: hamRain },
    { name: "Bass", wave: "triangle", vol: 0.3, hue: 145, synth: "--cutoff:900;--fenv:1.5;--attack:0.003;--release:0.06;--verb:0.06;--width:0.1", notes: hamBass },
    { name: "Strum", wave: "sawtooth", vol: 0.045, hue: 280, synth: "--cutoff:1800;--attack:0.004;--release:0.25;--verb:0.4;--width:0.8", notes: hamStrum },
    { name: "Kit", wave: "noise", vol: 0.42, hue: 35, synth: "--verb:0.12", notes: hamKit },
  ],
};

// ============================================================================
// HAMMERS X — the unhinged copy. ~6,300 notes: four swarm streams interlocked
// on a quarter-step lattice (a 64th-note composite grid), each hit a 7-9 note
// microtonal cluster; pitch cycles of 6/7/5/11 (coprime wheels); six rain
// drops per step; 12-14 note strum cascades every half-beat; five-voice bass
// stacks (root, just fifth, octave, twelfth, double octave). The "thin"
// toggle drops it back to roughly HAMMERS density for A/B.
// ============================================================================

const HX_A = [62, 66, 69, 74, 71, 64];
const HX_B = [69, 74, 76, 78, 81, 78, 76];
const HX_C = [57, 62, 64, 66, 69];
const HX_D = [74, 76, 78, 81, 83, 81, 79, 78, 76, 74, 71];
const hxA: SongNote[] = [];
const hxB: SongNote[] = [];
const hxC: SongNote[] = [];
const hxD: SongNote[] = [];
for (let i = 0; i < 128; i++) {
  cluster(hxA, HX_A[i % 6] ?? 62, 9, 0.28, i, 1, i % 5 === 0 ? 0.85 : 0.34, i * 17);
  cluster(hxB, HX_B[i % 7] ?? 69, 9, 0.3, i + 0.5, 1, i % 4 === 0 ? 0.55 : 0.24, i * 23 + 7);
  cluster(hxC, HX_C[i % 5] ?? 62, 7, 0.25, i + 0.25, 1, i % 3 === 0 ? 0.5 : 0.22, i * 29 + 3);
  cluster(hxD, HX_D[i % 11] ?? 78, 7, 0.3, i + 0.75, 1, i % 7 === 0 ? 0.5 : 0.2, i * 31 + 11);
}

const hxRain: SongNote[] = [];
for (let i = 0; i < 128; i++) {
  for (let j = 0; j < 6; j++) {
    hxRain.push({
      m: (PENT_HI[(i * 7 + j * 5) % 5] ?? 78) + scat(i * 6 + j, 0.15),
      s: Math.max(0, i + scat(i * 13 + j * 5, 0.45)),
      l: 1,
      v: 0.2 + ((i * 31 + j) % 4) * 0.08,
    });
  }
}

const hxStrum: SongNote[] = [];
for (let k = 0; k < 64; k++) {
  const s0 = k * 2;
  const base = HAM_CHORDS[Math.floor(s0 / 32) % 4] ?? [];
  const tones = [...base, ...base.map((m) => m + 12), ...base.map((m) => m + 24)].filter((m) => m <= 83);
  for (let j = 0; j < tones.length; j++) {
    hxStrum.push({ m: (tones[j] ?? 62) + scat(k * 11 + j, 0.05), s: s0 + j * 0.07, l: 2, v: Math.max(0.5 - j * 0.025, 0.15) });
  }
}

const HX_STACK_V = [1, 0.4, 0.55, 0.3, 0.35];
const hxBass: SongNote[] = [];
for (let i = 0; i < 64; i++) {
  const step = i * 2;
  const root = HAM_ROOTS[Math.floor(step / 32) % 4] ?? 38;
  const r = i % 2 === 0 ? root : root + 12;
  const stack = [r, r + 7.02, r + 12, r + 19.02, r + 24].filter((m) => m <= 83);
  for (let j = 0; j < stack.length; j++) {
    hxBass.push({ m: (stack[j] ?? r) + scat(i * 5 + j, 0.02), s: step, l: 1, v: HX_STACK_V[j] ?? 0.3 });
  }
}

// a drummer, not a metronome: per-bar kick variations, backbeat laid back a
// hair with ghost notes and flams, hats contoured with opens on the "and"s
// (rows are articulation: 80+ closed, 76-79 open), and pitched tom
// punctuation — the melodic part of the kit
const hxKit: SongNote[] = [];
const HK_KICK = [
  [0, 6, 10], [0, 6, 8.5, 14], [0, 6, 10], [0, 6, 10, 14.5],
  [0, 6, 10], [0, 6, 8.5, 14], [0, 6, 10], [0, 7, 11],
];
const HK_GHOST = [
  [6.75, 10.5], [2.75, 14.75], [6.75, 10.5, 14.5], [2.75, 6.75],
  [6.75, 10.5], [2.75, 14.75], [6.75, 13.5], [2.75],
];
for (let b = 0; b < 8; b++) {
  const o = b * 16;
  for (const k of HK_KICK[b] ?? []) hxKit.push({ m: 41, s: o + k, l: 1, v: k === 0 ? 0.95 : 0.7 });
  for (const sn of [4, 12]) {
    hxKit.push({ m: 65, s: o + sn + 0.06, l: 1, v: 0.85 });
    if ((b === 3 || b === 7) && sn === 12) hxKit.push({ m: 65, s: o + sn - 0.08, l: 1, v: 0.4 });
  }
  for (const g of HK_GHOST[b] ?? []) hxKit.push({ m: 64, s: o + g, l: 1, v: 0.16 });
  for (let i = 0; i < 16; i++) {
    if (b === 7 && i >= 12) continue; // clear the deck for the fill
    const open = i === 6 || i === 14;
    const base = [0.5, 0.16, 0.3, 0.2][i % 4] ?? 0.3;
    hxKit.push({ m: open ? 77 : 81, s: Math.max(0, o + i - 0.03), l: 1, v: open ? 0.4 : base + scat(b * 16 + i, 0.06) });
  }
}
// tom punctuation between phrases
hxKit.push({ m: 57, s: 30.5, l: 1, v: 0.5 }, { m: 52, s: 31.25, l: 1, v: 0.6 });
hxKit.push({ m: 59, s: 60, l: 1, v: 0.55 }, { m: 55, s: 61.5, l: 1, v: 0.65 }, { m: 50, s: 62.5, l: 1, v: 0.75 });
hxKit.push({ m: 57, s: 94.5, l: 1, v: 0.5 }, { m: 55, s: 95.25, l: 1, v: 0.55 });
// bar 8: descending tom roll, crescendo into the loop point
const HK_ROLL = [62, 59, 59, 57, 55, 55, 52, 50, 50, 48];
for (let j = 0; j < HK_ROLL.length; j++) {
  hxKit.push({ m: HK_ROLL[j] ?? 55, s: 120 + j * 0.8, l: 1, v: 0.45 + j * 0.055 });
}
hxKit.push({ m: 65, s: 127.3, l: 1, v: 0.9 }); // crack into the downbeat

// body: mid-low 16ths, len 2 so adjacent hits overlap — the wall's torso
const HX_E = [50, 54, 57, 62, 59, 52];
const hxBody: SongNote[] = [];
for (let i = 0; i < 128; i++) {
  cluster(hxBody, HX_E[i % 6] ?? 50, 7, 0.2, i, 2, i % 5 === 0 ? 0.7 : 0.3, i * 37 + 5);
}

// glue: overlapping medium notes — never a drone, never a gap. Strings enter
// every beat (pairs of chord tones, ~1.4s each, detuned twins); the choir
// enters every half bar (~2.3s). Entries always overlap the previous ones.
const HX_STRTONES = [
  [50, 57, 62, 66, 69, 74, 78],
  [47, 54, 59, 62, 66, 71, 74],
  [43, 50, 55, 59, 62, 67, 71],
  [45, 52, 57, 61, 64, 69, 73],
];
const hxStrings: SongNote[] = [];
for (let k = 0; k < 32; k++) {
  const s0 = k * 4;
  const tones = HX_STRTONES[Math.floor(s0 / 32) % 4] ?? [];
  for (const pick of [(k * 3) % 7, (k * 3 + 2) % 7]) {
    const m = tones[pick] ?? 62;
    hxStrings.push({ m: m + scat(k * 13 + pick, 0.04), s: s0, l: 12, v: 0.8 });
    hxStrings.push({ m: m + 0.06 + scat(k * 17 + pick, 0.04), s: s0, l: 12, v: 0.6 });
  }
}
const hxChoir: SongNote[] = [];
for (let k = 0; k < 16; k++) {
  const s0 = k * 8;
  const tones = HX_STRTONES[Math.floor(s0 / 32) % 4] ?? [];
  for (const pick of [(k * 2) % 7, (k * 2 + 3) % 7, (k * 2 + 5) % 7]) {
    const up = (tones[pick] ?? 62) + 12;
    hxChoir.push({ m: (up > 83 ? up - 12 : up) + scat(k * 19 + pick, 0.05), s: s0, l: 20, v: 0.6 });
  }
}

const HX_CSS = `
/* ========== HAMMERS X — arrangement (edit live via { } css) ========== */

body:has(#mute-swarm:checked) :is(.trk[data-name="SwarmA"], .trk[data-name="SwarmB"], .trk[data-name="SwarmC"], .trk[data-name="SwarmD"]) { --vol: 0 !important; filter: grayscale(1) brightness(0.6); }
body:has(#mute-rain:checked)  .trk[data-name="Rain"]  { --vol: 0 !important; filter: grayscale(1) brightness(0.6); }
body:has(#mute-strum:checked) .trk[data-name="Strum"] { --vol: 0 !important; filter: grayscale(1) brightness(0.6); }
body:has(#mute-bass:checked)  .trk[data-name="Bass"]  { --vol: 0 !important; filter: grayscale(1) brightness(0.6); }
body:has(#mute-kit:checked)   .trk[data-name="Kit"]   { --vol: 0 !important; filter: grayscale(1) brightness(0.6); }

/* thin: drop back to roughly HAMMERS density */
body:has(#thin:checked) :is(.trk[data-name="SwarmC"], .trk[data-name="SwarmD"], .trk[data-name="Rain"]) { --vol: 0 !important; filter: grayscale(1) brightness(0.6); }

/* the glue: mute it to hear what the connective tissue is doing */
body:has(#mute-glue:checked) :is(.trk[data-name="Body"], .trk[data-name="Strings"], .trk[data-name="Choir"]) { --vol: 0 !important; filter: grayscale(1) brightness(0.6); }

/* tape: the whole storm warbles together — relative tuning intact */
html.playing:has(#tape:checked) #roll .trk { animation: warblex 17s ease-in-out infinite; }
@keyframes warblex {
  0%, 100% { transform: translateY(0); }
  30% { transform: translateY(calc(var(--rh) * -0.15)); }
  70% { transform: translateY(calc(var(--rh) * 0.12)); }
}

/* acid: the bass goes sawtooth and squelches (#roll keeps its specificity
   above tape's so acid wins the bass when both are on) */
body:has(#acid:checked) .trk[data-name="Bass"] { --wave: sawtooth !important; }
html.playing:has(#acid:checked) #roll .trk[data-name="Bass"] { animation: acidx 3.1s ease-in-out infinite; }
@keyframes acidx { 0%, 100% { --cutoff: 300; } 50% { --cutoff: 3400; } }

/* quantize: snap the entire storm to the grid */
body:has(#quantize:checked) .trk b { transform: none !important; }

/* cathedral: six thousand hammers in a cave */
body:has(#cathedral:checked) .trk { --verb: 0.55 !important; }

html:has(#hyper:checked) { --bpm: 152 !important; }

.trk { transition: --vol 1.2s ease; }

/* standing motion: filter plucks, ±4-cent breath, bass filter wander
   (the acid toggle out-specifies the standing wander when it's on) */
.trk { --fenv: 0.6; }
html.playing .trk { animation: microtape 23s ease-in-out infinite; }
@keyframes microtape {
  0%, 100% { translate: 0 0; }
  33% { translate: 0 calc(var(--rh) * -0.045); }
  66% { translate: 0 calc(var(--rh) * 0.035); }
}
html.playing .trk[data-name="Bass"] { animation: cutdrift 9.3s ease-in-out infinite, microtape 23s ease-in-out infinite; }
@keyframes cutdrift { 0%, 100% { --cutoff: 700; } 50% { --cutoff: 1500; } }

/* ========== FORM — the loop pass is a CSS hook (data-pass on <html>).
   Eight passes ≈ two minutes of structure from a 15-second loop. The kick
   also pumps the whole mix via --duck. ========== */
html { --form: 8; --duck: 0.35; }
/* 0: the full wall arrives drumless — the kit holds back exactly one pass.
   transition:none so the kit is silent from the first sample (no fade-out);
   leaving pass 0, the un-mute regains the normal fade and the kit eases in. */
html[data-pass="0"] .trk[data-name="Kit"] { --vol: 0 !important; transition: none; }
/* 4: breakdown — drums and bass out, everything swims */
html[data-pass="4"] :is(.trk[data-name="Kit"], .trk[data-name="Bass"]) { --vol: 0 !important; }
html[data-pass="4"] .trk { --verb: 0.55 !important; }
/* 5-6: the drop — the bass goes acid */
html[data-pass="5"] .trk[data-name="Bass"],
html[data-pass="6"] .trk[data-name="Bass"] { --wave: sawtooth !important; }
html.playing[data-pass="5"] .trk[data-name="Bass"],
html.playing[data-pass="6"] .trk[data-name="Bass"] { animation: acidx 3.1s ease-in-out infinite, microtape 23s ease-in-out infinite; }
/* 7: strip back and turn around */
html[data-pass="7"] :is(.trk[data-name="SwarmC"], .trk[data-name="SwarmD"], .trk[data-name="Rain"], .trk[data-name="Strum"]) { --vol: 0 !important; }

/* the first pass is a ramp: pitch spins up like a turntable (3.2s, sustained
   voices bend up live) while one shared filter opens across the whole pass,
   accelerating into the kit drop. !important so it outranks the tape rule;
   re-runs on every form wrap. */
html.playing[data-pass="0"] #roll .trk {
  animation: rampcut calc(var(--steps) * 15s / var(--bpm)) ease-in 1, microtape 23s ease-in-out infinite, spinup 3.2s ease-out 1 !important;
}
@keyframes rampcut { 0% { --cutoff: 120; } 100% { --cutoff: 3000; } }
@keyframes spinup { 0% { translate: 0 calc(var(--rh) * 3); } 100% { translate: 0 0; } }
`;

const HX_MIXER = `
<span>css-only:</span>
<label><input type="checkbox" id="mute-swarm"> mute swarms</label>
<label><input type="checkbox" id="mute-rain"> mute rain</label>
<label><input type="checkbox" id="mute-strum"> mute strum</label>
<label><input type="checkbox" id="mute-bass"> mute bass</label>
<label><input type="checkbox" id="mute-kit"> mute kit</label>
<label><input type="checkbox" id="mute-glue"> mute glue</label>
<label><input type="checkbox" id="thin"> thin</label>
<label><input type="checkbox" id="quantize"> quantize</label>
<label><input type="checkbox" id="acid" checked> acid</label>
<label><input type="checkbox" id="tape" checked> tape</label>
<label><input type="checkbox" id="cathedral" checked> cathedral</label>
<label><input type="checkbox" id="hyper"> hyper</label>
`;

const hammersX: Song = {
  file: "hammers-x.html",
  title: "HAMMERS X",
  bpm: 132,
  steps: 128,
  css: HX_CSS,
  mixer: HX_MIXER,
  tracks: [
    { name: "SwarmA", wave: "ep", vol: 0.045, hue: 200, synth: "--cutoff:2800;--attack:0.002;--release:0.22;--verb:0.25;--width:0.6", notes: hxA },
    { name: "SwarmB", wave: "pulse25", vol: 0.035, hue: 320, synth: "--cutoff:2400;--attack:0.002;--release:0.2;--verb:0.3;--width:0.7", notes: hxB },
    { name: "SwarmC", wave: "pulse125", vol: 0.03, hue: 160, synth: "--cutoff:2000;--attack:0.002;--release:0.2;--verb:0.3;--pan:-0.25", notes: hxC },
    { name: "SwarmD", wave: "glass", vol: 0.025, hue: 50, synth: "--attack:0.002;--release:0.35;--verb:0.45;--width:0.8", notes: hxD },
    { name: "Rain", wave: "sine", vol: 0.04, hue: 60, synth: "--attack:0.002;--release:0.4;--verb:0.55;--width:0.85", notes: hxRain },
    { name: "Strum", wave: "sawtooth", vol: 0.03, hue: 280, synth: "--cutoff:1700;--attack:0.004;--release:0.45;--verb:0.4;--width:0.8", notes: hxStrum },
    { name: "Body", wave: "brass", vol: 0.04, hue: 100, synth: "--cutoff:1400;--attack:0.004;--release:0.22;--verb:0.3;--width:0.3", notes: hxBody },
    { name: "Strings", wave: "sawtooth", vol: 0.05, hue: 230, synth: "--cutoff:1600;--attack:0.25;--release:0.6;--verb:0.5;--vibrato:9;--width:0.6", notes: hxStrings },
    { name: "Choir", wave: "organ", vol: 0.045, hue: 10, synth: "--cutoff:1200;--attack:0.45;--release:0.8;--verb:0.55;--vibrato:6;--width:0.5", notes: hxChoir },
    { name: "Bass", wave: "triangle", vol: 0.22, hue: 145, synth: "--cutoff:900;--fenv:1.5;--attack:0.003;--release:0.06;--verb:0.05;--width:0.1", notes: hxBass },
    { name: "Kit", wave: "noise", vol: 0.32, hue: 35, synth: "--verb:0.12", notes: hxKit },
  ],
};

// ============================================================================
// PUMP — filter house. 124bpm, four-on-the-floor, C minor (Cm7 Abmaj7 Ebmaj7
// Bb7, two bars each) with just-intonation voicings (m3 +16c, M3 -14c, and a
// septimal 7th on the Bb7). The genre signatures, all CSS-native: --duck 0.45
// (the pump IS the genre), a French-house saw riff under a giant 31s filter
// LFO, offbeat open hats, ep-piano stabs micro-rolled and scattered, glue
// pads, and an 8-pass form with the turntable ramp intro and an acid drop.
// ============================================================================

const PUMP_ROOTS = [36, 36, 44, 44, 39, 39, 46, 46];
const PUMP_STABS = [
  [48, 51.16, 55.02, 58.18], // Cm7, JI minor — voiced dark
  [44, 47.86, 51.02, 54.86], // Abmaj7
  [51, 54.86, 58.02, 61.86], // Ebmaj7
  [46, 49.86, 53.02, 55.69], // Bb7 — septimal seventh
];
const PUMP_RIFF = [
  [48, 51.16, 55],
  [44, 47.86, 51],
  [51, 54.86, 58],
  [46, 49.86, 53],
];
const pumpChord = (bar: number): number => Math.floor(bar / 2) % 4;

const pumpKick: SongNote[] = [];
for (let b = 0; b < 8; b++) {
  for (const k of [0, 4, 8, 12]) pumpKick.push({ m: 40, s: b * 16 + k, l: 1, v: 1 });
}

const pumpHats: SongNote[] = [];
for (let b = 0; b < 8; b++) {
  const o = b * 16;
  for (let i = 0; i < 16; i++) {
    if (i % 4 === 2) pumpHats.push({ m: 77, s: o + i, l: 1, v: 0.3 }); // open on the offbeats
    else pumpHats.push({ m: 81, s: o + i + (i % 2 === 1 ? 0.22 : 0), l: 1, v: 0.09 + scat(b * 16 + i, 0.03) + (i % 4 === 0 ? 0.06 : 0) });
  }
}

const pumpClap: SongNote[] = [];
for (let b = 0; b < 8; b++) {
  pumpClap.push({ m: 64, s: b * 16 + 4, l: 1, v: 0.85 }, { m: 64, s: b * 16 + 12, l: 1, v: 0.85 });
  if (b % 4 === 3) pumpClap.push({ m: 64, s: b * 16 + 11.5, l: 1, v: 0.25 });
}

// rolling offbeat bass between the kicks — the duck pumps it
const pumpBass: SongNote[] = [];
for (let b = 0; b < 8; b++) {
  const r = PUMP_ROOTS[b] ?? 36;
  const o = b * 16;
  pumpBass.push(
    { m: r + scat(b, 0.02), s: o + 2, l: 2, v: 1 },
    { m: r + 12 + scat(b + 10, 0.03), s: o + 6, l: 2, v: 0.8 },
    { m: r + scat(b + 20, 0.02), s: o + 10, l: 2, v: 0.95 },
    { m: r + 12 + scat(b + 30, 0.03), s: o + 14, l: 2, v: 0.8 },
  );
  if (b % 2 === 1) pumpBass.push({ m: r + 7.02, s: o + 15.5, l: 0.5, v: 0.6 });
}

// ep-piano stabs, syncopated, micro-rolled
const pumpStabs: SongNote[] = [];
for (let b = 0; b < 8; b++) {
  const chord = PUMP_STABS[pumpChord(b)] ?? [];
  const o = b * 16;
  const hits = b % 2 === 0 ? [{ s: 7, l: 2 }, { s: 14, l: 1.5 }] : [{ s: 3, l: 2 }, { s: 10.67, l: 1.33 }];
  for (const h of hits) {
    for (let j = 0; j < chord.length; j++) {
      const m0 = (chord[j] ?? 48) + scat(b * 31 + j, 0.05);
      pumpStabs.push({ m: m0, s: o + h.s + j * 0.02, l: h.l, v: 0.85 - j * 0.05 });
      pumpStabs.push({ m: m0 + 0.09, s: o + h.s + j * 0.02, l: h.l, v: (0.85 - j * 0.05) * 0.7 });
    }
  }
}

// the French-house loop, wall-of-sound edition: every triad tone is a 3-note
// microtonal cluster (×2 detuned oscillators each = 18 voices per hit)
const pumpRiff: SongNote[] = [];
for (let i = 0; i < 64; i++) {
  const tri = PUMP_RIFF[pumpChord(Math.floor((i * 2) / 16))] ?? [];
  for (let j = 0; j < tri.length; j++) {
    cluster(pumpRiff, tri[j] ?? 48, 3, 0.12, i * 2 + (i % 2 === 1 ? 0.1 : 0), 2, (i % 4 === 0 ? 0.8 : 0.5) * (1 - j * 0.08), i * 17 + j * 5);
  }
}

// dark mid-mass: 5-note clusters on 8ths around root/fifth/octave — the
// HAMMERS swarm trick living in the low-mids
const pumpBody: SongNote[] = [];
for (let i = 0; i < 64; i++) {
  const r = PUMP_ROOTS[Math.floor((i * 2) / 16)] ?? 36;
  const off = [0, 7.02, 12][i % 3] ?? 0;
  cluster(pumpBody, r + off, 5, 0.18, i * 2 + (i % 2 === 1 ? 0.08 : 0), 2, i % 4 === 0 ? 0.55 : 0.32, i * 41 + 9);
}

const pumpArp: SongNote[] = [];
for (let i = 0; i < 128; i++) {
  const chord = PUMP_STABS[pumpChord(Math.floor(i / 16))] ?? [];
  const tone = (chord[i % 4] ?? 48) + (i % 8 >= 4 ? 12 : 0);
  pumpArp.push({ m: tone + scat(i * 7, 0.06), s: i + (i % 2 === 1 ? 0.18 : 0) + scat(i * 3, 0.03), l: 1, v: i % 4 === 0 ? 0.7 : 0.4 });
}

// glue: overlapping chord tones with detuned twins, entries every half bar
const pumpPad: SongNote[] = [];
for (let h = 0; h < 16; h++) {
  const s0 = h * 8;
  const chord = PUMP_STABS[pumpChord(Math.floor(s0 / 16))] ?? [];
  for (const pick of [h % 4, (h + 2) % 4]) {
    const m0 = (chord[pick] ?? 48) + scat(h * 13 + pick, 0.04);
    pumpPad.push({ m: m0, s: s0, l: 14, v: 0.7 });
    pumpPad.push({ m: m0 + 0.1, s: s0, l: 14, v: 0.5 });
  }
}

const pumpVox: SongNote[] = [
  { m: 53, s: 62, l: 4, v: 1, w: "pump" },
  { m: 51, s: 126, l: 2, v: 1, w: "cascade" },
];

// the hook: a dark brass topline in C blues — quarter-tone blue note (66.5),
// JI minor thirds, and a turnaround landing on Bb7's septimal seventh
const pumpHook: SongNote[] = [
  { m: 67, s: 0, l: 2.67, v: 0.95 }, { m: 66.5, s: 2.67, l: 1.33, v: 0.85 }, { m: 63.16, s: 4, l: 3, v: 0.9 },
  { m: 60, s: 8, l: 4, v: 0.85 },
  { m: 63.16, s: 18, l: 2, v: 0.8 }, { m: 65, s: 20.67, l: 1.33, v: 0.8 }, { m: 67, s: 22, l: 4, v: 0.9 },
  { m: 70.18, s: 32, l: 2.67, v: 0.9 }, { m: 67, s: 34.67, l: 1.33, v: 0.8 }, { m: 63.16, s: 36, l: 3, v: 0.85 },
  { m: 60, s: 40, l: 4, v: 0.8 }, { m: 58, s: 50, l: 2, v: 0.75 }, { m: 60, s: 52.67, l: 3, v: 0.85 },
  { m: 63.16, s: 64, l: 2.67, v: 0.85 }, { m: 65, s: 66.67, l: 1.33, v: 0.8 }, { m: 66.5, s: 68, l: 2, v: 0.95 },
  { m: 67, s: 70, l: 5, v: 0.9 }, { m: 63.16, s: 82, l: 2, v: 0.75 }, { m: 60, s: 84, l: 4, v: 0.8 },
  { m: 65, s: 96, l: 2.67, v: 0.85 }, { m: 63.16, s: 98.67, l: 1.33, v: 0.8 }, { m: 60, s: 100, l: 3, v: 0.8 },
  { m: 55.69, s: 108, l: 3, v: 0.85 }, { m: 58, s: 112, l: 2, v: 0.8 }, { m: 60, s: 114.67, l: 1.33, v: 0.8 },
  { m: 63.16, s: 116, l: 2, v: 0.85 }, { m: 67, s: 118, l: 6, v: 0.95 },
];

const PUMP_CSS = `
/* ========== PUMP — arrangement (edit live via { } css) ========== */

body:has(#mute-hook:checked)  .trk[data-name="Hook"]  { --vol: 0 !important; filter: grayscale(1) brightness(0.6); }
body:has(#mute-stabs:checked) .trk[data-name="Stabs"] { --vol: 0 !important; filter: grayscale(1) brightness(0.6); }
body:has(#mute-riff:checked)  .trk[data-name="Riff"]  { --vol: 0 !important; filter: grayscale(1) brightness(0.6); }
body:has(#mute-arp:checked)   .trk[data-name="Arp"]   { --vol: 0 !important; filter: grayscale(1) brightness(0.6); }
body:has(#mute-pad:checked)   .trk[data-name="Pad"]   { --vol: 0 !important; filter: grayscale(1) brightness(0.6); }
body:has(#mute-body:checked)  .trk[data-name="Body"]  { --vol: 0 !important; filter: grayscale(1) brightness(0.6); }
body:has(#mute-bass:checked)  .trk[data-name="Bass"]  { --vol: 0 !important; filter: grayscale(1) brightness(0.6); }
body:has(#mute-kick:checked)  .trk[data-name="Kick"]  { --vol: 0 !important; filter: grayscale(1) brightness(0.6); }
body:has(#mute-hats:checked)  .trk[data-name="Hats"]  { --vol: 0 !important; filter: grayscale(1) brightness(0.6); }
body:has(#mute-clap:checked)  .trk[data-name="Clap"]  { --vol: 0 !important; filter: grayscale(1) brightness(0.6); }
body:has(#mute-vox:checked)   .trk[data-name="Vox"]   { --vol: 0 !important; filter: grayscale(1) brightness(0.6); }

/* acid: the offbeat bass goes 303 */
body:has(#acid:checked) .trk[data-name="Bass"] { --wave: sawtooth !important; }
html.playing:has(#acid:checked) #roll .trk[data-name="Bass"] { animation: acidx 3.4s ease-in-out infinite; }
@keyframes acidx { 0%, 100% { --cutoff: 300; } 50% { --cutoff: 3000; } }

/* tape: the whole record warbles */
html.playing:has(#tape:checked) #roll .trk { animation: warblex 17s ease-in-out infinite; }
@keyframes warblex {
  0%, 100% { transform: translateY(0); }
  30% { transform: translateY(calc(var(--rh) * -0.15)); }
  70% { transform: translateY(calc(var(--rh) * 0.12)); }
}

body:has(#cathedral:checked) .trk { --verb: 0.55 !important; }
html:has(#hyper:checked) { --bpm: 134 !important; }

.trk { transition: --vol 1.2s ease; }

/* standing motion: the French-house filter LFO on the riff, plus the usual
   anti-MIDI layer (filter plucks, ±4-cent breath, stab filter wander) */
.trk { --fenv: 0.6; }
html.playing .trk { animation: microtape 23s ease-in-out infinite; }
@keyframes microtape {
  0%, 100% { translate: 0 0; }
  33% { translate: 0 calc(var(--rh) * -0.045); }
  66% { translate: 0 calc(var(--rh) * 0.035); }
}
html.playing .trk[data-name="Riff"] { animation: housefilter 31s ease-in-out infinite, microtape 23s ease-in-out infinite; }
@keyframes housefilter { 0%, 100% { --cutoff: 220; } 50% { --cutoff: 3200; } }
html.playing .trk[data-name="Stabs"] { animation: cutdrift 9.3s ease-in-out infinite, microtape 23s ease-in-out infinite; }
@keyframes cutdrift { 0%, 100% { --cutoff: 900; } 50% { --cutoff: 1800; } }

/* ========== FORM — 8 passes, the pump carries it ========== */
html { --form: 8; --duck: 0.45; }
/* 0: the wall rides the ramp (stabs included); rhythm section silent from
   sample one, hook held back */
html[data-pass="0"] :is(.trk[data-name="Kick"], .trk[data-name="Clap"], .trk[data-name="Bass"], .trk[data-name="Vox"], .trk[data-name="Hook"]) { --vol: 0 !important; transition: none; }
/* 1: the floor lands, full band — hook saves itself for pass 2 */
html[data-pass="1"] :is(.trk[data-name="Hook"], .trk[data-name="Vox"]) { --vol: 0 !important; }
/* 4: breakdown — floor drops out, stabs and pads swim */
html[data-pass="4"] :is(.trk[data-name="Kick"], .trk[data-name="Clap"], .trk[data-name="Bass"]) { --vol: 0 !important; }
html[data-pass="4"] .trk { --verb: 0.55 !important; }
/* 5-6: the drop — acid bass */
html[data-pass="5"] .trk[data-name="Bass"],
html[data-pass="6"] .trk[data-name="Bass"] { --wave: sawtooth !important; }
html.playing[data-pass="5"] .trk[data-name="Bass"],
html.playing[data-pass="6"] .trk[data-name="Bass"] { animation: acidx 3.4s ease-in-out infinite, microtape 23s ease-in-out infinite; }
/* 7: outro — back to the loop bones */
html[data-pass="7"] :is(.trk[data-name="Stabs"], .trk[data-name="Arp"], .trk[data-name="Pad"], .trk[data-name="Vox"], .trk[data-name="Hook"]) { --vol: 0 !important; }

/* the first pass ramps: turntable spin-up + one shared filter opening */
html.playing[data-pass="0"] #roll .trk {
  animation: rampcut calc(var(--steps) * 15s / var(--bpm)) ease-in 1, microtape 23s ease-in-out infinite, spinup 3.2s ease-out 1 !important;
}
@keyframes rampcut { 0% { --cutoff: 150; } 100% { --cutoff: 2800; } }
@keyframes spinup { 0% { translate: 0 calc(var(--rh) * 3); } 100% { translate: 0 0; } }
`;

const PUMP_MIXER = `
<span>css-only:</span>
<label><input type="checkbox" id="mute-hook"> mute hook</label>
<label><input type="checkbox" id="mute-stabs"> mute stabs</label>
<label><input type="checkbox" id="mute-riff"> mute riff</label>
<label><input type="checkbox" id="mute-arp"> mute arp</label>
<label><input type="checkbox" id="mute-pad"> mute pad</label>
<label><input type="checkbox" id="mute-body"> mute body</label>
<label><input type="checkbox" id="mute-bass"> mute bass</label>
<label><input type="checkbox" id="mute-kick"> mute kick</label>
<label><input type="checkbox" id="mute-hats"> mute hats</label>
<label><input type="checkbox" id="mute-clap"> mute clap</label>
<label><input type="checkbox" id="mute-vox"> mute vox</label>
<label><input type="checkbox" id="acid" checked> acid</label>
<label><input type="checkbox" id="tape"> tape</label>
<label><input type="checkbox" id="cathedral"> cathedral</label>
<label><input type="checkbox" id="hyper"> hyper</label>
`;

const pump: Song = {
  file: "pump.html",
  title: "PUMP",
  bpm: 124,
  steps: 128,
  css: PUMP_CSS,
  mixer: PUMP_MIXER,
  tracks: [
    { name: "Hook", wave: "brass", vol: 0.13, hue: 5, synth: "--cutoff:1600;--spread:6;--attack:0.01;--release:0.12;--verb:0.3;--echo:0.35;--vibrato:12;--width:0.3", notes: pumpHook },
    { name: "Stabs", wave: "ep", vol: 0.1, hue: 280, synth: "--cutoff:1400;--spread:5;--attack:0.004;--release:0.25;--verb:0.3;--echo:0.25;--width:0.5", notes: pumpStabs },
    { name: "Riff", wave: "sawtooth", vol: 0.035, hue: 200, synth: "--cutoff:1000;--spread:6;--attack:0.006;--release:0.18;--verb:0.25;--width:0.4", notes: pumpRiff },
    { name: "Arp", wave: "pulse25", vol: 0.05, hue: 330, synth: "--cutoff:1800;--echo:0.35;--release:0.15;--width:0.7", notes: pumpArp },
    { name: "Pad", wave: "organ", vol: 0.04, hue: 100, synth: "--attack:0.4;--release:0.7;--verb:0.5;--vibrato:6;--width:0.6", notes: pumpPad },
    { name: "Body", wave: "brass", vol: 0.04, hue: 20, synth: "--cutoff:900;--attack:0.005;--release:0.2;--verb:0.25;--width:0.25", notes: pumpBody },
    { name: "Bass", wave: "triangle", vol: 0.4, hue: 145, synth: "--cutoff:750;--fenv:1.6;--attack:0.004;--release:0.08;--verb:0.04;--width:0", notes: pumpBass },
    { name: "Kick", wave: "noise", vol: 0.55, hue: 10, synth: "--verb:0.03;--width:0", notes: pumpKick },
    { name: "Hats", wave: "noise", vol: 0.26, hue: 60, synth: "--verb:0.15;--pan:0.15", notes: pumpHats },
    { name: "Clap", wave: "clap", vol: 0.5, hue: 40, synth: "--verb:0.35", notes: pumpClap },
    { name: "Vox", wave: "voice", vol: 0.35, hue: 0, notes: pumpVox },
  ],
};

// ============================================================================
// SELECTOR — the stylesheet is the composer. 138bpm acid techno whose markup
// is 27 empty <b> elements and zero placed notes: every drum hit and every
// pitch is a CSS formula (sibling-index() spaces the hits into euclidean
// rhythms, mod() walks the pitches). Per-track --loop lengths (16/12/20/36)
// keep the layers phasing against each other.
// ============================================================================

const SELECTOR_CSS = `
/* ========== SELECTOR — the entire composition lives in this stylesheet =====
   The markup has 27 empty <b> elements. Everything you hear is a formula:
   sibling-index() computes each hit's time, mod() computes each pitch.
   Requires sibling-index() support (Chrome 138+). Edit live via { } css. */

.trk b { display: none; }

/* kick: four on the floor over a 16-step loop */
.trk[data-name="Kick"] b {
  display: block;
  grid-row: 44;
  grid-column: calc((sibling-index() - 1) * 4 + 1);
  --vel: 1;
}

/* clap: backbeat */
.trk[data-name="Clap"] b {
  display: block;
  grid-row: 20;
  grid-column: calc((sibling-index() - 1) * 8 + 5);
  --vel: 0.8;
}

/* hats: E(7,12) — seven hits euclidean-spread over a 12-step loop,
   phasing against the 16-step kick forever */
.trk[data-name="Hat"] b {
  display: block;
  grid-row: 2;
  grid-column: calc(round(down, (sibling-index() - 1) * 12 / 7, 1) + 1);
  --vel: 0.4;
}

/* bass: five hits over 20 steps, pitch wandering by modular arithmetic */
.trk[data-name="Bass"] b {
  display: block;
  grid-column: calc((sibling-index() - 1) * 4 + 1) / span 3;
  grid-row: calc(46 - mod(sibling-index() * 5, 7));
}

/* blip: nine notes over 36 steps — a melody nobody wrote */
.trk[data-name="Blip"] b {
  display: block;
  grid-column: calc((sibling-index() - 1) * 4 + 1) / span 2;
  grid-row: calc(22 - mod(sibling-index() * 7, 12));
  --vel: 0.8;
}

body:has(#mute-kick:checked) .trk[data-name="Kick"] { --vol: 0 !important; filter: grayscale(1) brightness(0.6); }
body:has(#mute-clap:checked) .trk[data-name="Clap"] { --vol: 0 !important; filter: grayscale(1) brightness(0.6); }
body:has(#mute-hat:checked)  .trk[data-name="Hat"]  { --vol: 0 !important; filter: grayscale(1) brightness(0.6); }
body:has(#mute-bass:checked) .trk[data-name="Bass"] { --vol: 0 !important; filter: grayscale(1) brightness(0.6); }
body:has(#mute-blip:checked) .trk[data-name="Blip"] { --vol: 0 !important; filter: grayscale(1) brightness(0.6); }

/* dense: same seven hat elements, tighter formula */
body:has(#dense:checked) .trk[data-name="Hat"] b {
  grid-column: calc((sibling-index() - 1) * 2 + 1);
}

/* acid: the bass filter starts squelching */
html.playing:has(#acid:checked) .trk[data-name="Bass"] { animation: acid 3.7s ease-in-out infinite; }
@keyframes acid { 0%, 100% { --cutoff: 350; } 50% { --cutoff: 3400; } }

.trk { transition: --vol 0.8s ease; }

/* standing motion: filter plucks, ±4-cent breath, bass filter wander */
.trk { --fenv: 0.6; }
html.playing .trk { animation: microtape 23s ease-in-out infinite; }
@keyframes microtape {
  0%, 100% { translate: 0 0; }
  33% { translate: 0 calc(var(--rh) * -0.045); }
  66% { translate: 0 calc(var(--rh) * 0.035); }
}
html.playing .trk[data-name="Bass"] { animation: cutdrift 9.3s ease-in-out infinite, microtape 23s ease-in-out infinite; }
@keyframes cutdrift { 0%, 100% { --cutoff: 450; } 50% { --cutoff: 900; } }
html { --duck: 0.4; }
`;

const SELECTOR_MIXER = `
<span>css-only:</span>
<label><input type="checkbox" id="mute-kick"> mute kick</label>
<label><input type="checkbox" id="mute-clap"> mute clap</label>
<label><input type="checkbox" id="mute-hat"> mute hat</label>
<label><input type="checkbox" id="mute-bass"> mute bass</label>
<label><input type="checkbox" id="mute-blip"> mute blip</label>
<label><input type="checkbox" id="dense"> dense hats</label>
<label><input type="checkbox" id="acid"> acid</label>
`;

const selectorSong: Song = {
  file: "selector.html",
  title: "SELECTOR",
  bpm: 138,
  steps: 64,
  css: SELECTOR_CSS,
  mixer: SELECTOR_MIXER,
  tracks: [
    { name: "Kick", wave: "noise", vol: 0.6, hue: 10, synth: "--loop:16;--verb:0.04;--width:0", blanks: 4, notes: [] },
    { name: "Clap", wave: "clap", vol: 0.45, hue: 50, synth: "--loop:16;--verb:0.3", blanks: 2, notes: [] },
    { name: "Hat", wave: "noise", vol: 0.4, hue: 80, synth: "--loop:12;--pan:0.25;--verb:0.12", blanks: 7, notes: [] },
    { name: "Bass", wave: "sawtooth", vol: 0.3, hue: 150, synth: "--cutoff:600;--attack:0.005;--loop:20;--fenv:2.5;--width:0", blanks: 5, notes: [] },
    { name: "Blip", wave: "glass", vol: 0.12, hue: 270, synth: "--cutoff:2400;--loop:36;--echo:0.4;--width:0.6", blanks: 9, notes: [] },
  ],
};

// ============================================================================

const css = await Bun.file("src/style.css").text();
const ts = await Bun.file("src/daw.ts").text();
const tpl = await Bun.file("src/template.html").text();
const transpiler = new Bun.Transpiler({ loader: "ts" });
const js = transpiler.transformSync(ts);

const sonifySrc = await Bun.file("src/sonify.ts").text();
const sonifyJs =
  "// midiCSS sonify — paste this whole file into any website's devtools console.\n" +
  "// Scroll to remix · Escape to stop · paste again to toggle off.\n" +
  transpiler.transformSync(sonifySrc);
await Bun.write("sonify.js", sonifyJs);
console.log(`sonify.js — ${(sonifyJs.length / 1024).toFixed(1)} kB`);

for (const song of [demo, bloom, ratio, blue, bloom31, mass, hammers, hammersX, pump, selectorSong]) {
  const out = tpl
    .replace("__TITLE__", () => song.title)
    .replace("__BPM__", () => String(song.bpm))
    .replace("__STEPS__", () => String(song.steps))
    .replace("__CSS__", () => css.trim())
    .replace("__SONGCSS__", () => song.css.trim())
    .replace("__MIXER__", () => song.mixer.trim())
    .replace("__JS__", () => js.trim())
    .replace("__SONG__", () => song.tracks.map(track).join("\n"));
  await Bun.write(song.file, out);
  let count = 0;
  for (const t of song.tracks) count += t.notes.length;
  console.log(`${song.file} — ${(out.length / 1024).toFixed(1)} kB, ${count} notes`);
}
