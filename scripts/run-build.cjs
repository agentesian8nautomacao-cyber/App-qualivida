/**
 * Roda o build do Vite usando npx (usa o vite de node_modules/.bin).
 * Config: vite.config.cjs para evitar ERR_MODULE_NOT_FOUND.
 */
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const configPath = path.join(root, 'vite.config.cjs');

const r = spawnSync('npx', ['vite', 'build', '--config', configPath], {
  stdio: 'inherit',
  shell: true,
  cwd: root
});

process.exit(r.status !== 0 ? (r.status || 1) : 0);
