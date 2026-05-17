export const ANSI_16 = [
  "#000000",
  "#aa0000",
  "#00aa00",
  "#aa5500",
  "#0000aa",
  "#aa00aa",
  "#00aaaa",
  "#aaaaaa",
  "#555555",
  "#ff5555",
  "#55ff55",
  "#ffff55",
  "#5555ff",
  "#ff55ff",
  "#55ffff",
  "#ffffff",
];

export function colorFromAnsiCode(code, bold = false) {
  if (code >= 30 && code <= 37) {
    return ANSI_16[(bold ? 8 : 0) + code - 30];
  }
  if (code >= 90 && code <= 97) {
    return ANSI_16[8 + code - 90];
  }
  if (code >= 40 && code <= 47) {
    return ANSI_16[code - 40];
  }
  if (code >= 100 && code <= 107) {
    return ANSI_16[8 + code - 100];
  }
  return null;
}

export function colorFromAnsi256(index) {
  const value = clamp(Number(index), 0, 255);
  if (value < 16) {
    return ANSI_16[value];
  }
  if (value >= 232) {
    const level = 8 + (value - 232) * 10;
    return rgbToHex(level, level, level);
  }

  const cube = value - 16;
  const r = Math.floor(cube / 36);
  const g = Math.floor((cube % 36) / 6);
  const b = cube % 6;
  return rgbToHex(colorCubeLevel(r), colorCubeLevel(g), colorCubeLevel(b));
}

export function rgbToHex(r, g, b) {
  return `#${hexByte(r)}${hexByte(g)}${hexByte(b)}`;
}

function colorCubeLevel(value) {
  return value === 0 ? 0 : 55 + value * 40;
}

function hexByte(value) {
  return clamp(Number(value), 0, 255).toString(16).padStart(2, "0");
}

function clamp(value, min, max) {
  if (Number.isNaN(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, value));
}
