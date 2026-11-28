<?php
/**
 * Plugin Name: 現在地（最寄駅）表示
 * Description: iPhoneのショートカットから送られた現在地をもとに最寄駅を計算し、地図と文字で表示します。正確な位置は保存せず、駅名と時刻だけを過去7日分保存します。表示したいページに [genzaichi] と書いてください。
 * Version: 1.6.0
 * Requires at least: 5.6
 * Requires PHP: 7.4
 * License: GPLv2 or later
 */

// このファイルは、WordPressに追加するプラグインの本体です。
// 位置を受け取って最寄駅を計算・保存し、[genzaichi] を書いたページに地図と文字を表示します。管理画面の設定もここにあります。

if (!defined('ABSPATH')) {
    exit; // WordPressの外から直接開かれたときは何もしない
}

define('GZ_VERSION', '1.6.0');
define('GZ_KEEP_DAYS', 7);       // 履歴を残す日数
define('GZ_MIN_INTERVAL', 20);   // 連続送信を受け付けない秒数

// ===== 設定の読み書き =====
function gz_defaults() {
    return array(
        'key_hash'    => '',        // 合言葉（そのままではなく、暗号のような形に変えて保存）
        'paused'      => 0,         // 1なら一時停止
        'name'        => '高浜直樹', // 表示する名前
        'night_start' => 21,        // この時刻から
        'night_end'   => 7,         // この時刻までは「本日の活動は終了しました」
        'stale_hours' => 3,         // 最後の更新からこの時間たつと「現在は非公開です」
        'near_km'     => 2,         // 駅からこの距離までは「○○駅付近」
        'note_text'   => '',        // F1 今日のひとこと（空なら出さない）
        'note_date'   => '',        // F1 ひとことを出す日（Y-m-d）
        'schedule'    => '',        // F4 予定の表示（1行に「2026-11-20 10:00-17:00 表示する文」）
        'show_stats'  => 0,         // F2・F3 7日間の集計（区内の割合、よく行く駅）を出すか
        'show_posts'  => 0,         // F5 その日のブログ記事へのリンクを出すか
        'freeze_dates' => '2027-04-25', // 投票日（1行に1日）。その日は0時から終わりまで、記録も表示の変化も一切しない
        'line_enabled'  => 0,       // LINE自動投稿（最初はオフ）
        'line_daily'    => 1,       // 1日に送る上限回数
        'line_monthly'  => 2,       // 1か月に送る上限回数
        'line_stations' => '',      // 送る駅（1行に1駅。空なら全部の駅）
        'line_template' => '{name}は今、{station}駅付近で活動しています。', // 送る文
        'line_friends'  => 0,       // 友だちの人数（通数の見込みを出すためだけに使う）
    );
}
function gz_settings() {
    return array_merge(gz_defaults(), (array) get_option('gz_settings', array()));
}
// 記録は「時間枠（○時00分・○時30分）ごとに1件」の形で保存する（gz_points）
// 1件 = d:日付, s:時間枠の時刻, t:実際に届いた時刻, n:駅名, la/lo:駅の位置, m:駅からの距離
function gz_points() {
    $p = get_option('gz_points', null);
    if (is_array($p)) {
        return $p;
    }
    // 1.2.0までの形（gz_history）から移し替える（初回だけ）
    $points = array();
    foreach ((array) get_option('gz_history', array()) as $e) {
        foreach (array_unique(array($e['t1'], $e['t2'])) as $ts) {
            $points = gz_add_point($points, array(
                'd' => $e['d'], 's' => gz_slot($ts), 't' => $ts,
                'n' => $e['n'], 'la' => $e['la'], 'lo' => $e['lo'], 'm' => $e['m'],
            ));
        }
    }
    update_option('gz_points', $points, false);
    delete_option('gz_history');
    return $points;
}
// 記録を1件足す。直前の記録と同じ日・同じ時間枠なら、直前の記録を消して最新に置き換える
function gz_add_point($points, $p) {
    $last = end($points);
    if ($last && $last['d'] === $p['d'] && $last['s'] === $p['s']) {
        array_pop($points);
    }
    $points[] = $p;
    return $points;
}
// 表示用に、同じ駅が続いた記録を1行にまとめる（t1:最初の時間枠, t2:最後の時間枠, ta:最後に実際に届いた時刻）
function gz_history() {
    $entries = array();
    foreach (gz_points() as $p) {
        $i = count($entries) - 1;
        if ($i >= 0 && $entries[$i]['d'] === $p['d'] && $entries[$i]['n'] === $p['n']
            && abs($entries[$i]['la'] - $p['la']) < 0.0001 && abs($entries[$i]['lo'] - $p['lo']) < 0.0001) {
            $entries[$i]['t2'] = $p['s'];
            $entries[$i]['ta'] = $p['t'];
            $entries[$i]['m']  = $p['m'];
        } else {
            $entries[] = array('d' => $p['d'], 'n' => $p['n'], 'la' => $p['la'], 'lo' => $p['lo'], 'm' => $p['m'],
                'tl' => $p['s'], 't1' => $p['s'], 't2' => $p['s'], 'ta' => $p['t']);
        }
    }
    return $entries;
}

