// @ts-check
import { defineConfig } from 'astro/config';

// Deployed to GitHub Pages as a user site, so it serves from the root path and
// there is no base path to account for.
//
// `site` is currently the github.io URL rather than untaughrod.com because the
// domain still points at the old Google Sites host. It feeds `canonical` and
// the absolute og:image URL, so pointing it at a domain that does not serve
// the site yet would break social previews. Switch it — and restore
// public/CNAME — when the DNS migration happens. See the README.
export default defineConfig({
  site: 'https://untaughrod.github.io',
  output: 'static',
  build: {
    inlineStylesheets: 'auto',
  },
  // three.js is the bulk of the JS payload, but Hero.astro imports it
  // dynamically, so it already lands in its own lazily-fetched chunk without
  // any manual chunking config.
});
