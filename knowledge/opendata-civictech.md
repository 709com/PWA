# 自治体オープンデータとシビックテック作品事例（PWA実験室向け調査メモ）

このファイルは、文京区議会議員 高浜直樹のPWA実験室で使うための調査メモです。iPhone向けの小さなWebアプリ（PWA）の材料になりそうな「文京区・東京都のオープンデータ」と「他の自治体で市民がつくったアプリ事例」をまとめました。
**調査日：2026-11-07**（Web検索で確認できたものだけを載せています。確認が弱いものには「要確認」と書きました）

---

## 節1 文京区・東京都のオープンデータ（10件）

| # | データ名 | 形式 | URL | 利用条件 | 使えそうなアプリ案 |
|---|---|---|---|---|---|
| 1 | オープンデータBUNKYO（文京区オープンデータポータル） | 分野別一覧。メタデータ一覧CSVあり | https://www.city.bunkyo.lg.jp/b004/p006286.html ／ 一覧 https://www.city.bunkyo.lg.jp/b004/p006749.html ／ FAQ https://www.city.bunkyo.lg.jp/kusejoho/opendata/opendatashitsumon.html | CC BY 4.0（「文京区のデータを使った」と表示する） | 区のデータ全体を探せる検索アプリ |
| 2 | 文京区 イベント一覧 | CSV（一覧ページに掲載） | https://www.city.bunkyo.lg.jp/b004/p006749.html | CC BY 4.0（ポータル共通） ※どの範囲のイベントか、更新の頻度は要確認 | 「今週の文京区イベント」カレンダー |
| 3 | 文京区のAED設置箇所一覧 | 都のAPIカタログに登録あり（形式は要確認） | https://spec.api.metro.tokyo.lg.jp/spec/t131059d0000000002-1d218f3f609cad9767de90fa8e33c26e-0?lang=en | 要確認（都カタログは原則CC BY 4.0） | 現在地から近いAEDを示すマップ |
| 4 | 区立小・中学校の校門等のAED（24時間利用可） | HTMLの一覧表（施設名・住所・「正門左手」などの設置場所） | https://www.city.bunkyo.lg.jp/b009/p000234.html （AED総合ページ https://www.city.bunkyo.lg.jp/b009/p000051.html 、ファミリーマート設置店 https://www.city.bunkyo.lg.jp/b009/p000164.html ） | オープンデータとしての表示はない（要確認） | 3と組み合わせて「夜でも使えるAED」で絞り込む |
| 5 | 文京区の避難所・緊急避難場所一覧 | CSV（都のAPIあり） | https://spec.api.metro.tokyo.lg.jp/spec/t131059d0502060001-4621833cac34429f839636c33ade6e9f-0?lang=en | 要確認（都カタログは原則CC BY 4.0） | オフラインでも見られる避難所マップ（PWAのキャッシュを使う） |
| 6 | 文京区防災地図（令和7年4月発行版） | PDF地図 | https://www.city.bunkyo.lg.jp/b009/p000027.html | 要確認 | 避難所アプリから元の地図PDFへのリンク |
| 7 | 文京区の公衆無線LAN設置場所 | CSV・Excel（都のAPIあり） | https://spec.api.metro.tokyo.lg.jp/spec/t131059d0101040001-68c4b87646d45057353dc738cbcdb85f-0?lang=en | 要確認（都カタログは原則CC BY 4.0） | 「近くの無料Wi-Fi」マップ（災害時の連絡手段にも） |
| 8 | 東京都防災マップ 避難所・避難場所一覧データ | 都のAPIあり（形式は要確認） | https://spec.api.metro.tokyo.lg.jp/spec/t000003d0000000093-0af9bfa497bc7be6ef83e5bfd1fdcfc6-0?lang=en | CC BY 4.0（出典を表示する） | 区境をまたいで避難所を探せるマップ |
| 9 | 車椅子使用者対応トイレのバリアフリー情報（東京都福祉局）。公共施設は令和6年度更新版、鉄道駅は令和4年度更新版 | CSV＋写真（緯度経度、出入口の幅、オストメイト、ベビーチェアなど）。API（service.api.metro.tokyo.lg.jp）あり | https://www.fukushi.metro.tokyo.lg.jp/kiban/machizukuri/bf_data.html ／ API https://spec.api.metro.tokyo.lg.jp/spec/t000054d0000000342-7a9c14dc8c4743458ac2ff54f1461aa1-0?lang=en | 要確認（都カタログは原則CC BY 4.0）。工事・故障で使えない場合があるとの注意書きあり | 文京区内のバリアフリートイレ・おむつ交換台マップ |
| 10 | 東京都オープンデータカタログサイト／利用規約（平成29年3月24日 総務局長決定） | CKANカタログ（CSVなど）。データごとのAPI仕様ページあり | https://catalog.data.metro.tokyo.lg.jp/ ／ API一覧 https://spec.api.metro.tokyo.lg.jp/ | 原則CC BY 4.0。データごとにライセンスの表示を確認する | 文京区のデータ（識別子 t131059…）を自動で取り込む仕組み |

