/**
 * Derives every icon and share image from the source logo.
 *
 * This is a MAINTENANCE script, not a build step — run `npm run assets` when
 * the branding changes and commit the output. Generating at build time would
 * make the share card depend on whichever fonts the CI runner happens to have,
 * which is a different set from a local Windows machine, so the image would
 * silently differ between environments.
 *
 * Only dependency is sharp, which Astro already installs.
 */

import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ASSETS = path.join(root, 'src', 'assets');
const PUBLIC = path.join(root, 'public');
const DOCS = path.join(root, 'docs');

const BADGE = path.join(ASSETS, 'logo-badge.png'); // original, white rim intact
const DISC = path.join(ASSETS, 'logo-disc.png'); // generated, rim cropped away

/**
 * Which mark feeds every derivative. Flip to DISC to drop the white rim.
 *
 * The badge's peach only fills 77.5% of its frame, so anywhere the mark sits on
 * a larger canvas it is scaled up to keep the peach the same size — otherwise
 * switching would shrink the squid at the same time as adding the rim, and you
 * could not tell which change you were reacting to.
 */
const MARK = BADGE;
const USING_BADGE = MARK === BADGE;

const INK = '#08080a';
const PAPER = '#f4f2ed';
const ACCENT = '#f8ac92';
const MUTED = '#a8a6a0';

/**
 * The source art is the squid on a white ground, die-cut into a circle — so the
 * white is leftover background, not a designed ring. Find where it gives way to
 * the peach disc.
 *
 * Detects against *white* rather than against peach. Testing for peach looks
 * like the obvious approach but is unreliable: the squid's tentacles cross the
 * disc boundary in places, so "first peach pixel" finds the tentacle's inner
 * edge instead of the disc's, under-reporting the radius and throwing the
 * centre off. The leftover background is a flat #ffffff, which nothing inside
 * the disc matches, so marching inward until white ends is unambiguous.
 *
 * Measured rather than hardcoded so a re-export at a different size or margin
 * doesn't silently produce a mis-cropped mark.
 */
async function findDisc() {
  const { data, info } = await sharp(BADGE).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;
  const at = (x, y) => {
    const i = (y * W + x) * C;
    return { r: data[i], g: data[i + 1], b: data[i + 2], a: data[i + 3] };
  };

  const isWhite = (p) => p.a > 200 && p.r > 245 && p.g > 245 && p.b > 245;
  const isClear = (p) => p.a < 40;

  const cx = Math.floor(W / 2);
  const cy = Math.floor(H / 2);

  // Walk inward from each edge; the first non-white, non-transparent pixel
  // after seeing white is the disc boundary.
  const march = (fromX, fromY, dx, dy) => {
    let x = fromX;
    let y = fromY;
    let sawWhite = false;

    while (x >= 0 && y >= 0 && x < W && y < H) {
      const p = at(x, y);
      if (isWhite(p)) sawWhite = true;
      else if (!isClear(p) && sawWhite) return Math.round(Math.hypot(x - cx, y - cy));
      x += dx;
      y += dy;
    }
    return null;
  };

  const radii = [
    march(0, cy, 1, 0),
    march(W - 1, cy, -1, 0),
    march(cx, 0, 0, 1),
    march(cx, H - 1, 0, -1),
  ].filter((r) => r !== null);

  if (radii.length < 4) {
    throw new Error(
      `Could not find the disc boundary from all four edges of ${path.basename(BADGE)} ` +
        `(got ${radii.length}/4). Has the artwork changed?`,
    );
  }

  // The four readings should agree within a pixel or two. Take the smallest so
  // a stray white hairline never survives into the mark.
  const radius = Math.min(...radii);
  const spread = Math.max(...radii) - radius;

  if (spread > 4) {
    console.warn(
      `  ! disc radius readings disagree by ${spread}px (${radii.join(', ')}) — ` +
        `the artwork may not be concentric with its canvas.`,
    );
  }

  const diameter = radius * 2;
  return {
    left: cx - radius,
    top: cy - radius,
    diameter,
    margin: cx - radius,
  };
}

