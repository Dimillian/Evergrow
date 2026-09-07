import { toolForPath, toolURL } from './catalog.ts';
/** Shared navigation is imported only by standalone local review HTML. */
if (import.meta.env.DEV) {
  const path=()=>location.pathname+location.search+location.hash;
  const tool=toolForPath(path());
  if(tool&&window.parent===window){
    const nav=document.createElement('nav');nav.setAttribute('aria-label','Development tools');
    nav.style.cssText='position:fixed;bottom:8px;left:8px;z-index:2147483647;display:flex;gap:12px;padding:9px 14px;background:#101d24;border:1px solid #536f73;border-radius:8px;font:14px system-ui;color:#e2d9bf;box-shadow:0 2px 12px #0008';
    nav.innerHTML=`<a style="color:inherit" href="/tools/">✦ Tools home</a><a style="color:inherit" href="${toolURL(tool,path())}">Open in workspace ↗</a>`;document.body.append(nav);
  }
  if(tool&&window.parent!==window){
    const report=()=>window.parent.postMessage({type:'evergrow:tool-route',path:path()},location.origin);
    window.addEventListener('load',report);
    document.addEventListener('change',()=>requestAnimationFrame(report));
    document.addEventListener('click',()=>requestAnimationFrame(report));
    window.addEventListener('popstate',report);
  }
}
