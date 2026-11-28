// このファイルは、公開前の点検です。「node bunkyo/tools/check.mjs」で動かします。
// 確かめること：版番号がそろっているか／使わないと決めた言葉が入っていないか／外部のファイルを読み込んでいないか／検索よけがあるか。
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const dir = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => readFileSync(join(dir, f), 'utf8');
const ng = [];
const v1 = read('config.js').match(/VERSION: '([^']+)'/)[1], v2 = read('sw.js').match(/const VERSION = '([^']+)'/)[1];
if (v1 !== v2) ng.push(`版番号がそろっていません（config.js ${v1} / sw.js ${v2}）`);
if (!/name="robots" content="noindex/.test(read('index.html'))) ng.push('検索よけ（noindex）がありません');
const walk = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
for (const p of walk(dir).filter((p) => /\.(js|html|css|json)$/.test(p) && !p.includes('/tools/'))) {
  const s = readFileSync(p, 'utf8'), name = p.slice(dir.length + 1);
  if (/文の京/.test(s)) ng.push(`${name}: 「文の京」は使わない決まりです`);
  if (/投票|選挙|候補/.test(s.replace(/\/\/.*$/gm, ''))) ng.push(`${name}: 選挙に関する言葉が入っています`);
  if (/<script[^>]+src="https?:|<link[^>]+href="https?:|@import|fetch\(['"]https?:|XMLHttpRequest|sendBeacon|localStorage|indexedDB|document\.cookie/.test(s)) ng.push(`${name}: 外部の読み込み・送信・保存の命令があります`);
}
for (const f of JSON.parse(JSON.stringify(read('config.js').match(/'\.\/[^']+'/g))).map((x) => x.slice(1, -1)).filter((f) => f !== './'))
  try { statSync(join(dir, f)); } catch { ng.push(`設定にあるファイルがありません: ${f}`); }
if (ng.length) { console.error('点検NG\n' + ng.join('\n')); process.exit(1); }
console.log('点検OK（版 ' + v1 + '）');
