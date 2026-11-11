const { copyFileSync, mkdirSync } = require('node:fs');
mkdirSync('dist-electron/electron', { recursive: true });
copyFileSync('electron/camoufox-worker.mjs', 'dist-electron/electron/camoufox-worker.mjs');
copyFileSync('electron/native-runtime.mjs', 'dist-electron/electron/native-runtime.mjs');
