import { defineConfig } from 'astro/config';
import node from '@astrojs/node';

export default defineConfig({
  site: 'https://oddlympics.app',
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  // We do our own Origin check in src/pages/api/signup.ts that allows
  // localhost/127.0.0.1 for development. Astro's default checkOrigin uses the
  // configured `site` host, which would block same-origin local testing.
  security: { checkOrigin: false },
  vite: {
    ssr: {
      external: ['better-sqlite3'],
    },
  },
});
