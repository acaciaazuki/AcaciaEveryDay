// 十款網站圖示候選的圖稿定義（座標系 512×512，主體大約落在 56–456 之間）
// art(detail)：detail=false 是給 16/32/48px favicon 用的簡化版，拿掉細節讓小尺寸仍清楚
// 產生檔案：node scripts/icon-candidates/build.mjs

const INK = '#263633'

/** 以 (cx,cy) 為中心、半徑 r 的五瓣花 */
function blossom(cx, cy, r, petal, edge, center, rot = 0) {
  let s = `<g transform="translate(${cx} ${cy}) rotate(${rot})">`
  for (let i = 0; i < 5; i++) {
    s += `<ellipse cx="0" cy="${-r * 0.55}" rx="${r * 0.42}" ry="${r * 0.55}" fill="${petal}" stroke="${edge}" stroke-width="${r * 0.08}" transform="rotate(${i * 72})"/>`
  }
  s += `<circle r="${r * 0.22}" fill="${center}"/></g>`
  return s
}

/** 台灣欒樹的蒴果（三片膜質像小燈籠），朝下垂掛 */
function lantern(x, y, rot, fill, vein, scale = 1) {
  return `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${scale})">
    <path d="M0,-52 C44,-44 52,8 0,58 C-52,8 -44,-44 0,-52 Z" fill="${fill}"/>
    <path d="M0,-46 C10,-10 10,20 0,50" fill="none" stroke="${vein}" stroke-width="5" stroke-linecap="round"/>
  </g>`
}

/** 藍鵲的長尾羽：藍色長羽＋末端黑帶與白端（用 pathLength 分段上色） */
function plume(d, w) {
  return `<path d="${d}" pathLength="100" stroke="#4a8ad0" stroke-width="${w}" fill="none" stroke-linecap="round"/>
    <path d="${d}" pathLength="100" stroke="${INK}" stroke-width="${w}" fill="none" stroke-dasharray="0 80 9 11"/>
    <path d="${d}" pathLength="100" stroke="#fff" stroke-width="${w}" fill="none" stroke-linecap="round" stroke-dasharray="0 90 10 0"/>`
}

