export function makeCell(ch = " ", style = {}) {
  return {
    ch,
    fg: style.fg ?? null,
    bg: style.bg ?? null,
    bold: Boolean(style.bold),
    inverse: Boolean(style.inverse),
  };
}

export function makeFrame(cols, rows, style = {}) {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => makeCell(" ", style)),
  );
}

export function cloneCell(cell) {
  return {
    ch: cell.ch,
    fg: cell.fg ?? null,
    bg: cell.bg ?? null,
    bold: Boolean(cell.bold),
    inverse: Boolean(cell.inverse),
  };
}

export function cloneFrame(frame) {
  return frame.map((row) => row.map(cloneCell));
}

export function trimFrame(frame, minRows = 1) {
  let lastUsedRow = frame.length - 1;
  while (lastUsedRow >= minRows) {
    if (frame[lastUsedRow].some((cell) => cell.ch !== " " || cell.bg)) {
      break;
    }
    lastUsedRow -= 1;
  }
  return frame.slice(0, Math.max(minRows, lastUsedRow + 1));
}

export function textToFrame(text, options = {}) {
  const lines = normalizeNewlines(text).split("\n");
  const rows = Math.max(1, lines.length);
  const cols = Math.max(1, options.cols ?? Math.max(...lines.map((line) => [...line].length), 1));
  const frame = makeFrame(cols, rows, options.style ?? {});

  lines.forEach((line, y) => {
    [...line].slice(0, cols).forEach((ch, x) => {
      frame[y][x] = makeCell(ch, options.style ?? {});
    });
  });

  return { cols, rows, frames: [frame], frame };
}

export function normalizeNewlines(value) {
  return String(value ?? "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}
