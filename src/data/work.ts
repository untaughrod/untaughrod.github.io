import { disciplineLabels, type WorkItem } from './site';
import { workImages } from './work-images';
import type { ImageMetadata } from 'astro';

/**
 * Display data for the work strip.
 *
 * Discovery lives in `npm run images`, which scans the asset folders and writes
 * work-images.ts. That indirection exists for a concrete reason: Astro only
 * skips emitting an original image when it can statically prove <Image> is its
 * sole consumer, and an `import.meta.glob` defeats that analysis. Measured on
 * this repo, the glob shipped 17 MB of unreferenced originals alongside the
 * 1.3 MB of WebP actually served.
 */

/** Folder name is the discipline. */
const disciplineByFolder: Record<string, WorkItem['discipline']> = {
  illustrations: 'illustration',
  'retro-stuff': 'modelling',
};

/**
 * Per-piece overrides, keyed by `folder/basename` (no extension).
 *
 * Anything absent falls back to a title derived from the filename, so the strip
 * works before this map is filled in. Add a line here to correct a title or
 * attach a year — nothing else needs touching.
 */
export const overrides: Record<
  string,
  { title?: string; year?: string; summary?: string; tags?: string[] }
> = {
  // 'retro-stuff/gamedude.307': { title: 'Game Dude', year: '2024' },
};

/**
 * Filenames here are export artefacts: `gamedude.307`, `untitled.60`,
 * `first mermay opt 2 - Copy`. Strip the noise, then title-case *only* if the
 * name is entirely lowercase — otherwise `Graf von Faber Castell Pen of the
 * Year` would come back as `Graf Von Faber Castell Pen Of The Year`.
 */
function titleFromFilename(base: string): string {
  const cleaned = base
    .replace(/\.\d+$/, '') // trailing export id: "gamedude.307"
    .replace(/\s*-\s*copy$/i, '') // accidental duplicate marker
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (cleaned !== cleaned.toLowerCase()) return cleaned;

  return cleaned.replace(/\b\w/g, (c) => c.toUpperCase());
}

export type WorkImage = WorkItem & {
  image: ImageMetadata;
  /** Intrinsic ratio, used to derive card width from a shared height. */
  ratio: number;
};

export const work: WorkImage[] = workImages
  .map(({ key, image }) => {
    const slash = key.indexOf('/');
    const folder = key.slice(0, slash);
    const base = key.slice(slash + 1);

    const discipline = disciplineByFolder[folder];
    if (!discipline) return null;

    const override = overrides[key] ?? {};

    return {
      slug: key,
      title: override.title ?? titleFromFilename(base),
      discipline,
      year: override.year ?? '',
      summary: override.summary ?? '',
      tags: override.tags ?? [],
      image,
      ratio: image.width / image.height,
    } satisfies WorkImage;
  })
  .filter((item): item is WorkImage => item !== null)
  // Stable, readable order: discipline first, then title.
  .sort(
    (a, b) =>
      a.discipline.localeCompare(b.discipline) || a.title.localeCompare(b.title),
  );

export { disciplineLabels };
