/** Build permission and save ownership are independent. A disconnected cloud session is still cloud. */
export function canUseLocalConsole(buildEnabled:boolean, siteBuild:boolean, mode:string, hostname:string, android:boolean):boolean {
  return buildEnabled && !siteBuild && mode==='local' && (android||['localhost','127.0.0.1','[::1]','::1'].includes(hostname));
}
// The console's own input may toggle closed; other editable fields retain their keys.
export function isConsoleShortcut(event:{key:string;code:string;metaKey:boolean;ctrlKey:boolean;altKey:boolean;shiftKey:boolean;isComposing:boolean}, editingText=false):boolean {
  if(editingText||event.altKey||event.shiftKey||event.isComposing)return false;
  return event.code==='KeyK'&&(event.metaKey||event.ctrlKey)
    ||event.key==='`'&&!event.metaKey&&!event.ctrlKey;
}
