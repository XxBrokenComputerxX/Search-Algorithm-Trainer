import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Relative base so the built app also works when opened from any static folder.
  base: './',
  test: {
    include: ['src/**/*.test.ts'],
  },
});
