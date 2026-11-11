import { defineConfig } from '@playwright/test';
export default defineConfig({ testDir: './tests/native', workers: 1, timeout: 180000, expect: { timeout: 90000 }, reporter: 'list' });