// ===== 時刻（WordPressの設定のタイムゾーンで扱う） =====
// ===== 投票日の停止（高浜さんの指示・厳守） =====
// 投票日は、日付が変わった0時からその日の終わりまで、記録・表示の変化・設定の変更を一切しない。
// 管理画面のどの設定でも解除できない。表示は前日23時59分59秒の時点のまま止める。
function gz_real_now() {
    return new DateTimeImmutable('now', wp_timezone());
}
function gz_freeze_list() {
    $s = array_merge(array('freeze_dates' => '2027-04-25'), (array) get_option('gz_settings', array()));
    preg_match_all('/\d{4}-\d{2}-\d{2}/', (string) $s['freeze_dates'], $m);
    return $m[0];
}
function gz_is_freeze() {
    return in_array(gz_real_now()->format('Y-m-d'), gz_freeze_list(), true);
}
function gz_now() {
    $now = gz_real_now();
    if (gz_is_freeze()) {
        return $now->setTime(0, 0, 0)->modify('-1 second'); // 表示を前日の終わりの時点で止める
    }
    return $now;
}
// 表示用の時刻は「00分」か「30分」の二段階にそろえる
// ・毎時ちょうどの前後5分以内（例：14:55〜15:05）に届いたもの → 15:00（自動実行を想定）
// ・それ以外（例：15:06〜15:54） → 15:30（手動で送ったものを想定）
// ※「3時間たったら非公開」などの判定は、ここではなく実際に届いた時刻で行う
define('GZ_ROUND_MARGIN_MIN', 5);
function gz_slot($ts) {
    $t = (new DateTimeImmutable('@' . $ts))->setTimezone(wp_timezone());
    $sec = (int) $t->format('i') * 60 + (int) $t->format('s'); // その時の何分何秒か（秒に直したもの）
    $hour = $t->setTime((int) $t->format('G'), 0, 0);
    if ($sec <= GZ_ROUND_MARGIN_MIN * 60) {
        return $hour->getTimestamp();                          // 例：15:03 → 15:00
    }
    if ($sec >= (60 - GZ_ROUND_MARGIN_MIN) * 60) {
        return $hour->modify('+1 hour')->getTimestamp();       // 例：14:59 → 15:00
    }
    return $hour->modify('+30 minutes')->getTimestamp();       // 例：15:12 → 15:30
}
function gz_time_label_raw($ts) {
    return (new DateTimeImmutable('@' . $ts))->setTimezone(wp_timezone())->format('n/j G:i');
}
function gz_time_label($ts) {
    return (new DateTimeImmutable('@' . gz_slot($ts)))->setTimezone(wp_timezone())->format('G:i');
}

// ===== 最寄駅の計算 =====
// 2点間の距離（メートル）
function gz_distance($lat1, $lon1, $lat2, $lon2) {
    $r = 6371000;
    $p1 = deg2rad($lat1);
    $p2 = deg2rad($lat2);
    $dp = $p2 - $p1;
    $dl = deg2rad($lon2 - $lon1);
    $h = sin($dp / 2) ** 2 + cos($p1) * cos($p2) * sin($dl / 2) ** 2;
    return 2 * $r * asin(min(1, sqrt($h)));
}
// 全国の駅の一覧（国土数値情報の駅データを加工したもの）から、いちばん近い駅を探す
function gz_nearest_station($lat, $lon) {
    $json = file_get_contents(__DIR__ . '/stations.json');
    $stations = json_decode($json, true);
    if (!is_array($stations)) {
        return null;
    }
    $best = null;
    $bestDist = INF;
    foreach ($stations as $s) {
        // 明らかに遠い駅は、正確な計算を省いて速くする（緯度・経度で約0.5度以上離れている）
        if (abs($s[1] - $lat) > 0.5 || abs($s[2] - $lon) > 0.6) {
            continue;
        }
        $d = gz_distance($lat, $lon, $s[1], $s[2]);
        if ($d < $bestDist) {
            $bestDist = $d;
            $best = $s;
        }
    }
    if ($best === null) { // 近くに駅がない場合は全駅で探し直す
        foreach ($stations as $s) {
            $d = gz_distance($lat, $lon, $s[1], $s[2]);
            if ($d < $bestDist) {
                $bestDist = $d;
                $best = $s;
            }
        }
    }
    return $best ? array('name' => $best[0], 'lat' => $best[1], 'lon' => $best[2], 'dist' => (int) round($bestDist)) : null;
}

// ===== 履歴への記録 =====
// 正確な位置は保存せず、駅名・駅の位置（公開データ）・駅からの距離・時刻だけを記録する
function gz_record($station, $ts) {
    $today = (new DateTimeImmutable('@' . $ts))->setTimezone(wp_timezone())->format('Y-m-d');
    $points = gz_add_point(gz_points(), array(
        'd'  => $today,
        's'  => gz_slot($ts),
        't'  => $ts,
        'n'  => $station['name'],
        'la' => $station['lat'],
        'lo' => $station['lon'],
        'm'  => $station['dist'],
    ));
    // 7日より前の記録を消す
    $limit = gz_now()->modify('-' . (GZ_KEEP_DAYS - 1) . ' days')->format('Y-m-d');
    $points = array_values(array_filter($points, function ($p) use ($limit) {
        return $p['d'] >= $limit;
    }));
    update_option('gz_points', $points, false);
}

