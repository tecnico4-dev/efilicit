"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";

type PaperKind =
  | "lined"
  | "contract"
  | "form"
  | "licitacion"
  | "folder"
  | "zip";

type Paper = {
  x: number;
  y: number;
  w: number;
  h: number;
  rot: number;
  vx: number;
  vy: number;
  vr: number;
  kind: PaperKind;
  landed: boolean;
  opacity: number;
};

/** Cielo con gradiente suave (marca: primary / primary-light / navy). */
const LIGHT_BG_TOP = "#c5e8f2";
const LIGHT_BG_BOTTOM = "#7ec5db";
const DARK_BG_TOP = "#152038";
const DARK_BG_BOTTOM = "#0b1226";
const PAPER_FILL = "#ffffff";
const FOLDER_FILL = "#fff8eb";
const ZIP_FILL = "#f3f4f6";
const PAPER_STROKE_LIGHT = "#5aa8c0";
const PAPER_STROKE_DARK = "#94a3b8";
const INK_LIGHT = "#1e4a5c";
const INK_DARK = "#334155";

const MAX_PAPERS = 55;
/** Un poco más lento al spawnear; misma densidad final. */
const SPAWN_EVERY_MS = 420;
const GROUND_MARGIN = 28;

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function randomKind(): PaperKind {
  const r = Math.random();
  if (r < 0.14) return "contract";
  if (r < 0.26) return "licitacion";
  if (r < 0.4) return "form";
  if (r < 0.52) return "folder";
  if (r < 0.62) return "zip";
  return "lined";
}

function createPaper(width: number, falling: boolean): Paper {
  const kind = randomKind();
  const scale = 0.55 + Math.random() * 0.55;
  const isFolder = kind === "folder" || kind === "zip";
  const w = (isFolder ? 58 : 52) * scale;
  const h = (isFolder ? 48 : 68) * scale;
  return {
    x: Math.random() * Math.max(width - w, 1),
    y: falling ? -h - Math.random() * 80 : 0,
    w,
    h,
    rot: (Math.random() - 0.5) * 1.2,
    vx: (Math.random() - 0.5) * 0.45,
    // Ritmos distintos, pero ~30–40% más lentos que la v1.
    vy: falling ? 0.45 + Math.random() * 0.95 : 0,
    vr: (Math.random() - 0.5) * 0.028,
    kind,
    landed: !falling,
    opacity: 0.92 + Math.random() * 0.08,
  };
}

function drawSheetBody(
  ctx: CanvasRenderingContext2D,
  p: Paper,
  fill: string,
  stroke: string,
) {
  ctx.fillStyle = fill;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  ctx.roundRect(-p.w / 2, -p.h / 2, p.w, p.h, 2);
  ctx.fill();
  ctx.stroke();

  const corner = Math.min(10, p.w * 0.18);
  ctx.beginPath();
  ctx.moveTo(p.w / 2 - corner, -p.h / 2);
  ctx.lineTo(p.w / 2, -p.h / 2 + corner);
  ctx.lineTo(p.w / 2, -p.h / 2);
  ctx.closePath();
  ctx.fillStyle = "#f0f9fc";
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.stroke();
}

function drawFolderBody(
  ctx: CanvasRenderingContext2D,
  p: Paper,
  fill: string,
  stroke: string,
) {
  const hw = p.w / 2;
  const hh = p.h / 2;
  const tabW = p.w * 0.38;
  const tabH = p.h * 0.18;

  ctx.fillStyle = fill;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  ctx.moveTo(-hw, -hh + tabH);
  ctx.lineTo(-hw, hh);
  ctx.lineTo(hw, hh);
  ctx.lineTo(hw, -hh + tabH);
  ctx.lineTo(-hw + tabW, -hh + tabH);
  ctx.lineTo(-hw + tabW - 4, -hh);
  ctx.lineTo(-hw, -hh);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function drawPaper(
  ctx: CanvasRenderingContext2D,
  p: Paper,
  stroke: string,
  ink: string,
) {
  ctx.save();
  ctx.translate(p.x + p.w / 2, p.y + p.h / 2);
  ctx.rotate(p.rot);
  ctx.globalAlpha = p.opacity;

  const left = -p.w / 2 + 6;
  const right = p.w / 2 - 6;
  const top = -p.h / 2 + 8;

  if (p.kind === "folder") {
    drawFolderBody(ctx, p, FOLDER_FILL, stroke);
    ctx.fillStyle = ink;
    ctx.font = `bold ${Math.max(6, p.w * 0.14)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("EXP.", 0, p.h * 0.12);
  } else if (p.kind === "zip") {
    drawFolderBody(ctx, p, ZIP_FILL, stroke);
    // Zipper-ish marks
    ctx.strokeStyle = ink;
    ctx.lineWidth = 1;
    ctx.beginPath();
    const zipX = 0;
    for (let i = 0; i < 5; i++) {
      const y = -p.h / 2 + p.h * 0.28 + i * (p.h * 0.12);
      ctx.moveTo(zipX - 4, y);
      ctx.lineTo(zipX + 4, y);
    }
    ctx.stroke();
    ctx.fillStyle = ink;
    ctx.font = `bold ${Math.max(6, p.w * 0.15)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(".zip", 0, p.h * 0.28);
  } else {
    drawSheetBody(ctx, p, PAPER_FILL, stroke);
    ctx.strokeStyle = ink;
    ctx.fillStyle = ink;
    ctx.lineWidth = 1;

    if (p.kind === "contract") {
      ctx.font = `bold ${Math.max(7, p.w * 0.16)}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText("CONTRACT", 0, top + p.h * 0.18);
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const y = top + p.h * 0.32 + i * (p.h * 0.1);
        ctx.moveTo(left, y);
        ctx.lineTo(right - (i % 2) * 8, y);
      }
      ctx.stroke();
    } else if (p.kind === "licitacion") {
      ctx.font = `bold ${Math.max(6, p.w * 0.13)}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText("LICITACIÓN", 0, top + p.h * 0.18);
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const y = top + p.h * 0.32 + i * (p.h * 0.1);
        ctx.moveTo(left, y);
        ctx.lineTo(right - (i % 3) * 6, y);
      }
      ctx.stroke();
    } else if (p.kind === "form") {
      ctx.strokeRect(left, top, p.w * 0.28, p.h * 0.22);
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const y = top + p.h * 0.35 + i * (p.h * 0.12);
        ctx.moveTo(left, y);
        ctx.lineTo(right, y);
      }
      ctx.stroke();
    } else {
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const y = top + i * (p.h * 0.12);
        ctx.moveTo(left, y);
        ctx.lineTo(right - (i === 5 ? 12 : 0), y);
      }
      ctx.stroke();
    }
  }

  ctx.restore();
}

