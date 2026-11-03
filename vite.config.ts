import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // `npm run server` in a second terminal makes username sign-in work during `npm run dev`.
  server: {
    proxy: { '/api': 'http://localhost:3000' },
  },
});