/**
 * Crops to the disc and clears everything outside the circle.
 *
 * The mask is required: the disc is inscribed in the square, so a plain extract
 * would leave four white corner fragments behind.
 */
async function buildDisc() {
  const { left, top, diameter, margin } = await findDisc();

  const mask = Buffer.from(
    `<svg width="${diameter}" height="${diameter}">
       <circle cx="${diameter / 2}" cy="${diameter / 2}" r="${diameter / 2}" fill="#fff"/>
     </svg>`,
  );

  await sharp(BADGE)
    .extract({ left, top, width: diameter, height: diameter })
    .composite([{ input: mask, blend: 'dest-in' }])
    .png({ compressionLevel: 9 })
    .toFile(DISC);

  console.log(`  disc      ${diameter}×${diameter} (cropped ${margin}px of white per side)`);
  return diameter;
}

/**
 * Icons are flat illustration, not photographs, so an 8-bit palette costs
 * nothing visible and cuts file size by roughly 6×. Without it a 512px icon
 * lands at ~260 KB, which is absurd for a favicon.
 */
const ICON_PNG = { compressionLevel: 9, palette: true, quality: 90, effort: 10 };

/**
 * Transparent icon — adapts to light and dark browser tab bars.
 *
 * This is the one surface the badge cannot be compensated on: the canvas *is*
 * the mark, so with the rim in play the peach necessarily drops to 77.5%.
 */
async function icon(size, out) {
  await sharp(MARK)
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png(ICON_PNG)
    .toFile(path.join(PUBLIC, out));
}

/**
 * Opaque icon on the site's ink ground. iOS and Android composite transparent
 * icons unpredictably (often onto white, which would strand the disc in a pale
 * box), so these are flattened deliberately.
 */
async function solidIcon(size, out, padding = USING_BADGE ? 0 : 0.1) {
  // The badge carries its own inset in the white rim, so padding it again would
  // stack two rings — and dropping to zero happens to restore the peach to
  // almost exactly the size it had as a padded disc.
  const inner = Math.round(size * (1 - padding * 2));
  const disc = await sharp(MARK).resize(inner, inner).png().toBuffer();

  await sharp({
    create: { width: size, height: size, channels: 4, background: INK },
  })
    .composite([{ input: disc, gravity: 'center' }])
    .png(ICON_PNG)
    .toFile(path.join(PUBLIC, out));
}

/**
 * Minimal ICO container wrapping a single 32px PNG.
 *
 * sharp cannot write ICO, but the format permits embedded PNG data, so this is
 * a 6-byte header plus one 16-byte directory entry — cheaper than taking on a
 * dependency, and it stops legacy /favicon.ico requests 404ing.
 */
async function buildIco() {
  const size = 32;
  const png = await sharp(MARK).resize(size, size).png(ICON_PNG).toBuffer();

  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: 1 = icon
  header.writeUInt16LE(1, 4); // image count

  const entry = Buffer.alloc(16);
  entry.writeUInt8(size, 0); // width
  entry.writeUInt8(size, 1); // height
  entry.writeUInt8(0, 2); // palette size (0 = no palette)
  entry.writeUInt8(0, 3); // reserved
  entry.writeUInt16LE(1, 4); // colour planes
  entry.writeUInt16LE(32, 6); // bits per pixel
  entry.writeUInt32LE(png.length, 8); // payload size
  entry.writeUInt32LE(header.length + entry.length, 12); // payload offset

  await writeFile(path.join(PUBLIC, 'favicon.ico'), Buffer.concat([header, entry, png]));
}

/**
 * 1200×630 share card.
 *
 * Text is rendered through SVG, so it uses fonts available to the local
 * renderer — Fontsource ships woff2 only, which SVG cannot load, so the site's
 * Bricolage Grotesque is not reachable here. The stack below falls back through
 * the usual system sans faces. Since this PNG is committed rather than built in
 * CI, it can simply be overwritten with a hand-designed version.
 */
