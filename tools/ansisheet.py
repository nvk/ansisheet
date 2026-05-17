#!/usr/bin/env python3
"""Small no-dependency ANSI-to-SVG helper for ansisheet demos and tests."""

from __future__ import annotations

import argparse
import html
import re
import sys
from dataclasses import dataclass, replace

ANSI_16 = [
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
]
CSI_FINAL = re.compile(r"[\x40-\x7e]")


@dataclass
class Cell:
    ch: str = " "
    fg: str | None = None
    bg: str | None = None
    bold: bool = False
    inverse: bool = False


def parse_ansi(source: str, cols: int | None = None, rows: int | None = None) -> dict:
    source = source.replace("\r\n", "\n").replace("\r", "\n")
    if "\x1b" not in source:
        lines = source.split("\n")
        width = cols or max(1, *(len(line) for line in lines))
        frame = make_frame(width, max(1, len(lines)))
        for y, line in enumerate(lines):
            for x, ch in enumerate(line[:width]):
                frame[y][x] = Cell(ch)
        return {"cols": width, "rows": len(frame), "frames": [frame], "frame": frame}

    parser = AnsiParser(cols or 80, rows or 25, preserve_rows=rows is not None)
    return parser.parse(source)


class AnsiParser:
    def __init__(self, cols: int, rows: int, preserve_rows: bool = False) -> None:
        self.cols = cols
        self.rows = rows
        self.preserve_rows = preserve_rows
        self.screen = make_frame(cols, rows)
        self.frames: list[list[list[Cell]]] = []
        self.x = 0
        self.y = 0
        self.used_row = 0
        self.style = Cell()

    def parse(self, source: str) -> dict:
        i = 0
        while i < len(source):
            ch = source[i]
            if ch == "\x1b":
                i = self.consume_escape(source, i)
            else:
                self.write(ch)
            i += 1
        self.push_frame()
        frames = self.frames or [self.visible_frame()]
        return {"cols": self.cols, "rows": len(frames[-1]), "frames": frames, "frame": frames[-1]}

    def consume_escape(self, source: str, start: int) -> int:
        if start + 1 >= len(source) or source[start + 1] != "[":
            return start
        end = start + 2
        while end < len(source) and not CSI_FINAL.match(source[end]):
            end += 1
        if end >= len(source):
            return start
        params = parse_params(source[start + 2 : end])
        final = source[end]
        self.apply_csi(params or [0], final)
        return end

    def apply_csi(self, params: list[int], final: str) -> None:
        if final == "m":
            self.apply_sgr(params)
        elif final in {"H", "f"}:
            self.y = clamp((params[0] or 1) - 1, 0, 999)
            self.x = clamp((params[1] if len(params) > 1 else 1) - 1, 0, self.cols - 1)
            self.ensure_rows(self.y)
        elif final == "J" and params[0] in {2, 3}:
            if self.has_content():
                self.push_frame()
            self.screen = make_frame(self.cols, self.rows)
            self.x = 0
            self.y = 0
            self.used_row = 0
        elif final == "K":
            self.ensure_rows(self.y)
            start = self.x if params[0] == 0 else 0
            end = self.x if params[0] == 1 else self.cols - 1
            for x in range(start, end + 1):
                self.screen[self.y][x] = Cell()

    def apply_sgr(self, params: list[int]) -> None:
        i = 0
        while i < len(params):
            code = params[i]
            if code == 0:
                self.style = Cell()
            elif code == 1:
                self.style.bold = True
            elif code == 22:
                self.style.bold = False
            elif code == 7:
                self.style.inverse = True
            elif code == 27:
                self.style.inverse = False
            elif code == 39:
                self.style.fg = None
            elif code == 49:
                self.style.bg = None
            elif 30 <= code <= 37 or 90 <= code <= 97:
                self.style.fg = ansi_color(code, self.style.bold)
            elif 40 <= code <= 47 or 100 <= code <= 107:
                self.style.bg = ansi_color(code, False)
            i += 1

    def write(self, ch: str) -> None:
        if ch == "\n":
            self.x = 0
            self.y += 1
            self.ensure_rows(self.y)
            return
        if ch < " ":
            return
        self.ensure_rows(self.y)
        self.screen[self.y][self.x] = replace(self.style, ch=ch)
        self.used_row = max(self.used_row, self.y)
        self.x += 1
        if self.x >= self.cols:
            self.x = 0
            self.y += 1
            self.ensure_rows(self.y)

    def ensure_rows(self, row: int) -> None:
        while row >= len(self.screen):
            self.screen.append([Cell() for _ in range(self.cols)])

    def has_content(self) -> bool:
        return any(cell.ch != " " or cell.bg for row in self.screen for cell in row)

    def visible_frame(self) -> list[list[Cell]]:
        if self.preserve_rows:
            return [row[:] for row in self.screen[: self.rows]]
        end = self.used_row + 1
        return [row[:] for row in self.screen[: max(1, end)]]

    def push_frame(self) -> None:
        frame = self.visible_frame()
        if any(cell.ch != " " or cell.bg for row in frame for cell in row):
            self.frames.append(frame)


