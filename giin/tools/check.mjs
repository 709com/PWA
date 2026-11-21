// このファイルは「公開前の自動点検」です。GitHubに変更を送るたびに自動で動きます（.github/workflows/giin-check.yml）。
// 確かめること：外部への通信がない／音・振動・撮影・録音・ファイル取り込みの命令がない／鍵や個人の入力が紛れていない／版の番号がそろっている／選挙の期間でない。
// 手元で動かすとき： node giin/tools/check.mjs
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => readFileSync(join(dir, f), 'utf8');
const ng = [];
const must = (cond, msg) => { if (!cond) ng.push(msg); };

// 1. 置いてよいファイルだけがあるか（PDF・画像・音声・映像などが紛れ込んでいないか）
const allowed = new Set(['index.html', 'style.css', 'app.js', 'data.js', 'sw.js', 'manifest.json', 'icon-180.png', 'icon-512.png', 'README.md', 'tools']);
readdirSync(dir).forEach((f) => must(allowed.has(f), '決めたもの以外のファイルがあります: ' + f));

const html = read('index.html'), app = read('app.js'), sw = read('sw.js'), css = read('style.css');

// 2. 外部への通信を止める設定（コンテンツセキュリティポリシー）があるか
must(/Content-Security-Policy" content="default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; manifest-src 'self'; worker-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'"/.test(html), '外部への通信を止める設定（CSP）が変わっています');
must(html.includes('このアプリは入力内容をどこにも送信しません'), '「どこにも送信しません」の表示がありません');
must(html.includes('たかはまなおき個人が作成したものです。文京区議会の公式のものではありません'), '運営者の表示がありません');

// 3. 画面のファイルが外部を読み込んでいないか
const outside = (html.match(/(?:src|href)="(?:https?:)?\/\/[^"]*"/g) || []);
must(outside.length === 0, '画面が外部のファイルを読み込んでいます: ' + outside.join(' '));
must(!/@import|url\(/.test(css), '見た目のファイルが別のファイルを読み込んでいます');
must(!/<(input[^>]*type="file"|video|audio|canvas|iframe|form)\b/i.test(html), 'ファイル取り込み・映像・音声などの部品が入っています');

// 4. 送信・音・振動・撮影・録音・ファイルの読み書きの命令がないか
const banned = /\b(XMLHttpRequest|WebSocket|EventSource|sendBeacon|importScripts|getUserMedia|MediaRecorder|AudioContext|webkitAudioContext|speechSynthesis|SpeechRecognition|vibrate|FileReader|showOpenFilePicker|showSaveFilePicker|createObjectURL|Notification|PushManager|geolocation|indexedDB|eval)\b|new Audio|new Image|\.download\b|document\.cookie|navigator\.share/;
[['app.js', app], ['sw.js', sw]].forEach(([n, s]) => { const m = s.match(banned); must(!m, n + ' に使わない決まりの命令があります: ' + (m && m[0])); });
must(!/\bfetch\s*\(/.test(app), 'app.js に通信の命令（fetch）があります');
must((sw.match(/\bfetch\s*\(/g) || []).length === 3, 'sw.js の通信の命令の数が変わっています（同じフォルダのファイルを取る3か所だけのはず）');
must(!/https?:\/\//.test(app + sw + css), 'プログラムの中に外部のアドレスが書かれています');

// 5. 鍵・メールアドレスらしきものがないか
const all = html + app + sw + css + read('data.js') + read('manifest.json');
const secret = all.match(/(api[_-]?key|secret|password|token|BEGIN [A-Z ]*PRIVATE KEY|AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9]{20,}|[\w.+-]+@[\w-]+\.[\w.]+)/i);
must(!secret, '鍵やメールアドレスらしき文字があります: ' + (secret && secret[0]));

// 6. リンクと電話番号は、公式サイトと公開の番号だけか
const ctx = { window: {} }; vm.runInNewContext(read('data.js'), ctx);
const D = ctx.window.GIIN_DATA;
must(D && D.links.length > 0 && D.denwa.length > 0, 'data.js が読めません');
if (D) {
  D.links.forEach((l) => must(l.url.startsWith('https://www.city.bunkyo.lg.jp/'), '公式サイト以外のリンクがあります: ' + l.na));
  must(D.denwaShutten.url.startsWith('https://www.city.bunkyo.lg.jp/'), '電話番号の出典が公式サイトではありません');
  D.denwa.forEach((k) => {
    must(k.tel.length > 0 && k.tel.every((t) => /^0\d{1,3}-\d{3,4}-\d{4}$/.test(t.no)), '電話番号の形がおかしい: ' + k.ka);
    must(!/内線/.test(JSON.stringify(k)), '内線番号が入っています: ' + k.ka);
  });
  must(/^\d{4}-\d{2}-\d{2}$/.test(D.kakunin), '確認した日がありません');
}

// 7. 版の番号がそろっているか
const v1 = (app.match(/APP_VERSION = '([^']+)'/) || [])[1], v2 = (sw.match(/VERSION = '([^']+)'/) || [])[1];
must(v1 && v1 === v2, '版の番号が app.js（' + v1 + '）と sw.js（' + v2 + '）でちがいます');
(sw.match(/FILES = \[(.*?)\]/s)[1].match(/'\.\/[^']+'/g) || []).forEach((f) => { const n = f.slice(3, -1); must(allowed.has(n), '保存するファイルの一覧に知らないファイルがあります: ' + n); });

// 8. 選挙の期間（告示日〜投票日）は公開内容を更新しない。告示日は見込みなので、区の公表で確かめて直すこと
const QUIET = { from: '2027-04-18', to: '2027-04-25' };
const today = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);   // 日本時間の今日
must(today < QUIET.from || today > QUIET.to, '選挙の期間（' + QUIET.from + '〜' + QUIET.to + '）です。公開している内容を更新しないでください');

if (ng.length) { console.error('点検で引っかかりました:\n- ' + ng.join('\n- ')); process.exit(1); }
console.log('点検OK（版 ' + v1 + '、リンク ' + D.links.length + '件、電話番号 ' + D.denwa.length + '課）');
