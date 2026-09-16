import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Asterism',
    description: 'Your private memory for open-source software.',
  },
  vite: () => ({
    plugins: [tailwindcss()],
  }),
});