def render_svg(frame: list[list[Cell]], cell_w: int = 10, cell_h: int = 20) -> str:
    rows = len(frame)
    cols = max(len(row) for row in frame)
    width = cols * cell_w
    height = rows * cell_h
    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" '
        'preserveAspectRatio="xMidYMid meet" role="img">'
    ]
    for y, row in enumerate(frame):
        for x, cell in enumerate(row):
            if cell.bg:
                parts.append(rect(x * cell_w, y * cell_h, cell_w, cell_h, cell.bg))
            if cell.ch != " ":
                parts.append(glyph(cell.ch, x * cell_w, y * cell_h, cell_w, cell_h, cell.fg or "#d9f99d"))
    parts.append("</svg>")
    return "".join(parts)


def glyph(ch: str, x: int, y: int, w: int, h: int, fill: str) -> str:
    if ch == "█":
        return rect(x, y, w, h, fill)
    return (
        f'<text x="{x + w / 2:g}" y="{y + h * 0.78:g}" fill="{html.escape(fill)}" '
        'font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" '
        f'font-size="{h * 0.82:g}" text-anchor="middle">{html.escape(ch)}</text>'
    )


def rect(x: float, y: float, w: float, h: float, fill: str) -> str:
    return f'<rect x="{x:g}" y="{y:g}" width="{w:g}" height="{h:g}" fill="{html.escape(fill)}"/>'


def make_frame(cols: int, rows: int) -> list[list[Cell]]:
    return [[Cell() for _ in range(cols)] for _ in range(rows)]


def ansi_color(code: int, bold: bool) -> str:
    if 30 <= code <= 37:
        return ANSI_16[(8 if bold else 0) + code - 30]
    if 90 <= code <= 97:
        return ANSI_16[8 + code - 90]
    if 40 <= code <= 47:
        return ANSI_16[code - 40]
    return ANSI_16[8 + code - 100]


def parse_params(raw: str) -> list[int]:
    clean = re.sub(r"[?=>]", "", raw)
    return [int(part or "0") for part in clean.split(";") if part or clean]


def clamp(value: int, low: int, high: int) -> int:
    return min(high, max(low, value))


def main() -> int:
    ap = argparse.ArgumentParser(description="Render plain ANSI text as responsive SVG.")
    ap.add_argument("path", nargs="?", help="Input file, defaults to stdin.")
    ap.add_argument("--cols", type=int, default=None)
    ap.add_argument("--rows", type=int, default=None)
    args = ap.parse_args()
    data = open(args.path, encoding="utf-8").read() if args.path else sys.stdin.read()
    parsed = parse_ansi(data, cols=args.cols, rows=args.rows)
    print(render_svg(parsed["frame"]))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
