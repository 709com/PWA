<?php
/**
 * Plugin Name: 現在地（最寄駅）表示
 * Description: iPhoneのショートカットから送られた現在地をもとに最寄駅を計算し、地図と文字で表示します。正確な位置は保存せず、駅名と時刻だけを過去7日分保存します。表示したいページに [genzaichi] と書いてください。
 * Version: 1.0.0
 * Requires at least: 5.6
 * Requires PHP: 7.4
 * License: GPLv2 or later
 */

// このファイルは、WordPressに追加するプラグインの本体です。
// 位置を受け取って最寄駅を計算・保存し、[genzaichi] を書いたページに地図と文字を表示します。管理画面の設定もここにあります。

if (!defined('ABSPATH')) {
    exit; // WordPressの外から直接開かれたときは何もしない
}

define('GZ_VERSION', '1.0.0');
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
    );
}
function gz_settings() {
    return array_merge(gz_defaults(), (array) get_option('gz_settings', array()));
}
function gz_history() {
    $h = get_option('gz_history', array());
    return is_array($h) ? $h : array();
}

// ===== 時刻（WordPressの設定のタイムゾーンで扱う） =====
function gz_now() {
    return new DateTimeImmutable('now', wp_timezone());
}
function gz_time_label($ts) {
    return (new DateTimeImmutable('@' . $ts))->setTimezone(wp_timezone())->format('G:i');
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
    $history = gz_history();
    $last = end($history);
    if ($last && $last['d'] === $today && $last['n'] === $station['name']
        && abs($last['la'] - $station['lat']) < 0.0001 && abs($last['lo'] - $station['lon']) < 0.0001) {
        // 同じ駅にいる：印は増やさず、最後の時刻だけ更新する
        $history[count($history) - 1]['t2'] = $ts;
        $history[count($history) - 1]['m'] = $station['dist'];
    } else {
        $history[] = array(
            'd'  => $today,
            'n'  => $station['name'],
            'la' => $station['lat'],
            'lo' => $station['lon'],
            'm'  => $station['dist'],
            't1' => $ts,
            't2' => $ts,
        );
    }
    // 7日より前の記録を消す
    $limit = gz_now()->modify('-' . (GZ_KEEP_DAYS - 1) . ' days')->format('Y-m-d');
    $history = array_values(array_filter($history, function ($e) use ($limit) {
        return $e['d'] >= $limit;
    }));
    update_option('gz_history', $history, false);
}

// ===== 表示する文章 =====
function gz_status_text() {
    $s = gz_settings();
    $history = gz_history();
    $now = gz_now();
    $hour = (int) $now->format('G');
    $last = end($history);
    $name = $s['name'];
    if ($s['paused'] || !$last) {
        return '現在は非公開です。';
    }
    $isNight = ($s['night_start'] > $s['night_end'])
        ? ($hour >= $s['night_start'] || $hour < $s['night_end'])
        : ($hour >= $s['night_start'] && $hour < $s['night_end']);
    if ($isNight) {
        return '本日の活動は終了しました。';
    }
    if ($now->getTimestamp() - $last['t2'] > $s['stale_hours'] * 3600) {
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
    gz_record($station, time());
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
    $res = new WP_REST_Response(array(
        'status'  => gz_status_text(),
        'date'    => $date,
        'dates'   => $dates,
        'entries' => $entries,
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
    <div class="gz-wrap" data-api="<?php echo esc_url(rest_url('genzaichi/v1/data')); ?>">
        <p class="gz-status" style="font-weight:bold;">読み込み中…</p>
        <p class="gz-date-row" style="margin:.5em 0;">表示する日：<select class="gz-date"></select></p>
        <div class="gz-map" style="height:<?php echo (int) $height; ?>px;border-radius:8px;"></div>
        <ol class="gz-list" style="font-size:.9em;margin:.8em 0 .4em 1.4em;"></ol>
        <p class="gz-note" style="font-size:.75em;color:#666;line-height:1.5;">
            1時間ごとの記録をもとに、最寄駅どうしを直線で結んでいます（実際に通った道ではありません）。<br>
            駅の位置：国土数値情報（鉄道データ）国土交通省を加工して作成 ／ 地図：<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener">国土地理院</a>
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
    update_option('gz_settings', $s, false);
    wp_safe_redirect(add_query_arg(array('page' => 'genzaichi', 'gz_msg' => $error ?: 'saved'), admin_url('options-general.php')));
    exit;
});

add_action('admin_post_gz_clear', function () {
    if (!current_user_can('manage_options')) {
        wp_die('権限がありません。');
    }
    check_admin_referer('gz_clear');
    update_option('gz_history', array(), false);
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
    );
    ?>
    <div class="wrap">
        <h1>現在地表示の設定</h1>
        <?php if (isset($messages[$msg])) : ?>
            <div class="notice notice-<?php echo esc_attr($messages[$msg][0]); ?>"><p><?php echo esc_html($messages[$msg][1]); ?></p></div>
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
            </table>
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
    delete_option('gz_last_post');
}
