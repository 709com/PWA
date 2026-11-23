// このファイルは「サービスワーカー」です。アプリのファイルを端末の中に保存しておき、通信がなくても開けるようにします。
// /giin/ のアプリと同じ「新しい版の知らせ」の仕組みを使っています。
// アプリを更新するときは、下の VERSION と config.js の VERSION を同じ番号に上げてください。
// このファイルが読みに行くのは、同じフォルダの中のファイルだけです（外部へは通信しません）。

const VERSION = '0.1.0';
importScripts('./config.js?v=' + VERSION);
const CACHE = 'bunkyo-' + VERSION;
const FILES = self.BK_CONFIG.ALL_FILES;

// 初めて読み込まれたとき：必要なファイルを1つずつ取り直して保存する
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => Promise.all(FILES.map((f) =>
      fetch(new Request(f, { cache: 'reload' })).then((res) => {
        if (!res.ok) throw new Error('保存できませんでした: ' + f);
        return c.put(f, res);
      })
    )))
  );
  // すぐには切り替えず、画面の「切り替える」が押されるまで待つ
});

// 新しい版に切り替わったとき：古い版の保存ファイルを消す
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('bunkyo-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

// ファイルの読み込み：保存してあるものを使う。なければ同じフォルダから取る
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
