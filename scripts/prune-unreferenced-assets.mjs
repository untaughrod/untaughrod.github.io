/**
 * Deletes image files in dist/ that nothing in the build references.
 *
 * WHY THIS IS NEEDED:
 *
 * Astro skips emitting an original image when it can statically prove <Image>
 * is its sole consumer. That proof only holds when the import binding flows
 * straight into <Image> in the same module. The work strip is data-driven —
 * generated index → data module → array → <Image src={item.image}> — so the
 * analysis fails and every source file is emitted alongside the variants that
 * actually get served.
 *
 * Verified on this repo: a clean direct import emits WebP only; the same image
 * reached through the array emits its 3.5 MB original too. Across 16 pieces
 * that was 17 MB of dead weight against 1.3 MB actually used.
 *
 * This runs after `astro build` and removes only files whose basename appears
 * nowhere in any emitted HTML, CSS, JS, JSON or manifest. Anything referenced,
 * even once, is left alone.
 */

import { readdir, readFile, stat, unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(root, 'dist');

/** Only ever consider these for deletion. */
const PRUNABLE = new Set(['.jpg', '.jpeg', '.png', '.tif', '.tiff', '.gif', '.bmp']);

/** File types that can hold a reference to an asset. */
const TEXTUAL = new Set(['.html', '.css', '.js', '.mjs', '.json', '.webmanifest', '.xml', '.txt', '.svg']);

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else out.push(full);
  }
  return out;
}

const files = await walk(DIST);

// Concatenate everything that could mention an asset, once.
const haystack = (
  await Promise.all(
    files
      .filter((f) => TEXTUAL.has(path.extname(f).toLowerCase()))
      .map((f) => readFile(f, 'utf8').catch(() => '')),
  )
).join('\n');

const candidates = files.filter((f) => PRUNABLE.has(path.extname(f).toLowerCase()));

let removed = 0;
let bytes = 0;

for (const file of candidates) {
  const name = path.basename(file);

  // A filename appearing anywhere at all is treated as referenced. Erring
  // toward keeping a file is the right bias: a stray extra asset costs
  // bandwidth, a wrongly deleted one breaks the page.
  if (haystack.includes(name)) continue;

  // Never touch anything the site serves from a stable path, such as the
  // favicons and share card in public/.
  if (!file.includes(`${path.sep}_astro${path.sep}`)) continue;

  bytes += (await stat(file)).size;
  await unlink(file);
  removed++;
}

if (removed > 0) {
  console.log(
    `  pruned ${removed} unreferenced image${removed === 1 ? '' : 's'} ` +
      `(${(bytes / 1024 / 1024).toFixed(1)} MB) from dist/_astro`,
  );
} else {
  console.log('  no unreferenced images to prune');
}