// ===== F4 予定の表示 =====
// 1行に「2026-11-20 10:00-17:00 シビックセンターで本会議に出席しています」の形で書く
function gz_parse_schedule($text) {
    $rows = array();
    foreach (preg_split('/\r\n|\r|\n/', (string) $text) as $line) {
        if (preg_match('/^\s*(\d{4}-\d{2}-\d{2})\s+(\d{1,2}:\d{2})\s*[-〜~]\s*(\d{1,2}:\d{2})\s+(.+?)\s*$/u', $line, $m)) {
            $rows[] = array('date' => $m[1], 'from' => $m[2], 'to' => $m[3], 'text' => $m[4]);
        }
    }
    return $rows;
}
function gz_schedule_now($text, $now) {
    foreach (gz_parse_schedule($text) as $r) {
        $from = DateTimeImmutable::createFromFormat('Y-m-d G:i', $r['date'] . ' ' . $r['from'], wp_timezone());
        $to   = DateTimeImmutable::createFromFormat('Y-m-d G:i', $r['date'] . ' ' . $r['to'], wp_timezone());
        if ($from && $to && $now >= $from && $now < $to) {
            return array('text' => $r['text'], 'range' => $r['from'] . '〜' . $r['to']);
        }
    }
    return null;
}

// ===== F2・F3 7日間の集計 =====
function gz_bunkyo_station_names() {
    $area = json_decode((string) @file_get_contents(__DIR__ . '/bunkyo.json'), true);
    $names = array();
    foreach ((array) ($area['stations'] ?? array()) as $st) {
        $names[$st[0]] = true;
    }
    return $names;
}
function gz_stats() {
    $points = gz_points();
    if (!$points) {
        return null;
    }
    $inside = gz_bunkyo_station_names();
    $count = array();
    $in = 0;
    foreach ($points as $p) {
        $count[$p['n']] = ($count[$p['n']] ?? 0) + 1;
        if (isset($inside[$p['n']])) {
            $in++;
        }
    }
    arsort($count);
    $top = array();
    foreach (array_slice($count, 0, 5, true) as $n => $c) {
        $top[] = array('name' => $n, 'count' => $c);
    }
    return array('total' => count($points), 'inside_rate' => round($in / count($points) * 100), 'top' => $top);
}

// ===== F5 その日のブログ記事 =====
function gz_posts_on($date) {
    if (!preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $date, $m)) {
        return array();
    }
    $posts = get_posts(array(
        'post_type'   => 'post',
        'post_status' => 'publish',
        'numberposts' => 5,
        'date_query'  => array(array('year' => (int) $m[1], 'month' => (int) $m[2], 'day' => (int) $m[3])),
    ));
    $out = array();
    foreach ($posts as $p) {
        $out[] = array('title' => get_the_title($p), 'url' => get_permalink($p));
    }
    return $out;
}

// ===== LINEへの自動投稿（1.6.0） =====
// 友だち全員への一斉送信（LINE Messaging API の broadcast）。費用が「送った回数×友だちの人数」で増えるため、
// ・最初はオフ ・駅が変わったときだけ ・1日／1か月の上限回数 ・夜間は送らない ・投票日は送らない（記録自体を止める）
// LINEの鍵（チャネルアクセストークン）は gz_line_token に保存し、リポジトリには入れない。
function gz_last_station_name() {
    $p = gz_points();
    $last = end($p);
    return $last ? $last['n'] : '';
}
function gz_line_log($entry) {
    $log = (array) get_option('gz_line_log', array());
    array_unshift($log, $entry);
    update_option('gz_line_log', array_slice($log, 0, 30), false);
}
function gz_line_count($since_ts) {
    $n = 0;
    foreach ((array) get_option('gz_line_log', array()) as $e) {
        if (!empty($e['ok']) && $e['t'] >= $since_ts) {
            $n++;
        }
    }
    return $n;
}
function gz_line_maybe_send($prev, $stationName) {
    $s = gz_settings();
    $token = (string) get_option('gz_line_token', '');
    if (!$s['line_enabled'] || $token === '' || gz_is_freeze() || $s['paused']) {
        return;
    }
    if ($prev === $stationName) {
        return; // 駅が変わったときだけ
    }
    $allowed = array_filter(array_map('trim', preg_split('/\r\n|\r|\n/', (string) $s['line_stations'])));
    if ($allowed && !in_array($stationName, array_map(function ($x) { return preg_replace('/駅$/u', '', $x); }, $allowed), true)) {
        return; // 送る駅に入っていない
    }
    $now = gz_real_now();
    $hour = (int) $now->format('G');
    $isNight = ($s['night_start'] > $s['night_end'])
        ? ($hour >= $s['night_start'] || $hour < $s['night_end'])
        : ($hour >= $s['night_start'] && $hour < $s['night_end']);
    if ($isNight) {
        return;
    }
    $dayStart = $now->setTime(0, 0, 0)->getTimestamp();
    $monthStart = $now->modify('first day of this month')->setTime(0, 0, 0)->getTimestamp();
    if (gz_line_count($dayStart) >= (int) $s['line_daily'] || gz_line_count($monthStart) >= (int) $s['line_monthly']) {
        gz_line_log(array('t' => time(), 'n' => $stationName, 'ok' => false, 'msg' => '上限回数のため送りませんでした'));
        return;
    }
    $text = strtr((string) $s['line_template'], array('{name}' => $s['name'], '{station}' => $stationName));
    $res = wp_remote_post('https://api.line.me/v2/bot/message/broadcast', array(
        'timeout' => 8,
        'headers' => array('Authorization' => 'Bearer ' . $token, 'Content-Type' => 'application/json'),
        'body'    => wp_json_encode(array('messages' => array(array('type' => 'text', 'text' => mb_substr($text, 0, 500))))),
    ));
    $code = is_wp_error($res) ? 0 : (int) wp_remote_retrieve_response_code($res);
    gz_line_log(array('t' => time(), 'n' => $stationName, 'ok' => ($code === 200),
        'msg' => $code === 200 ? '送りました' : ('送れませんでした（' . ($code ?: '通信エラー') . '）')));
}

