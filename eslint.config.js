// eslint.config.js — ESLint 9 flat config
import tseslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

export default [
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: { project: true },
    },
    plugins: { '@typescript-eslint': tseslint },
    rules: {
      // Deciso in sezione 14 del piano: 'error', non 'warn' — altrimenti
      // resta un'intenzione, non una regola verificata in CI.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': 'error',
    },
  },
  {
    ignores: ['**/node_modules/**', '**/.next/**', '**/dist/**'],
  },
];
