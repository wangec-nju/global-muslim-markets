import { defineConfig } from 'vite';

/**
 * `base` is injected at build time for GitHub Pages project sites, e.g.
 *   VITE_BASE=/global-muslim-markets/ npm run build
 * The deploy workflow computes it automatically. Local dev stays at `/`.
 */
const base = process.env.VITE_BASE || '/';

export default defineConfig({
  base,
  build: {
    target: 'es2022',
    assetsInlineLimit: 2048,
  },
});
