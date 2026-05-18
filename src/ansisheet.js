import { parseAnsi } from "./ansiparser.js";
import { renderFrameToSvg } from "./svgrenderer.js";

export { parseAnsi } from "./ansiparser.js";
export { renderFrameToSvg } from "./svgrenderer.js";

const controllers = new WeakMap();

const SHEET_STYLE = `
  ansisheet {
    display: block;
    container-type: inline-size;
    color: #d9f99d;
    --ansisheet-bg: #050807;
    --ansisheet-radius: 8px;
    --ansisheet-padding: 0;
  }

  ansisheet .ansisheet-wrap {
    display: block;
    inline-size: 100%;
    overflow: hidden;
    border-radius: var(--ansisheet-radius);
    background: var(--ansisheet-bg);
    padding: var(--ansisheet-padding);
    box-sizing: border-box;
  }

  ansisheet .ansisheet-frame,
  ansisheet svg {
    display: block;
    inline-size: 100%;
    block-size: auto;
  }

  ansisheet .ansisheet-error {
    color: #ff9d9d;
    font: 13px/1.4 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
    padding: 12px;
  }

  ansisheet .ansisheet-empty {
    color: #6f7d76;
    font: 13px/1.4 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
    padding: 12px;
  }
`;

export class Ansisheet {
  constructor(element) {
    this.element = element;
    this.frames = [];
    this.frameIndex = 0;
    this.playing = false;
    this.frameTimer = 0;
    this.lastTick = 0;
    this.loadQueued = false;
    this.rendering = false;
    this.initialText = normalizeInlineText(element.textContent);
    this.inlineText = null;
  }

  queueLoad(readDom = false) {
    if (readDom) {
      this.initialText = normalizeInlineText(this.element.textContent);
      this.inlineText = null;
    }
    if (this.loadQueued) {
      return;
    }
    this.loadQueued = true;
    queueMicrotask(() => {
      this.loadQueued = false;
      this.load();
    });
  }

  setText(text) {
    this.inlineText = String(text ?? "");
    this.queueLoad(false);
  }

  async load() {
    try {
      const source = await this.sourceText();
      if (!source.trim()) {
        this.stop();
        this.frames = [];
        this.frameIndex = 0;
        this.renderEmpty();
        return;
      }
      const parsed = parseAnsi(source, this.parseOptions());
      this.frames = parsed.frames;
      this.frameIndex = this.frames.length - 1;
      this.renderFrame();
      if (this.element.hasAttribute("autoplay") && this.frames.length > 1 && !prefersReducedMotion()) {
        this.play();
      }
    } catch (error) {
      this.renderError(error);
    }
  }

  async sourceText() {
    if (this.inlineText !== null) {
      return this.inlineText;
    }

    const textAttr = this.element.getAttribute("text");
    if (textAttr !== null) {
      return textAttr;
    }

    const src = this.element.getAttribute("src");
    if (src) {
      const response = await fetch(src);
      if (!response.ok) {
        throw new Error(`Failed to load ${src}: HTTP ${response.status}`);
      }
      return response.text();
    }

    return this.initialText;
  }

  parseOptions() {
    const options = {};
    const cols = numberAttr(this.element, "cols");
    const rows = numberAttr(this.element, "rows");
    if (cols) {
      options.cols = cols;
    }
    if (rows) {
      options.rows = rows;
      options.preserveRows = true;
    }
    return options;
  }

  renderEmpty() {
    this.writeHtml('<div class="ansisheet-wrap"><div class="ansisheet-empty">No ansisheet loaded.</div></div>');
  }

  renderFrame() {
    const frame = this.frames[this.frameIndex] ?? [[{ ch: " " }]];
    const cellWidth = numberAttr(this.element, "cellwidth") || numberAttr(this.element, "cell-width") || 10;
    const cellHeight = numberAttr(this.element, "cellheight") || numberAttr(this.element, "cell-height") || 20;
    const svg = renderFrameToSvg(frame, {
      cellWidth,
      cellHeight,
      background: "transparent",
      color: this.element.getAttribute("color") ?? undefined,
      title: this.element.getAttribute("title") ?? undefined,
    });
    this.writeHtml(`<div class="ansisheet-wrap"><div class="ansisheet-frame">${svg}</div></div>`);
  }

