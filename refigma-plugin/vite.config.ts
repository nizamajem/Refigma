// vite.config.ts
import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig(({ command, mode }) => {
  // aktifkan watch hanya jika CLI memanggil --watch
  const isWatch = process.argv.includes('--watch');

  return {
    build: {
      emptyOutDir: true,
      outDir: 'dist',
      target: 'esnext',
      rollupOptions: {
        input: {
          // output => dist/main.js
          main: path.resolve(__dirname, 'src/main.ts'),
          // output => dist/ui/index.html (+ dist/assets/* jika ada)
          ui: path.resolve(__dirname, 'ui/index.html'),
        },
        output: {
          entryFileNames: '[name].js',
          assetFileNames: 'assets/[name][extname]',
          chunkFileNames: 'assets/[name].js',
        },
      },
      minify: false,
      // penting: JANGAN force watch di sini. Serahkan ke flag CLI.
      watch: isWatch ? { include: ['src/**', 'ui/**', 'types/**'] } : null,
    },
  };
});
