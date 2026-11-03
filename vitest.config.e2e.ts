import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    // Neon y Atlas son remotos: un test con varias peticiones encadenadas
    // supera los 5 s por defecto aunque el código sea correcto.
    testTimeout: 15000,
    hookTimeout: 60000,
    server: {
      deps: {
        external: ['y-websocket', 'yjs'],
      },
    },
  },
});
