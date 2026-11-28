// このファイルは「議員のタイマーと区の情報入口」の動きを決めています。
// 入力した内容は端末の中（localStorage）だけに保存します。外部へ送る命令は1つも書いていません。音と振動も出しません。
'use strict';

// ===== 基本の設定 =====
// アプリを更新するときは、この番号と sw.js の VERSION を同じ番号に上げる
const APP_VERSION = '1.0.0';
const KEY = 'giin:v1';
const HK_TOTAL_MS = 30 * 60000;          // 本会議は30分固定
const WARN5 = 5 * 60000, WARN1 = 60000;  // 残り5分・1分で知らせる
const $ = (id) => document.getElementById(id);
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

// ===== 保存してある内容を読む =====
// yk＝予算・決算審査、hk＝本会議。時計は「動き始めた時刻（端末の時刻）」を覚えておき、いまの時刻との差で計算する。
// だから、他のアプリに切り替えても画面を消しても、時間はずれない。
function blank() {
  return {
    kind: 'yk', tab: 'timer', seen: 0,
    yk: { totalMs: 0, usedMs: 0, since: null, started: false, mode: 'flow', kan: [], cur: null, log: [] },
    hk: { totalMs: HK_TOTAL_MS, usedMs: 0, since: null, started: false, mode: 'flow' }
  };
}
function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && s.yk && s.hk) { const b = blank(); return Object.assign(b, s, { yk: Object.assign(b.yk, s.yk), hk: Object.assign(b.hk, s.hk, { totalMs: HK_TOTAL_MS }) }); }
  } catch (e) { /* 壊れていたら最初から */ }
  return blank();
}
let st = load();
let saveFailed = false;
function save() {
  st.seen = Date.now();
  try { localStorage.setItem(KEY, JSON.stringify(st)); saveFailed = false; } catch (e) { saveFailed = true; }
}

// ===== 時間の計算と表示の形 =====
const T = () => st[st.kind];
const used = (t) => t.usedMs + (t.since ? Math.max(0, Date.now() - t.since) : 0);
const p2 = (n) => String(n).padStart(2, '0');
// 「分:秒」。90分なら 90:00 と出す
function fmt(ms) { const s = Math.floor(Math.max(0, ms) / 1000); return p2(Math.floor(s / 60)) + ':' + p2(s % 60); }
function fmtJa(ms) { const s = Math.round(Math.abs(ms) / 1000); return Math.floor(s / 60) + '分' + p2(s % 60) + '秒'; }
function hm(t) { const d = new Date(t); return p2(d.getHours()) + ':' + p2(d.getMinutes()); }
function ymd(t) { const d = new Date(t); return d.getFullYear() + '/' + (d.getMonth() + 1) + '/' + d.getDate(); }
const kanName = (id) => { const k = st.yk.kan.find((x) => x.id === id); return k ? k.name : '（款なし）'; };

// ===== 時計を動かす・止める =====
// 止めるとき：動いていた区間を記録に残す（予算・決算のみ）
function closeSegment(t) {
  if (!t.since) return;
  const now = Date.now(), ms = Math.max(0, now - t.since);
  t.usedMs += ms;
  if (t === st.yk && ms >= 1000) t.log.push({ k: 'run', s: t.since, e: now, kan: t.cur, ms: ms });
  t.since = null;
}
function start(t) { if (!t.since) { t.since = Date.now(); t.started = true; } }
function toggleMain() {
  const t = T();
  if (t.totalMs <= 0) { openSetBox(); return; }
  if (t.since) closeSegment(t); else start(t);
  save(); render(); syncWake();
}
function resetTimer() {
  const t = T();
  if (st.kind === 'yk') {
    if (!confirm('予算・決算審査の残り時間と記録を消して、最初からにします。款の配分は残ります。よろしいですか。')) return;
    t.usedMs = 0; t.since = null; t.started = false; t.log = [];
  } else {
    if (t.started && !confirm('本会議のタイマーを30分に戻します。よろしいですか。')) return;
    t.usedMs = 0; t.since = null; t.started = false;
  }
  save(); render(); syncWake();
}

