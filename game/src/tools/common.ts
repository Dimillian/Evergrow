import '../typography.css';
import './tools.css';
import { installUITheme } from '../ui-theme.ts';
import { loadGameFont } from '../font.ts';
export async function toolPage(title: string, description: string): Promise<HTMLElement> {
  if (!import.meta.env.DEV) throw new Error('This tool requires local development.');
  await loadGameFont(); installUITheme();
  document.title=`Evergrow · ${title}`;
  const root=document.querySelector<HTMLElement>('#tool')!;root.className='tool-page';root.replaceChildren();
  const h=document.createElement('h1');h.textContent=title;const p=document.createElement('p');p.textContent=description;root.append(h,p);return root;
}
export function downloadJSON(name: string, value: unknown): void {
  const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function boundedNumber(value: unknown, fallback: number, min: number, max: number): number {
  const n=value===null||value===''?NaN:Number(value);return Number.isFinite(n)?Math.max(min,Math.min(max,Math.round(n))):fallback;
}
export function reportRoute(): void { if(window.parent!==window)window.parent.postMessage({type:'evergrow:tool-route',path:location.pathname+location.search},location.origin); }
