const DEFAULT_FONT =
  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';

export function renderFrameToSvg(frame, options = {}) {
  const rows = frame.length || 1;
  const cols = Math.max(1, ...frame.map((row) => row.length));
  const cellWidth = Number(options.cellWidth ?? 10);
  const cellHeight = Number(options.cellHeight ?? 20);
  const width = cols * cellWidth;
  const height = rows * cellHeight;
  const background = options.background ?? "transparent";
  const defaultFg = options.color ?? "#d9f99d";
  const parts = [];

  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="${escapeAttr(options.preserveAspectRatio ?? "xMidYMid meet")}" role="${escapeAttr(options.role ?? "img")}" shape-rendering="crispEdges">`,
  );
  if (options.title) {
    parts.push(`<title>${escapeHtml(options.title)}</title>`);
  }
  if (background !== "transparent") {
    parts.push(`<rect width="${width}" height="${height}" fill="${escapeAttr(background)}"/>`);
  }

  for (let y = 0; y < rows; y += 1) {
    const row = frame[y] ?? [];
    for (let x = 0; x < cols; x += 1) {
      const cell = row[x] ?? { ch: " " };
      const px = x * cellWidth;
      const py = y * cellHeight;
      const fg = cell.inverse ? (cell.bg ?? defaultFg) : (cell.fg ?? defaultFg);
      const bg = cell.inverse ? cell.fg : cell.bg;
      if (bg) {
        parts.push(`<rect x="${px}" y="${py}" width="${cellWidth}" height="${cellHeight}" fill="${escapeAttr(bg)}"/>`);
      }
      if (cell.ch && cell.ch !== " ") {
        parts.push(renderGlyph(cell.ch, px, py, cellWidth, cellHeight, fg, cell.bold));
      }
    }
  }

  parts.push("</svg>");
  return parts.join("");
}

export function renderGlyph(ch, x, y, w, h, color, bold = false) {
  const fill = escapeAttr(color);
  const primitive = primitiveCellGlyph(ch, x, y, w, h, fill);
  if (primitive) {
    return primitive;
  }

  const fontWeight = bold ? "700" : "400";
  const fontSize = h * 0.86;
  const textX = x + w / 2;
  const textY = y + h / 2;
  const cellFit = isBoxDrawing(ch) ? ` textLength="${round(w)}" lengthAdjust="spacingAndGlyphs"` : "";
  return `<text x="${round(textX)}" y="${round(textY)}" fill="${fill}" font-family="${escapeAttr(DEFAULT_FONT)}" font-size="${round(fontSize)}" font-weight="${fontWeight}" text-anchor="middle" dominant-baseline="central"${cellFit}>${escapeHtml(ch)}</text>`;
}

function primitiveCellGlyph(ch, x, y, w, h, fill) {
  if (ch === "█") {
    return rect(x, y, w, h, fill);
  }
  if (ch === "▓" || ch === "▒" || ch === "░") {
    const opacity = ch === "▓" ? 0.75 : ch === "▒" ? 0.5 : 0.25;
    return rect(x, y, w, h, fill, opacity);
  }
  if (ch === "▀") {
    return rect(x, y, w, h / 2, fill);
  }
  if (ch === "▄") {
    return rect(x, y + h / 2, w, h / 2, fill);
  }
  if (ch === "▌") {
    return rect(x, y, w / 2, h, fill);
  }
  if (ch === "▐") {
    return rect(x + w / 2, y, w / 2, h, fill);
  }

  const box = boxDrawingGlyph(ch, x, y, w, h, fill);
  if (box) {
    return box;
  }

  const quadrant = quadrantBlocks[ch];
  if (quadrant) {
    return quadrant
      .map(([qx, qy]) => rect(x + qx * w / 2, y + qy * h / 2, w / 2, h / 2, fill))
      .join("");
  }
  return "";
}

const quadrantBlocks = {
  "▘": [[0, 0]],
  "▝": [[1, 0]],
  "▖": [[0, 1]],
  "▗": [[1, 1]],
  "▚": [[0, 0], [1, 1]],
  "▞": [[1, 0], [0, 1]],
  "▛": [[0, 0], [1, 0], [0, 1]],
  "▜": [[0, 0], [1, 0], [1, 1]],
  "▙": [[0, 0], [0, 1], [1, 1]],
  "▟": [[1, 0], [0, 1], [1, 1]],
};

function boxDrawingGlyph(ch, x, y, w, h, fill) {
  const thin = Math.max(1, Math.min(w, h) * 0.08);
  const singleX = w / 2;
  const singleY = h / 2;
  const doubleX1 = w * 0.38;
  const doubleX2 = w * 0.62;
  const doubleY1 = h * 0.42;
  const doubleY2 = h * 0.58;

  const hLine = (x1, x2, yy) => rect(x + x1, y + yy - thin / 2, x2 - x1, thin, fill);
  const vLine = (xx, y1, y2) => rect(x + xx - thin / 2, y + y1, thin, y2 - y1, fill);

  if (ch === "─" || ch === "━") {
    return hLine(0, w, singleY);
  }
  if (ch === "│" || ch === "┃") {
    return vLine(singleX, 0, h);
  }
  if (ch === "┌") {
    return hLine(singleX, w, singleY) + vLine(singleX, singleY, h);
  }
  if (ch === "┐") {
    return hLine(0, singleX, singleY) + vLine(singleX, singleY, h);
  }
  if (ch === "└") {
    return hLine(singleX, w, singleY) + vLine(singleX, 0, singleY);
  }
  if (ch === "┘") {
    return hLine(0, singleX, singleY) + vLine(singleX, 0, singleY);
  }
  if (ch === "═") {
    return hLine(0, w, doubleY1) + hLine(0, w, doubleY2);
  }
  if (ch === "║") {
    return vLine(doubleX1, 0, h) + vLine(doubleX2, 0, h);
  }
  if (ch === "╔") {
    return (
      hLine(doubleX1, w, doubleY1) +
      hLine(doubleX2, w, doubleY2) +
      vLine(doubleX1, doubleY1, h) +
      vLine(doubleX2, doubleY2, h)
    );
  }
  if (ch === "╗") {
    return (
      hLine(0, doubleX2, doubleY1) +
      hLine(0, doubleX1, doubleY2) +
      vLine(doubleX1, doubleY2, h) +
      vLine(doubleX2, doubleY1, h)
    );
  }
  if (ch === "╚") {
    return (
      vLine(doubleX1, 0, doubleY2) +
      vLine(doubleX2, 0, doubleY1) +
      hLine(doubleX1, w, doubleY2) +
      hLine(doubleX2, w, doubleY1)
    );
  }
  if (ch === "╝") {
    return (
      vLine(doubleX1, 0, doubleY1) +
      vLine(doubleX2, 0, doubleY2) +
      hLine(0, doubleX1, doubleY1) +
      hLine(0, doubleX2, doubleY2)
    );
  }
  return "";
}

function isBoxDrawing(ch) {
  const code = ch.codePointAt(0);
  return code >= 0x2500 && code <= 0x257f;
}

function rect(x, y, w, h, fill, opacity = null) {
  const opacityAttr = opacity === null ? "" : ` opacity="${opacity}"`;
  return `<rect x="${round(x)}" y="${round(y)}" width="${round(w)}" height="${round(h)}" fill="${fill}"${opacityAttr}/>`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll('"', "&quot;");
}

function round(value) {
  return Number(value.toFixed(3));
}
