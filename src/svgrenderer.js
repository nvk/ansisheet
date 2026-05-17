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
  const primitive = primitiveGlyph(ch, x, y, w, h, fill);
  if (primitive) {
    return primitive;
  }

  const fontWeight = bold ? "700" : "400";
  const fontSize = h * 0.82;
  const textX = x + w / 2;
  const textY = y + h * 0.78;
  return `<text x="${round(textX)}" y="${round(textY)}" fill="${fill}" font-family="${escapeAttr(DEFAULT_FONT)}" font-size="${round(fontSize)}" font-weight="${fontWeight}" text-anchor="middle">${escapeHtml(ch)}</text>`;
}

function primitiveGlyph(ch, x, y, w, h, fill) {
  const thin = Math.max(1, w * 0.12);
  const thick = Math.max(1, w * 0.2);
  const cx = x + w / 2;
  const cy = y + h / 2;
  const top = y + h * 0.32;
  const bottom = y + h * 0.58;
  const left = x + w * 0.32;
  const right = x + w * 0.58;

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
  if (ch === "─" || ch === "━") {
    return rect(x, cy - thin / 2, w, thin, fill);
  }
  if (ch === "│" || ch === "┃") {
    return rect(cx - thin / 2, y, thin, h, fill);
  }
  if (ch === "═") {
    return rect(x, top, w, thick, fill) + rect(x, bottom, w, thick, fill);
  }
  if (ch === "║") {
    return rect(left, y, thick, h, fill) + rect(right, y, thick, h, fill);
  }
  if (ch === "┌") {
    return rect(cx - thin / 2, cy, thin, h / 2, fill) + rect(cx, cy - thin / 2, w / 2, thin, fill);
  }
  if (ch === "┐") {
    return rect(cx - thin / 2, cy, thin, h / 2, fill) + rect(x, cy - thin / 2, w / 2, thin, fill);
  }
  if (ch === "└") {
    return rect(cx - thin / 2, y, thin, h / 2, fill) + rect(cx, cy - thin / 2, w / 2, thin, fill);
  }
  if (ch === "┘") {
    return rect(cx - thin / 2, y, thin, h / 2, fill) + rect(x, cy - thin / 2, w / 2, thin, fill);
  }
  if (ch === "╔") {
    return rect(right, bottom, thick, h - (bottom - y), fill) + rect(right, bottom, w - (right - x), thick, fill);
  }
  if (ch === "╗") {
    return rect(left, bottom, thick, h - (bottom - y), fill) + rect(x, bottom, left - x + thick, thick, fill);
  }
  if (ch === "╚") {
    return rect(right, y, thick, top - y + thick, fill) + rect(right, top, w - (right - x), thick, fill);
  }
  if (ch === "╝") {
    return rect(left, y, thick, top - y + thick, fill) + rect(x, top, left - x + thick, thick, fill);
  }
  return "";
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
