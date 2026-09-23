/**
 * Production bundle for the API.
 *
 * `tsc` output cannot run in production: `@rkf/shared-types` is consumed from
 * TypeScript source (its package.json `main` points at src/index.ts), so
 * `node dist/server.js` failed with ERR_MODULE_NOT_FOUND the moment it hit
 * the workspace package. That broke the API Docker image and the scheduled
 * load-test gate.
 *
 * esbuild inlines workspace packages (`@rkf/*`) into a single ESM file and
 * leaves every third-party dependency external, so the runtime only needs
 * the API's own node_modules.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const here = path.dirname(fileURLToPath(import.meta.url));

/** Bundle workspace packages, keep everything else (node_modules, node: builtins) external. */
const externalizeThirdParty = {
  name: 'externalize-third-party',
  setup(pluginBuild) {
    pluginBuild.onResolve({ filter: /^[^./]/ }, (args) => {
      if (args.path.startsWith('@rkf/')) return null;
      return { path: args.path, external: true };
    });
  },
};

await build({
  entryPoints: [path.join(here, 'src/server.ts')],
  outfile: path.join(here, 'dist/server.js'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  sourcemap: true,
  logLevel: 'info',
  plugins: [externalizeThirdParty],
});