export const ICONS = [
  {
    slug: 'blue-magpie',
    zh: '台灣藍鵲',
    en: 'Formosan Blue Magpie',
    latin: 'Urocissa caerulea',
    status: '台灣特有種（2007 年網路票選國鳥）',
    concept: '寶藍身體、黑頭、紅嘴，配一條長長的白端尾羽。長尾巴往右下延伸，像在畫面裡劃出一道「往前走」的弧線，呼應每天整理生活的節奏。',
    bg: '#e3f2ea',
    art: (d) => `
      ${plume('M300,300 Q400,360 446,462', 40)}
      ${plume('M322,282 Q420,316 478,404', 34)}
      <ellipse cx="258" cy="262" rx="120" ry="80" transform="rotate(32 258 262)" fill="#4a8ad0"/>
      <ellipse cx="286" cy="276" rx="84" ry="50" transform="rotate(32 286 276)" fill="#3468ad"/>
      ${d ? `<path d="M240,352 L232,394 M272,350 L272,392" stroke="#e2574c" stroke-width="12" stroke-linecap="round"/>
      <path d="M150,404 C230,386 320,384 380,396" stroke="#a8825e" stroke-width="16" stroke-linecap="round" fill="none"/>` : ''}
      <circle cx="178" cy="182" r="72" fill="${INK}"/>
      <path d="M116,170 L52,204 L122,218 Z" fill="#e2574c" stroke="#e2574c" stroke-width="8" stroke-linejoin="round"/>
      <circle cx="168" cy="168" r="${d ? 17 : 22}" fill="#f6d55c"/>
      <circle cx="166" cy="168" r="${d ? 8 : 11}" fill="${INK}"/>`,
  },
  {
    slug: 'black-bear',
    zh: '台灣黑熊',
    en: 'Formosan Black Bear',
    latin: 'Ursus thibetanus formosanus',
    status: '台灣特有亞種，胸前白色 V 字是招牌',
    concept: '圓頭圓耳的正面黑熊，胸口一道奶油色 V 字月牙。用圓潤幾何造型而不是卡通吉祥物，避免和既有的黑熊角色相像。',
    bg: '#f8efd4',
    art: (d) => `
      <rect x="104" y="350" width="304" height="200" rx="110" fill="#2e3432"/>
      <path d="M156,392 Q256,470 356,392 L344,430 Q256,506 168,430 Z" fill="#fffaf0"/>
      <circle cx="148" cy="122" r="54" fill="#2e3432"/>
      <circle cx="364" cy="122" r="54" fill="#2e3432"/>
      ${d ? `<circle cx="148" cy="122" r="24" fill="#5b4f4a"/><circle cx="364" cy="122" r="24" fill="#5b4f4a"/>` : ''}
      <ellipse cx="256" cy="232" rx="150" ry="140" fill="#2e3432"/>
      <ellipse cx="256" cy="290" rx="74" ry="58" fill="#d9b98f"/>
      <ellipse cx="256" cy="264" rx="28" ry="19" fill="${INK}"/>
      ${d ? `<path d="M236,306 Q256,322 276,306" stroke="${INK}" stroke-width="8" fill="none" stroke-linecap="round"/>` : ''}
      <circle cx="198" cy="212" r="${d ? 13 : 17}" fill="#fffaf0"/>
      <circle cx="314" cy="212" r="${d ? 13 : 17}" fill="#fffaf0"/>`,
  },
  {
    slug: 'formosan-salmon',
    zh: '櫻花鉤吻鮭',
    en: 'Formosan Landlocked Salmon',
    latin: 'Oncorhynchus masou formosanus',
    status: '台灣特有亞種，冰河孑遺生物、國寶魚',
    concept: '溪流裡的國寶魚：橄欖綠背、櫻花粉的側線與一排橢圓幼魚斑，下方一道淺藍水波。粉＋綠剛好是網站的配色。',
    bg: '#e2eff7',
    smallScale: 1.12,
    art: (d) => `
      ${d ? `<path d="M96,410 q40,-26 80,0 t80,0 t80,0 t80,0" stroke="#9cc6de" stroke-width="16" fill="none" stroke-linecap="round"/>` : ''}
      <path d="M232,178 L282,160 L292,206 Z" fill="#5e8a72" stroke="#5e8a72" stroke-width="10" stroke-linejoin="round"/>
      <path d="M380,250 L462,176 C450,230 450,284 462,338 L380,266 Z" fill="#5e8a72" stroke="#5e8a72" stroke-width="12" stroke-linejoin="round"/>
      <path d="M56,258 C100,180 250,166 390,248 C250,346 100,334 56,258 Z" fill="#7aa58a"/>
      <path d="M60,262 C140,268 280,266 388,252 C260,344 110,336 60,262 Z" fill="#f3e6d8"/>
      <path d="M100,258 C180,262 290,258 372,250" stroke="#ef9fac" stroke-width="${d ? 22 : 30}" fill="none" stroke-linecap="round"/>
      ${d ? [150, 200, 250, 300].map((x) => `<ellipse cx="${x}" cy="256" rx="13" ry="24" fill="#4c6f5f" opacity=".85"/>`).join('') : ''}
      ${d ? [[180, 214], [230, 206], [280, 212], [330, 228]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="6" fill="#3f5f51"/>`).join('') : ''}
      <circle cx="112" cy="240" r="${d ? 15 : 19}" fill="#fff"/>
      <circle cx="110" cy="240" r="${d ? 8 : 11}" fill="${INK}"/>`,
  },
  {
    slug: 'muntjac',
    zh: '山羌',
    en: 'Formosan Reeves’s Muntjac',
    latin: 'Muntiacus reevesi micrurus',
    status: '台灣特有亞種，中低海拔山林最常見的鹿科動物',
    concept: '大耳朵、小短角，額頭兩道深色 V 字稜線是山羌最好認的特徵。暖棕色臉在薄荷綠底上很跳，小尺寸也一眼看得出是鹿。',
    bg: '#dff2e9',
    art: (d) => `
      <path d="M228,188 C224,164 220,146 216,128 C212,108 218,94 236,86 M218,144 L198,130" stroke="#7a5236" stroke-width="${d ? 16 : 22}" fill="none" stroke-linecap="round"/>
      <path d="M284,188 C288,164 292,146 296,128 C300,108 294,94 276,86 M294,144 L314,130" stroke="#7a5236" stroke-width="${d ? 16 : 22}" fill="none" stroke-linecap="round"/>
      <ellipse cx="140" cy="222" rx="80" ry="38" transform="rotate(-28 140 222)" fill="#c08a58"/>
      <ellipse cx="372" cy="222" rx="80" ry="38" transform="rotate(28 372 222)" fill="#c08a58"/>
      ${d ? `<ellipse cx="146" cy="222" rx="54" ry="20" transform="rotate(-28 146 222)" fill="#ecc39a"/>
      <ellipse cx="366" cy="222" rx="54" ry="20" transform="rotate(28 366 222)" fill="#ecc39a"/>` : ''}
      <path d="M256,456 C206,456 172,384 166,304 C160,222 202,168 256,168 C310,168 352,222 346,304 C340,384 306,456 256,456 Z" fill="#c08a58"/>
      <path d="M226,186 L248,306 M286,186 L264,306" stroke="#6b4426" stroke-width="${d ? 12 : 16}" stroke-linecap="round"/>
      <ellipse cx="256" cy="404" rx="60" ry="52" fill="#ecd2b2"/>
      <ellipse cx="256" cy="420" rx="36" ry="26" fill="#3b2a20"/>
      <circle cx="204" cy="296" r="${d ? 15 : 19}" fill="${INK}"/>
      <circle cx="308" cy="296" r="${d ? 15 : 19}" fill="${INK}"/>
      ${d ? `<circle cx="209" cy="291" r="5" fill="#fff"/><circle cx="313" cy="291" r="5" fill="#fff"/>` : ''}`,
  },
  {
    slug: 'macaque',
    zh: '台灣獼猴',
    en: 'Formosan Rock Macaque',
    latin: 'Macaca cyclopis',
    status: '台灣特有種，也是台灣唯一的原生靈長類',
    concept: '灰褐毛圓臉、粉橘色心形臉蛋與招牌的短眉骨，表情溫和帶點笑意，給人「每天一起生活」的親切感。',
    bg: '#f8efd4',
    art: (d) => `
      <circle cx="96" cy="262" r="46" fill="#8e8775"/>
      <circle cx="416" cy="262" r="46" fill="#8e8775"/>
      <circle cx="96" cy="262" r="24" fill="#e9b7a2"/>
      <circle cx="416" cy="262" r="24" fill="#e9b7a2"/>
      <circle cx="256" cy="252" r="170" fill="#8e8775"/>
      ${d ? `<path d="M196,96 Q226,70 256,92 Q286,70 316,96" stroke="#7a7463" stroke-width="12" fill="none" stroke-linecap="round"/>` : ''}
      <g fill="#f2c3ae">
        <circle cx="204" cy="232" r="70"/>
        <circle cx="308" cy="232" r="70"/>
        <ellipse cx="256" cy="320" rx="104" ry="94"/>
      </g>
      <path d="M150,200 Q204,170 248,196 M264,196 Q308,170 362,200" stroke="#a88e7d" stroke-width="${d ? 12 : 16}" fill="none" stroke-linecap="round"/>
      <circle cx="208" cy="240" r="${d ? 16 : 20}" fill="${INK}"/>
      <circle cx="304" cy="240" r="${d ? 16 : 20}" fill="${INK}"/>
      ${d ? `<circle cx="213" cy="235" r="5" fill="#fff"/><circle cx="309" cy="235" r="5" fill="#fff"/>` : ''}
      <ellipse cx="243" cy="314" rx="8" ry="11" fill="#9b6c5c"/>
      <ellipse cx="269" cy="314" rx="8" ry="11" fill="#9b6c5c"/>
      <path d="M222,360 Q256,${d ? 384 : 390} 290,360" stroke="#9b6c5c" stroke-width="${d ? 9 : 13}" fill="none" stroke-linecap="round"/>`,
  },
  {
    slug: 'taiwan-barbet',
    zh: '五色鳥',
    en: 'Taiwan Barbet',
    latin: 'Psilopogon nuchalis',
    status: '台灣特有種，「森林裡的花和尚」',
    concept: '綠身體、藍臉、黃喉、紅斑、黑眉，一隻鳥就有五種顏色。圓滾滾的身形像在樹洞口探頭，代表一天裡大大小小、五顏六色的事。',
    bg: '#faf1d2',
    art: (d) => `
      ${d ? `<path d="M330,470 L340,120" stroke="#b89270" stroke-width="64" stroke-linecap="round"/>` : ''}
      <ellipse cx="282" cy="320" rx="118" ry="136" fill="#5bae6b"/>
      <ellipse cx="318" cy="330" rx="74" ry="104" transform="rotate(-12 318 330)" fill="#3f8f55"/>
      <path d="M330,436 L372,486 L310,470 Z" fill="#3f8f55" stroke="#3f8f55" stroke-width="10" stroke-linejoin="round"/>
      <circle cx="214" cy="198" r="104" fill="#4b8fd8"/>
      <ellipse cx="190" cy="278" rx="66" ry="44" fill="#f5cf47"/>
      <circle cx="${d ? 222 : 226}" cy="${d ? 318 : 314}" r="${d ? 15 : 20}" fill="#e3574c"/>
      <ellipse cx="150" cy="142" rx="34" ry="24" fill="#e3574c"/>
      <path d="M170,132 Q222,108 278,128" stroke="${INK}" stroke-width="${d ? 14 : 18}" fill="none" stroke-linecap="round"/>
      <path d="M124,194 L54,222 L130,244 Z" fill="#4f504b" stroke="#4f504b" stroke-width="12" stroke-linejoin="round"/>
      <circle cx="196" cy="186" r="${d ? 15 : 19}" fill="#fff"/>
      <circle cx="194" cy="186" r="${d ? 8 : 11}" fill="${INK}"/>`,
  },
  {
    slug: 'taiwania',
    zh: '台灣杉',
    en: 'Taiwania',
    latin: 'Taiwania cryptomerioides',
    status: '以台灣命名、首次在台灣發現的巨木（亞洲大陸也有零星分布，非嚴格特有）',
    concept: '台灣最高的樹之一，層層下垂的枝葉像一座寶塔。後方是淡綠色的中央山脈，寓意穩穩向上長、慢慢累積的日常。',
    bg: '#dff2e9',
    art: (d) => {
      // 一層層扁平、邊緣微微下垂的樹冠，像寶塔一樣疊上去，最後浮在雲海上
      const dome = (cx, cy, rx, ry, fill) =>
        `<path d="M${cx - rx},${cy + ry * 0.5} Q${cx - rx * 0.9},${cy - ry} ${cx},${cy - ry} Q${cx + rx * 0.9},${cy - ry} ${cx + rx},${cy + ry * 0.5} Q${cx},${cy + ry * 0.2} ${cx - rx},${cy + ry * 0.5} Z" fill="${fill}"/>`
      return `
      <rect x="242" y="150" width="28" height="330" rx="12" fill="#8a6a4a"/>
      ${d ? `<path d="M256,330 L206,300 M256,280 L304,252" stroke="#8a6a4a" stroke-width="10" stroke-linecap="round"/>` : ''}
      ${dome(256, 300, 160, 40, '#3d876c')}
      ${dome(256, 236, 136, 40, '#4a987b')}
      ${dome(256, 174, 108, 38, '#3d876c')}
      ${dome(256, 116, 76, 34, '#4a987b')}
      ${dome(256, 66, 40, 28, '#3d876c')}
      ${d ? `<g fill="#fff"><circle cx="120" cy="440" r="50"/><circle cx="190" cy="418" r="56"/><circle cx="270" cy="446" r="48"/><circle cx="340" cy="420" r="54"/><circle cx="410" cy="442" r="50"/><rect x="60" y="440" width="400" height="80"/></g>` : ''}`
    },
  },
  {
    slug: 'golden-rain-tree',
    zh: '台灣欒樹',
    en: 'Taiwan Golden-rain Tree',
    latin: 'Koelreuteria elegans subsp. formosana',
    status: '台灣特有亞種，秋天黃花、紅果、綠葉同時出現，被稱為「四色樹」',
    concept: '秋天的台灣欒樹：一串串粉紅色紙燈籠般的蒴果，加上點點金黃小花。粉、黃、綠三色很柔和，最貼近網站的粉彩感。',
    bg: '#dff2e9',
    art: (d) =>
      d
        ? `
      <path d="M70,150 C170,120 300,110 450,150" stroke="#9a7656" stroke-width="${d ? 14 : 20}" fill="none" stroke-linecap="round"/>
      ${d ? `<g fill="#5bae6b"><ellipse cx="120" cy="112" rx="40" ry="16" transform="rotate(-20 120 112)"/><ellipse cx="396" cy="108" rx="40" ry="16" transform="rotate(18 396 108)"/><ellipse cx="300" cy="96" rx="34" ry="14" transform="rotate(-10 300 96)"/></g>` : ''}
      <path d="M256,140 L256,210 M256,150 L190,262 M256,150 L322,262" stroke="#9a7656" stroke-width="${d ? 7 : 12}" stroke-linecap="round"/>
      ${lantern(190, 318, 10, '#f4a7a0', '#e07f78', 1.15)}
      ${lantern(322, 318, -10, '#f4a7a0', '#e07f78', 1.15)}
      ${lantern(208, 408, 6, '#e9837c', '#cf6a63', 1.05)}
      ${lantern(304, 408, -6, '#e9837c', '#cf6a63', 1.05)}
      ${lantern(256, 278, 0, '#ee9690', '#d8746d', 1.3)}
      ${[[110, 166], [150, 172], [192, 150], [402, 162], [440, 174], [360, 150], [222, 132], [292, 130]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="13" fill="#f2c94c"/>`).join('')}`
        : // 小尺寸：只留三顆大燈籠和一點黃花，避免細枝糊成一團
          `<path d="M120,96 C200,76 312,76 392,96" stroke="#9a7656" stroke-width="26" fill="none" stroke-linecap="round"/>
      ${lantern(168, 300, 12, '#f4a7a0', '#e07f78', 1.7)}
      ${lantern(344, 300, -12, '#f4a7a0', '#e07f78', 1.7)}
      ${lantern(256, 250, 0, '#e9837c', '#cf6a63', 1.9)}`,
  },
  {
    slug: 'yushan-rhododendron',
    zh: '玉山杜鵑',
    en: 'Yushan Rhododendron',
    latin: 'Rhododendron pseudochrysanthum',
    status: '台灣特有種，盛開於玉山等高山地區',
    concept: '高山上的粉白杜鵑花團，背景是戴著雪頂的玉山。花團像一束捧花，象徵把每天的小事整理成一束好看的生活。',
    bg: '#e2eff7',
    art: (d) => `
      ${d ? `<path d="M30,330 L182,140 L230,196 L272,150 L482,330 Z" fill="#c4dbe8"/>
      <path d="M150,180 L182,140 L230,196 L272,150 L302,186 L272,176 L230,214 L182,168 Z" fill="#fff"/>` : ''}
      <g fill="#3d876c">
        <ellipse cx="146" cy="380" rx="88" ry="30" transform="rotate(-24 146 380)"/>
        <ellipse cx="366" cy="380" rx="88" ry="30" transform="rotate(24 366 380)"/>
        <ellipse cx="200" cy="420" rx="76" ry="26" transform="rotate(-56 200 420)"/>
        <ellipse cx="312" cy="420" rx="76" ry="26" transform="rotate(56 312 420)"/>
      </g>
      ${blossom(176, 296, 92, '#fbd3dc', '#ef9fb3', '#e58aa2', 10)}
      ${blossom(336, 296, 92, '#fbd3dc', '#ef9fb3', '#e58aa2', -12)}
      ${blossom(256, 236, 100, '#fde6eb', '#ef9fb3', '#e58aa2', 0)}
      ${d ? `<g fill="#d9758f"><circle cx="248" cy="196" r="6"/><circle cx="266" cy="200" r="6"/><circle cx="256" cy="186" r="6"/></g>` : ''}`,
  },
  {
    slug: 'formosa-lily',
    zh: '台灣百合',
    en: 'Formosa Lily',
    latin: 'Lilium formosanum',
    status: '台灣特有種，從海邊到高山都能生長，象徵堅韌',
    concept: '在鼠尾草綠底上的一朵白色喇叭花，花瓣外側帶淡紫紅條紋。十款裡唯一的深底設計，在淺色瀏覽器分頁最醒目。',
    bg: '#4a987b',
    art: (d) => `
      ${d ? `<path d="M110,500 C130,440 138,400 152,362" stroke="#bfe6cf" stroke-width="14" fill="none" stroke-linecap="round"/>` : ''}
      ${d ? `<ellipse cx="90" cy="440" rx="70" ry="15" transform="rotate(-60 90 440)" fill="#bfe6cf"/>
      <ellipse cx="160" cy="456" rx="64" ry="14" transform="rotate(-110 160 456)" fill="#bfe6cf"/>` : ''}
      <g transform="translate(${d ? 150 : 120} ${d ? 360 : 380}) rotate(-40) scale(${d ? 1.3 : 1.5})">
        <path d="M-10,-16 C40,-22 96,-42 130,-62 L150,0 L130,62 C96,42 40,22 -10,16 Z" fill="#ffffff"/>
        <path d="M116,-44 C160,-96 210,-132 244,-104 C226,-62 186,-26 146,-2 Z" fill="#ffffff"/>
        <path d="M116,44 C160,96 210,132 244,104 C226,62 186,26 146,2 Z" fill="#ffffff"/>
        <path d="M136,-16 C190,-30 236,-12 236,12 C200,24 166,18 136,14 Z" fill="#f1f7f3"/>
        ${d ? `<path d="M0,-2 C40,-4 90,-10 126,-18" stroke="#c79aae" stroke-width="7" fill="none" stroke-linecap="round"/>
        <path d="M0,6 C40,10 90,20 124,32" stroke="#c79aae" stroke-width="5" fill="none" stroke-linecap="round" opacity=".7"/>
        <g stroke="#e8d27a" stroke-width="5" stroke-linecap="round"><path d="M150,0 L214,-26"/><path d="M150,0 L220,-4"/><path d="M150,0 L212,20"/></g>
        <g fill="#c58b3a"><circle cx="214" cy="-26" r="8"/><circle cx="220" cy="-4" r="8"/><circle cx="212" cy="20" r="8"/></g>` : `<path d="M0,0 C40,-2 90,-8 126,-14" stroke="#c79aae" stroke-width="12" fill="none" stroke-linecap="round"/>`}
      </g>`,
  },
]
