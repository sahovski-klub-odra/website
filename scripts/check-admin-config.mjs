/**
 * After the build: make sure the generated CMS configurations are valid YAML and contain the
 * expected collections. A broken config.yml would leave editors with an error screen in /admin/.
 */
import { readFileSync, existsSync } from 'node:fs';
import { parse } from 'yaml';

const checks = [
  ['dist/admin/config.yml', ['blog-hr', 'albums', 'data']],
  ['dist/admin/trener/config.yml', ['data']],
];
let failed = false;
for (const [file, expected] of checks) {
  if (!existsSync(file)) { console.error(`✗ ${file} is missing`); failed = true; continue; }
  try {
    const cfg = parse(readFileSync(file, 'utf8'));
    const names = (cfg.collections ?? []).map((c) => c.name);
    const missing = expected.filter((n) => !names.includes(n));
    if (missing.length) { console.error(`✗ ${file}: missing collections ${missing.join(', ')}`); failed = true; }
    else console.log(`✓ ${file} – ${names.length} collections, backend ${cfg.backend?.name} ${cfg.backend?.repo}`);
  } catch (e) {
    console.error(`✗ ${file} is not valid YAML: ${e.message}`);
    failed = true;
  }
}
process.exit(failed ? 1 : 0);