> メモ：今回の検索では、文京区の「子育て施設一覧」「公衆トイレ」「区立公園」「ごみ収集」のオープンデータは確認できませんでした（要確認。ポータルのメタデータCSVで確かめる）。参考として、町田市の子育て施設一覧はデジタル庁の「自治体標準オープンデータセット」の様式で公開されています（https://opendata.city.machida.tokyo.jp/en/dataset/shisetsu_kosodateshisetsuichiran ）。

---

## 節2 他の自治体のシビックテック作品（13件）

| # | 作品 | 自治体 | 内容 | 出典URL | PWA化のヒント |
|---|---|---|---|---|---|
| 1 | 5374（ごみなし）.jp | 石川県金沢市（Code for Kanazawa） | ごみ収集日を色分けで表示し、分別の品目を一覧で見せる。100以上の都市に広がった（2018年IPA資料による） | http://5374.jp ／ https://imi.ipa.go.jp/contents/2018/07/20180601_02_07_CfK.pdf | ソースはMPLライセンスで公開。`data`フォルダを差し替えれば別の自治体で使える。文京区版がつくれるかを最初に検討する |
| 2 | 5374 塩尻版などのフォーク | 長野県塩尻市など | 塩尻市の収集カレンダーで動かしたフォーク | https://www.github.com/shiolab/5374 ／ https://github.com/myokoym/5374 | 「データを差し替えるだけ」の実例として参考になる |
| 3 | 5374（ごみなし）神戸版 | 兵庫県神戸市（NPO法人コミュニティリンクと市環境局） | 6か国語に対応。収集日を調べられ、品目から分別も検索できる。2025年3月31日に更新 | https://www.city.kobe.lg.jp/a04164/kurashi/recycle/gomi/dashikata/bunbetsukubun/apri/ | 多言語対応。文京区の留学生や外国人住民向けにも |
| 4 | さっぽろ保育園マップ（ぱぱまま） | 北海道札幌市（Code for Sapporo） | 認可保育所の一覧を整え、地図に載せた。住所が丁目までしかないこと、園名の表記ゆれが課題だった | https://docs.google.com/document/d/1s8Y6Ahdl-MZY3OGiTaBs6MPAviujxuJx2uxk2uZ3rmY/export?format=pdf （現在の公開状況は要確認） | 住所から緯度経度に変える作業がいちばん大変。データを先に整える |
| 5 | ちば保育園マップ | 千葉県千葉市（Code for Chiba） | 市内の認可・認可外保育所と幼稚園を地図で探せる | https://www.city.chiba.jp/somu/joho/kaikaku/chibadataportal_appli.html | 保育園の種類ごとにアイコンを分ける、空き情報を重ねる |
| 6 | ちばレポ（ちば市民協働レポート） | 千葉県千葉市 | 道路の傷みや公園遊具の不具合を、写真と位置をつけてスマホで報告する。2014年に正式に始まった | https://cloud.watch.impress.co.jp/docs/news/20140829_664217.html | PWAではカメラとGPSが使える。文京区版の「まちの困りごと投稿」の試作に |
| 7 | 千葉市 公共施設の位置情報 | 千葉県千葉市 | 市のサイトの施設案内で使っている位置情報をCSVで公開 | https://www.city.chiba.jp/sogoseisaku/shichokoshitsu/kohokocho/map_opendata.html | 施設マップの元データの公開のしかたとして参考になる（区への提案材料に） |
| 8 | 東京都 新型コロナウイルス感染症対策サイト | 東京都（Code for Japan） | 感染者数などのオープンデータを見やすくしたサイト。オープンソースで公開され、すべての都道府県で同じ形のサイトがつくられた | https://www.businessinsider.jp/post-212276 ／ https://atmarkit.itmedia.co.jp/ait/articles/2009/30/news031.html | データの形をそろえ（標準フォーマット）、見せ方をテンプレート化すると横に広がる |
| 9 | おやまAEDマップ → 子ども施設マップ | 栃木県小山市（Code for OYAMA） | 市のオープンデータでAEDマップをつくり、同じ構成を子ども施設マップに使い回した。Claude Codeで移行した手順の記事あり | https://zenn.dev/bishi/articles/20250810a_article | 地図アプリを1つ型にすれば、データを替えるだけで何本もつくれる。この実験室のやり方に近い |
| 10 | 日本全国AEDマップ（aedm.jp） | 全国（民間） | GPSで近くのAEDを表示。利用者の投稿で成り立ち、正確さの保証はない | https://apps.apple.com/jp/app/id421697422 | 公式データ（節1の3・4）と投稿データの違いを画面に書く |
| 11 | 愛知県 AED設置情報 | 愛知県 | AEDの設置情報をCSV（UTF-8）で公開し、毎日更新 | https://www.pref.aichi.jp/opendata/aichi-aedmap/aed.html | 「毎日更新するCSV」は区に求める公開の水準として参考になる |
| 12 | mapprint（Code for Japan） | 全国（災害支援） | GoogleマイマップやuMapのデータを取り込み、印刷向けの地図にする。MITライセンス | https://github.com/codeforjapan/mapprint | 避難所マップに「印刷する」ボタンをつける（スマホを持たない人に紙で配る） |
| 13 | 防災備蓄マップ（bichiku-map） | 東京（Tokyo OSS Party!! で市民が開発） | 避難所の防災備蓄の状況を登録して表示できるオープンソースのテンプレート | https://www.github.com/t-kurasawa/bichiku-map | 文京区の避難所CSV（節1の5）と組み合わせて「備蓄の見える化」 |

