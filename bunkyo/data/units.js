// このファイルは、換算機で使う数字と、その出どころの一覧です。
// 決まり：公式の資料（施設・区・都・国・競技団体）を実際に開いて確かめた数字だけを書く。記憶や推測で書かない。
// 数字を直すときは、value（数字）と sources（出どころ・確認した日）を一緒に直す。
// 確かめられなかったものは excluded に理由つきで書き、画面には出さない。

self.BK_DATA = {
  area: {
    unit: '㎡', unitName: '平方メートル',
    plain: [
      { id: 'm2', label: '平方メートル（㎡）', short: '㎡', f: 1 },
      { id: 'ha', label: 'ヘクタール（ha）', short: 'ha', f: 10000 },
      { id: 'km2', label: '平方キロ（k㎡）', short: 'k㎡', f: 1000000 }
    ],
    bunkyo: [
      { id: 'dome', name: '東京ドーム', counter: '個分', value: 46755, note: '建築面積', src: 'dome' },
      { id: 'shokubutsuen', name: '小石川植物園', counter: '個分', value: 161588, src: 'shokubutsuen' },
      { id: 'rikugien', name: '六義園', counter: '個分', value: 87809.41, note: '開園面積', src: 'rikugien' },
      { id: 'korakuen', name: '小石川後楽園', counter: '個分', value: 70847.17, note: '開園面積', src: 'korakuen' },
      { id: 'todai', name: '東京大学 本郷地区キャンパス', counter: '個分', value: 561351, note: '敷地面積', src: 'todai' },
      { id: 'kyoiku', name: '教育の森公園', counter: '個分', value: 21171, src: 'kyoiku' },
      { id: 'bunkyo', name: '文京区まるごと', counter: '個分', value: 11290000, note: '区の面積 11.29k㎡', src: 'kumenseki' }
    ],
    familiar: [
      { id: 'tatami', name: '畳1枚', one: '', value: 1.62, src: 'tatami', how: '不動産広告の決まりで「畳1枚＝1.62㎡以上」とされている、その1.62㎡で計算' },
      { id: 'basket', name: 'バスケットコート', one: '1面', value: 420, src: 'basket', how: '縦28m×横15mから計算' },
      { id: 'tennis', name: 'テニスコート', one: '1面', value: 260.7569, src: 'tennis', how: 'ダブルス用 23.77m×10.97mから計算' },
      { id: 'soccer', name: 'サッカーコート', one: '1面', value: 7140, src: 'soccer', how: '105m×68mから計算' }
    ]
  },
  height: {
    unit: 'm', unitName: 'メートル',
    plain: [
      { id: 'm', label: 'メートル（m）', short: 'm', f: 1 },
      { id: 'cm', label: 'センチ（cm）', short: 'cm', f: 0.01 },
      { id: 'km', label: 'キロメートル（km）', short: 'km', f: 1000 }
    ],
    bunkyo: [
      { id: 'domeh', name: '東京ドーム', counter: '個分', value: 56.19, note: '最高部・地上から', src: 'dome' },
      { id: 'civic', name: '文京シビックセンター', counter: '棟分', value: 141.7, note: '建物高さ', src: 'civic' }
    ],
    familiar: []
  },

  // 区政モード：区の統計で確かめた数字
  kusei: [
    { kind: 'area', name: '区内の公園 48園の合計', note: '都立2園＋区立46園', value: 369864, unit: '㎡', src: 'toukei' },
    { kind: 'area', name: 'うち区立公園 46園', value: 211207, unit: '㎡', src: 'toukei' },
    { kind: 'area', name: '区内の児童遊園 66園の合計', value: 21609, unit: '㎡', src: 'toukei' }
  ],

  sources: {
    dome: { title: '株式会社東京ドーム 公式サイト「東京ドームについて」（建築面積 46,755㎡、最高部の高さ 地上56.190m）', url: 'https://www.tokyo-dome.co.jp/dome/about/', date: '2026年11月23日' },
    shokubutsuen: { title: '東京大学大学院理学系研究科附属植物園（小石川植物園）公式サイト', url: 'https://koishikawa-bg.jp/overview/', date: '2026年11月23日' },
    rikugien: { title: '東京都公園協会「六義園」（平成27年7月1日現在の開園面積）', url: 'https://www.tokyo-park.or.jp/park/rikugien/', date: '2026年11月23日' },
    korakuen: { title: '東京都公園協会「小石川後楽園」（平成27年7月1日現在の開園面積）', url: 'https://www.tokyo-park.or.jp/park/koishikawakorakuen/', date: '2026年11月23日' },
    todai: { title: '東京大学「東京大学本郷地区キャンパスエリア活性化に向けた基本構想」（令和4年7月）', url: 'https://www.u-tokyo.ac.jp/content/400193179.pdf', date: '2026年11月23日' },
    kyoiku: { title: '文京区「五十音別公園・児童遊園一覧」', url: 'https://www.city.bunkyo.lg.jp/b036/p004869.html', date: '2026年11月23日' },
    kumenseki: { title: '文京区「位置・面積」', url: 'https://www.city.bunkyo.lg.jp/kusejoho/profile/three-minutes/location.html', date: '2026年11月23日' },
    civic: { title: '文京区 文京シビックセンター案内図（建物高さ 141.70m）', url: 'https://www.city.bunkyo.lg.jp/documents/6364/202502.pdf', date: '2026年11月23日' },
    tatami: { title: '不動産公正取引協議会連合会「不動産の公正競争規約」表示規約施行規則 第9条(16)', url: 'https://www.rftc.jp/webkanri/kanri/wp-content/uploads/2025/08/20250826_kiyakushuu.pdf', date: '2026年11月23日' },
    basket: { title: '日本バスケットボール協会「2026 バスケットボール競技規則」', url: 'https://www.japanbasketball.jp/files/referee/rule/2026rule.pdf', date: '2026年11月23日' },
    tennis: { title: '国際テニス連盟（ITF）「Rules of Tennis 2026」', url: 'https://www.world.tennis/media/7221/2026-rules-of-tennis-english.pdf', date: '2026年11月23日' },
    soccer: { title: '日本サッカー協会「サッカー競技規則2026/27」第1条（国内の全国的規模の大会などでの大きさ）', url: 'https://www.jfa.jp/laws/soccer/2026_27/', date: '2026年11月23日' },
    toukei: { title: '文京区「第58回 文京の統計 令和7年」表67 公園・児童遊園及び公衆便所状況（令和7年4月1日現在）', url: 'https://www.city.bunkyo.lg.jp/documents/6030/58_bunkyonotoukei.pdf', date: '2026年11月23日' }
  },

  excluded: [
    { name: '富士神社（駒込）の標高', reason: '区の公式ページに標高の記載がなく、公的な資料で確かめられませんでした。' },
    { name: '25メートルプール', reason: '幅の決まりを公式の規則で確かめられませんでした（資料のサイトが開けませんでした）。' },
    { name: '体積・人数の換算', reason: '広さと高さから始めています。数字の確認が済みしだい足します。' }
  ]
};