/**
 * Fondo a pantalla completa: hojas/carpetas que caen y se amontonan.
 * Reacciona suavemente al ratón. Solo visual (`pointer-events: none`).
 */
export function FallingPapersBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { resolvedTheme } = useTheme();
  const themeRef = useRef(resolvedTheme);

  useEffect(() => {
    themeRef.current = resolvedTheme;
  }, [resolvedTheme]);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const context = el.getContext("2d");
    if (!context) return;
    const canvas = el;
    const ctx = context;

    const reduced = prefersReducedMotion();
    const papers: Paper[] = [];
    const mouse = { x: 0, y: 0, active: false };
    let raf = 0;
    let lastSpawn = 0;
    let running = true;
    let pileHeight = GROUND_MARGIN;

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function seedStaticPile() {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const count = Math.min(40, Math.floor(w / 28));
      for (let i = 0; i < count; i++) {
        const p = createPaper(w, false);
        p.y = h - GROUND_MARGIN - p.h - Math.random() * Math.min(140, h * 0.22);
        p.x = Math.random() * (w - p.w);
        p.rot = (Math.random() - 0.5) * 1.4;
        p.landed = true;
        papers.push(p);
      }
      pileHeight = Math.min(h * 0.35, GROUND_MARGIN + 120);
    }

    function onMove(e: MouseEvent) {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      mouse.active = true;
    }

    function onLeave() {
      mouse.active = false;
    }

    function paintFrame(now: number) {
      if (!running) return;
      const w = window.innerWidth;
      const h = window.innerHeight;
      const dark = themeRef.current === "dark";
      const stroke = dark ? PAPER_STROKE_DARK : PAPER_STROKE_LIGHT;
      const ink = dark ? INK_DARK : INK_LIGHT;

      const sky = ctx.createLinearGradient(0, 0, 0, h);
      if (dark) {
        sky.addColorStop(0, DARK_BG_TOP);
        sky.addColorStop(1, DARK_BG_BOTTOM);
      } else {
        sky.addColorStop(0, LIGHT_BG_TOP);
        sky.addColorStop(1, LIGHT_BG_BOTTOM);
      }
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);

      if (!reduced) {
        if (papers.length < MAX_PAPERS && now - lastSpawn > SPAWN_EVERY_MS) {
          papers.push(createPaper(w, true));
          lastSpawn = now;
        }

        const groundY = h - pileHeight;

        for (const p of papers) {
          if (!p.landed) {
            if (mouse.active) {
              const cx = p.x + p.w / 2;
              const cy = p.y + p.h / 2;
              const dx = cx - mouse.x;
              const dy = cy - mouse.y;
              const dist = Math.hypot(dx, dy) || 1;
              if (dist < 180) {
                const force = (1 - dist / 180) * 0.28;
                p.vx += (dx / dist) * force;
                p.vy += (dy / dist) * force * 0.3;
              }
            }

            p.vy += 0.028;
            p.vx *= 0.996;
            p.x += p.vx;
            p.y += p.vy;
            p.rot += p.vr;

            if (p.x < -p.w) p.x = w;
            if (p.x > w) p.x = -p.w;

            if (p.y + p.h >= groundY) {
              p.y = groundY - p.h + Math.random() * 6;
              p.landed = true;
              p.vx = 0;
              p.vy = 0;
              p.vr = 0;
              p.rot += (Math.random() - 0.5) * 0.25;
              pileHeight = Math.min(h * 0.42, pileHeight + p.h * 0.08);
            }
          }
        }
      }

      for (const p of papers) {
        if (p.landed) drawPaper(ctx, p, stroke, ink);
      }
      for (const p of papers) {
        if (!p.landed) drawPaper(ctx, p, stroke, ink);
      }

      raf = window.requestAnimationFrame(paintFrame);
    }

    resize();
    if (reduced) {
      seedStaticPile();
    }
    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseleave", onLeave);
    raf = window.requestAnimationFrame(paintFrame);

    return () => {
      running = false;
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0"
    />
  );
}
