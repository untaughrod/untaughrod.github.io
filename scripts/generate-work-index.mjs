/**
 * Writes src/data/work-images.ts — one explicit import per work image.
 *
 * WHY THIS EXISTS, rather than an import.meta.glob:
 *
 * Astro can statically prove that a direct `import img from './x.jpg'` is
 * consumed only by <Image>, so it emits the optimised variants and skips the
 * original. `import.meta.glob` defeats that analysis — eager or lazy — and
 * every source file gets copied into the build as well. Measured on this repo:
 * 17 MB of unreferenced originals against 1.3 MB of WebP actually served.
 *
 * So discovery happens here, at author time, and the app sees plain static
 * imports. Run `npm run images` after adding or removing artwork.
 */

import { readdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ASSETS = path.join(root, 'src', 'assets');
const OUT = path.join(root, 'src', 'data', 'work-images.ts');

/** Folder name → discipline. Adding a folder here adds a category. */
const FOLDERS = ['illustrations', 'retro-stuff'];

// tif/tiff deliberately absent: Astro's image service accepts TIFF, but the
// bundler has no loader for the extension and reads the binary as UTF-8 text.
const EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif']);

const entries = [];

for (const folder of FOLDERS) {
  let names;
  try {
    names = await readdir(path.join(ASSETS, folder));
  } catch {
    console.warn(`  ! ${folder}/ not found — skipping`);
    continue;
  }

  for (const name of names.sort()) {
    if (!EXTENSIONS.has(path.extname(name).toLowerCase())) continue;
    entries.push({
      folder,
      name,
      key: `${folder}/${name.slice(0, -path.extname(name).length)}`,
    });
  }
}

if (entries.length === 0) {
  console.error('No work images found. Refusing to write an empty index.');
  process.exit(1);
}

// Identifiers must be valid JS, and these filenames contain spaces, dots and
// dashes — so they are numbered rather than derived from the name.
const imports = entries
  .map((e, i) => `import img${i} from '../assets/${e.folder}/${e.name}';`)
  .join('\n');

const rows = entries
  .map((e, i) => `  { key: ${JSON.stringify(e.key)}, image: img${i} },`)
  .join('\n');

const file = `// GENERATED FILE — do not edit by hand.
// Run \`npm run images\` after adding or removing artwork.
//
// Explicit imports rather than import.meta.glob: Astro only skips emitting an
// original image when it can statically prove <Image> is the sole consumer,
// and a glob defeats that. See scripts/generate-work-index.mjs.

import type { ImageMetadata } from 'astro';

${imports}

export type WorkImageEntry = {
  /** \`folder/basename\`, used to look up per-piece overrides. */
  key: string;
  image: ImageMetadata;
};

export const workImages: WorkImageEntry[] = [
${rows}
];
`;

await writeFile(OUT, file, 'utf8');

const byFolder = FOLDERS.map(
  (f) => `${entries.filter((e) => e.folder === f).length} ${f}`,
).join(', ');

console.log(`  work-images.ts  ${entries.length} images (${byFolder})`);
