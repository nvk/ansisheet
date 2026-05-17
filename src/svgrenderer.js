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
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="${escapeAttr(options.preserveAspectRatio ?? "xMidYMid meet")}" role="${escapeAttr(options.role ?? "img")}">`,
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
  const primitive = primitiveBlockGlyph(ch, x, y, w, h, fill);
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

function primitiveBlockGlyph(ch, x, y, w, h, fill) {
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
