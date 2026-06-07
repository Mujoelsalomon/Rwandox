import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    target: ['chrome89', 'edge89', 'firefox89'],
  },
})
