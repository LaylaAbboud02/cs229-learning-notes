/**
 * Generates `public/og-image.png` — the social-sharing card.
 *
 * Run once and commit the PNG: `node scripts/make-og-image.mjs`.
 * Original, on-brand (warm ivory, ink-navy, muted teal, restrained coral),
 * no design-reference image is copied in, no external assets.
 *
 * Uses `@napi-rs/canvas` (already a dependency) so there is nothing extra to
 * install and the text renders deterministically with system serif/sans fonts.
 */

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createCanvas } from '@napi-rs/canvas';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'og-image.png');

const W = 1200;
const H = 630;

// Brand tokens (mirrors src/styles/global.css).
const PAPER = '#f7f3ea';
const INK = '#12294a';
const INK_SOFT = '#33445f';
const MUTED = '#5b6472';
const TEAL = '#0b6d70';
const CORAL = '#e46f61';
const BORDER = '#d9d3c8';

const canvas = createCanvas(W, H);
const ctx = canvas.getContext('2d');

// Ground.
ctx.fillStyle = PAPER;
ctx.fillRect(0, 0, W, H);

// Subtle paper grid.
ctx.strokeStyle = 'rgba(18,41,74,0.05)';
ctx.lineWidth = 1;
for (let x = 40; x < W; x += 40) {
  ctx.beginPath();
  ctx.moveTo(x + 0.5, 0);
  ctx.lineTo(x + 0.5, H);
  ctx.stroke();
}
for (let y = 40; y < H; y += 40) {
  ctx.beginPath();
  ctx.moveTo(0, y + 0.5);
  ctx.lineTo(W, y + 0.5);
  ctx.stroke();
}

// Inner keyline.
ctx.strokeStyle = BORDER;
ctx.lineWidth = 2;
ctx.strokeRect(40, 40, W - 80, H - 80);

const PAD = 96;

// Kicker.
ctx.fillStyle = MUTED;
ctx.font = '600 24px "Helvetica Neue", Arial, sans-serif';
ctx.textBaseline = 'alphabetic';
ctx.fillText('UNOFFICIAL LEARNING NOTES', PAD, 150);

// Title.
ctx.fillStyle = INK;
ctx.font =
  '700 108px "Iowan Old Style", Palatino, "Palatino Linotype", Georgia, "Times New Roman", serif';
ctx.fillText('CS229', PAD, 290);
ctx.fillText('Learning Notes', PAD, 410);

// Hand-drawn teal underline beneath the title.
ctx.strokeStyle = TEAL;
ctx.lineWidth = 6;
ctx.lineCap = 'round';
ctx.beginPath();
ctx.moveTo(PAD, 452);
ctx.bezierCurveTo(PAD + 210, 442, PAD + 430, 464, PAD + 620, 450);
ctx.stroke();

// Tagline.
ctx.fillStyle = INK_SOFT;
ctx.font = '400 34px "Iowan Old Style", Palatino, Georgia, serif';
ctx.fillText('Machine learning, worked through by hand.', PAD, 520);

// Disclaimer footer.
ctx.fillStyle = MUTED;
ctx.font = '400 22px "Helvetica Neue", Arial, sans-serif';
ctx.fillText('Not affiliated with or endorsed by Stanford University.', PAD, H - 72);

// Small coral annotation mark, top-right.
ctx.strokeStyle = CORAL;
ctx.lineWidth = 5;
const cx = W - 150;
const cy = 150;
for (const [dx1, dy1, dx2, dy2] of [
  [-22, 0, 22, 0],
  [0, -22, 0, 22],
  [-15, -15, 15, 15],
  [-15, 15, 15, -15],
]) {
  ctx.beginPath();
  ctx.moveTo(cx + dx1, cy + dy1);
  ctx.lineTo(cx + dx2, cy + dy2);
  ctx.stroke();
}

writeFileSync(OUT, canvas.toBuffer('image/png'));
console.log(`wrote ${OUT} (${W}x${H})`);
