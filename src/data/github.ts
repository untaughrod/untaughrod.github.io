import { site } from './site';

export type Repo = {
  name: string;
  description: string;
  url: string;
  language: string | null;
  stars: number;
  updated: string;
  topics: string[];
};

/**
 * Used when the API is unreachable or rate-limited so a network blip can never
 * fail the build or ship an empty projects section. Keep roughly in sync with
 * reality; the live fetch overwrites it on any successful build.
 */
const FALLBACK: Repo[] = [
  {
    name: 'menu-handler',
    description: 'A contextual menu for notes in Obsidian',
    url: 'https://github.com/untaughrod/menu-handler',
    language: 'TypeScript',
    stars: 0,
    updated: '2026-08-09T00:00:00Z',
    topics: [],
  },
  {
    name: 'dictionary-handler',
    description:
      'Plugin for Obsidian enabling users to manage dictionary entries and update custom dictionaries',
    url: 'https://github.com/untaughrod/dictionary-handler',
    language: 'TypeScript',
    stars: 0,
    updated: '2026-07-19T00:00:00Z',
    topics: [],
  },
  {
    name: 'favorite-tab',
    description:
      'Adds an independent favorites tab with visual accent markers for favorite notes and folders',
    url: 'https://github.com/untaughrod/favorite-tab',
    language: 'TypeScript',
    stars: 0,
    updated: '2026-07-07T00:00:00Z',
    topics: [],
  },
  {
    name: 'tag-handler',
    description:
      'A minimalist plugin for Obsidian that automatically injects tags into the YAML frontmatter',
    url: 'https://github.com/untaughrod/tag-handler',
    language: 'TypeScript',
    stars: 0,
    updated: '2026-07-06T00:00:00Z',
    topics: [],
  },
  {
    name: 'text-expander',
    description: 'A minimalist plugin that expands text based on user created keywords',
    url: 'https://github.com/untaughrod/text-expander',
    language: 'TypeScript',
    stars: 0,
    updated: '2026-07-04T00:00:00Z',
    topics: [],
  },
];

/**
 * Fetches public repos at build time. The scheduled workflow in
 * .github/workflows/deploy.yml re-runs the build daily, so the published page
 * stays current without any client-side API call (and without burning the
 * visitor's rate limit).
 */
export async function getRepos(): Promise<Repo[]> {
  const token = process.env.GITHUB_TOKEN;

  try {
    const res = await fetch(
      `https://api.github.com/users/${site.handle}/repos?per_page=100&sort=updated`,
      {
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': `${site.handle}-portfolio-build`,
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      },
    );

    if (!res.ok) {
      console.warn(`[github] ${res.status} ${res.statusText} — using fallback repo data.`);
      return FALLBACK;
    }

    const raw = (await res.json()) as any[];

    const repos = raw
      .filter((r) => !r.fork && !r.archived && !r.private)
      .map((r): Repo => ({
        name: r.name,
        description: r.description ?? '',
        url: r.html_url,
        language: r.language,
        stars: r.stargazers_count ?? 0,
        updated: r.pushed_at ?? r.updated_at,
        topics: r.topics ?? [],
      }))
      .sort((a, b) => Date.parse(b.updated) - Date.parse(a.updated));

    // An empty result almost always means something went wrong upstream rather
    // than that every repo was genuinely deleted.
    return repos.length > 0 ? repos : FALLBACK;
  } catch (err) {
    console.warn('[github] fetch failed — using fallback repo data.', err);
    return FALLBACK;
  }
}

/** Colour chips matching GitHub's own language palette. */
export const languageColors: Record<string, string> = {
  TypeScript: '#3178c6',
  JavaScript: '#f1e05a',
  Python: '#3572a5',
  CSS: '#663399',
  HTML: '#e34c26',
  Astro: '#ff5d01',
  Svelte: '#ff3e00',
  Rust: '#dea584',
  Go: '#00add8',
  Shell: '#89e051',
};

export function formatUpdated(iso: string): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return '';

  const days = Math.floor((Date.now() - then) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`;

  const years = Math.floor(months / 12);
  return `${years} year${years === 1 ? '' : 's'} ago`;
}
