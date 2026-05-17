import { makeCell, makeFrame, cloneFrame, textToFrame, trimFrame, normalizeNewlines } from "./cells.js";
import { colorFromAnsi256, colorFromAnsiCode, rgbToHex } from "./palette.js";

const CSI_FINAL_RE = /[\x40-\x7e]/;

export function parseAnsi(source, options = {}) {
  const input = normalizeNewlines(source);
  if (!input.includes("\x1b")) {
    return textToFrame(input, options);
  }

  const parser = new AnsiParser(options);
  return parser.parse(input);
}

export class AnsiParser {
  constructor(options = {}) {
    this.cols = Number(options.cols ?? 80);
    this.rows = Number(options.rows ?? 25);
    this.maxRows = Number(options.maxRows ?? 1000);
    this.preserveRows = Boolean(options.preserveRows);
    this.recordOnClear = options.recordOnClear !== false;
    this.screen = makeFrame(this.cols, this.rows);
    this.frames = [];
    this.x = 0;
    this.y = 0;
    this.saved = { x: 0, y: 0 };
    this.style = this.defaultStyle();
    this.usedRow = 0;
  }

  parse(input) {
    for (let index = 0; index < input.length; index += 1) {
      const ch = input[index];
      if (ch === "\x1b") {
        index = this.consumeEscape(input, index);
      } else {
        this.writeChar(ch);
      }
    }
    this.pushFrame();
    const frames = this.frames.length ? this.frames : [this.visibleFrame()];
    return {
      cols: this.cols,
      rows: frames[frames.length - 1].length,
      frames,
      frame: frames[frames.length - 1],
    };
  }

  defaultStyle() {
    return { fg: null, bg: null, bold: false, inverse: false };
  }

  consumeEscape(input, start) {
    const next = input[start + 1];
    if (next === "[") {
      let end = start + 2;
      while (end < input.length && !CSI_FINAL_RE.test(input[end])) {
        end += 1;
      }
      if (end < input.length) {
        this.applyCsi(input.slice(start + 2, end), input[end]);
        return end;
      }
    }
    if (next === "7") {
      this.saved = { x: this.x, y: this.y };
      return start + 1;
    }
    if (next === "8") {
      this.x = this.saved.x;
      this.y = this.saved.y;
      return start + 1;
    }
    return start;
  }

  applyCsi(rawParams, final) {
    const params = parseParams(rawParams);
    if (final === "m") {
      this.applySgr(params.length ? params : [0]);
      return;
    }

    if (final === "H" || final === "f") {
      this.y = clamp((params[0] ?? 1) - 1, 0, this.maxRows - 1);
      this.x = clamp((params[1] ?? 1) - 1, 0, this.cols - 1);
      this.ensureRows(this.y);
      return;
    }

    if (final === "A") {
      this.y = clamp(this.y - (params[0] || 1), 0, this.maxRows - 1);
      return;
    }
    if (final === "B") {
      this.y = clamp(this.y + (params[0] || 1), 0, this.maxRows - 1);
      this.ensureRows(this.y);
      return;
    }
    if (final === "C") {
      this.x = clamp(this.x + (params[0] || 1), 0, this.cols - 1);
      return;
    }
    if (final === "D") {
      this.x = clamp(this.x - (params[0] || 1), 0, this.cols - 1);
      return;
    }
    if (final === "G") {
      this.x = clamp((params[0] || 1) - 1, 0, this.cols - 1);
      return;
    }
    if (final === "J") {
      this.clearScreen(params[0] ?? 0);
      return;
    }
    if (final === "K") {
      this.clearLine(params[0] ?? 0);
      return;
    }
    if (final === "s") {
      this.saved = { x: this.x, y: this.y };
      return;
    }
    if (final === "u") {
      this.x = this.saved.x;
      this.y = this.saved.y;
    }
  }

