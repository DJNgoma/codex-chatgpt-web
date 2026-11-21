import { readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { parseTOML, getStaticTOMLValue } from 'toml-eslint-parser';

const evidence = resolve(import.meta.dir, '../repair-evidence');
const backup = readFileSync(resolve(evidence, 'install-backup-path.txt'), 'utf8').trim();
const parse = p => getStaticTOMLValue(parseTOML(readFileSync(p, 'utf8')));
const before = parse(resolve(backup, 'protected-0.toml'));
const after = parse(resolve(homedir(), '.codex/config.toml'));
for (const key of ['model_provider', 'model_providers', 'model_catalog_json']) {
  assert.deepEqual(after[key], before[key], `Protected setting changed: ${key}`);
}
const changedFields = [];
function diff(a, b, path = '') {
  if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b)) {
    for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
      diff(a[key], b[key], path ? `${path}.${key}` : key);
    }
  } else if (JSON.stringify(a) !== JSON.stringify(b)) changedFields.push(path);
}
diff(before, after);
const report = { providerSettingsPreserved: true, activeProvider: after.model_provider,
  modelProviderIds: Object.keys(after.model_providers || {}), changedFields };
writeFileSync(resolve(evidence, 'config-semantic-verification.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
