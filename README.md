# ansisheet

Responsive FIGlet and ANSI art for modern websites.

ansisheet is a no build, no Node, no npm renderer for terminal art. It lets a
website use ordinary `<ansisheet>` tags, then upgrades them in the browser into
responsive SVG. The art scales like a sheet instead of reflowing like text.

The no hyphen tag is deliberate. Browser custom elements require a hyphenated
name, so ansisheet does not use `customElements.define`. It is a progressive
enhancer: include the module, write `<ansisheet>`, and the script upgrades those
ordinary elements in place.

## Why This Exists

Old terminal art is not normal web text. A `<pre>` block can work in a README,
but it falls apart in a real layout:

- font fallback changes the cell grid;
- line height changes the look of block and box glyphs;
- responsive font sizing causes clipping, wrapping, or unreadable text;
- ANSI color and cursor movement are not HTML layout;
- old art often assumes terminal cells, not proportional browser typography.

ansisheet keeps the terminal model:

```text
source text or ANSI -> rectangular cells -> responsive SVG
```

## Features

- Plain `<ansisheet>` markup.
- No package manager, build step, runtime dependency, or framework.
- Responsive SVG output with a stable `viewBox`.
- ANSI SGR color parsing.
- Cursor positioning and clear screen frame capture for simple ansimations.
- Python standard library helper for static SVG export.
- Python standard library tests.

## Use It

Load the browser module:

```html
<script type="module" src="./src/ansisheet.js"></script>
```

Write normal markup:

```html
<ansisheet title="Project banner">
████  █  █ ████ ████ ████
█     █  █ █    █      ██
████  ████ ███  ███    ██
   █  █  █ █    █      ██
████  █  █ ████ ████   ██
</ansisheet>
```

Render ANSI color:

```html
<ansisheet text="&#x1b;[32mGREEN&#x1b;[0m and &#x1b;[35mMAGENTA&#x1b;[0m"></ansisheet>
```

Play simple clear screen animations:

```html
<ansisheet src="/art/demo.ans" cols="80" rows="25" autoplay fps="12"></ansisheet>
```

## Attributes

| Attribute | Purpose |
|---|---|
| `src` | Fetch source text or ANSI from a URL |
| `text` | Render source from an attribute |
| `cols` | Fixed terminal columns for ANSI parsing |
| `rows` | Fixed terminal rows; also preserves frame height |
| `cellwidth` | Internal SVG cell width, default `10` |
| `cellheight` | Internal SVG cell height, default `20` |
| `autoplay` | Play multi frame ANSI |
| `fps` | Animation frame rate |
| `title` | SVG title for accessibility |

## JavaScript API

The module auto upgrades every `<ansisheet>` tag on the page. You can also call
the upgrader yourself after injecting markup:

```js
import { upgradeAnsisheets, parseAnsi, renderFrameToSvg } from "./src/ansisheet.js";

upgradeAnsisheets(document);
```

For live editors, keep a controller and update it directly instead of rewriting
the element's child nodes:

```js
import { upgradeAnsisheet } from "./src/ansisheet.js";

const sheet = upgradeAnsisheet(document.querySelector("ansisheet"));
sheet.setText(textarea.value);
```

## Static SVG Helper

For static sites, CMS uploads, or no JS fallbacks, use the Python helper:

```bash
python3 tools/ansisheet.py input.ans --cols 80 --rows 25 > output.svg
```

The helper uses only the Python standard library. It mirrors the browser cell
model closely enough for smoke tests and static export.

## Development

Run tests:

```bash
python3 -m unittest discover -s tests
```

Serve the demo:

```bash
python3 -m http.server 5173
```

Open:

```text
http://localhost:5173/demo/
```

## Current Renderer

The browser renderer emits SVG:

- `viewBox` is derived from `cols * cellwidth` and `rows * cellheight`;
- `preserveAspectRatio="xMidYMid meet"` keeps the art proportional;
- block, shade, and common box drawing glyphs are drawn as SVG primitives;
- other glyphs render as fixed terminal-cell SVG text.

## Roadmap

- CP437 SVG glyph atlas for exact historical ANSI/NFO display.
- SAUCE metadata parsing for width, height, font, flags, and title.
- Canvas and OffscreenCanvas tier for huge files and frame heavy ansimations.
- Better animation controls and poster frames.
- Import examples from old artpack formats.

## Prior Art

- AnsiLove.js for browser ANSI/BIN/XBIN rendering and SAUCE aware artpack
  compatibility.
- asciinema player for terminal session recordings.
- xterm.js for live browser terminals.
- ansi up style converters for simple SGR to HTML log rendering.

ansisheet is narrower: responsive decorative and brand display of banners and
old terminal art without embedding a full terminal emulator.
