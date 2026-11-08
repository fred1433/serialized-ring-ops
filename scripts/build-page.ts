// Builds site/ from page/, src/shared and the recorded reports. Nothing is typed by hand into the output.
import { build, Plugin } from 'esbuild';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { bundleShared } from './bundle-shared';

const root = join(__dirname, '..');
const site = join(root, 'site');

const sharedIsExternal: Plugin = {
  name: 'shared-is-external',
  setup(b) {
    b.onResolve({ filter: /src\/shared$/ }, () => ({ path: './shared.js', external: true }));
  },
};

function readJson(path: string): string {
  return existsSync(path) ? readFileSync(path, 'utf8') : 'null';
}

async function main(): Promise<void> {
  mkdirSync(site, { recursive: true });
  writeFileSync(join(site, 'shared.js'), await bundleShared());
  const coverage = JSON.parse(readJson(join(root, 'reports', 'coverage', 'coverage-summary.json')));
  await build({
    entryPoints: [join(root, 'page', 'app.ts')],
    bundle: true,
    format: 'esm',
    target: 'es2020',
    outfile: join(site, 'app.js'),
    plugins: [sharedIsExternal],
    charset: 'utf8',
    legalComments: 'none',
    define: {
      __DEMO_STATE__: readFileSync(join(root, 'page', 'demo-state.json'), 'utf8'),
      __RACE_REPORT__: readJson(join(root, 'reports', 'race-report.json')),
      __COVERAGE__: JSON.stringify(coverage && coverage.total),
    },
  });
  for (const file of ['index.html', 'style.css', 'favicon.svg', 'favicon.png']) {
    copyFileSync(join(root, 'page', file), join(site, file));
  }
  console.log('Built site/');
}

main().catch((error) => {
  console.error(`Failed: ${error?.message || error}`);
  process.exit(1);
});
