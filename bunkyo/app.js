// このファイルは「文京区民アプリ」の骨組みです。最初の画面（6つのタイル）、共通のページ、
// 「新しい機能が届きました」の知らせ、お休みの切り替えを受け持ちます。
// 各機能（換算機など）は apps/ の中の別ファイルで、ここには書きません。
(function () {
  'use strict';
  var C = self.BK_CONFIG, D = self.BK_DATA;
  var view = document.getElementById('view');
  var apps = {}, current = null;

  // 画面の部品を作る小さな道具
  function h(tag, attrs) {
    var el = document.createElement(tag), i, k;
    for (k in (attrs || {})) {
      if (k === 'text') el.textContent = attrs[k];
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] !== false && attrs[k] != null) el.setAttribute(k, attrs[k]);
    }
    for (i = 2; i < arguments.length; i++) {
      var c = arguments[i];
      if (c == null || c === false) continue;
      (Array.isArray(c) ? c : [c]).forEach(function (x) { if (x != null && x !== false) el.append(x.nodeType ? x : String(x)); });
    }
    return el;
  }
  function svg(paths, cls) {
    var NS = 'http://www.w3.org/2000/svg', s = document.createElementNS(NS, 'svg');
    s.setAttribute('viewBox', '0 0 48 48'); s.setAttribute('aria-hidden', 'true'); if (cls) s.setAttribute('class', cls);
    paths.forEach(function (d) {
      var p = document.createElementNS(NS, 'path'); p.setAttribute('d', d);
      p.setAttribute('fill', 'none'); p.setAttribute('stroke', 'currentColor');
      p.setAttribute('stroke-width', '2'); p.setAttribute('stroke-linecap', 'square'); s.append(p);
    });
    return s;
  }
  // タイルの絵（すべて自作の線画）
  var ICON = {
    dome: ['M5 30 Q24 4 43 30', 'M3 30 H45', 'M6 37 H42', 'M6 37 v6 M15 37 v4 M24 37 v6 M33 37 v4 M42 37 v6'],
    saka: ['M4 40 H44 V16 Z', 'M10 24 a5 5 0 1 0 .1 0', 'M4 44 H44'],
    yayoi: ['M18 8 H30', 'M20 8 C20 15 11 18 11 28 C11 37 17 42 24 42 S37 37 37 28 C37 18 28 15 28 8', 'M13 24 H35', 'M30 20 L44 6'],
    kuka: ['M17 36 V11 L35 7 V32', 'M17 17 L35 13', 'M12 32 a5 4 0 1 0 .1 0', 'M30 28 a5 4 0 1 0 .1 0'],
    nenne: ['M31 7 A17 17 0 1 0 41 33 A14 14 0 0 1 31 7 Z', 'M8 8 h7 l-7 8 h7'],
    botsu: ['M8 19 H40 V41 H8 Z', 'M5 10 H43 V19 H5 Z', 'M19 27 H29']
  };
  function sealSvg() { // 角印「本家」
    var NS = 'http://www.w3.org/2000/svg', s = document.createElementNS(NS, 'svg');
    s.setAttribute('viewBox', '0 0 60 60'); s.setAttribute('class', 'seal'); s.setAttribute('role', 'img'); s.setAttribute('aria-label', '本家の印');
    s.innerHTML = '<rect x="3" y="3" width="54" height="54" rx="3" fill="none" stroke="currentColor" stroke-width="4"/>' +
      '<text x="30" y="27" text-anchor="middle" font-size="21" font-weight="700" fill="currentColor" font-family="Hiragino Mincho ProN,Yu Mincho,serif">本</text>' +
      '<text x="30" y="50" text-anchor="middle" font-size="21" font-weight="700" fill="currentColor" font-family="Hiragino Mincho ProN,Yu Mincho,serif">家</text>';
    return s;
  }

  function today() { // 日本時間の今日（例：2026-11-23）
    return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(new Date());
  }
  function paused() {
    var p = C.PAUSE, t = today();
    return p.force || (t >= p.from && t <= p.to);
  }
  function go(hash) { location.hash = hash; }
  function bar(title, no) {
    return h('header', { class: 'bar' },
      h('button', { class: 'back', type: 'button', onclick: function () { go('#/'); } }, '‹ もどる'),
      h('h1', null, no ? h('span', { class: 'no', text: no }) : null, title));
  }
  function majime(text) { // 「まじめな一言」の札と「声を送る」
    return h('section', { class: 'majime' },
      h('p', { class: 'tag', text: 'まじめな一言' }),
      h('p', { class: 'txt', text: text }),
      h('a', { class: 'btn line', href: C.LINE_URL, target: '_blank', rel: 'noopener' }, '声を送る（公式LINEが開きます）'),
      h('p', { class: 'small', text: 'このアプリの中では、お名前などの入力はいただきません。' }));
  }
  function loadScript(src) {
    return new Promise(function (ok, ng) {
      var s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = ng; document.head.append(s);
    });
  }

  // ── 最初の画面 ──
  function home() {
    var list = h('ul', { class: 'tiles' });
    C.TILES.forEach(function (t) {
      var open = t.status === 'open';
      list.append(h('li', null, h('button', {
        class: 'tile ' + (open ? 'open' : 'soon'), type: 'button',
        'aria-label': t.no + '番 ' + t.name + (open ? '（開いています）' : '（準備中・近日開店）'),
        onclick: function () { open ? go('#/app/' + t.id) : teaser(t); }
      },
        h('span', { class: 'no', text: t.no + '番' }),
        open ? h('span', { class: 'lamp', text: '受付中' }) : h('span', { class: 'fuda' }, h('b', { text: '近日開店' })),
        svg(ICON[t.id] || []),
        h('span', { class: 'name', text: t.name }),
        h('span', { class: 'desc', text: t.desc }))));
    });
    view.replaceChildren(
      h('header', { class: 'mast' },
        h('p', { class: 'doc', text: '区民各位　　　　　文換第一号' }),
        h('h1', { text: '文京区民アプリ' }),
        h('p', { class: 'sub', text: '〜本家・東京ドーム換算機〜' }),
        h('p', { class: 'by', text: '制作：ぶんきょう子育て.ネット（区議会の会派）' }),
        sealSvg()),
      h('p', { class: 'guide' }, h('span', { text: '窓口は6つ。番号の順に開きます。' }), h('span', { text: '本日 1／6' })),
      list,
      h('nav', { class: 'foot', 'aria-label': 'このアプリの案内' },
        h('a', { href: '#/voices' }, '届いた声と、その後'),
        h('a', { href: '#/sources' }, '数字の出どころ'),
        h('a', { href: '#/about' }, 'このアプリについて')),
      h('p', { class: 'small', text: '冗談のアプリです。株式会社東京ドームとは関係ありません。版 ' + C.VERSION }));
  }
  function teaser(t) {
    var d = h('dialog', null,
      h('h2', { text: t.no + '番　' + t.name }),
      h('p', { text: t.teaser }),
      h('p', { class: 'small', text: 'ただいま仕込み中です。開いたら、このアプリに「新しい機能が届きました」とお知らせします。' }),
      h('button', { class: 'btn', type: 'button', onclick: function () { d.close(); } }, 'たのしみに待つ'));
    d.addEventListener('close', function () { d.remove(); });
    document.body.append(d);
    if (d.showModal) d.showModal(); else d.setAttribute('open', '');
  }

  // ── 共通のページ ──
  function pageVoices() {
    view.replaceChildren(bar('届いた声と、その後'),
      h('p', { text: 'このアプリから届いた声と、それを受けて会派がしたこと・区に伝えたことを、ここに載せていきます。' }),
      h('div', { class: 'empty', text: 'これから載せます。' }),
      h('p', { class: 'small', text: '載せるときは、個人が分からない形にまとめます。' }),
      h('a', { class: 'btn line', href: C.LINE_URL, target: '_blank', rel: 'noopener' }, '声を送る（公式LINEが開きます）'));
  }
  function srcBlock(u, unit) {
    var s = D.sources[u.src];
    return h('div', { class: 'src' },
      h('div', null, u.name + (u.note ? '（' + u.note + '）' : '') + '：', h('b', { text: u.value.toLocaleString('ja-JP') + ' ' + unit })),
      u.how ? h('small', { text: u.how }) : null,
      h('small', null, '資料：' + s.title + '（' + s.date + ' 確認）'),
      h('a', { href: s.url, target: '_blank', rel: 'noopener', text: s.url }));
  }
  function pageSources() {
    var kids = [bar('数字の出どころ'),
      h('p', { text: 'このアプリの数字は、施設や区・国などの公式の資料で確かめたものだけを使っています。確かめられなかった単位は載せていません。' })];
    [['area', '広さ', '㎡'], ['height', '高さ', 'm']].forEach(function (k) {
      var g = D[k[0]];
      kids.push(h('h2', { text: k[1] + '：文京区の単位' }));
      g.bunkyo.forEach(function (u) { kids.push(srcBlock(u, k[2])); });
      if (g.familiar.length) {
        kids.push(h('h2', { text: k[1] + '：身近なもの' }));
        g.familiar.forEach(function (u) { kids.push(srcBlock(u, k[2])); });
      }
    });
    if (D.kusei && D.kusei.length) {
      kids.push(h('h2', { text: '区政モードの数字' }));
      D.kusei.forEach(function (u) { kids.push(srcBlock(u, u.unit)); });
    }
    kids.push(h('h2', { text: '確かめられず、載せていないもの' }));
    D.excluded.forEach(function (e) { kids.push(h('div', { class: 'src' }, h('div', { text: e.name }), h('small', { text: e.reason }))); });
    kids.push(h('p', { class: 'small', text: '数字は資料の改定で変わることがあります。誤りにお気づきの場合は「このアプリについて」の問い合わせ先までお知らせください。' }));
    view.replaceChildren.apply(view, kids);
  }
  function pageAbout() {
    view.replaceChildren(bar('このアプリについて'),
      h('p', { text: '文京区民のための、冗談のアプリです。実用性はあまりありません。笑ったあとに、文京区のこれからを少しだけ考えるきっかけになればと思って作っています。' }),
      h('h2', { text: '運営' }),
      h('p', null, 'ぶんきょう子育て.ネット（文京区議会の会派）', h('br'),
        h('a', { href: C.SITE_URL, target: '_blank', rel: 'noopener', text: C.SITE_URL })),
      h('div', { class: 'box' },
        h('p', { text: '文京区や文京区議会が作った公式のアプリではありません。' }),
        h('p', { text: '株式会社東京ドームとは関係ありません。「東京ドーム」は、広さ・高さのたとえとして使っています。' })),
      h('h2', { text: 'テスト公開中です' }),
      h('p', { text: '現在はテスト公開です。機能は1つずつ足していきます。予告なく内容が変わることがあります。' }),
      h('h2', { text: '数字の出どころ' }),
      h('p', null, '使っている数字と資料は、', h('a', { href: '#/sources', text: '「数字の出どころ」' }), 'に一覧で載せています。'),
      h('h2', { text: '情報の扱い' }),
      h('p', { text: '利用者の情報は集めていません。入力した数字は、その場の計算に使うだけで、外に送らず、保存もしません。' }),
      h('h2', { text: '問い合わせ先' }),
      h('p', { text: '掲載内容に問題がある場合は、ご連絡いただければすぐに対応します。' }),
      h('a', { class: 'btn line', href: C.LINE_URL, target: '_blank', rel: 'noopener' }, '公式LINEで連絡する'),
      h('a', { class: 'btn line', href: C.SITE_URL, target: '_blank', rel: 'noopener' }, '会派サイトを開く'),
      h('p', { class: 'small', text: '版 ' + C.VERSION }));
  }
  function pageApp(id) {
    var t = C.TILES.filter(function (x) { return x.id === id; })[0];
    if (!t || t.status !== 'open') { go('#/'); return; }
    var body = h('div');
    view.replaceChildren(bar(t.name, t.no + '番窓口'), body);
    if (t.majime) view.append(majime(t.majime));
    var need = apps[id] ? Promise.resolve() : t.files.reduce(function (p, f) { return p.then(function () { return loadScript(f); }); }, Promise.resolve());
    need.then(function () {
      if (location.hash !== '#/app/' + id) return;
      current = apps[id]; current.mount(body, api);
    }).catch(function () {
      body.append(h('div', { class: 'empty', text: '読み込めませんでした。通信のあるところで、もう一度お試しください。' }));
    });
  }

  function route() {
    if (current && current.unmount) current.unmount();
    current = null;
    document.querySelectorAll('dialog').forEach(function (d) { d.remove(); });
    if (paused()) {
      document.getElementById('testband').hidden = true;
      view.replaceChildren(h('div', { class: 'pause' },
        h('h1', { text: 'ただいま、お休みをいただいております' }),
        h('p', { text: C.PAUSE.force ? 'しばらくお待ちください。' : C.PAUSE.reopen + 'に再開します。' })));
      return;
    }
    var p = location.hash.replace(/^#\/?/, '').split('/');
    if (p[0] === 'app') pageApp(p[1]);
    else if (p[0] === 'voices') pageVoices();
    else if (p[0] === 'sources') pageSources();
    else if (p[0] === 'about') pageAbout();
    else home();
    window.scrollTo(0, 0);
  }

  var api = { h: h, config: C, data: D, today: today };
  self.Bunkyo = { register: function (id, def) { apps[id] = def; }, h: h };
  window.addEventListener('hashchange', route);
  route();

  // ── 新しい版の知らせ（/giin/ と同じ仕組み） ──
  if ('serviceWorker' in navigator) {
    var had = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(function (reg) {
      var show = function (w) {
        document.getElementById('update').hidden = false;
        document.getElementById('update-btn').onclick = function () { w.postMessage('SKIP_WAITING'); };
      };
      if (reg.waiting && navigator.serviceWorker.controller) show(reg.waiting);
      reg.addEventListener('updatefound', function () {
        var w = reg.installing; if (!w) return;
        w.addEventListener('statechange', function () {
          if (w.state === 'installed' && navigator.serviceWorker.controller) show(w);
        });
      });
      // 画面に戻るたびに、新しい版がないか確かめる。お休みの日付に入っていないかも確かめる
      document.addEventListener('visibilitychange', function () {
        if (document.hidden) return;
        reg.update().catch(function () {});
        if (paused()) route();
      });
    }).catch(function () {});
    navigator.serviceWorker.addEventListener('controllerchange', function () { if (had) location.reload(); had = true; });
  }
})();