// ===== 予算・決算：持ち時間と、事務局の時計への合わせ直し =====
function openSetBox() { $('set-box').open = true; $('in-total').focus(); }
function setTotal() {
  const m = Math.floor(Number($('in-total').value));
  if (!(m >= 1 && m <= 999)) { alert('持ち時間を1〜999分で入れてください。'); return; }
  st.yk.totalMs = m * 60000; save(); render();
}
function adjustRemain() {
  const t = st.yk;
  if (t.totalMs <= 0) { alert('先に持ち時間を決めてください。'); return; }
  const m = Math.floor(Number($('in-rem-m').value || 0)), s = Math.floor(Number($('in-rem-s').value || 0));
  if (!(m >= 0 && s >= 0 && s <= 59) || $('in-rem-m').value === '') { alert('残り時間を「分」と「秒」で入れてください。'); return; }
  const target = m * 60000 + s * 1000;
  if (target > t.totalMs) { alert('残り時間が持ち時間より長くなっています。'); return; }
  const running = !!t.since;
  closeSegment(t);
  const newUsed = t.totalMs - target, delta = newUsed - t.usedMs;
  t.log.push({ k: 'adj', s: Date.now(), kan: t.cur, ms: delta });
  t.usedMs = newUsed; t.started = true;
  if (running) start(t);
  $('in-rem-m').value = ''; $('in-rem-s').value = '';
  save(); render();
}

// ===== 予算・決算：款ごとの配分 =====
function addKan() {
  const name = $('in-kan').value.trim().slice(0, 20), plan = Math.floor(Number($('in-plan').value || 0));
  if (!name) { alert('款の名前を入れてください。'); return; }
  if (!(plan >= 0 && plan <= 999)) { alert('予定は0〜999分で入れてください。'); return; }
  const id = 'k' + Date.now().toString(36);
  st.yk.kan.push({ id: id, name: name, planMin: plan });
  if (!st.yk.cur) st.yk.cur = id;
  $('in-kan').value = ''; $('in-plan').value = '';
  save(); render();
}
function selectKan(id) {
  const t = st.yk;
  if (t.cur === id) return;
  const running = !!t.since;
  closeSegment(t);      // いまの款の区間をここで区切る
  t.cur = id;
  if (running) start(t);
  save(); render();
}
function delKan(id) {
  const t = st.yk;
  if (!confirm('「' + kanName(id) + '」を配分の表から消します。使った時間の記録は「（款なし）」として残ります。')) return;
  const running = !!t.since;
  closeSegment(t);
  t.kan = t.kan.filter((k) => k.id !== id);
  t.log.forEach((l) => { if (l.kan === id) l.kan = null; });
  if (t.cur === id) t.cur = t.kan.length ? t.kan[0].id : null;
  if (running) start(t);
  save(); render();
}
// 款ごとに使った時間（動いている最中の分も足す）
function usedByKan() {
  const t = st.yk, m = {};
  t.log.forEach((l) => { const k = l.kan || ''; m[k] = (m[k] || 0) + l.ms; });
  if (t.since) { const k = t.cur || ''; m[k] = (m[k] || 0) + Math.max(0, Date.now() - t.since); }
  return m;
}

