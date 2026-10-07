// Packages the PC build with @electron/packager.
// Usage: node tools/package.mjs [win32|linux] [--no-build] [--zip]
// Output: release/VERITY TIME-<platform>-x64/ (+ .zip with --zip)
import { packager } from '@electron/packager';
import { execSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const platform = process.argv[2] ?? 'win32';
const noBuild = process.argv.includes('--no-build');
const zip = process.argv.includes('--zip');
const root = resolve(import.meta.dirname, '..');

if (!noBuild) {
  console.log('> vite build (release, debug tools compiled out)');
  execSync('npm run build', { cwd: root, stdio: 'inherit' });
}
if (!existsSync(resolve(root, 'dist/index.html'))) throw new Error('dist/ is missing — run npm run build');

// only the built game, the shell and package.json go into the app
const keep = [/^\/dist(\/|$)/, /^\/electron(\/|$)/, /^\/package\.json$/];
const paths = await packager({
  dir: root,
  out: resolve(root, 'release'),
  name: 'VERITY TIME',
  executableName: 'VerityTime',
  platform,
  arch: 'x64',
  overwrite: true,
  asar: true,
  prune: false,
  ignore: (p) => p !== '' && !keep.some((r) => r.test(p)),
  appCopyright: 'VERITY TIME',
  win32metadata: { CompanyName: 'VERITY TIME', FileDescription: 'VERITY TIME', ProductName: 'VERITY TIME' },
});
for (const p of paths) console.log('packaged:', p);

if (zip) {
  for (const p of paths) {
    const z = p + '.zip';
    if (existsSync(z)) rmSync(z);
    execSync(`cd "${resolve(p, '..')}" && zip -qr "${z}" "${p.split('/').pop()}"`, { stdio: 'inherit', shell: '/bin/bash' });
    console.log('zip:', z);
  }
}
