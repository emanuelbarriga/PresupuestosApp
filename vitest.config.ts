import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    exclude: ['e2e/**', 'node_modules/**', 'functions/node_modules/**', 'dist/**', 'lib/__tests__/firestore-rules-*.test.ts', 'lib/__tests__/storage-rules-*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['lib/**', 'components/**', 'context/**', 'app/**'],
      exclude: ['**/*.test.*', '**/__tests__/**', '**/types.ts', '**/.DS_Store'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