// ===== 画面に出す =====
let lastSig = '';
function render() {
  const t = T(), isYk = st.kind === 'yk';
  const u = used(t), rem = t.totalMs - u, set = t.totalMs > 0;
  const over = set && rem <= 0;
  // 残りは切り上げ表示（00:00 になった瞬間が時間切れ）
  $('remain').textContent = !set ? '--:--' : over ? '+' + fmt(-rem) : fmt(rem + 999);
  $('remain-lbl').textContent = over ? '超過した時間' : '残り';
  $('used').textContent = fmt(u);
  $('total').textContent = set ? fmt(t.totalMs) : '未設定';

  // 残り5分・1分・時間切れ：色＋枠の形＋文字で知らせる（音と振動は出さない）
  let cls = '', phase = '';
  if (set && t.started) {
    if (over) { cls = 'over'; phase = '■ 時間を超えました'; }
    else if (rem <= WARN1) { cls = 'p1'; phase = '◆ 残り1分を切りました'; }
    else if (rem <= WARN5) { cls = 'p5'; phase = '▲ 残り5分を切りました'; }
  }
  $('clock').className = 'clock' + (cls ? ' ' + cls : '');
  $('phase').textContent = phase;

  const stopMode = t.mode === 'stop';
  const sig = [st.kind, st.tab, !!t.since, t.started, set, t.mode, saveFailed, st.yk.cur, st.yk.log.length, st.yk.kan.length].join('|');
  if (sig !== lastSig) {
    lastSig = sig;
    $('status').textContent = saveFailed ? '⚠ 端末に保存できませんでした（空き容量やプライベートブラウズを確認）'
      : !set ? '持ち時間を決めてください'
      : t.since ? '▶ 動いています' + (isYk && st.yk.cur ? '（' + kanName(st.yk.cur) + '）' : '')
      : t.started ? (stopMode ? '⏸ 止めています（答弁中）' : '⏸ 止めています') : '止まっています';
    $('btn-main').textContent = !set ? '持ち時間を決める'
      : t.since ? (stopMode ? '答弁に入る（止める）' : '一時停止')
      : t.started ? (stopMode ? '質問に戻る（進める）' : '再開') : '開始';
    $('mode-hint').textContent = stopMode ? '答弁の間は自分でボタンを押して止めます。' : '質問も答弁も、止めずに数えます。';
    document.querySelectorAll('[data-mode]').forEach((b) => b.classList.toggle('on', b.dataset.mode === t.mode));
    document.querySelectorAll('[data-kind]').forEach((b) => b.classList.toggle('on', b.dataset.kind === st.kind));
    document.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === st.tab));
    ['timer', 'joho', 'denwa', 'about'].forEach((n) => { $('tab-' + n).hidden = st.tab !== n; });
    $('yk-side').hidden = !isYk;
    document.querySelector('.timer-grid').classList.toggle('two', isYk);
    if (isYk && document.activeElement !== $('in-total')) $('in-total').value = set ? Math.round(t.totalMs / 60000) : '';
    renderLog();
  }
  if (isYk && st.tab === 'timer') renderKan();
}

let kanSig = '';
function renderKan() {
  const t = st.yk, by = usedByKan(), body = $('kan-table').tBodies[0];
  const rows = t.kan.map((k) => ({ id: k.id, name: k.name, plan: k.planMin * 60000, used: by[k.id] || 0 }));
  if (by['']) rows.push({ id: null, name: '（款なし）', plan: 0, used: by[''] });
  // 表の作り直しは、款が増減・切り替わったときだけ（毎回作り直すと、ボタンを押している途中で消えてしまう）
  const sig = rows.map((r) => r.id + ':' + r.name + ':' + r.plan).join('|') + '#' + t.cur;
  if (sig !== kanSig) {
    kanSig = sig;
    const frag = document.createDocumentFragment();
    rows.forEach((r) => {
      const tr = el('tr', r.id && r.id === t.cur ? 'cur' : '');
      if (r.id) tr.dataset.id = r.id;
      tr.appendChild(el('td', '', r.name));
      tr.appendChild(el('td', '', r.id ? fmt(r.plan) : '—'));
      tr.appendChild(el('td', 'u'));
      tr.appendChild(el('td', 'd'));
      const td = el('td');
      if (r.id) { const b = el('button', 'del', '消す'); b.type = 'button'; b.dataset.del = r.id; td.appendChild(b); }
      tr.appendChild(td);
      frag.appendChild(tr);
    });
    if (!rows.length) { const tr = el('tr'); const td = el('td', '', '款はまだありません。下で足してください。'); td.colSpan = 5; td.style.textAlign = 'left'; tr.appendChild(td); frag.appendChild(tr); }
    body.replaceChildren(frag);
    const foot = el('tr');
    foot.appendChild(el('td', '', '合計')); foot.appendChild(el('td', 'p')); foot.appendChild(el('td', 'u'));
    const c = el('td', 'd'); c.colSpan = 2; foot.appendChild(c);
    $('kan-table').tFoot.replaceChildren(foot);
  }
  // 数字だけを書き換える
  let sp = 0, su = 0;
  rows.forEach((r, i) => {
    sp += r.plan; su += r.used;
    const tr = body.rows[i], d = Math.floor(r.used / 1000) * 1000 - r.plan;
    tr.querySelector('.u').textContent = fmt(r.used);
    const dc = tr.querySelector('.d');
    dc.textContent = !r.id ? '—' : d > 0 ? '超過 ' + fmt(d) : '残 ' + fmt(-d);
    dc.classList.toggle('plus', d > 0 && !!r.id);
  });
  const f = $('kan-table').tFoot.rows[0], left = t.totalMs - sp;
  f.querySelector('.p').textContent = fmt(sp);
  f.querySelector('.u').textContent = fmt(su);
  f.querySelector('.d').textContent = t.totalMs > 0 ? (left >= 0 ? '未配分 ' + fmt(left) : '配分が ' + fmt(-left) + ' 多い') : '';
}

