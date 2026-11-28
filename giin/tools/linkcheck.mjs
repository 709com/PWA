// このファイルは「リンク切れの自動点検」です。月に1回、GitHubの上で自動で動きます（.github/workflows/giin-linkcheck.yml）。
// data.js に書いたリンク先と電話番号の出典ページを1件ずつ開き、開けないものや、ページの題名が変わったものを知らせます。
// 区のサイトに負担をかけないよう、1件ごとに3秒あけます。アプリ自体はこの点検と無関係に、通信なしで動きます。
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..');
const ctx = { window: {} }; vm.runInNewContext(readFileSync(join(dir, 'data.js'), 'utf8'), ctx);
const D = ctx.window.GIIN_DATA;
// それぞれのページの題名に入っているはずの言葉（ページが別の内容に変わっていないかを見る）
const WORD = { '庁議資料': '庁議', '報道発表': '報道発表', '教育委員会の定例会': '会議', 'パブリックコメント': 'パブリックコメント', '区民の声': '区民の声', '例規集': '例規集', '会議録': '会議録', 'インターネット中継': '中継', '議員名簿': '議員名簿', '議会日程': '日程' };
const list = D.links.map((l) => ({ na: l.na, url: l.url, word: WORD[l.na] })).concat([{ na: '電話番号の出典', url: D.denwaShutten.url, word: '区役所' }]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ng = [];
for (const x of list) {
  let note = '';
  for (let i = 0; i < 3 && note !== 'ok'; i++) {
    try {
      const res = await fetch(x.url, { redirect: 'follow', signal: AbortSignal.timeout(30000) });
      const title = ((await res.text()).match(/<title>([^<]*)<\/title>/) || [])[1] || '';
      note = !res.ok ? '開けません（' + res.status + '）' : (x.word && !title.includes(x.word)) ? '題名が変わっています（' + title.trim() + '）' : 'ok';
      if (res.ok) break;
    } catch (e) { note = '開けません（' + (e.cause && e.cause.code || e.name) + '）'; }
    await sleep(5000);
  }
  console.log((note === 'ok' ? 'OK  ' : 'NG  ') + x.na + '  ' + x.url + (note === 'ok' ? '' : '  ' + note));
  if (note !== 'ok') ng.push(x.na);
  await sleep(3000);
}
if (ng.length) { console.error('\n点検が必要なリンク: ' + ng.join('、') + '\n公式サイトで新しいページを探し、giin/data.js を直してください。'); process.exit(1); }
console.log('\nすべて開けました（' + list.length + '件）');
