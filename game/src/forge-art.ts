/** All engraving stays inside the viewBox, including its stroke width. */
export function forgeFrameSVG(): string {
  return `<svg class="forge-frame" viewBox="0 0 160 184" fill="none" aria-hidden="true">
    <path class="forge-frame-corners" d="M12 58V34L32 14H48M112 14H128L148 34V58M12 112V136L32 156H48M112 156H128L148 136V112"/>
    <path class="forge-frame-diamond" d="M80 19L146 85L80 151L14 85Z"/>
    <path class="forge-frame-inner" d="M80 28L137 85L80 142L23 85Z"/>
    <path class="forge-frame-highlights" d="M28 71L66 33M94 137L132 99"/>
    <path class="forge-frame-seals" d="M80 10L84 14L80 18L76 14ZM80 152L84 156L80 160L76 156Z"/>
    <path class="forge-frame-base" d="M40 171H65M95 171H120M73 171H87"/>
  </svg>`;
}

export function forgeCoinSVG(): string {
  return `<svg class="forge-coin" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M8 2H16L22 8V16L16 22H8L2 16V8Z"/><path d="M9 5H15L19 9V15L15 19H9L5 15V9Z"/><path d="M12 8L16 12L12 16L8 12Z"/></svg>`;
}

/** Eighteen irregular, bounded ember paths; no random source or gameplay state. */
export function forgeMotesMarkup(): string {
  return `<div class="forge-motes" aria-hidden="true">${Array.from({length:18},(_,i)=>{
    const noise=(salt:number)=>((Math.imul(i+1,salt)>>>0)%997)/997;
    const offset=(salt:number,spread:number)=>(noise(salt)*spread*2-spread).toFixed(2)+'%';
    return `<span class="forge-ember" style="--x0:${offset(7919,36)};--y0:${offset(3571,34)};--x1:${offset(6271,33)};--y1:${offset(2377,32)};--x2:${offset(5023,22)};--y2:${offset(1877,26)};--x3:${offset(3469,4)};--y3:${offset(1399,4)};--delay:${Math.round(noise(2851)*190)}ms;--ember:${i%4===0?'#c3e7d7':'#ffe0a0'};--spark-size:${i%3===0?3:2}px"><i></i></span>`;
  }).join('')}</div>`;
}