// ===== 移動ログ（PWA実験室の /idou/）からの読み込みを許可する（1.6.0） =====
// 公開している表示用データだけを、別のサイト（709com.github.io）からも読めるようにする
add_filter('rest_post_dispatch', function ($response, $server, $request) {
    if ($request->get_route() === '/genzaichi/v1/data' && $response instanceof WP_REST_Response) {
        $response->header('Access-Control-Allow-Origin', '*');
    }
    return $response;
}, 10, 3);

// ===== 表示する文章 =====
function gz_status_text() {
    $s = gz_settings();
    $history = gz_history();
    $now = gz_now();
    $hour = (int) $now->format('G');
    $last = end($history);
    $name = $s['name'];
    if ($s['paused']) {
        return '現在は非公開です。';
    }
    // F4 予定の表示：登録した日時の間は、駅の代わりに予定の文を出す
    $planned = gz_schedule_now($s['schedule'], $now);
    if ($planned) {
        return $name . 'は今、' . $planned['text'] . '（' . $planned['range'] . 'の予定）。';
    }
    if (!$last) {
        return '現在は非公開です。';
    }
    $isNight = ($s['night_start'] > $s['night_end'])
        ? ($hour >= $s['night_start'] || $hour < $s['night_end'])
        : ($hour >= $s['night_start'] && $hour < $s['night_end']);
    if ($isNight) {
        return '本日の活動は終了しました。';
    }
    if ($now->getTimestamp() - $last['ta'] > $s['stale_hours'] * 3600) { // 判定は実際に届いた時刻で行う
        return '現在は非公開です。';
    }
    $time = gz_time_label($last['t2']);
    if ($last['m'] <= $s['near_km'] * 1000) {
        return $name . 'は今、' . $last['n'] . '駅付近にいます（' . $time . '時点）。';
    }
    $km = $last['m'] >= 10000 ? round($last['m'] / 1000) : round($last['m'] / 1000, 1);
    return $name . 'は今、' . $last['n'] . '駅から約' . $km . 'kmの場所にいます（' . $time . '時点）。';
}

// ===== 外部とのやりとり（REST API） =====
add_action('rest_api_init', function () {
    // iPhoneのショートカットから位置を受け取る（合言葉が必要）
    register_rest_route('genzaichi/v1', '/update', array(
        'methods'             => 'POST',
        'callback'            => 'gz_rest_update',
        'permission_callback' => '__return_true', // 合言葉の確認は下の関数で行う
    ));
    // ホームページの地図が、表示用のデータを読み込む（誰でも見られる）
    register_rest_route('genzaichi/v1', '/data', array(
        'methods'             => 'GET',
        'callback'            => 'gz_rest_data',
        'permission_callback' => '__return_true',
    ));
});

