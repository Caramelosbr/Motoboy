/**
 * Build + auditoria do bundle das Functions (DEC-019.1).
 *
 * esbuild empacota `src/index.ts` em `lib/index.js` (Node 22, CJS), mantendo
 * `firebase-admin`/`firebase-functions` (e subpaths) como EXTERNALS e INLINANDO
 * o núcleo compartilhado de `src/`. Gera `lib/meta.json` e audita o metafile:
 * (a) o núcleo de `src/` está entre os inputs; (b) admin/functions NÃO foram
 * inlinados (aparecem como import externo); (c) há um único outfile lib/index.js.
 * Sai com código ≠ 0 em qualquer violação. Sem deploy.
 */

import { build } from 'esbuild';
import { writeFileSync, mkdirSync } from 'node:fs';

const EXTERNAL = ['firebase-admin', 'firebase-admin/*', 'firebase-functions', 'firebase-functions/*'];
const OUTFILE = 'lib/index.js';

function norm(p) {
  return p.replace(/\\/g, '/');
}

function audit(metafile) {
  const problems = [];
  const inputs = Object.keys(metafile.inputs).map(norm);
  const outputs = Object.keys(metafile.outputs).map(norm);

  // (c) único bundle .js em lib/index.js
  const jsOutputs = outputs.filter((o) => o.endsWith('.js'));
  if (jsOutputs.length !== 1 || !jsOutputs[0].endsWith(OUTFILE)) {
    problems.push(`outfile inesperado: [${jsOutputs.join(', ')}]`);
  }

  // (a) núcleo de src/ inlinado (algum input aponta para ../src/)
  const coreInlined = inputs.some((i) => i.includes('../src/'));
  if (!coreInlined) problems.push('núcleo de src/ não aparece nos inputs (não foi inlinado)');

  // (b) admin/functions NÃO inlinados (nenhum input em node_modules dessas libs)
  const leaked = inputs.filter((i) => /node_modules\/(firebase-admin|firebase-functions)\b/.test(i));
  if (leaked.length > 0) problems.push(`externals inlinados: ${leaked.join(', ')}`);

  // (b') firebase-functions aparece como import EXTERNO do bundle
  const out = metafile.outputs[Object.keys(metafile.outputs).find((o) => norm(o).endsWith(OUTFILE))];
  const externalImports = (out?.imports ?? []).filter((im) => im.external).map((im) => im.path);
  if (!externalImports.includes('firebase-functions')) {
    problems.push(`firebase-functions não consta como import externo: [${externalImports.join(', ')}]`);
  }

  if (problems.length > 0) {
    console.error('AUDITORIA DO BUNDLE FALHOU:\n- ' + problems.join('\n- '));
    process.exit(1);
  }
  console.log('Auditoria do bundle OK: núcleo inlinado; admin/functions externos; único outfile.');
}

mkdirSync('lib', { recursive: true });
const result = await build({
  entryPoints: ['src/index.ts'],
  outfile: OUTFILE,
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  external: EXTERNAL,
  metafile: true,
  logLevel: 'warning',
});
writeFileSync('lib/meta.json', JSON.stringify(result.metafile, null, 2));
audit(result.metafile);
