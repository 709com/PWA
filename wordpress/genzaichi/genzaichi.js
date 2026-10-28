// このファイルは、[genzaichi] を書いたページで、最寄駅の地図・移動の線・一覧を描きます。
// データは同じWordPressの「genzaichi/v1/data」から読み込みます（地図の画像は国土地理院から読み込みます）。
(function () {
  'use strict';

  function el(tag, text) {
    var e = document.createElement(tag);
    if (text !== undefined) e.textContent = text; // 文字としてだけ表示する（安全のため）
    return e;
  }

  function setup(wrap) {
    var api = wrap.getAttribute('data-api');
    var statusEl = wrap.querySelector('.gz-status');
    var select = wrap.querySelector('.gz-date');
    var list = wrap.querySelector('.gz-list');

    // 地図の準備（最初は文京区あたりを表示）
    var map = L.map(wrap.querySelector('.gz-map'), { scrollWheelZoom: false }).setView([35.708, 139.752], 13);
    L.tileLayer('https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener">国土地理院</a>'
    }).addTo(map);
    map.attributionControl.setPrefix('<a href="https://leafletjs.com" target="_blank" rel="noopener">Leaflet</a>');
    var layer = L.layerGroup().addTo(map);

    function label(e) {
      return (e.from === e.to ? e.from : e.from + '〜' + e.to) + ' ' + e.name + '駅';
    }

    function draw(data) {
      statusEl.textContent = data.status;

      // 日付の選択肢
      select.innerHTML = '';
      var dates = data.dates.length ? data.dates : [data.date];
      dates.forEach(function (d) {
        var p = d.split('-');
        var opt = new Option(Number(p[1]) + '月' + Number(p[2]) + '日', d);
        if (d === data.date) opt.selected = true;
        select.add(opt);
      });

      // 地図の印と線
      layer.clearLayers();
      list.innerHTML = '';
      var points = data.entries.map(function (e) { return [e.lat, e.lon]; });
      if (points.length > 1) {
        L.polyline(points, { color: '#c0392b', weight: 4, opacity: 0.8 }).addTo(layer);
      }
      data.entries.forEach(function (e, i) {
        var latest = i === data.entries.length - 1;
        L.circleMarker([e.lat, e.lon], {
          radius: latest ? 11 : 7,
          color: '#fff',
          weight: 2,
          fillColor: latest ? '#c0392b' : '#e67e22',
          fillOpacity: 1
        }).bindTooltip(label(e), { direction: 'top' }).addTo(layer);
        list.appendChild(el('li', label(e)));
      });
      if (!data.entries.length) {
        list.appendChild(el('li', 'この日の記録はありません'));
      } else if (points.length === 1) {
        map.setView(points[0], 15);
      } else {
        map.fitBounds(points, { padding: [30, 30], maxZoom: 15 });
      }
    }

    function load(date) {
      var url = api + (api.indexOf('?') >= 0 ? '&' : '?') + 'date=' + encodeURIComponent(date || '') + '&_=' + Date.now();
      fetch(url, { credentials: 'omit' })
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
        .then(draw)
        .catch(function () { statusEl.textContent = '現在地を読み込めませんでした。'; });
    }

    select.addEventListener('change', function () { load(select.value); });
    load('');
  }

  function start() {
    var wraps = document.querySelectorAll('.gz-wrap');
    for (var i = 0; i < wraps.length; i++) setup(wraps[i]);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
