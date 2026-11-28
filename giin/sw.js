// このファイルは「サービスワーカー」です。アプリのファイルを端末の中に保存しておき、通信がなくても開けるようにします。
// アプリを更新するときは、下の VERSION と app.js の APP_VERSION を同じ番号に上げてください。
// このファイルが読みに行くのは、同じフォルダの中のファイルだけです（外部へは通信しません）。

const VERSION = '1.0.0';
const CACHE = 'giin-' + VERSION;
const FILES = ['./', './index.html', './style.css', './app.js', './data.js', './manifest.json', './icon-180.png', './icon-512.png'];

// 初めて読み込まれたとき：必要なファイルを1つずつ取り直して保存する（1つでも失敗したら、次に開いたときにやり直す）
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => Promise.all(FILES.map((f) =>
      fetch(new Request(f, { cache: 'reload' })).then((res) => {
        if (!res.ok || res.redirected) throw new Error('保存できませんでした: ' + f);
        return c.put(f, res);
      })
    )))
  );
  // すぐには切り替えず、画面の「更新する」が押されるまで待つ
});

// 新しい版に切り替わったとき：古い版の保存ファイルを消す
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('giin-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// 画面からの問い合わせに答える
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') { self.skipWaiting(); return; }
  // 「全部保存できているか」を調べて返す
  if (event.data === 'CHECK' && event.ports[0]) {
    caches.open(CACHE)
      .then((c) => Promise.all(FILES.map((f) => c.match(f).then((r) => (r ? null : f)))))
      .then((miss) => event.ports[0].postMessage({ version: VERSION, missing: miss.filter(Boolean) }))
      .catch(() => event.ports[0].postMessage({ version: VERSION, missing: ['?'] }));
  }
});

// ファイルの読み込み：保存してあるものを使う。なければ同じフォルダから取る。画面の読み込みで通信がないときはトップを返す
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    caches.open(CACHE).then((c) => c.match(req, { ignoreSearch: true }).then((hit) => {
      if (hit) return hit;
      if (req.mode === 'navigate') return c.match('./index.html').then((top) => top || fetch(req));
      return fetch(req);
    }))
  );
});
