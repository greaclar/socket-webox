// vite.config.js
import { resolve } from 'path'
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts';
import strip from '@rollup/plugin-strip';

export default defineConfig(({ mode }) => {
  const isBuild = mode === 'production';
  console.log('mode', isBuild);
  return {
    plugins: [
      dts(),
      isBuild && strip({
        functions: ['console.log', 'console.info'],
        include: ['**/**.ts']
      }),
    ].filter(Boolean),
    build: {
      lib: {
        entry: resolve(__dirname, './src/socket-webox.ts'),
        name: 'SocketWebox',
        fileName: 'socket-webox',
      },
      /* rollupOptions: {
        
      }, */
    },
  }
})