  renderError(error) {
    this.stop();
    this.writeHtml(
      `<div class="ansisheet-wrap"><div class="ansisheet-error">${escapeHtml(error.message ?? error)}</div></div>`,
    );
  }

  writeHtml(html) {
    this.rendering = true;
    this.element.innerHTML = html;
    setTimeout(() => {
      this.rendering = false;
    }, 0);
  }

  play() {
    if (this.playing || this.frames.length <= 1) {
      return;
    }
    this.playing = true;
    this.frameIndex = 0;
    this.lastTick = performance.now();
    const tick = (now) => {
      if (!this.playing) {
        return;
      }
      const interval = 1000 / (numberAttr(this.element, "fps") || 12);
      if (now - this.lastTick >= interval) {
        this.frameIndex = (this.frameIndex + 1) % this.frames.length;
        this.renderFrame();
        this.lastTick = now;
      }
      this.frameTimer = requestAnimationFrame(tick);
    };
    this.renderFrame();
    this.frameTimer = requestAnimationFrame(tick);
  }

  stop() {
    this.playing = false;
    if (this.frameTimer) {
      cancelAnimationFrame(this.frameTimer);
      this.frameTimer = 0;
    }
  }
}

export function upgradeAnsisheet(element) {
  if (!element || element.localName !== "ansisheet") {
    return null;
  }
  let controller = controllers.get(element);
  if (!controller) {
    controller = new Ansisheet(element);
    controllers.set(element, controller);
  }
  controller.queueLoad();
  return controller;
}

export function upgradeAnsisheets(root = document) {
  injectStyle(root);
  const elements = [];
  if (root.localName === "ansisheet") {
    elements.push(root);
  }
  if (typeof root.querySelectorAll === "function") {
    elements.push(...root.querySelectorAll("ansisheet"));
  }
  return elements.map(upgradeAnsisheet).filter(Boolean);
}

function observeAnsisheets() {
  if (typeof MutationObserver === "undefined" || !document.documentElement) {
    return;
  }
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      const element = findAnsisheet(mutation.target);
      if (element) {
        const controller = controllers.get(element);
        if (controller && mutation.type === "attributes") {
          controller.queueLoad(false);
        } else if (controller && !controller.rendering) {
          controller.queueLoad(mutation.type === "childList" || mutation.type === "characterData");
        }
      }
      for (const node of mutation.addedNodes || []) {
        if (node.nodeType === 1) {
          upgradeAnsisheets(node);
        }
      }
    }
  });
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["src", "text", "cols", "rows", "cellwidth", "cellheight", "color", "autoplay", "fps", "title"],
    childList: true,
    characterData: true,
    subtree: true,
  });
}

function injectStyle(root = document) {
  const doc = root.ownerDocument ?? root;
  if (!doc.head || doc.getElementById("ansisheet-style")) {
    return;
  }
  const style = doc.createElement("style");
  style.id = "ansisheet-style";
  style.textContent = SHEET_STYLE;
  doc.head.appendChild(style);
}

function findAnsisheet(target) {
  if (target.nodeType === 1 && target.localName === "ansisheet") {
    return target;
  }
  if (target.parentElement) {
    return target.parentElement.closest("ansisheet");
  }
  return null;
}

function numberAttr(element, name) {
  const value = element.getAttribute(name);
  if (value === null || value === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeInlineText(text) {
  // Spaces inside terminal art are cells. Only remove wrapper whitespace from HTML formatting.
  const lines = String(text ?? "").replaceAll("\r\n", "\n").replaceAll("\r", "\n").split("\n");
  while (lines.length && lines[0].trim() === "") {
    lines.shift();
  }
  while (lines.length && lines[lines.length - 1].trim() === "") {
    lines.pop();
  }

  const indents = lines
    .filter((line) => line.trim() !== "")
    .map((line) => line.match(/^[ \t]*/)[0].length);
  const commonIndent = indents.length ? Math.min(...indents) : 0;
  return lines.map((line) => line.slice(commonIndent)).join("\n");
}

function prefersReducedMotion() {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      upgradeAnsisheets(document);
      observeAnsisheets();
    });
  } else {
    upgradeAnsisheets(document);
    observeAnsisheets();
  }
}
