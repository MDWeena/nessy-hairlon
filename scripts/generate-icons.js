// One-off script: generates the PWA manifest icons (gold "N" on a dark circle, matching the
// in-app placeholder used on the About page / admin Settings) as PNGs in public/icons/.
// Run with: node scripts/generate-icons.js
import { createCanvas, registerFont } from "canvas";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

registerFont(join(__dirname, "fonts", "Tangerine-Bold.ttf"), { family: "Tangerine", weight: "bold" });

const GOLD = "#C49A6C";
const DARK_BG = "#0A0A0A";

function drawIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = DARK_BG;
  ctx.fillRect(0, 0, size, size);

  const radius = size / 2;
  ctx.beginPath();
  ctx.arc(radius, radius, radius * 0.88, 0, Math.PI * 2);
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = size * 0.02;
  ctx.stroke();

  ctx.fillStyle = GOLD;
  ctx.font = `bold ${size * 0.62}px Tangerine`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("N", radius, radius + size * 0.05);

  return canvas;
}

const outDir = join(__dirname, "..", "public", "icons");
mkdirSync(outDir, { recursive: true });

for (const size of [192, 512]) {
  const canvas = drawIcon(size);
  writeFileSync(join(outDir, `icon-${size}x${size}.png`), canvas.toBuffer("image/png"));
  console.log(`Wrote public/icons/icon-${size}x${size}.png`);
}
