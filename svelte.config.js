import nodeAdapter from '@sveltejs/adapter-node';
import vercelAdapter from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    // Vercel sets VERCEL=1 during its builds; everywhere else (local, Docker) uses Node.
    adapter: process.env.VERCEL
      ? vercelAdapter({ runtime: 'nodejs22.x' })
      : nodeAdapter({ out: 'build' })
  }
};

export default config;
