// このファイルは「サービスワーカー」です。アプリのファイルをiPhoneの中に保存しておき、電波がなくても起動できるようにします。
// アプリを更新するときは、下の VERSION と index.html の APP_VERSION を同じ番号に上げてください。

const VERSION = '1.0.0';
const CACHE = 'pomodoro-' + VERSION;
const FILES = ['./', './index.html', './manifest.json', './icon-180.png', './icon-512.png'];

// 初めて読み込まれたとき：必要なファイルをまとめて保存する
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)));
  // すぐには切り替えず、画面の「更新する」ボタンが押されるまで待つ
});

// 新しい版に切り替わったとき：古い版の保存ファイルを消す
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('pomodoro-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// 画面から「更新する」が押されたら、新しい版に切り替える
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

// ファイルの読み込み：保存してあるものを優先して使い、なければネットから取る
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((hit) => {
      if (hit) return hit;
      return fetch(event.request).catch(() => {
        // 電波がなくて取れないとき、画面の読み込みならトップを返す
        if (event.request.mode === 'navigate') return caches.match('./');
        return Response.error();
      });
    })
  );
});

// 通知を押したとき：アプリを前面に出す（開いていなければ開く）
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) if ('focus' in c) return c.focus();
      return self.clients.openWindow('./');
    })
  );
});
