# midiCSS

A browser DAW where the HTML/CSS file *is* the song format.

- A note is a `<b>` element: `grid-area: row/col-start/row+1/col-end` — grid row
  is pitch (row 1 = B5 … row 48 = C2), grid column is the 16th-note step.
- Song parameters are CSS custom properties: `--bpm` on `<html>`, `--steps` on
  `#roll`, `--wave`/`--vol`/`--hue` per track `<section>`, `--vel` per note.
- The piano roll you see is just the CSS rendering of that data — no JS needed
  to *display* a song.
- The inline script plays it (Web Audio) and edits it (pointer events writing
  inline styles). "save .html" re-serializes the document: the downloaded file
  is again a full player/editor/song.
- Synth design is CSS too: per-track `--spread` (unison detune, cents),
  `--cutoff` (lowpass Hz), `--attack`/`--release` (seconds) — all registered
  properties, so `@keyframes` can sweep a filter.
- A track's `::before`/`::after` with `content` and a `grid-area` is a playable
  note that exists only in the stylesheet (rendered with a dashed border).
- Playback reads **rendered geometry + computed style**, not the raw markup:
  a note sounds exactly where it is painted. So CSS *is* an arrangement layer —
  media queries remix per viewport, `:has(:checked)` makes JS-free mute/transpose
  toggles, `transform: translateY` transposes, `translateX` micro-shifts timing
  (swing), `scaleX` time-stretches, `display: none` mutes. The demo song carries
  its arrangement in a second `<style>` block (responsive mix, css-only mixer,
  +8va and swing toggles). Base values are inline styles, so arrangement rules
  use `!important` to win the cascade.

## Build

```sh
bun run build   # src/{template.html,style.css,daw.ts} -> midicss.html
bun run check   # tsc --noEmit
```

Open `midicss.html` (double-click; no server needed).

## Controls

drag on grid: draw note · drag note: move · drag right edge: resize ·
alt-click or right-click: delete · space: play/stop

`{ } css` opens a live editor over the song's arrangement stylesheet
(`<style id="songcss">`): edits are heard within ~120ms while playing and
persist through save — live-coding surface included.
