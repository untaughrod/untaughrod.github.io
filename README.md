# untaughrod.com

Portfolio for Thales Medeiros — product design, illustration, 3D, and the
software that came after.

Built with [Astro](https://astro.build) (static output), [GSAP
ScrollTrigger](https://gsap.com) for the scroll sequences,
[three.js](https://threejs.org) for the hero, and [Lenis](https://lenis.darkroom.engineering)
for smooth scrolling. Deployed to GitHub Pages.

## Running it

```bash
npm install
```

```bash
npm run dev
```

Then open <http://localhost:4321>.

```bash
npm run build
```

Output lands in `dist/`. `npm run preview` serves that build locally.

`npm run assets` regenerates the icons and share card from the logo — see
[Brand assets](#brand-assets). It is deliberately not part of `build`.

## Where to change things

| What | Where |
| --- | --- |
| Your name, bio, email, social links | `src/data/site.ts` |
| Hero headline and standfirst | `src/data/site.ts` → `hero` |
| The four discipline rows | `src/data/site.ts` → `disciplines` |
| Portfolio pieces | `src/data/site.ts` → `work` |
| Colours, type scale, spacing | `src/styles/global.css` (`:root`) |
| The 3D handheld | `src/scripts/hero3d.ts` |
| Scroll animations | `src/scripts/motion.ts` |
| Logo, icons, share card | `src/assets/` + `npm run assets` |

## Theming

Light and dark, toggled from the nav. First visit follows the OS; once the
toggle is used that choice is stored in `localStorage` and wins from then on.
Clearing the key returns the site to following the OS.

Colour tokens live in `src/styles/global.css` and use `light-dark()`, so each
token's two values sit on one line instead of being duplicated into a second
block that can drift. Which half applies is decided by `color-scheme` on the
root — which also themes scrollbars and form controls for free.

### The accent splits by role

`#f8ac92` is a *light* colour. Against a light ground it measures **1.66–1.86:1**,
failing WCAG by roughly 2.7×, so it cannot be text in light mode. Three tokens
instead of one:

| Token | Dark | Light | Use for |
| --- | --- | --- | --- |
| `--accent` | `#f8ac92` | `#9b4427` | text, borders, indicator lines |
| `--accent-fill` | `#f8ac92` | `#f8ac92` | the brand peach as a block |
| `--on-accent` | `#050506` | `#16151a` | text sitting *on* `--accent-fill` |

**`--accent-fill` and `--on-accent` are a pair — never use one without the
other.** There are only four fill sites: `.btn--solid`, `.nav__cta:hover`,
`.skip` and `::selection`. Everything else wants plain `--accent`.

`#9b4427` is hue-locked to the brand peach (H≈15°) and measures 6.09:1.

Every text/surface combination in both modes is measured, not eyeballed — all
clear AA, and most clear AAA. If you change a colour, re-check it.

### Adding a theme-aware effect

Anything outside CSS listens for a `themechange` CustomEvent on `document`:

```js
document.addEventListener('themechange', (e) => {
  if (e.detail.theme === 'light') { /* … */ }
});
```

That is how `src/scripts/hero3d.ts` retunes its lighting — WebGL cannot read
CSS custom properties, and a rig lit for near-black turns the model into a
silhouette against off-white. The device shell deliberately stays dark in both
modes; only the lights change.

## Brand assets

The accent (`--accent: #f8ac92`) is sampled from the logo's own peach field,
which measures `#f8ac91` — so the mark and the interface share one palette.

> The accent is also hardcoded once in `src/scripts/hero3d.ts` (`ACCENT` /
> `ACCENT_RGB`), because WebGL cannot read CSS custom properties. If you change
> `--accent`, change that too.

Sources in `src/assets/`:

| File | What it is |
| --- | --- |
| `logo-badge.png` | The original: squid on a white ground, die-cut into a circle. **The source of truth**, and currently what ships. |
| `logo-disc.png` | **Generated.** The same disc with the white rim cropped away. |
| `logo-squid.png` | The bare squid, no circle, transparent. Currently unused. |

### Switching between the rimmed and unrimmed mark

One line in `scripts/generate-assets.mjs`:

```js
const MARK = BADGE; // flip to DISC to drop the white rim
```

…and the matching import in `src/components/Nav.astro`.

The badge's peach fills only 77.5% of its frame, so the script scales it up
wherever the mark sits on a larger canvas — the nav renders at 39px rather than
30px, the share card at 440px rather than 340px, and the solid app icons drop
their padding to zero. That keeps the squid the same size in both modes, so the
rim is the only thing that changes.

The 16px and 32px favicons are the exception: there the canvas *is* the mark,
so the badge unavoidably shrinks the peach by 23%. Worth knowing that the white
rim is also invisible against a light browser tab bar, so at those sizes it
costs size for no gain.

```bash
npm run assets
```

`scripts/generate-assets.mjs` crops `logo-badge.png` down to its peach disc and
derives everything else from it: `icon-16/32.png`, `apple-touch-icon.png`,
`icon-192/512.png`, `favicon.ico`, and the 1200×630 `og.jpg` share card.

Two things to know about it:

- **It is not a build step.** Run it by hand when the branding changes and
  commit the output. Rendering the share card's text depends on locally
  installed fonts, and the CI runner has a different set — generating in CI
  would silently produce a different image.
- **It measures rather than hardcodes.** The disc boundary is found by marching
  inward from each edge until the flat white background ends, so re-exporting
  the logo at a different size or margin still works. It warns if the four
  readings disagree by more than 4px.

### Replacing the share card

`public/og.jpg` is a committed static file, so you can simply overwrite it with
a version designed in your own tools — 1200×630. The generated one uses a
system sans, because Fontsource ships woff2 only and SVG text rendering cannot
load those, so it is *not* set in Bricolage Grotesque like the rest of the site.

### Adding real work images

Drop files into `public/work/`, then reference them in the `work` array:

```ts
{
  slug: 'world-birds',
  title: 'World Birds',
  image: '/work/world-birds.jpg',
  // ...
}
```

Items without an `image` render a typographic placeholder card, so the layout
stays intact while you migrate assets across from the old Google Sites
portfolio.

## GitHub projects section

`src/data/github.ts` fetches your public repos from the GitHub API **at build
time** — visitors never call the API, so there is no rate limit to hit and no
loading spinner. The deploy workflow re-runs the build every morning (07:00
UTC), so the section never drifts more than a day behind reality.

If the API is unreachable or rate-limited, the build falls back to a hardcoded
repo list rather than failing or shipping an empty section. Keep that list in
rough sync if you add a repo you care about.

## Deploying

Deploys to GitHub Pages from `main` via `.github/workflows/deploy.yml`, which
also re-runs every morning at 07:00 UTC to refresh the repo cards. Pages is
already configured with **Source: GitHub Actions**.

Currently live at **<https://untaughrod.github.io>**.

## Migrating untaughrod.com

The site is deliberately *not* yet on the custom domain. `untaughrod.com` still
resolves to the old Google Sites host, and a Pages site with a custom domain
set serves **only** at that domain — so shipping the CNAME before DNS moves
would take the site offline everywhere rather than moving it.

When you're ready to switch, in this order:

**1.** Add these records at your registrar and wait for them to propagate
(`nslookup untaughrod.com` should return the GitHub addresses, not
`198.49.23.x`):

```text
A     @    185.199.108.153
A     @    185.199.109.153
A     @    185.199.110.153
A     @    185.199.111.153
CNAME www  untaughrod.github.io.
```

**2.** Recreate `public/CNAME` containing one line:

```text
untaughrod.com
```

**3.** Change `site` in `astro.config.mjs` back to `https://untaughrod.com`, so
`canonical` and the `og:image` URL follow the site to its real home.

**4.** Push. Then in **Settings → Pages**, tick **Enforce HTTPS** once the
certificate is issued — that can take up to an hour after DNS resolves.

Your existing site stays up until step 1 propagates, so the visible downtime is
just the propagation window.

## Accessibility and performance notes

- Everything honours `prefers-reduced-motion`: the WebGL scene is never
  downloaded, Lenis is skipped, the custom cursor is hidden, and scroll reveals
  resolve immediately.
- three.js (~540 kB raw) is dynamically imported and only fetched when the hero
  canvas is near the viewport, and never on browsers without WebGL2.
- The render loop pauses when the hero scrolls off-screen or the tab is
  backgrounded.
- Scroll reveals are CSS transitions driven by IntersectionObserver, so content
  is fully readable if JavaScript fails to load.