  applySgr(params) {
    for (let i = 0; i < params.length; i += 1) {
      const code = params[i] ?? 0;
      if (code === 0) {
        this.style = this.defaultStyle();
      } else if (code === 1) {
        this.style.bold = true;
      } else if (code === 22) {
        this.style.bold = false;
      } else if (code === 7) {
        this.style.inverse = true;
      } else if (code === 27) {
        this.style.inverse = false;
      } else if (code === 39) {
        this.style.fg = null;
      } else if (code === 49) {
        this.style.bg = null;
      } else if ((code >= 30 && code <= 37) || (code >= 90 && code <= 97)) {
        this.style.fg = colorFromAnsiCode(code, this.style.bold);
      } else if ((code >= 40 && code <= 47) || (code >= 100 && code <= 107)) {
        this.style.bg = colorFromAnsiCode(code, false);
      } else if ((code === 38 || code === 48) && params[i + 1] === 5) {
        const color = colorFromAnsi256(params[i + 2] ?? 0);
        if (code === 38) {
          this.style.fg = color;
        } else {
          this.style.bg = color;
        }
        i += 2;
      } else if ((code === 38 || code === 48) && params[i + 1] === 2) {
        const color = rgbToHex(params[i + 2] ?? 0, params[i + 3] ?? 0, params[i + 4] ?? 0);
        if (code === 38) {
          this.style.fg = color;
        } else {
          this.style.bg = color;
        }
        i += 4;
      }
    }
  }

  writeChar(ch) {
    if (ch === "\n") {
      this.x = 0;
      this.y += 1;
      this.ensureRows(this.y);
      return;
    }
    if (ch === "\b") {
      this.x = Math.max(0, this.x - 1);
      return;
    }
    if (ch === "\t") {
      const spaces = 8 - (this.x % 8);
      for (let i = 0; i < spaces; i += 1) {
        this.writeChar(" ");
      }
      return;
    }
    if (ch < " ") {
      return;
    }

    this.ensureRows(this.y);
    this.screen[this.y][this.x] = makeCell(ch, this.style);
    this.usedRow = Math.max(this.usedRow, this.y);
    this.x += 1;
    if (this.x >= this.cols) {
      this.x = 0;
      this.y += 1;
      this.ensureRows(this.y);
    }
  }

  ensureRows(rowIndex) {
    while (rowIndex >= this.screen.length && this.screen.length < this.maxRows) {
      this.screen.push(Array.from({ length: this.cols }, () => makeCell()));
    }
  }

  clearScreen(mode) {
    if (mode === 2 || mode === 3) {
      if (this.recordOnClear && this.hasContent()) {
        this.pushFrame();
      }
      this.screen = makeFrame(this.cols, this.preserveRows ? this.rows : Math.max(this.rows, this.usedRow + 1));
      this.x = 0;
      this.y = 0;
      this.usedRow = 0;
      return;
    }

    if (mode === 1) {
      for (let y = 0; y <= this.y; y += 1) {
        const start = y === this.y ? this.x : 0;
        for (let x = 0; x <= start; x += 1) {
          this.screen[y][x] = makeCell();
        }
      }
      return;
    }

    for (let y = this.y; y < this.screen.length; y += 1) {
      const start = y === this.y ? this.x : 0;
      for (let x = start; x < this.cols; x += 1) {
        this.screen[y][x] = makeCell();
      }
    }
  }

  clearLine(mode) {
    this.ensureRows(this.y);
    let start = 0;
    let end = this.cols - 1;
    if (mode === 0) {
      start = this.x;
    } else if (mode === 1) {
      end = this.x;
    }
    for (let x = start; x <= end; x += 1) {
      this.screen[this.y][x] = makeCell();
    }
  }

  hasContent() {
    return this.screen.some((row) => row.some((cell) => cell.ch !== " " || cell.bg));
  }

  visibleFrame() {
    if (this.preserveRows) {
      return cloneFrame(this.screen.slice(0, this.rows));
    }
    return trimFrame(cloneFrame(this.screen), 1);
  }

  pushFrame() {
    const frame = this.visibleFrame();
    if (frame.some((row) => row.some((cell) => cell.ch !== " " || cell.bg))) {
      this.frames.push(frame);
    }
  }
}

function parseParams(rawParams) {
  if (!rawParams) {
    return [];
  }
  const cleaned = rawParams.replace(/[?=>]/g, "");
  if (!cleaned) {
    return [];
  }
  return cleaned.split(";").map((part) => (part === "" ? 0 : Number(part)));
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
