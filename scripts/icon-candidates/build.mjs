// 產生十款網站圖示候選的完整套組到 public/design/icons/NN-slug/
// 用法：NODE_PATH=$(npm root -g) node scripts/icon-candidates/build.mjs
// 需要：playwright（Chromium，轉 PNG 用）、ImageMagick 的 convert（合成 favicon.ico）
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { ICONS } from './art.mjs'

// playwright 不是專案相依套件：用全域安裝的版本（NODE_PATH=$(npm root -g)）
const { chromium } = createRequire(import.meta.url)('playwright')

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..')
const OUT = join(ROOT, 'public/design/icons')

const RADIUS = 128 // 和現在 public/favicon.svg 的圓角比例相同（16/64）

/**
 * shape：rounded＝圓角方形、透明角（favicon、PWA any）；square＝滿版不透明（apple-touch、maskable）
 * scale：主體縮放（maskable 要縮進安全區）
 * detail：false＝小尺寸簡化版
 */
function frame(icon, { shape, scale = 1, detail = true }) {
  const bgShape =
    shape === 'rounded'
      ? `<rect width="512" height="512" rx="${RADIUS}" fill="${icon.bg}"/>`
      : `<rect width="512" height="512" fill="${icon.bg}"/>`
  const clip = shape === 'rounded' ? `<rect width="512" height="512" rx="${RADIUS}"/>` : `<rect width="512" height="512"/>`
  const art = icon.art(detail).replace(/\n\s*/g, '')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><title>${icon.zh} ${icon.en}</title><defs><clipPath id="c">${clip}</clipPath></defs>${bgShape}<g clip-path="url(#c)"><g transform="translate(256 256) scale(${scale}) translate(-256 -256)">${art}</g></g></svg>\n`
}

const VARIANTS = {
  // 原稿：完整細節、圓角
  'source.svg': { shape: 'rounded', detail: true },
  // 分頁 favicon：簡化版，主體稍微放大
  'favicon.svg': { shape: 'rounded', detail: false, scale: 1.04 },
  'maskable.svg': { shape: 'square', detail: true, scale: 0.72 },
}

const PNGS = [
  // [檔名, 尺寸, 用哪個變體]
  ['favicon-16.png', 16, 'favicon.svg'],
  ['favicon-32.png', 32, 'favicon.svg'],
  ['favicon-48.png', 48, 'favicon.svg'],
  ['apple-touch-icon.png', 180, 'apple'],
  ['icon-192.png', 192, 'source.svg'],
  ['icon-512.png', 512, 'source.svg'],
  ['icon-maskable-192.png', 192, 'maskable.svg'],
  ['icon-maskable-512.png', 512, 'maskable.svg'],
]

rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({ deviceScaleFactor: 1 })

async function render(svg, size, file) {
  await page.setViewportSize({ width: size, height: size })
  await page.setContent(
    `<html><body style="margin:0;background:transparent">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`,
  )
  await page.screenshot({ path: file, omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } })
}

const meta = []
for (const [i, icon] of ICONS.entries()) {
  const dir = `${String(i + 1).padStart(2, '0')}-${icon.slug}`
  const path = join(OUT, dir)
  mkdirSync(path, { recursive: true })
  const svgs = {}
  for (const [name, opt] of Object.entries(VARIANTS)) {
    // 有些主體比較扁（例如魚），小尺寸可以各自再放大一點
    svgs[name] = frame(icon, name === 'favicon.svg' && icon.smallScale ? { ...opt, scale: icon.smallScale } : opt)
    writeFileSync(join(path, name), svgs[name])
  }
  // apple-touch-icon：iOS 會自己裁圓角，所以給滿版不透明底，主體留一點邊
  svgs.apple = frame(icon, { shape: 'square', detail: true, scale: 0.88 })
  for (const [name, size, from] of PNGS) await render(svgs[from], size, join(path, name))
  execFileSync('convert', ['favicon-16.png', 'favicon-32.png', 'favicon-48.png', 'favicon.ico'], { cwd: path })
  writeFileSync(
    join(path, 'manifest-icons.json'),
    JSON.stringify(
      {
        theme_color: icon.bg,
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
      null,
      2,
    ) + '\n',
  )
  const { art: _art, ...rest } = icon
  meta.push({ dir, ...rest })
}
await browser.close()

writeFileSync(join(OUT, 'icons.json'), JSON.stringify(meta, null, 2) + '\n')
console.log(`已產生 ${meta.length} 款到 ${OUT}`)

// ---------- 預覽頁（/design/icons/，不在正式導覽裡）----------
const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;')
const tab = (m, i) =>
  `<div class="tab"><img src="${m.dir}/favicon-16.png" srcset="${m.dir}/favicon-32.png 2x" width="16" height="16" alt=""><span>${i == null ? 'ACACIA Everyday' : `${String(i + 1).padStart(2, '0')} ${esc(m.zh)}`}</span><i>×</i></div>`
const home = (m, label) =>
  `<figure class="app"><img src="${m.dir}/apple-touch-icon.png" width="60" height="60" alt=""><figcaption>${esc(label)}</figcaption></figure>`
const sizes = (m) => `
  <div class="sizes">
    <figure><div class="px"><img src="${m.dir}/favicon-16.png" width="16" height="16" alt=""></div><figcaption>16</figcaption></figure>
    <figure><div class="px"><img src="${m.dir}/favicon-32.png" width="32" height="32" alt=""></div><figcaption>32</figcaption></figure>
    <figure><div class="px"><img class="zoom" src="${m.dir}/favicon-16.png" width="64" height="64" alt=""></div><figcaption>16 放大 4 倍</figcaption></figure>
    <figure><div class="px"><img class="ios" src="${m.dir}/apple-touch-icon.png" width="90" height="90" alt=""></div><figcaption>180 apple</figcaption></figure>
    <figure><div class="px"><img src="${m.dir}/icon-512.png" width="128" height="128" alt=""></div><figcaption>512 PWA</figcaption></figure>
    <figure><div class="px"><img class="mask-circle" src="${m.dir}/icon-maskable-512.png" width="96" height="96" alt=""></div><figcaption>maskable 圓形</figcaption></figure>
    <figure><div class="px"><img class="mask-squircle" src="${m.dir}/icon-maskable-512.png" width="96" height="96" alt=""></div><figcaption>maskable 圓角</figcaption></figure>
  </div>`

const cards = meta
  .map(
    (m, i) => `
<section class="card" id="${m.slug}">
  <header>
    <img src="${m.dir}/source.svg" width="72" height="72" alt="">
    <div>
      <h2><span class="no">${String(i + 1).padStart(2, '0')}</span>${esc(m.zh)} <small>${esc(m.en)}</small></h2>
      <p class="latin"><i>${esc(m.latin)}</i>・${esc(m.status)}</p>
    </div>
  </header>
  <p class="concept">${esc(m.concept)}</p>
  <div class="bg light">${sizes(m)}</div>
  <div class="bg dark">${sizes(m)}</div>
  <div class="mocks">
    <div class="tabbar light">${tab(m)}</div>
    <div class="tabbar dark">${tab(m)}</div>
    <div class="mini-home">${home(m, 'ACACIA')}</div>
  </div>
  <p class="files">檔案：<a href="${m.dir}/source.svg">source.svg</a> · <a href="${m.dir}/favicon.svg">favicon.svg</a> · <a href="${m.dir}/favicon.ico">favicon.ico</a> · <a href="${m.dir}/apple-touch-icon.png">apple-touch-icon.png</a> · <a href="${m.dir}/icon-192.png">icon-192</a> · <a href="${m.dir}/icon-512.png">icon-512</a> · <a href="${m.dir}/icon-maskable-512.png">maskable-512</a></p>
</section>`,
  )
  .join('')

const html = `<!doctype html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>網站圖示候選</title>
<link rel="icon" href="data:,">
<style>
:root{--ink:#263633;--muted:#6f7f7a;--sage:#3d876c;--mint:#dff2e9;--line:#e3ebe6;--paper:#fff;--oat:#f7faf8}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]){--ink:#e6efeb;--muted:#9fb0aa;--sage:#7cc7a6;--mint:#1f3a30;--line:#2c3a35;--paper:#18211e;--oat:#111816}}
:root[data-theme=dark]{--ink:#e6efeb;--muted:#9fb0aa;--sage:#7cc7a6;--mint:#1f3a30;--line:#2c3a35;--paper:#18211e;--oat:#111816}
*{box-sizing:border-box}
body{margin:0;background:var(--oat);color:var(--ink);font:15px/1.6 'DM Sans','Noto Sans TC',system-ui,sans-serif}
main{max-width:1080px;margin:0 auto;padding:28px 16px 64px}
h1{font-size:26px;margin:0 0 4px}
.lead{color:var(--muted);margin:0 0 20px}
.toggle{float:right;border:1px solid var(--line);background:var(--paper);color:var(--ink);border-radius:10px;padding:6px 12px;font:inherit;cursor:pointer}
h2{font-size:19px;margin:0}
h2 small{font-weight:500;color:var(--muted);font-size:13px;margin-left:6px}
.no{display:inline-block;background:var(--mint);color:var(--sage);border-radius:8px;padding:0 8px;margin-right:8px;font-size:14px}
.panel,.card{background:var(--paper);border:1px solid var(--line);border-radius:14px;padding:18px;margin:0 0 18px;box-shadow:0 12px 36px #29483a0b}
.panel h3{margin:0 0 10px;font-size:16px}
.card header{display:flex;gap:14px;align-items:center}
.latin{margin:2px 0 0;color:var(--muted);font-size:13px}
.concept{margin:12px 0}
.bg{border-radius:12px;padding:14px;margin:8px 0;overflow-x:auto}
.bg.light{background:#ffffff;border:1px solid #e8eeea}
.bg.dark{background:#1f2124}
.sizes{display:flex;gap:18px;align-items:flex-end;min-width:max-content}
.sizes figure{margin:0;text-align:center}
.sizes .px{display:flex;align-items:center;justify-content:center;min-height:128px}
.sizes figcaption{font-size:12px;color:#8a9893;margin-top:4px}
.zoom{image-rendering:pixelated}
.ios{border-radius:22.5%}
.mask-circle{border-radius:50%}
.mask-squircle{border-radius:30%}
.mocks{display:flex;flex-wrap:wrap;gap:12px;align-items:center;margin-top:8px}
.tabbar{display:flex;gap:2px;padding:8px 8px 0;border-radius:10px 10px 0 0;overflow-x:auto;max-width:100%}
.tabbar.light{background:#dee1e6}.tabbar.dark{background:#202124}
.tab{display:flex;align-items:center;gap:8px;width:200px;flex:none;padding:8px 10px;border-radius:8px 8px 0 0;font:12px system-ui,sans-serif}
.tabbar.light .tab{background:#fff;color:#202124}.tabbar.dark .tab{background:#35363a;color:#e8eaed}
.tab span{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.tab i{font-style:normal;opacity:.6}
.tabbar.multi .tab{width:150px}
.mini-home{background:linear-gradient(160deg,#a8c9e0,#e8c7d3);border-radius:14px;padding:12px 18px}
.app{margin:0;text-align:center;width:72px}
.app img{border-radius:22.5%;display:block;margin:0 auto;box-shadow:0 1px 3px #0003}
.app figcaption{font:11px/1.3 -apple-system,system-ui,sans-serif;color:#fff;margin-top:5px;text-shadow:0 1px 2px #0006;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.phone{max-width:360px;border-radius:36px;padding:28px 18px;background:linear-gradient(160deg,#9cc3dd,#d9b8c9 60%,#f0d9b5);display:grid;grid-template-columns:repeat(4,1fr);gap:18px 6px;justify-items:center}
.phone.dark{background:linear-gradient(160deg,#1d2b3a,#3a2635 60%,#2c2a22)}
.phones{display:flex;flex-wrap:wrap;gap:18px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px}
.grid a{display:flex;flex-direction:column;align-items:center;gap:6px;text-decoration:none;color:inherit;padding:10px;border-radius:12px;border:1px solid var(--line)}
.grid a:hover{border-color:var(--sage)}
.files{font-size:13px;color:var(--muted);margin:10px 0 0}
a{color:var(--sage)}
.howto ol{padding-left:20px;margin:0}.howto li{margin:6px 0}
code{background:var(--mint);border-radius:6px;padding:1px 6px;font-size:13px}
</style>
</head>
<body>
<main>
<button class="toggle" type="button" onclick="var r=document.documentElement;r.dataset.theme=r.dataset.theme==='dark'?'light':'dark'">切換頁面深淺色</button>
<h1>網站圖示候選・台灣動植物十款</h1>
<p class="lead">ACACIA Everyday 的 favicon／apple-touch-icon／PWA 圖示候選，目前還沒套用到正式網站。挑好喜歡的編號後再套用。</p>

<section class="panel">
<h3>十款總覽</h3>
<div class="grid">${meta.map((m, i) => `<a href="#${m.slug}"><img src="${m.dir}/source.svg" width="96" height="96" alt=""><span><b>${String(i + 1).padStart(2, '0')}</b> ${esc(m.zh)}</span></a>`).join('')}</div>
</section>

<section class="panel">
<h3>瀏覽器分頁（實際 16px，高解析螢幕用 32px）</h3>
<div class="tabbar light multi">${meta.slice(0, 5).map((m, i) => tab(m, i)).join('')}</div>
<div class="tabbar light multi" style="border-radius:0">${meta.slice(5).map((m, i) => tab(m, i + 5)).join('')}</div>
<div style="height:10px"></div>
<div class="tabbar dark multi">${meta.slice(0, 5).map((m, i) => tab(m, i)).join('')}</div>
<div class="tabbar dark multi" style="border-radius:0">${meta.slice(5).map((m, i) => tab(m, i + 5)).join('')}</div>
</section>

<section class="panel">
<h3>iOS 主畫面（加入主畫面後的樣子）</h3>
<div class="phones">
<div class="phone">${meta.map((m, i) => home(m, `${String(i + 1).padStart(2, '0')} ${m.zh}`)).join('')}</div>
<div class="phone dark">${meta.map((m, i) => home(m, `${String(i + 1).padStart(2, '0')} ${m.zh}`)).join('')}</div>
</div>
</section>

${cards}

<section class="panel howto" id="apply">
<h3>選定後如何套用（例如選了 03）</h3>
<ol>
<li>把 <code>03-xxx/</code> 裡的檔案複製到 <code>public/</code>，覆蓋同名檔：<code>favicon.svg</code>、<code>favicon.ico</code>、<code>apple-touch-icon.png</code>、<code>icon-192.png</code>、<code>icon-512.png</code>，再新增 <code>icon-maskable-192.png</code>、覆蓋 <code>icon-maskable-512.png</code>。</li>
<li><code>index.html</code>：保留 <code>&lt;link rel="icon" type="image/svg+xml" href="/favicon.svg"&gt;</code>，前面加一行 <code>&lt;link rel="icon" href="/favicon.ico" sizes="48x48"&gt;</code> 給不支援 SVG 的瀏覽器；apple-touch-icon 那行不用改。</li>
<li><code>public/manifest.webmanifest</code>：<code>icons</code> 換成該資料夾 <code>manifest-icons.json</code> 裡的清單（多了 maskable 192）；想讓 PWA 標題列配色一致，可以把 <code>theme_color</code> 改成同檔案裡的底色。</li>
<li><code>src/components/BrandMark.tsx</code>（側邊欄左上角的標誌）和 <code>public/favicon.svg</code> 是同一張圖，要一起換成 <code>source.svg</code> 的內容。</li>
<li>套用後刪掉 <code>public/design/icons/</code> 和 <code>scripts/icon-candidates/</code>，候選圖就不會留在正式網站上。</li>
</ol>
</section>
</main>
</body>
</html>
`
writeFileSync(join(OUT, 'index.html'), html)
console.log('預覽頁：public/design/icons/index.html')
