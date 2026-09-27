import { resolve } from 'node:path';
import { build } from 'vite';

await build({
  configFile: false,
  build: {
    rollupOptions: {
      input: {
        main: resolve('index.html'),
        setup: resolve('setup/index.html'),
      },
    },
  },
});
