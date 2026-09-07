import './typography.css';
import { loadGameFont } from './font.ts';
import { installUITheme } from './ui-theme.ts';
if(!import.meta.env.DEV)throw new Error('Local smartphone mockup only.');
installUITheme();await loadGameFont();
document.querySelector('#phone-study')!.innerHTML=`
<style>
*{box-sizing:border-box}body{margin:0;background:#091219;color:#d3ddd6;font:16px var(--ui-font)}main{max-width:1320px;margin:auto;padding:28px 20px}header{display:flex;justify-content:space-between;gap:20px;align-items:center;margin-bottom:24px}h1{font-size:25px;font-weight:500;margin:0 0 8px}p{font-size:14px;color:#97aaa9;margin:0;line-height:1.6}a{color:#b9d2c0}section{display:flex;gap:24px;flex-wrap:wrap;justify-content:center}article{width:398px;max-width:100%}h2{font-size:18px;font-weight:400;margin:0 0 6px}article p{margin-bottom:14px;font-size:12px}.device{border:4px solid #34464c;border-radius:26px;overflow:hidden;background:#0b161d;box-shadow:0 16px 36px #0005}iframe{display:block;border:0;width:100%;height:844px}footer{margin-top:24px;color:#91a5a4;font-size:13px}@media(max-width:600px){header{display:block}header a{display:inline-block;margin-top:12px}main{padding:20px 10px}}
</style>
<header><div><h1>Character editor · Smartphone study</h1><p>Live preview above, scrollable controls below. Try each screen independently.</p></div><a href="/character-editor.html">Open full editor</a></header>
<section>
<article><h2>01 · Character</h2><p>Touch paging, larger swatches, always-visible character.</p><div class="device"><iframe title="Smartphone Character editor" src="/character-editor.html?view=character"></iframe></div></article>
<article><h2>02 · Armor</h2><p>Choose a piece, tint it, or restore its original color.</p><div class="device"><iframe title="Smartphone Armor editor" src="/character-editor.html?view=armor"></iframe></div></article>
<article><h2>03 · Inventory</h2><p>Equipment tab → edit icon beside the heading.</p><div class="device"><iframe title="Smartphone Inventory preview" src="/character-editor.html?view=inventory"></iframe></div></article>
</section><footer>390 × 844 phone canvases · local mockups · no saves or gameplay</footer>`;
