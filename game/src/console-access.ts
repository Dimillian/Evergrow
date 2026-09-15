/** Build permission and save ownership are independent. A disconnected cloud session is still cloud. */
export function canUseLocalConsole(buildEnabled:boolean, siteBuild:boolean, mode:string, hostname:string, android:boolean):boolean {
  return buildEnabled && !siteBuild && mode==='local' && (android||['localhost','127.0.0.1','[::1]','::1'].includes(hostname));
}
export function isConsoleShortcut(event:{code:string;metaKey:boolean;ctrlKey:boolean;altKey:boolean;shiftKey:boolean;isComposing:boolean}):boolean {
  return event.code==='KeyK'&&(event.metaKey||event.ctrlKey)&&!event.altKey&&!event.shiftKey&&!event.isComposing;
}