function logLines() {
  const lines = []; let day = '';
  st.yk.log.forEach((l) => {
    const d = ymd(l.s);
    if (d !== day) { day = d; lines.push({ day: true, text: d }); }
    lines.push({ text: l.k === 'adj'
      ? hm(l.s) + '　合わせ直し　' + (l.ms >= 0 ? '＋' : '−') + fmtJa(l.ms) + '　' + kanName(l.kan)
      : hm(l.s) + '〜' + hm(l.e) + '　' + kanName(l.kan) + '　' + fmtJa(l.ms) });
  });
  return lines;
}
function renderLog() {
  const box = $('log'), lines = logLines(), frag = document.createDocumentFragment();
  if (!lines.length) frag.appendChild(el('div', '', '記録はまだありません。'));
  lines.forEach((l) => frag.appendChild(el('div', l.day ? 'day' : '', l.text)));
  box.replaceChildren(frag);
  if (!$('log-text').hidden) $('log-text').value = logText();
}
// 持ち出しは「画面に出した文字をコピーする」方法だけ（ファイルの書き出しは作らない）
function logText() {
  const t = st.yk, by = usedByKan(), out = [];
  out.push('予算・決算審査 持ち時間の記録');
  out.push('持ち時間 ' + fmtJa(t.totalMs) + '／使った時間 ' + fmtJa(used(t)) + '／残り ' + (t.totalMs - used(t) >= 0 ? '' : '超過 ') + fmtJa(t.totalMs - used(t)));
  out.push('', '【款ごと】');
  t.kan.forEach((k) => out.push(k.name + '　予定 ' + k.planMin + '分　使った ' + fmtJa(by[k.id] || 0)));
  if (by['']) out.push('（款なし）　使った ' + fmtJa(by['']));
  out.push('', '【いつ・どの款で・何分】');
  logLines().forEach((l) => out.push(l.day ? '■ ' + l.text : l.text));
  return out.join('\n');
}

// ===== 画面が消えないようにする（動いている間だけ） =====
let wake = null;
function syncWake() {
  const need = !!(st.yk.since || st.hk.since) && document.visibilityState === 'visible';
  if (!('wakeLock' in navigator)) { $('wake').textContent = 'この端末では「画面を消さない」機能が使えません。設定の自動ロックを長くしてください。'; return; }
  if (need && !wake) {
    navigator.wakeLock.request('screen').then((w) => {
      wake = w; $('wake').textContent = '動いている間は画面が消えません。';
      w.addEventListener('release', () => { wake = null; });
      if (!(st.yk.since || st.hk.since)) w.release();
    }).catch(() => { $('wake').textContent = '画面を消さない設定ができませんでした。画面に一度触れてください。'; });
  } else if (!need && wake) { wake.release(); wake = null; $('wake').textContent = ''; }
  else if (!need) $('wake').textContent = '';
}

