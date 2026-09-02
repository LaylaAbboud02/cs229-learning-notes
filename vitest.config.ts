import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
    // The site is deployed under a GitHub Pages base path. Unit tests that
    // exercise base-path helpers assert against this value explicitly rather
    // than relying on Vite's default of "/".
    env: {
      BASE_URL: '/cs229-learning-notes',
    },
  },
});