参考（件数には入れていません）：会津若松市ではCode for AIZUが歩行空間ネットワークデータ（バリアフリー・ナビ）の整備に関わったと国土交通省の資料にあります（https://www.mlit.go.jp/common/001283319.pdf ほか、要確認）。室蘭市は子育てイベントと施設の一覧をオープンデータにして、民間の「いこーよ」が使っています（https://resemom.jp/release/prtimes/20191225/59365.html ）。

**合計：23件**（節1：10件、節2：13件）

---

## すぐ作れそうな文京区向けアプリ案

- **文京区版5374（ごみ分別・収集日）**：Code for KanazawaのMPLのコードを使い、データを文京区の収集日と分別表に差し替える。※文京区のごみデータがオープンデータにあるかは要確認（なければ区のページから手で整える）
- **近くのAEDマップ**：都APIの「文京区AED設置箇所一覧」と、区立小中学校の校門AED（24時間）を重ねる。「今使えるか」で絞り込める
- **オフライン避難所マップ**：文京区の避難所・緊急避難場所CSVをService Workerでキャッシュし、電波がなくても開ける。mapprintのように印刷もできる
- **無料Wi-Fiスポットマップ**：文京区の公衆無線LAN設置場所CSVを使い、災害時の連絡手段の案内も兼ねる
- **バリアフリートイレ・おむつ交換台マップ**：都福祉局の車椅子使用者対応トイレCSVを文京区内だけに絞る。子育て中の人と車いすの人の両方に役立つ
- **今週の文京区イベント**：オープンデータBUNKYOのイベント一覧CSVを日付順に並べ、ホーム画面に置けるようにする
- **まちの困りごと投稿（ちばレポ風の試作）**：カメラとGPSで写真と場所を記録し、区への要望メモにする（最初は端末の中だけに保存）
- **データ一つ・型一つの地図テンプレート**：小山市の例にならい、1つの地図PWAの型にCSVを差し替えて上の各マップをつくる

---

### 利用条件のまとめ
- 文京区（オープンデータBUNKYO）：CC BY 4.0。使うときは出典（文京区）を表示する
- 東京都オープンデータカタログ：原則CC BY 4.0。データごとにライセンスを確認し、出典を表示する
- 5374のソースコード：MPL（著作権はCode for Kanazawa）
- mapprint：MIT
