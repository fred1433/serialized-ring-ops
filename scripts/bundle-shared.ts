import { build } from 'esbuild';
import { join } from 'node:path';

/** Bundles src/shared into one browser module. The test suite compares this to site/shared.js. */
export async function bundleShared(): Promise<string> {
  const out = await build({
    entryPoints: [join(__dirname, '..', 'src', 'shared', 'index.ts')],
    bundle: true,
    format: 'esm',
    target: 'es2020',
    write: false,
    legalComments: 'none',
    charset: 'utf8',
  });
  return out.outputFiles[0].text;
}
