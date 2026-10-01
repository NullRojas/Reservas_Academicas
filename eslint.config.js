import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default [
  { ignores: ['**/dist/**', '**/node_modules/**', '**/coverage/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    // Regla de dependencia de Clean Architecture: las capas internas no conocen a las externas.
    // domain ← application ← (infrastructure | interfaces) ← composition
    files: ['apps/api/src/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '**/application/**',
                '**/infrastructure/**',
                '**/interfaces/**',
                '**/composition/**',
              ],
              message: 'El dominio no puede depender de capas externas.',
            },
            { regex: '^[^./]', message: 'El dominio es TypeScript puro: no importa librerías.' },
          ],
        },
      ],
    },
  },
  {
    files: ['apps/api/src/application/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/infrastructure/**', '**/interfaces/**', '**/composition/**'],
              message: 'La capa de aplicación depende de puertos (ports.ts), no de adaptadores.',
            },
            { regex: '^[^./]', message: 'Los casos de uso no importan librerías: usa un puerto.' },
          ],
        },
      ],
    },
  },
  {
    // Los CLI (migraciones, seed) y el arranque del servidor sí escriben en consola.
    files: ['apps/api/src/**/*-cli.ts', 'apps/api/src/server.ts'],
    rules: { 'no-console': 'off' },
  },
];