function gz_rest_update(WP_REST_Request $req) {
    if (gz_is_freeze()) {
        // 投票日は、合言葉の確認もせず、何も記録しない
        return array('ok' => false, 'message' => '投票日のため記録しませんでした。ホームページの表示も変えません。');
    }
    $s = gz_settings();
    if ($s['key_hash'] === '') {
        return new WP_Error('gz_no_key', '合言葉が管理画面で設定されていません。', array('status' => 403));
    }
    $key = (string) $req->get_param('key');
    if ($key === '' || !wp_check_password($key, $s['key_hash'])) {
        return new WP_Error('gz_bad_key', '合言葉が違います。', array('status' => 403));
    }
    if ($s['paused']) {
        return array('ok' => true, 'message' => '一時停止中のため記録しませんでした。');
    }
    $lat = $req->get_param('lat');
    $lon = $req->get_param('lon');
    // ショートカットは小数点に「,」を使うことがあるので「.」に直す
    $lat = is_string($lat) ? str_replace(',', '.', $lat) : $lat;
    $lon = is_string($lon) ? str_replace(',', '.', $lon) : $lon;
    if (!is_numeric($lat) || !is_numeric($lon)) {
        return new WP_Error('gz_bad_pos', '位置（緯度・経度）が読み取れません。', array('status' => 400));
    }
    $lat = (float) $lat;
    $lon = (float) $lon;
    if ($lat < 20 || $lat > 46 || $lon < 122 || $lon > 154) {
        return new WP_Error('gz_outside', '日本の範囲外のため記録しませんでした。', array('status' => 400));
    }
    $lastPost = (int) get_option('gz_last_post', 0);
    if (time() - $lastPost < GZ_MIN_INTERVAL) {
        return new WP_Error('gz_too_fast', '送信の間隔が短すぎます。少し待ってから送ってください。', array('status' => 429));
    }
    update_option('gz_last_post', time(), false);

    $station = gz_nearest_station($lat, $lon);
    if (!$station) {
        return new WP_Error('gz_no_station', '駅のデータを読み込めませんでした。', array('status' => 500));
    }
    $prevStation = gz_last_station_name();
    gz_record($station, time());
    gz_line_maybe_send($prevStation, $station['name']);
    // 受け取った正確な位置（$lat, $lon）は、ここで捨てる（どこにも保存しない）
    return array(
        'ok'      => true,
        'message' => $station['name'] . '駅（約' . $station['dist'] . 'm）として記録しました。',
    );
}

function gz_rest_data(WP_REST_Request $req) {
    $history = gz_history();
    $dates = array_values(array_unique(array_map(function ($e) {
        return $e['d'];
    }, $history)));
    rsort($dates);
    $date = (string) $req->get_param('date');
    if (!in_array($date, $dates, true)) {
        $date = $dates ? $dates[0] : gz_now()->format('Y-m-d');
    }
    $entries = array();
    foreach ($history as $e) {
        if ($e['d'] !== $date) {
            continue;
        }
        $entries[] = array(
            'name' => $e['n'],
            'lat'  => $e['la'],
            'lon'  => $e['lo'],
            'from' => gz_time_label($e['t1']),
            'to'   => gz_time_label($e['t2']),
        );
    }
    $s = gz_settings();
    $res = new WP_REST_Response(array(
        'status'  => gz_status_text(),
        'date'    => $date,
        'dates'   => $dates,
        'entries' => $entries,
        // F1 ひとこと：設定した日だけ出す
        'note'    => ($s['note_text'] !== '' && $s['note_date'] === gz_now()->format('Y-m-d')) ? $s['note_text'] : '',
        'stats'   => $s['show_stats'] ? gz_stats() : null,
        'posts'   => $s['show_posts'] ? gz_posts_on($date) : array(),
    ));
    $res->header('Cache-Control', 'no-store'); // 古い表示が残らないようにする
    return $res;
}

// ===== ページへの表示： [genzaichi] =====
add_shortcode('genzaichi', function ($atts) {
    $atts = shortcode_atts(array('height' => '420'), $atts, 'genzaichi');
    $height = max(200, min(1000, (int) $atts['height']));
    $base = plugin_dir_url(__FILE__);
    wp_enqueue_style('gz-leaflet', $base . 'leaflet/leaflet.css', array(), '1.9.4');
    wp_enqueue_script('gz-leaflet', $base . 'leaflet/leaflet.js', array(), '1.9.4', true);
    wp_enqueue_script('gz-map', $base . 'genzaichi.js', array('gz-leaflet'), GZ_VERSION, true);
    ob_start();
    ?>
    <div class="gz-wrap" data-api="<?php echo esc_url(rest_url('genzaichi/v1/data')); ?>" data-area="<?php echo esc_url($base . 'bunkyo.json?v=' . GZ_VERSION); ?>">
        <p class="gz-status" style="font-weight:bold;">読み込み中…</p>
        <p class="gz-today" style="margin:.3em 0;padding:.5em .7em;border-left:4px solid #7a9a2a;background:#f4f8ec;display:none;"></p>
        <p class="gz-date-row" style="margin:.5em 0;">表示する日：<select class="gz-date"></select></p>
        <div class="gz-map" style="height:<?php echo (int) $height; ?>px;border-radius:8px;"></div>
        <ol class="gz-list" style="font-size:.9em;margin:.8em 0 .4em 1.4em;"></ol>
        <div class="gz-posts" style="font-size:.9em;display:none;"></div>
        <div class="gz-stats" style="font-size:.85em;display:none;"></div>
        <p class="gz-note" style="font-size:.75em;color:#666;line-height:1.5;">
            1時間ごとの記録をもとに、最寄駅どうしを直線で結んでいます（実際に通った道ではありません）。<br>
            駅の位置・区の境界：国土数値情報（鉄道データ・行政区域）国土交通省を加工して作成 ／ 地図：<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener">国土地理院</a>
        </p>
    </div>
    <?php
    return ob_get_clean();
});

