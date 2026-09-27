import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// NOTE: source maps are emitted in the build. In a real product you'd usually
// keep these private; here they're intentionally shippable for the recon lab
// (JS analysis / source-map discovery) in a later phase.
export default defineConfig({
  plugins: [react()],
  build: { sourcemap: true, outDir: 'dist' },
  server: { host: true, port: 5173 },
});
