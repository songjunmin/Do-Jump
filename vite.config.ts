import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `--mode offline`: Verse8 서버 없이 브라우저 안에서 같은 서버 코드를 돌리는 단일 HTML 빌드 (미리보기용)
export default defineConfig(({ mode }) => ({
  plugins: mode === 'offline' ? [react(), viteSingleFile()] : [react()],
  base: './',
  build: { outDir: mode === 'offline' ? 'dist-offline' : 'dist' },
  server: { port: 5173, host: true },
}));
