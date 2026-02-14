import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: 'yu-core',
    environment: 'node',
    include: ['src/**/__tests__/*.{test,spec}.ts'],
    exclude: ['dist/**', 'node_modules/**'],
    globals: true,
    pool: 'threads',
    poolOptions: {
      threads: {
        maxThreads: 2,
      },
    },
  },
})
