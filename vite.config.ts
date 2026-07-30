/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages serves from /<repo>/; the deploy workflow sets BASE_PATH.
  base: process.env['BASE_PATH'] || '/',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    // .claude/worktrees holds parallel-session checkouts with their own copies
    // of the suite — never run them from the main tree.
    exclude: ['**/node_modules/**', '**/dist/**', '**/.claude/**'],
  },
})
