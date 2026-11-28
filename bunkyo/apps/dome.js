// このファイルは、一番窓口「東京ドーム換算機」です。
// 入れた数字を、文京区の単位（東京ドーム◯個分など）に換算します。逆向き（◯個分→平方メートル）もできます。
// 数字そのものは data/units.js にあります（出どころつき）。入力した数字は保存も送信もしません。
(function () {
  'use strict';
  var root, api, h, D, st;
  function setKids(el) { el.replaceChildren.apply(el, [].slice.call(arguments, 1).filter(Boolean)); }

  function norm(s) { // 全角の数字やカンマを直して数にする
    s = String(s).replace(/[０-９．]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); }).replace(/[,，\s]/g, '');
    if (!/^\d*\.?\d+$|^\d+\.$/.test(s)) return NaN;
    return parseFloat(s);
  }
  function fmt(x) {
    if (!isFinite(x)) return '—';
    if (x === 0) return '0';
    if (x < 1e-9) return 'ほぼ 0';
    if (x >= 1e12) return (x / 1e12).toLocaleString('ja-JP', { maximumSignificantDigits: 4 }) + '兆';
    if (x >= 1e8) return (x / 1e8).toLocaleString('ja-JP', { maximumSignificantDigits: 4 }) + '億';
    if (x >= 1000) return Math.round(x).toLocaleString('ja-JP');
    if (x >= 100) return x.toLocaleString('ja-JP', { maximumFractionDigits: 1 });
    return x.toLocaleString('ja-JP', { maximumSignificantDigits: 3, maximumFractionDigits: 12 });
  }
  function say(kind, r, u) {
    var n = u.name;
    if (kind === 'area') {
      if (r < 0.0001) return n + 'から見れば、ほぼ誤差です。';
      if (r < 0.1) return n + 'の片すみに、そっと置けます。';
      if (r < 0.95) return n + 'には、まだ届きません。';
      if (r <= 1.05) return 'ほぼ' + n + 'です。本家と肩を並べました。';
      if (r < 10) return n + '1' + u.counter.replace('分', '') + 'では、もう収まりません。';
      if (r < 1000) return n + 'を' + fmt(Math.round(r)) + u.counter.replace('分', '') + '並べる場所を、まず探しましょう。';
      return n + 'で数えるのは、そろそろやめませんか。';
    }
    if (r < 0.1) return n + 'の足もとにも及びません。';
    if (r < 0.95) return n + 'を、まだ見上げています。';
    if (r <= 1.05) return n + 'と、ほぼ肩を並べました。';
    if (r < 10) return n + 'を、見下ろしています。';
    return n + 'をそんなに積み重ねるのは、おすすめしません。';
  }

  function calc() { // いまの入力から、もとの量（㎡ か m）と、言い方を出す
    var g = D[st.kind], n = norm(st.text), u;
    if (st.dir === 'rev') {
      u = g.bunkyo.filter(function (x) { return x.id === st.revUnit; })[0] || g.bunkyo[0];
      if (isNaN(n)) return null;
      return { base: n * u.value, q: u.name + ' ' + fmt(n) + u.counter };
    }
    if (st.preset) return { base: st.preset.value, q: st.preset.name + ' ' + st.preset.one + '（' + fmt(st.preset.value) + g.unit + '）' };
    u = g.plain.filter(function (x) { return x.id === st.unit; })[0] || g.plain[0];
    if (isNaN(n)) return null;
    return { base: n * u.f, q: fmt(n) + ' ' + u.short };
  }

  function draw() {
    var g = D[st.kind], r = calc(), out = root.querySelector('#dome-out');
    st.last = null;
    if (!r || !(r.base > 0)) {
      out.replaceChildren(h('div', { class: 'empty', text: st.text ? '数字を入れてください（例：100）' : '数字を入れると、ここに結果が出ます。' }));
      return;
    }
    var pick = g.bunkyo.filter(function (x) { return x.id === st.pick; })[0] || g.bunkyo[0];
    var big, comment, rows = [];
    if (st.dir === 'rev') {
      big = { name: '', num: fmt(r.base), counter: g.unitName };
      comment = '逆算しました。もとの数字は「数字の出どころ」にあります。';
      g.plain.slice(1).forEach(function (p) { rows.push(h('tr', null, h('th', { text: p.label }), h('td', { text: fmt(r.base / p.f) + ' ' + p.short }))); });
    } else {
      big = { name: pick.name, num: fmt(r.base / pick.value), counter: pick.counter };
      comment = say(st.kind, r.base / pick.value, pick);
    }
    g.bunkyo.forEach(function (u) {
      if (st.dir === 'rev' && u.id === st.revUnit) return;
      rows.push(h('tr', { class: st.dir !== 'rev' && u.id === pick.id ? 'pick' : null },
        h('th', null, st.dir === 'rev' ? u.name : h('button', { type: 'button', 'aria-label': u.name + 'を大きく表示', onclick: function () { st.pick = u.id; draw(); } }, u.name),
          u.note ? h('small', { text: u.note + ' ' + fmt(u.value) + g.unit }) : h('small', { text: fmt(u.value) + g.unit })),
        h('td', { text: fmt(r.base / u.value) + ' ' + u.counter })));
    });
    st.last = { q: r.q, big: big, ref: st.dir === 'rev' ? '' : '比べた数字：' + pick.name + (pick.note ? '（' + pick.note + '）' : '') + ' ' + fmt(pick.value) + g.unit };
    setKids(out,
      h('section', { class: 'result', 'aria-live': 'polite' },
        h('p', { class: 'q', text: r.q + ' は' }),
        h('p', { class: 'big' }, big.name, h('span', { class: 'num', text: big.num }), big.counter),
        h('p', { class: 'say', text: comment + '（概算です）' }),
        h('table', { class: 'tbl' }, h('tbody', null, rows)),
        st.dir !== 'rev' ? h('p', { class: 'small', text: '名前を押すと、その単位を大きく表示します。' }) : null),
      h('button', { class: 'btn', type: 'button', onclick: certify }, '換算証明書にする'),
      h('div', { class: 'cert', id: 'dome-cert' }));
  }

  // ── 換算証明書（1枚の画像） ──
  function certify() {
    var L = st.last; if (!L) return;
    var W = 1080, H = 1350, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    var c = cv.getContext('2d'), M = '"Hiragino Mincho ProN","Yu Mincho","Noto Serif JP",serif', G = '"Hiragino Sans","Noto Sans JP",sans-serif';
    var INK = '#1b1a17', SHU = '#b3271f', SUB = '#5a5549';
    c.fillStyle = '#f6f1e3'; c.fillRect(0, 0, W, H);
    c.strokeStyle = INK; c.lineWidth = 7; c.strokeRect(38, 38, W - 76, H - 76);
    c.lineWidth = 2; c.strokeRect(56, 56, W - 112, H - 112);
    c.fillStyle = INK; c.textBaseline = 'alphabetic';
    function text(s, x, y, font, align, color, maxW) {
      c.font = font; c.textAlign = align || 'center'; c.fillStyle = color || INK;
      if (maxW && c.measureText(s).width > maxW) {
        var m = font.match(/(\d+)px/), px = +m[1];
        while (px > 20 && c.measureText(s).width > maxW) { px -= 4; c.font = font.replace(/\d+px/, px + 'px'); }
      }
      c.fillText(s, x, y);
    }
    var d = api.today().replace(/-/g, ''), t = new Date();
    var serial = d + '-' + ('0' + t.getHours()).slice(-2) + ('0' + t.getMinutes()).slice(-2);
    text('文換第 ' + serial + ' 号', W - 96, 128, '28px ' + G, 'right', SUB);
    text('換 算 証 明 書', W / 2, 270, '700 96px ' + M);
    c.fillRect(W / 2 - 220, 300, 440, 3);
    text(L.q + ' は', W / 2, 430, '46px ' + M, 'center', INK, W - 200);
    if (L.big.name) text(L.big.name, W / 2, 560, '700 68px ' + M, 'center', INK, W - 200);
    text(L.big.num, W / 2, L.big.name ? 740 : 680, '700 168px ' + M, 'center', SHU, W - 200);
    text(L.big.counter, W / 2, L.big.name ? 840 : 790, '700 64px ' + M);
    text('に相当することを、ここに証明します。', W / 2, 940, '40px ' + M);
    if (L.ref) text(L.ref, W / 2, 1000, '26px ' + G, 'center', SUB, W - 200);
    var wareki = new Intl.DateTimeFormat('ja-JP-u-ca-japanese', { timeZone: 'Asia/Tokyo', era: 'long', year: 'numeric', month: 'long', day: 'numeric' }).format(t);
    text(wareki, 110, 1100, '36px ' + M, 'left');
    text('文京区民アプリ　東京ドーム換算窓口', 110, 1156, '36px ' + M, 'left');
    // 角印「本家」
    c.save(); c.translate(880, 1100); c.rotate(-0.09); c.strokeStyle = SHU; c.lineWidth = 9; c.globalAlpha = 0.9;
    c.strokeRect(-70, -70, 140, 140);
    text('本', 0, -6, '700 60px ' + M, 'center', SHU); text('家', 0, 54, '700 60px ' + M, 'center', SHU);
    c.restore();
    text('この証明書は冗談です。効力はありません。数字の根拠は、アプリ内「数字の出どころ」をご覧ください。', W / 2, 1236, '21px ' + G, 'center', SUB, W - 160);
    text('制作：ぶんきょう子育て.ネット　／　文京区の公式のものではありません　／　株式会社東京ドームとは関係ありません', W / 2, 1270, '21px ' + G, 'center', SUB, W - 160);

    cv.toBlob(function (blob) {
      var box = root.querySelector('#dome-cert'); if (!box || !blob) return;
      if (st.url) URL.revokeObjectURL(st.url);
      st.url = URL.createObjectURL(blob);
      var file = new File([blob], 'kansan-shomeisho.png', { type: 'image/png' });
      var canShare = navigator.canShare && navigator.canShare({ files: [file] });
      box.replaceChildren(
        h('img', { src: st.url, alt: '換算証明書：' + L.q + ' は ' + L.big.name + L.big.num + L.big.counter }),
        canShare
          ? h('button', { class: 'btn', type: 'button', onclick: function () { navigator.share({ files: [file] }).catch(function () {}); } }, '画像を保存・共有する')
          : h('a', { class: 'btn', href: st.url, download: 'kansan-shomeisho.png' }, '画像を保存する'),
        h('p', { class: 'small', text: '画像を長押ししても保存できます。' }));
      box.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 'image/png');
  }

  function build() {
    var g = D[st.kind];
    var seg = function (items, key, after) {
      return h('div', { class: 'seg', role: 'group' }, items.map(function (it) {
        return h('button', { type: 'button', 'aria-pressed': String(st[key] === it[0]), onclick: function () { st[key] = it[0]; after && after(); build(); } }, it[1]);
      }));
    };
    var reset = function () { st.preset = null; st.pick = null; st.unit = null; st.revUnit = null; st.text = st.dir === 'rev' ? '3' : ''; };
    var input = h('input', { type: 'text', inputmode: 'decimal', id: 'dome-n', autocomplete: 'off', maxlength: '15',
      value: st.preset ? '' : st.text, placeholder: st.preset ? st.preset.name : '0',
      oninput: function (e) { st.text = e.target.value; st.preset = null; e.target.placeholder = '0'; draw(); } });
    var select = st.dir === 'rev'
      ? h('select', { 'aria-label': '文京区の単位', onchange: function (e) { st.revUnit = e.target.value; draw(); } },
          g.bunkyo.map(function (u) { return h('option', { value: u.id, selected: u.id === st.revUnit || null }, u.name + ' ' + u.counter); }))
      : h('select', { 'aria-label': '単位', onchange: function (e) { st.unit = e.target.value; st.preset = null; draw(); } },
          g.plain.map(function (u) { return h('option', { value: u.id, selected: u.id === st.unit || null }, u.label); }));
    var kusei = (D.kusei || []).filter(function (k) { return k.kind === st.kind; });
    setKids(root,
      seg([['area', '広さ'], ['height', '高さ']], 'kind', reset),
      seg([['fwd', '数字から換算'], ['rev', '何個分から逆算']], 'dir', reset),
      h('label', { class: 'lbl', for: 'dome-n', text: st.dir === 'rev' ? '文京区の単位で、いくつ分？' : (st.kind === 'area' ? '広さを入れる（自宅の広さでも）' : '高さを入れる（身長でも）') }),
      h('div', { class: 'row' }, input, select),
      st.dir === 'fwd' && g.familiar.length ? h('div', null,
        h('span', { class: 'lbl', text: '身近なものから選ぶ' }),
        h('div', { class: 'chips' }, g.familiar.map(function (u) {
          return h('button', { type: 'button', onclick: function () { st.preset = u; st.text = ''; build(); } }, u.name);
        }))) : null,
      h('div', { id: 'dome-out' }),
      h('h2', { text: '区政モード（試験運用）' }),
      kusei.length
        ? h('div', { class: 'kusei' },
            h('p', { class: 'small', text: '区の公式資料で確かめた数字を、同じ換算機にかけます。押すと換算します。' }),
            kusei.map(function (k) {
              return h('button', { type: 'button', onclick: function () {
                st.dir = 'fwd'; st.preset = { name: k.name, one: '', value: k.value }; st.text = ''; build();
                root.querySelector('#dome-out').scrollIntoView({ behavior: 'smooth', block: 'center' });
              } }, h('span', null, k.name, k.note ? h('small', { class: 'small', text: k.note }) : null), h('b', { text: fmt(k.value) + ' ' + k.unit }));
            }))
        : h('div', { class: 'empty', text: st.kind === 'area' ? '区の数字を確かめているところです。' : '高さの区政モードは、これから用意します。' }));
    draw();
  }

  self.Bunkyo.register('dome', {
    mount: function (el, a) {
      root = el; api = a; h = a.h; D = a.data;
      st = { kind: 'area', dir: 'fwd', text: '', unit: null, revUnit: null, pick: null, preset: null, url: null, last: null };
      build();
    },
    unmount: function () { if (st && st.url) URL.revokeObjectURL(st.url); }
  });
})();
