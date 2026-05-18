import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [
    vue({
      template: {
        compilerOptions: {
          // treat all tags with a dash as custom (Lit) elements
          isCustomElement: (tag) => tag.includes('-'),
        },
      },
    }),
  ],
  base: '/web-streaming/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        manualChunks: {
          vue: ['vue', 'vue-router'],
          lit: ['lit'],
        },
      },
    },
  },
})
