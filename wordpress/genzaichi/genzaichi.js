// このファイルは、[genzaichi] を書いたページで、最寄駅の地図・移動の線・一覧を描きます。
// 地図は国土地理院の「淡色地図」。文京区の境界を緑の線で囲み、区の外を白くうすくして、区内の道路と駅を目立たせます。
// データは同じWordPressの「genzaichi/v1/data」と、プラグイン内の bunkyo.json（区の境界・区内の駅）から読み込みます。
(function () {
  'use strict';

  var GREEN = '#7a9a2a'; // ホームページに合わせた緑

  function el(tag, text) {
    var e = document.createElement(tag);
    if (text !== undefined) e.textContent = text; // 文字としてだけ表示する（安全のため）
    return e;
  }

  // 駅名ラベルの見た目（白いふちどりの小さな文字）
  function addStyle() {
    if (document.getElementById('gz-style')) return;
    var s = document.createElement('style');
    s.id = 'gz-style';
    s.textContent =
      '.gz-st{background:none;border:none;box-shadow:none;padding:0;font-size:10px;font-weight:bold;color:#333;' +
      'text-shadow:0 0 2px #fff,0 0 2px #fff,0 0 3px #fff;white-space:nowrap}' +
      '.gz-st:before{display:none}';
    document.head.appendChild(s);
  }

  function setup(wrap) {
    var api = wrap.getAttribute('data-api');
    var areaUrl = wrap.getAttribute('data-area');
    var statusEl = wrap.querySelector('.gz-status');
    var select = wrap.querySelector('.gz-date');
    var list = wrap.querySelector('.gz-list');

    var map = L.map(wrap.querySelector('.gz-map'), { scrollWheelZoom: false, zoomSnap: 0.25 })
      .setView([35.718, 139.745], 13.5);
    L.tileLayer('https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener">国土地理院</a>'
    }).addTo(map);
    map.attributionControl.setPrefix('<a href="https://leafletjs.com" target="_blank" rel="noopener">Leaflet</a>');

    var areaBounds = null;  // 文京区の範囲
    var layer = L.layerGroup().addTo(map); // 移動の記録（日付を変えるたびに描き直す）

    // 文京区の境界・区外のうすい白・区内の駅を描く（最初の1回だけ）
    var areaReady = fetch(areaUrl)
      .then(function (r) { return r.json(); })
      .then(function (area) {
        var world = [[60, 100], [60, 180], [10, 180], [10, 100]];
        L.polygon([world, area.boundary], { stroke: false, fillColor: '#fff', fillOpacity: 0.65, interactive: false }).addTo(map);
        var outline = L.polygon(area.boundary, { color: GREEN, weight: 3, fill: false, interactive: false }).addTo(map);
        areaBounds = outline.getBounds();
        area.stations.forEach(function (s) {
          L.circleMarker([s[1], s[2]], { radius: 4, color: '#fff', weight: 1.5, fillColor: '#444', fillOpacity: 1, interactive: false })
            .bindTooltip(s[0], { permanent: true, direction: 'right', offset: [4, 0], className: 'gz-st' })
            .addTo(map);
        });
      })
      .catch(function () { /* 区の境界が読めなくても、移動の記録は表示する */ });

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

      // 移動の線と印
      layer.clearLayers();
      list.innerHTML = '';
      var points = data.entries.map(function (e) { return [e.lat, e.lon]; });
      if (points.length > 1) {
        L.polyline(points, { color: '#c0392b', weight: 4, opacity: 0.85 }).addTo(layer);
      }
      data.entries.forEach(function (e, i) {
        var latest = i === data.entries.length - 1;
        L.circleMarker([e.lat, e.lon], {
          radius: latest ? 10 : 6,
          color: '#fff',
          weight: 2,
          fillColor: latest ? '#c0392b' : '#e67e22',
          fillOpacity: 1
        }).bindTooltip(label(e), { direction: 'top' }).addTo(layer);
        list.appendChild(el('li', label(e)));
      });
      if (!data.entries.length) list.appendChild(el('li', 'この日の記録はありません'));

      // 表示の範囲：基本は文京区全体。区の外に出た日は、移動の線全体が入るように広げる
      var bounds = areaBounds ? L.latLngBounds(areaBounds.getSouthWest(), areaBounds.getNorthEast()) : null;
      points.forEach(function (p) { bounds = bounds ? bounds.extend(p) : L.latLngBounds(p, p); });
      if (bounds) map.fitBounds(bounds, { padding: [6, 6], maxZoom: 15 });
    }

    function load(date) {
      var url = api + (api.indexOf('?') >= 0 ? '&' : '?') + 'date=' + encodeURIComponent(date || '') + '&_=' + Date.now();
      fetch(url, { credentials: 'omit' })
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
        .then(function (data) { return areaReady.then(function () { draw(data); }); })
        .catch(function () { statusEl.textContent = '現在地を読み込めませんでした。'; });
    }

    select.addEventListener('change', function () { load(select.value); });
    load('');
  }

  function start() {
    addStyle();
    var wraps = document.querySelectorAll('.gz-wrap');
    for (var i = 0; i < wraps.length; i++) setup(wraps[i]);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
