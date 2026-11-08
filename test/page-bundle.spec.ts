import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { bundleShared } from '../scripts/bundle-shared';

const root = join(__dirname, '..');

describe('the page and the API run the same scan check', () => {
  it('site/shared.js is the bundle of src/shared, byte for byte', async () => {
    expect(readFileSync(join(root, 'site', 'shared.js'), 'utf8')).toBe(await bundleShared());
  });

  it('page/app.ts has no scan rule of its own: it imports the shared module', () => {
    const source = readFileSync(join(root, 'page', 'app.ts'), 'utf8');
    expect(source).toContain("from '../src/shared'");
    expect(source).not.toMatch(/Packing blocked/);
    expect(source).not.toMatch(/Ready for carrier handoff/);
  });
});
