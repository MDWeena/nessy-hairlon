// One-off script: generates the PWA/home-screen icons from the site's actual logo (the same
// image Navbar renders as LOGO_ICON, see src/assets/logos.ts — extracted to public/logo.png),
// centered on the dark brand background. Run with: node scripts/generate-icons.js
import { createCanvas, loadImage } from "canvas";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");

const DARK_BG = "#0A0A0A";
const PADDING_FRACTION = 0.2; // ~20% padding on each side

async function drawIcon(logo, size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = DARK_BG;
  ctx.fillRect(0, 0, size, size);

  const inner = size * (1 - PADDING_FRACTION * 2);
  const offset = (size - inner) / 2;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(logo, offset, offset, inner, inner);

  return canvas;
}

async function main() {
  const logo = await loadImage(join(repoRoot, "public", "logo.png"));

  const targets = [
    { path: join(repoRoot, "public", "icons", "icon-192x192.png"), size: 192 },
    { path: join(repoRoot, "public", "icons", "icon-512x512.png"), size: 512 },
    { path: join(repoRoot, "public", "apple-touch-icon.png"), size: 180 },
  ];

  for (const { path, size } of targets) {
    const canvas = await drawIcon(logo, size);
    writeFileSync(path, canvas.toBuffer("image/png"));
    console.log(`Wrote ${path.replace(repoRoot + "/", "")}`);
  }
}

main();