// ===== 管理画面（設定 → 現在地表示） =====
add_action('admin_menu', function () {
    add_options_page('現在地表示', '現在地表示', 'manage_options', 'genzaichi', 'gz_admin_page');
});

add_action('admin_post_gz_save', function () {
    if (!current_user_can('manage_options')) {
        wp_die('権限がありません。');
    }
    check_admin_referer('gz_save');
    if (gz_is_freeze()) { // 投票日は設定を変えない
        wp_safe_redirect(add_query_arg(array('page' => 'genzaichi', 'gz_msg' => 'frozen'), admin_url('options-general.php')));
        exit;
    }
    $s = gz_settings();
    $newKey = isset($_POST['gz_key']) ? trim(wp_unslash($_POST['gz_key'])) : '';
    $error = '';
    if ($newKey !== '') {
        if (mb_strlen($newKey) < 12) {
            $error = 'short';
        } else {
            $s['key_hash'] = wp_hash_password($newKey);
        }
    }
    $s['paused']      = empty($_POST['gz_paused']) ? 0 : 1;
    $s['name']        = sanitize_text_field(wp_unslash($_POST['gz_name'] ?? $s['name']));
    $s['night_start'] = max(0, min(23, (int) ($_POST['gz_night_start'] ?? 21)));
    $s['night_end']   = max(0, min(23, (int) ($_POST['gz_night_end'] ?? 7)));
    $s['stale_hours'] = max(1, min(24, (int) ($_POST['gz_stale_hours'] ?? 3)));
    $s['near_km']     = max(0.5, min(20, (float) ($_POST['gz_near_km'] ?? 2)));
    $s['note_text']   = mb_substr(sanitize_text_field(wp_unslash($_POST['gz_note_text'] ?? '')), 0, 100);
    $nd               = sanitize_text_field(wp_unslash($_POST['gz_note_date'] ?? ''));
    $s['note_date']   = preg_match('/^\d{4}-\d{2}-\d{2}$/', $nd) ? $nd : '';
    $s['schedule']    = sanitize_textarea_field(wp_unslash($_POST['gz_schedule'] ?? ''));
    $s['show_stats']  = empty($_POST['gz_show_stats']) ? 0 : 1;
    $s['show_posts']  = empty($_POST['gz_show_posts']) ? 0 : 1;
    preg_match_all('/\d{4}-\d{2}-\d{2}/', (string) wp_unslash($_POST['gz_freeze_dates'] ?? ''), $fd);
    $s['freeze_dates'] = implode("\n", array_unique($fd[0]));
    $s['line_enabled']  = empty($_POST['gz_line_enabled']) ? 0 : 1;
    $s['line_daily']    = max(0, min(10, (int) ($_POST['gz_line_daily'] ?? 1)));
    $s['line_monthly']  = max(0, min(100, (int) ($_POST['gz_line_monthly'] ?? 2)));
    $s['line_stations'] = sanitize_textarea_field(wp_unslash($_POST['gz_line_stations'] ?? ''));
    $tpl                = sanitize_text_field(wp_unslash($_POST['gz_line_template'] ?? ''));
    $s['line_template'] = $tpl !== '' ? mb_substr($tpl, 0, 200) : gz_defaults()['line_template'];
    $s['line_friends']  = max(0, min(1000000, (int) ($_POST['gz_line_friends'] ?? 0)));
    $newToken = isset($_POST['gz_line_token']) ? trim(wp_unslash($_POST['gz_line_token'])) : '';
    if ($newToken === '-') {
        delete_option('gz_line_token'); // 「-」を入れると鍵を消す
    } elseif ($newToken !== '') {
        update_option('gz_line_token', $newToken, false);
    }
    update_option('gz_settings', $s, false);
    wp_safe_redirect(add_query_arg(array('page' => 'genzaichi', 'gz_msg' => $error ?: 'saved'), admin_url('options-general.php')));
    exit;
});

add_action('admin_post_gz_clear', function () {
    if (!current_user_can('manage_options')) {
        wp_die('権限がありません。');
    }
    check_admin_referer('gz_clear');
    if (gz_is_freeze()) { // 投票日は履歴も消さない（表示が変わるため）
        wp_safe_redirect(add_query_arg(array('page' => 'genzaichi', 'gz_msg' => 'frozen'), admin_url('options-general.php')));
        exit;
    }
    update_option('gz_points', array(), false);
    wp_safe_redirect(add_query_arg(array('page' => 'genzaichi', 'gz_msg' => 'cleared'), admin_url('options-general.php')));
    exit;
});

