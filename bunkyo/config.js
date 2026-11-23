// このファイルは「文京区民アプリ」の設定です。ここ1か所を直せば、タイルの開け閉め・お休み・版番号が変わります。
// 画面（app.js）と、通信なしで開く仕組み（sw.js）の両方がこのファイルを読みます。
//
// 【機能を1つ開けるとき】
//   1) apps/ にその機能のファイルを置く
//   2) 下の TILES の該当行の status を 'open' にし、files にファイル名を書く
//   3) VERSION を上げ、sw.js の VERSION も同じ番号にする（使っている人に「新しい機能が届きました」と出る）
//   ほかの機能のファイルには手を入れなくて済みます。

const BK_CONFIG = {
  VERSION: '0.1.0',

  // 【お休みの切り替え】ここ1か所でアプリ全体を止められます。
  //   force: true にすると、すぐにお休み画面になる（手動）。
  //   from〜to の日付（日本時間。両端を含む）の間は、自動でお休み画面になる。
  //   すでにホーム画面に置いた人の端末でも、日付で自動的に止まります（通信なしでも止まる）。
  //   日付は見込みです。確定したら直してください。
  PAUSE: { force: false, from: '2027-04-18', to: '2027-04-25', reopen: '4月26日' },

  LINE_URL: 'https://line.me/R/ti/p/@t.709',
  SITE_URL: 'https://bunkyo-kosodate.net/',

  // 最初に必ず保存するファイル（通信なしで開くため）
  CORE_FILES: ['./', './index.html', './style.css', './config.js', './app.js', './data/units.js',
    './manifest.json', './icon-180.png', './icon-512.png'],

  // 6つのタイル。status は 'open'（開店）か 'soon'（準備中）。
  TILES: [
    { id: 'dome', no: '一', name: '東京ドーム換算機', desc: '広さ・高さを文京区の単位に',
      status: 'open', files: ['./apps/dome.js'],
      majime: '区内の公園をぜんぶ足すと、東京ドーム何個分でしょう。足りていると思いますか？' },
    { id: 'saka', no: '二', name: '坂の水準器', desc: 'いまの傾き、何坂くらい？',
      status: 'soon', files: [],
      teaser: 'スマホの傾きを測って、区内の坂にたとえます。ふつうの水準器としても、ちゃんと使えるものにします。' },
    { id: 'yayoi', no: '三', name: '弥生コンパス', desc: '土器が、あの碑の方角を指す',
      status: 'soon', files: [],
      teaser: '画面の土器から伸びる光が、「弥生式土器発掘ゆかりの地」の碑の方角を指します。碑までの距離も出します。' },
    { id: 'kuka', no: '四', name: '区歌カラオケ', desc: '歌えたら、歌唱認定書',
      status: 'soon', files: [],
      teaser: '文京区歌を、伴奏に合わせて歌えるようにします。権利の確認が済んでから開けます。' },
    { id: 'nenne', no: '五', name: '赤ちゃん寝かしつけ', desc: '文京区の音で、おやすみ',
      status: 'soon', files: [],
      teaser: '文京区らしい音（すべて手作り）で寝かしつけます。タイマーで静かに消えます。' },
    { id: 'botsu', no: '六', name: '没案コーナー', desc: '採用されなかった案たち',
      status: 'soon', files: [],
      teaser: '採用されなかった案を並べます。「復活希望」が多い案は、作者に届きます。' }
  ]
};

// 開いているタイルのファイルも、通信なしで使えるように保存する
BK_CONFIG.ALL_FILES = BK_CONFIG.CORE_FILES.concat(
  ...BK_CONFIG.TILES.filter((t) => t.status === 'open').map((t) => t.files));

self.BK_CONFIG = BK_CONFIG;
