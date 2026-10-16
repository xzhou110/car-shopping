/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// The commit this build came from: GitHub Actions sets GITHUB_SHA; a local build says 'local'.
// Stamped into index.html (<meta name="build-commit">) as the live check's proof of freshness:
// GitHub Pages' CDN ignores the query string, so only content proves a page is new.
const buildCommit = process.env.GITHUB_SHA ?? 'local';

// base: './' so a built dist/ also works when opened from a local path.
export default defineConfig({
  base: './',
  plugins: [
    react(),
    {
      name: 'stamp-build-commit',
      transformIndexHtml: (html: string) => html.replace('__BUILD_COMMIT__', buildCommit),
    },
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