function gz_admin_page() {
    if (!current_user_can('manage_options')) {
        return;
    }
    $s = gz_settings();
    $history = gz_history();
    $last = end($history);
    $msg = isset($_GET['gz_msg']) ? sanitize_key($_GET['gz_msg']) : '';
    $messages = array(
        'saved'   => array('success', '保存しました。'),
        'cleared' => array('success', '履歴をすべて消しました。'),
        'short'   => array('error', '合言葉は12文字以上にしてください（合言葉以外の設定は保存しました）。'),
        'frozen'  => array('error', '今日は投票日のため、設定の変更や履歴の消去はできません。明日以降に行ってください。'),
    );
    ?>
    <div class="wrap">
        <h1>現在地表示の設定</h1>
        <?php if (isset($messages[$msg])) : ?>
            <div class="notice notice-<?php echo esc_attr($messages[$msg][0]); ?>"><p><?php echo esc_html($messages[$msg][1]); ?></p></div>
        <?php endif; ?>

        <?php if (gz_is_freeze()) : ?>
            <div class="notice notice-warning"><p><strong>今日は投票日です。</strong>0時から今日の終わりまで、位置の記録・ホームページの表示の変化・設定の変更を一切止めています（解除はできません）。</p></div>
        <?php endif; ?>
        <h2>いまの状態</h2>
        <p>ホームページの表示：<strong><?php echo esc_html(gz_status_text()); ?></strong></p>
        <p>最後の記録：<?php echo $last ? esc_html($last['d'] . ' ' . gz_time_label($last['t2']) . ' ' . $last['n'] . '駅') : 'まだありません'; ?></p>
        <p>合言葉：<?php echo $s['key_hash'] ? '設定済み' : '<strong style="color:#b32d2e">未設定（設定するまで位置を受け付けません）</strong>'; ?></p>

        <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
            <input type="hidden" name="action" value="gz_save">
            <?php wp_nonce_field('gz_save'); ?>
            <table class="form-table" role="presentation">
                <tr><th scope="row">公表の一時停止</th>
                    <td><label><input type="checkbox" name="gz_paused" value="1" <?php checked($s['paused'], 1); ?>> 一時停止する（新しい位置を記録せず、「現在は非公開です」と表示）</label></td></tr>
                <tr><th scope="row"><label for="gz_key">合言葉</label></th>
                    <td><input type="password" id="gz_key" name="gz_key" class="regular-text" autocomplete="new-password">
                        <p class="description">12文字以上。変えるときだけ入力してください（空欄なら今の合言葉のまま）。iPhoneのショートカットにも同じ合言葉を入れます。</p></td></tr>
                <tr><th scope="row"><label for="gz_name">表示する名前</label></th>
                    <td><input type="text" id="gz_name" name="gz_name" class="regular-text" value="<?php echo esc_attr($s['name']); ?>"></td></tr>
                <tr><th scope="row">夜間（活動終了の表示）</th>
                    <td><input type="number" name="gz_night_start" min="0" max="23" value="<?php echo (int) $s['night_start']; ?>" style="width:5em"> 時から
                        <input type="number" name="gz_night_end" min="0" max="23" value="<?php echo (int) $s['night_end']; ?>" style="width:5em"> 時まで</td></tr>
                <tr><th scope="row">非公開にするまでの時間</th>
                    <td>最後の記録から <input type="number" name="gz_stale_hours" min="1" max="24" value="<?php echo (int) $s['stale_hours']; ?>" style="width:5em"> 時間</td></tr>
                <tr><th scope="row">「駅付近」とする距離</th>
                    <td>駅から <input type="number" name="gz_near_km" min="0.5" max="20" step="0.5" value="<?php echo esc_attr($s['near_km']); ?>" style="width:5em"> km まで</td></tr>
                <tr><th scope="row"><label for="gz_note_text">今日のひとこと</label></th>
                    <td><input type="text" id="gz_note_text" name="gz_note_text" class="regular-text" maxlength="100" value="<?php echo esc_attr($s['note_text']); ?>" placeholder="例：茗荷谷駅前で朝の駅頭をしています">
                        出す日 <input type="date" name="gz_note_date" value="<?php echo esc_attr($s['note_date']); ?>">
                        <p class="description">地図の上に一言を出します。「出す日」の当日だけ表示され、翌日には自動で消えます。空欄なら出しません。</p></td></tr>
                <tr><th scope="row"><label for="gz_schedule">予定の表示</label></th>
                    <td><textarea id="gz_schedule" name="gz_schedule" rows="4" class="large-text" placeholder="2026-11-20 10:00-17:00 シビックセンターで本会議に出席しています"><?php echo esc_textarea($s['schedule']); ?></textarea>
                        <p class="description">1行に「日付 開始-終了 表示する文」を書きます。その時間の間は、駅名の代わりに「<?php echo esc_html($s['name']); ?>は今、（表示する文）」と出します（議会・委員会の日など）。形式が違う行は無視します。</p></td></tr>
                <tr><th scope="row">7日間の集計</th>
                    <td><label><input type="checkbox" name="gz_show_stats" value="1" <?php checked($s['show_stats'], 1); ?>> 「区内の駅にいた割合」と「よく行った駅」を地図の下に出す</label></td></tr>
                <tr><th scope="row">ブログとの連動</th>
                    <td><label><input type="checkbox" name="gz_show_posts" value="1" <?php checked($s['show_posts'], 1); ?>> 表示している日に公開したブログ記事へのリンクを、地図の下に出す</label></td></tr>
                <tr><th scope="row"><label for="gz_freeze_dates">投票日（すべて停止）</label></th>
                    <td><textarea id="gz_freeze_dates" name="gz_freeze_dates" rows="3" class="regular-text" placeholder="2027-04-25"><?php echo esc_textarea($s['freeze_dates']); ?></textarea>
                        <p class="description">1行に1日（例：2027-04-25）。その日は日付が変わった0時から終わりまで、位置の記録・表示の変化・設定の変更を一切しません。当日は解除できません。日付は選挙管理委員会の公表で確かめてください。</p></td></tr>
            </table>
            <h2>LINEへの自動投稿</h2>
            <p>駅が変わったときだけ、LINE公式アカウントの友だち全員に送ります。<strong>LINEの料金は「送った回数×友だちの人数」で数えます</strong>（無料プランは月200通まで）。夜間・投票日・一時停止中は送りません。選挙期間中に使う前は、選挙管理委員会に確認してください。</p>
            <table class="form-table" role="presentation">
                <tr><th scope="row">自動投稿</th>
                    <td><label><input type="checkbox" name="gz_line_enabled" value="1" <?php checked($s['line_enabled'], 1); ?>> 送る（最初はオフ）</label></td></tr>
                <tr><th scope="row"><label for="gz_line_token">LINEの鍵</label></th>
                    <td><input type="password" id="gz_line_token" name="gz_line_token" class="regular-text" autocomplete="new-password">
                        <p class="description">今の状態：<?php echo get_option('gz_line_token', '') !== '' ? '設定済み' : '未設定'; ?>。LINE Developers の「チャネルアクセストークン（長期）」を貼ります。変えるときだけ入力（空欄なら今のまま、「-」だけを入れると消します）。</p></td></tr>
                <tr><th scope="row">上限回数</th>
                    <td>1日 <input type="number" name="gz_line_daily" min="0" max="10" value="<?php echo (int) $s['line_daily']; ?>" style="width:5em"> 回まで ／ 1か月 <input type="number" name="gz_line_monthly" min="0" max="100" value="<?php echo (int) $s['line_monthly']; ?>" style="width:5em"> 回まで</td></tr>
                <tr><th scope="row"><label for="gz_line_stations">送る駅</label></th>
                    <td><textarea id="gz_line_stations" name="gz_line_stations" rows="3" class="regular-text" placeholder="茗荷谷"><?php echo esc_textarea($s['line_stations']); ?></textarea>
                        <p class="description">1行に1駅（駅名だけ）。空なら、どの駅でも送ります。駅頭をする駅だけに絞るのがおすすめです。</p></td></tr>
                <tr><th scope="row"><label for="gz_line_template">送る文</label></th>
                    <td><input type="text" id="gz_line_template" name="gz_line_template" class="large-text" value="<?php echo esc_attr($s['line_template']); ?>">
                        <p class="description">{name} は表示する名前、{station} は駅名に置き換わります。政治活動の告知にとどめ、投票の呼びかけは入れないでください。</p></td></tr>
                <tr><th scope="row">通数の見込み</th>
                    <td>友だちの人数 <input type="number" name="gz_line_friends" min="0" value="<?php echo (int) $s['line_friends']; ?>" style="width:8em"> 人
                        <?php if ($s['line_friends'] > 0) : ?>
                            → 1回送ると約<?php echo number_format((int) $s['line_friends']); ?>通、月の上限まで送ると約<?php echo number_format((int) $s['line_friends'] * (int) $s['line_monthly']); ?>通
                        <?php endif; ?>
                        <p class="description">見込みを出すためだけに使います。</p></td></tr>
            </table>
            <?php $llog = (array) get_option('gz_line_log', array()); if ($llog) : ?>
                <p>最近の送信：</p><ul>
                <?php foreach (array_slice($llog, 0, 5) as $e) : ?>
                    <li><?php echo esc_html(gz_time_label_raw($e['t']) . ' ' . $e['n'] . '駅 ' . $e['msg']); ?></li>
                <?php endforeach; ?></ul>
            <?php endif; ?>
            <?php submit_button('保存する'); ?>
        </form>

        <h2>iPhoneのショートカットに入れる送り先</h2>
        <p><code><?php echo esc_html(rest_url('genzaichi/v1/update')); ?></code></p>

        <h2>履歴</h2>
        <p>過去<?php echo (int) GZ_KEEP_DAYS; ?>日分（現在 <?php echo count($history); ?> 件）を保存しています。古い分は自動で消えます。</p>
        <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>" onsubmit="return confirm('履歴をすべて消します。元に戻せません。よろしいですか？');">
            <input type="hidden" name="action" value="gz_clear">
            <?php wp_nonce_field('gz_clear'); ?>
            <?php submit_button('履歴をすべて消す', 'delete', 'submit', false); ?>
        </form>
    </div>
    <?php
}

// プラグインを削除したときは、設定と履歴も消す
register_uninstall_hook(__FILE__, 'gz_uninstall');
function gz_uninstall() {
    delete_option('gz_settings');
    delete_option('gz_history');
    delete_option('gz_points');
    delete_option('gz_last_post');
    delete_option('gz_line_token');
    delete_option('gz_line_log');
}
