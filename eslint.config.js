import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import astro from 'eslint-plugin-astro';
import globals from 'globals';

/**
 * Lints JavaScript, TypeScript, TSX, and Astro source.
 *
 * `.astro` files are linted via `eslint-plugin-astro`'s recommended flat config
 * (`astro-eslint-parser` + the plugin's core rules). Its optional jsx-a11y
 * extension is intentionally NOT enabled: `eslint-plugin-jsx-a11y`'s current
 * release still pins an ESLint peer range that excludes ESLint 10. React-specific
 * accessibility linting can be layered in once that peer range is fixed.
 */
export default tseslint.config(
  {
    ignores: ['dist/', 'dist-demo/', '.astro/', 'node_modules/', 'coverage/', 'pnpm-lock.yaml'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...astro.configs['flat/recommended'],
  {
    files: ['**/*.{js,mjs,cjs,ts,tsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // Node-context config files.
    files: ['*.config.{js,mjs,ts}', 'vitest.config.ts'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
  {
    // Ambient type declarations: triple-slash references are idiomatic here
    // (this is how Astro wires its generated types into a project).
    files: ['**/*.d.ts'],
    rules: {
      '@typescript-eslint/triple-slash-reference': 'off',
    },
  },
);
