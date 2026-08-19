/**
 * Single source of truth for copy and work entries.
 *
 * Everything a non-developer would want to change lives here rather than in
 * markup. The work strip is generated from the image folders instead — see
 * data/work.ts.
 */

export const site = {
  name: 'Thales Medeiros',
  handle: 'untaughrod',
  domain: 'untaughrod.com',
  title: 'Thales Medeiros — Designer who ships software',
  description:
    'Product designer, illustrator and 3D modeller building the tools he wanted to use. TypeScript, interface design, and things that move.',
  email: 'untaughrod@gmail.com',
  social: {
    github: 'https://github.com/untaughrod',
    instagram: 'https://instagram.com/untaughrod',
  },
} as const;

/** The three-line pitch that carries the hero. */
export const hero = {
  lines: ['Design', 'that ships', 'itself'],
  standfirst:
    'I spent a decade making things look right — illustration, 3D, product design. Then I got tired of handing off specs and learned to build them. Now I write the software too.',
} as const;

export type Discipline = {
  id: string;
  label: string;
  year: string;
  blurb: string;
};

/**
 * Ordered deliberately: engineering leads, and the creative practice reads as
 * the foundation underneath it rather than a separate career.
 */
export const disciplines: Discipline[] = [
  {
    id: 'engineering',
    label: 'Software',
    year: '2025 —',
    blurb:
      'TypeScript, Obsidian plugin APIs, DOM internals. Five shipped plugins with real users and real bug reports.',
  },
  {
    id: 'product',
    label: 'Product Design',
    year: '2018 —',
    blurb:
      'Interface systems, design tokens, and the unglamorous specification work that makes a product feel considered.',
  },
  {
    id: 'modelling',
    label: '3D Modelling',
    year: '2020 —',
    blurb:
      'Hard-surface modelling with a fixation on retro handhelds and consoles. Chamfers, injection-mould seams, worn plastic.',
  },
  {
    id: 'illustration',
    label: 'Illustration',
    year: '2014 —',
    blurb:
      'Character work, ornithological studies, fountain pens. Where the eye for weight and silhouette was trained.',
  },
];

export type WorkItem = {
  slug: string;
  title: string;
  discipline: 'illustration' | 'modelling' | 'product';
  year: string;
  summary: string;
  tags: string[];
};

export const disciplineLabels: Record<WorkItem['discipline'], string> = {
  illustration: 'Illustration',
  modelling: '3D Modelling',
  product: 'Product Design',
};