// ===== リンク集と電話番号 =====
const D = window.GIIN_DATA || { links: [], denwa: [], kakunin: '', denwaShutten: {} };
function renderLinks() {
  const box = $('links'); let g = '';
  D.links.forEach((l) => {
    if (l.bunrui !== g) { g = l.bunrui; box.appendChild(el('div', 'grp', g)); }
    const a = el('a', 'link'); a.href = l.url; a.target = '_blank'; a.rel = 'noopener noreferrer';
    a.appendChild(el('b', '', l.na)); a.appendChild(el('small', '', l.setsumei));
    box.appendChild(a);
  });
  $('links-date').textContent = 'リンク先は ' + D.kakunin + ' に1件ずつ開いて確かめました。議員名簿と議会日程は写しを持たず、公式サイトを開きます。';
}
// 検索：ひらがな・カタカナ、全角・半角のちがいを気にせず探せるようにする
const norm = (s) => s.normalize('NFKC').toLowerCase().replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60)).replace(/[\s-]/g, '');
function renderDenwa() {
  const q = norm($('q').value), box = $('denwa'), frag = document.createDocumentFragment();
  let g = '', n = 0;
  D.denwa.forEach((k) => {
    if (q && !norm(k.bu + k.ka + k.shigoto + k.tel.map((t) => t.no + t.memo).join('')).includes(q)) return;
    n++;
    if (k.bu !== g) { g = k.bu; frag.appendChild(el('div', 'grp', g)); }
    const c = el('div', 'ka'); c.appendChild(el('b', '', k.ka)); c.appendChild(el('br'));
    k.tel.forEach((t) => {
      const a = el('a', '', t.no); a.href = 'tel:' + t.no.replace(/-/g, ''); c.appendChild(a);
      if (t.memo) c.appendChild(el('span', 'memo', t.memo));
    });
    c.appendChild(el('small', '', k.shigoto));
    frag.appendChild(c);
  });
  box.replaceChildren(frag);
  $('q-count').textContent = q ? (n ? n + '件見つかりました。' : '見つかりませんでした。別の言葉で試してください。') : '全' + D.denwa.length + '件';
}
function renderSrc() {
  const p = $('denwa-src'), s = D.denwaShutten;
  p.appendChild(document.createTextNode('出典：'));
  const a = el('a', '', s.na); a.href = s.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; p.appendChild(a);
  p.appendChild(document.createTextNode('（ページの更新日 ' + s.pageKoshin + '）。' + D.kakunin + ' に確認。職員の個人名や内線番号は載せていません。番号が変わっていることがあるので、出典のページも確かめてください。'));
}

// ===== 全データを消す（貸与端末の返却用） =====
function wipe() {
  if (!confirm('タイマーの残り時間、款の配分、記録をすべて消します。元には戻せません。よろしいですか。')) return;
  if (!confirm('本当に消しますか。')) return;
  if (wake) { wake.release(); wake = null; }
  try { localStorage.removeItem(KEY); } catch (e) { /* 何もしない */ }
  st = blank(); st.tab = 'about'; lastSig = ''; kanSig = '';
  let ok = true;
  try { ok = localStorage.getItem(KEY) === null; } catch (e) { ok = false; }
  $('log-text').hidden = true; $('btn-copy').hidden = true; $('log-text').value = ''; $('q').value = '';
  render(); renderDenwa();
  $('wipe-msg').textContent = ok ? '消しました（' + hm(Date.now()) + '）。この端末に入力内容は残っていません。' : '消せませんでした。Safariの設定から「履歴とWebサイトデータを消去」を行ってください。';
}

// ===== 通信なしで使える準備ができたかを確かめて、画面に出す =====
function showOffline(state, text) {
  $('offline').className = 'offline ' + state; $('offline').textContent = text;
  $('foot-offline').className = 'dot ' + state;
  $('foot-offline').textContent = '通信なしの準備：' + (state === 'ok' ? 'できています' : state === 'ng' ? 'まだです' : '確認中');
  $('btn-offline').hidden = state !== 'ng';
}
function askWorker(worker) {
  return new Promise((resolve) => {
    const ch = new MessageChannel(); const timer = setTimeout(() => resolve(null), 4000);
    ch.port1.onmessage = (e) => { clearTimeout(timer); resolve(e.data); };
    worker.postMessage('CHECK', [ch.port2]);
  });
}
function checkOffline() {
  if (!('serviceWorker' in navigator)) { showOffline('ng', 'このブラウザでは、通信なしで開く仕組みが使えません（プライベートブラウズでは使えないことがあります）。'); return; }
  showOffline('wait', '確認しています…');
  const giveUp = new Promise((r) => setTimeout(() => r(null), 15000));
  Promise.race([navigator.serviceWorker.ready, giveUp]).then((reg) => {
    if (!reg || !reg.active) { showOffline('ng', 'まだ保存できていません。通信のある所で開き直してください。'); return; }
    return askWorker(reg.active).then((res) => {
      if (res && res.missing.length === 0 && navigator.serviceWorker.controller) showOffline('ok', '通信なしで使えます（版 ' + res.version + ' を保存済み）。');
      else if (res && res.missing.length === 0) showOffline('ok', '保存できました。次に開くときから通信なしで使えます（版 ' + res.version + '）。');
      else showOffline('ng', 'まだ保存できていません。通信のある所で開き直してください。');
    });
  }).catch(() => showOffline('ng', 'まだ保存できていません。通信のある所で開き直してください。'));
}
function setupWorker() {
  if (!('serviceWorker' in navigator)) { checkOffline(); return; }
  const had = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('sw.js').then((reg) => {
    const showUpdate = (w) => { $('update').hidden = false; $('update-btn').onclick = () => w.postMessage('SKIP_WAITING'); };
    if (reg.waiting && navigator.serviceWorker.controller) showUpdate(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing; if (!w) return;
      w.addEventListener('statechange', () => {
        if (w.state === 'installed' && navigator.serviceWorker.controller) showUpdate(w);
        if (w.state === 'activated') checkOffline();
        if (w.state === 'redundant') checkOffline();
      });
    });
    // 開き直すたびに新しい版がないか確かめる（古い版が端末に残り続けないようにする）
    document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update().catch(() => {}); });
    $('btn-offline').onclick = () => { reg.update().catch(() => {}); checkOffline(); };
    checkOffline();
  }).catch(() => showOffline('ng', 'まだ保存できていません。通信のある所で開き直してください。'));
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!had || reloaded) { checkOffline(); return; }
    reloaded = true; location.reload();
  });
}

