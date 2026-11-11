// Rasterize the editable vector mark and encode a PNG-backed, multi-size Windows ICO.
const { _electron: electron } = require('@playwright/test');
const { mkdtemp, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { readFile, writeFile } = require('node:fs/promises');
const { resolve } = require('node:path');
(async () => {
  const data = await mkdtemp(join(tmpdir(), 'workspace-icon-'));
  const browser = await electron.launch({ args: ['.'], env: { ...process.env, PROFILE_WORKSPACE_DATA_DIR: data } });
  const page = await browser.firstWindow();
  try {
    const sizes = [16, 24, 32, 48, 64, 128, 256];
    const images = [];
    const svg = await readFile(resolve('assets/icon.svg'), 'utf8');
    for (const size of sizes) {
      await page.setViewportSize({ width: size, height: size });
      await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:100vw;height:100vh}</style>${svg}`);
      images.push(await page.screenshot({ omitBackground: true }));
    }
    const header = Buffer.alloc(6 + sizes.length * 16); header.writeUInt16LE(1, 2); header.writeUInt16LE(sizes.length, 4);
    let offset = header.length;
    images.forEach((png, index) => {
      const entry = 6 + index * 16, size = sizes[index];
      header[entry] = header[entry + 1] = size === 256 ? 0 : size;
      header.writeUInt16LE(1, entry + 4); header.writeUInt16LE(32, entry + 6);
      header.writeUInt32LE(png.length, entry + 8); header.writeUInt32LE(offset, entry + 12); offset += png.length;
    });
    await writeFile('assets/icon.png', images.at(-1)); await writeFile('assets/icon.ico', Buffer.concat([header, ...images]));
  } finally { await browser.close(); await rm(data, { recursive: true, force: true }); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
