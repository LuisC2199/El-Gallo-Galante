// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import cloudflare from '@astrojs/cloudflare';
import react from '@astrojs/react';
import { remarkAlignPublic } from './src/lib/remark-align-public.mjs';

// https://astro.build/config
export default defineConfig({
  site: "https://elgallogalante.com",
  vite: {
    plugins: [tailwindcss()]
  },

  markdown: {
    // Strip :::align-TYPE::: prefixes emitted by the admin editor and apply
    // text-align CSS so public post pages render alignment correctly.
    remarkPlugins: [remarkAlignPublic],
  },

  integrations: [react()],
  // This app does not use Astro sessions; use in-memory storage so the
  // Cloudflare adapter does not require a SESSION KV namespace.
  session: {
    driver: "memory",
  },
  adapter: cloudflare({
    imageService: "compile",
  })
});