// ===== ボタンのつなぎ込み =====
$('btn-main').onclick = toggleMain;
$('btn-reset').onclick = resetTimer;
$('btn-total').onclick = setTotal;
$('btn-adjust').onclick = adjustRemain;
$('btn-kan').onclick = addKan;
$('btn-wipe').onclick = wipe;
$('q').oninput = renderDenwa;
document.querySelectorAll('[data-tab]').forEach((b) => { b.onclick = () => { st.tab = b.dataset.tab; save(); render(); window.scrollTo(0, 0); }; });
document.querySelectorAll('[data-kind]').forEach((b) => { b.onclick = () => { st.kind = b.dataset.kind; save(); render(); }; });
document.querySelectorAll('[data-mode]').forEach((b) => { b.onclick = () => { T().mode = b.dataset.mode; save(); render(); }; });
$('kan-table').onclick = (e) => {
  const del = e.target.closest('[data-del]'); if (del) { delKan(del.dataset.del); return; }
  const tr = e.target.closest('tr[data-id]'); if (tr) selectKan(tr.dataset.id);
};
$('btn-text').onclick = () => { $('log-text').hidden = false; $('btn-copy').hidden = false; $('log-text').value = logText(); };
$('btn-copy').onclick = () => {
  const ta = $('log-text'); ta.value = logText();
  const done = (ok) => { $('copy-msg').textContent = ok ? 'コピーしました。メモなどに貼り付けられます。' : 'コピーできませんでした。文字を長押しして選んでコピーしてください。'; };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(ta.value).then(() => done(true), () => done(false));
  else { ta.focus(); ta.select(); done(false); }
};

// ===== 起動 =====
$('ver').textContent = APP_VERSION; $('ver2').textContent = APP_VERSION;
// 閉じている間も時計が動いていた場合は、そのことを知らせる（時間は端末の時刻から正しく計算される）
(function () {
  const t = st.yk.since ? st.yk : st.hk.since ? st.hk : null;
  if (t && st.seen && Date.now() - st.seen > 10 * 60000) {
    $('gap').hidden = false;
    $('gap').textContent = 'お知らせ：' + (t === st.yk ? '予算・決算審査' : '本会議') + 'のタイマーは、アプリを閉じている間も動いていました（' + ymd(t.since) + ' ' + hm(t.since) + ' から）。違っていれば止めて、' + (t === st.yk ? '残り時間を合わせ直してください。' : 'やり直してください。');
    $('gap').onclick = () => { $('gap').hidden = true; };
  }
})();
renderLinks(); renderDenwa(); renderSrc(); render(); syncWake(); setupWorker();
setInterval(() => { render(); }, 250);
setInterval(() => { if (st.yk.since || st.hk.since) save(); }, 15000);   // 「最後に開いていた時刻」を覚えておく
document.addEventListener('visibilitychange', () => { lastSig = ''; render(); syncWake(); if (document.hidden) save(); });
window.addEventListener('pagehide', save);
