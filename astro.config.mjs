// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import preact from '@astrojs/preact';
import vercel from '@astrojs/vercel';

import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  output: 'static',
  site: 'https://travisgilbert.com',
  integrations: [preact(), sitemap()],
  adapter: vercel(),
  vite: {
    plugins: [tailwindcss()],
  },
});