async function buildOgCard() {
  const W = 1200;
  const H = 630;
  // Scaled up for the badge so the peach lands the same size as the bare disc
  // did — the rim is added around it rather than eating into it.
  const discSize = USING_BADGE ? 440 : 340;

  const stack = "'Segoe UI', 'Helvetica Neue', Arial, sans-serif";

  const svg = Buffer.from(`
    <svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="warm" cx="28%" cy="42%" r="55%">
          <stop offset="0%" stop-color="${ACCENT}" stop-opacity="0.16"/>
          <stop offset="100%" stop-color="${ACCENT}" stop-opacity="0"/>
        </radialGradient>
      </defs>

      <rect width="${W}" height="${H}" fill="${INK}"/>
      <rect width="${W}" height="${H}" fill="url(#warm)"/>

      <text x="560" y="252" font-family="${stack}" font-size="72" font-weight="700"
            fill="${PAPER}" letter-spacing="-2">Thales Medeiros</text>

      <text x="560" y="318" font-family="${stack}" font-size="34" font-weight="400"
            fill="${MUTED}">Product design → software</text>

      <rect x="560" y="360" width="72" height="3" fill="${ACCENT}"/>

      <text x="560" y="424" font-family="${stack}" font-size="26" font-weight="500"
            fill="${ACCENT}" letter-spacing="3">UNTAUGHROD.COM</text>

      <rect x="0" y="${H - 8}" width="${W}" height="8" fill="${ACCENT}"/>
    </svg>
  `);

  // Shifted left to match: at 440px the badge would otherwise run into the
  // text block at x=560. Positioned so the *peach* edge keeps the same ~90px
  // gap it had as a bare disc, since the rim reads as breathing room, not mass.
  const discLeft = USING_BADGE ? 80 : 130;
  const disc = await sharp(MARK).resize(discSize, discSize).png().toBuffer();

  // JPEG rather than PNG: the card carries a soft radial gradient across a dark
  // ground, which an 8-bit palette would band visibly, and full-colour PNG runs
  // ~240 KB. Share cards never need transparency, and every scraper accepts
  // JPEG.
  await sharp(svg)
    .composite([{ input: disc, left: discLeft, top: Math.round((H - discSize) / 2) }])
    .jpeg({ quality: 88, chromaSubsampling: '4:4:4', mozjpeg: true })
    .toFile(path.join(PUBLIC, 'og.jpg'));
}

/**
 * Small transparent mark for the README header.
 *
 * GitHub serves README images unoptimised, so pointing at the 559 KB source
 * would make the front page of the repo needlessly heavy. Transparency matters
 * too: it has to sit on both GitHub's light and dark themes.
 */
async function buildReadmeLogo() {
  await mkdir(DOCS, { recursive: true });
  await sharp(DISC)
    .resize(320, 320)
    .png({ compressionLevel: 9, palette: true, quality: 90, effort: 10 })
    .toFile(path.join(DOCS, 'logo-readme.png'));
}

async function main() {
  await mkdir(PUBLIC, { recursive: true });

  console.log(
    `Deriving assets from ${path.basename(MARK)}` +
      `${USING_BADGE ? ' (white rim intact)' : ' (rim cropped)'}\n`,
  );

  await buildDisc();

  await icon(16, 'icon-16.png');
  await icon(32, 'icon-32.png');
  console.log('  favicons  16, 32 (transparent)');

  await solidIcon(180, 'apple-touch-icon.png');
  await solidIcon(192, 'icon-192.png');
  await solidIcon(512, 'icon-512.png');
  console.log('  app icons 180, 192, 512 (on ink ground)');

  await buildIco();
  console.log('  favicon.ico');

  await buildOgCard();
  console.log('  og.jpg    1200×630');

  await buildReadmeLogo();
  console.log('  docs/logo-readme.png  320×320');

  console.log('\nDone. Commit the results — these are not generated at build time.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
