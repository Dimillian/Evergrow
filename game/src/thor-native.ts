import { parseNativePad, parseThorCommand, type ThorCommand, type ThorSnapshot } from './thor-protocol.ts';
import type { PadSnapshot } from './gamepad-input.ts';
interface AndroidBridge {
    controller(): string;
    clearController(): void;
    hasCompanion(): boolean;
    publish(value: string): void;
}
declare global {
    interface Window {
        EvergrowAndroid?: AndroidBridge;
        EvergrowCompanion?: {
            command(value: string): void;
            ready(): void;
        };
    }
}
export function nativeController(): PadSnapshot[] | null {
    if (!window.EvergrowAndroid)
        return null;
    try {
        const pad = parseNativePad(window.EvergrowAndroid.controller());
        return pad ? [pad] : [];
    }
    catch {
        return [];
    }
}
export function clearNativeController() { try {
    window.EvergrowAndroid?.clearController();
}
catch { /* The native window may already be closing. */ } }
export interface ThorHost {
    snapshot(map: boolean): ThorSnapshot;
    command(value: ThorCommand): void;
    background(): void;
    foreground(): void;
    back(): void;
}
/** Four bounded UI snapshots/second; terrain image refreshes twice/second. Never simulates a second player. */
export class ThorNative {
    private abort = new AbortController();
    private next = 0;
    private nextMap = 0;
    private host: ThorHost;
    constructor(host: ThorHost) {
        this.host = host;
        if (!window.EvergrowAndroid)
            return;
        const signal = this.abort.signal;
        window.addEventListener('evergrow-native-command', event => { const command = parseThorCommand((event as CustomEvent).detail); if (command)
            host.command(command); }, { signal });
        window.addEventListener('evergrow-native-lifecycle', event => { if ((event as CustomEvent).detail === 'pause')
            host.background();
        else
            host.foreground(); }, { signal });
        window.addEventListener('evergrow-native-back', () => host.back(), { signal });
    }
    update(now: number) {
        if (!window.EvergrowAndroid || now < this.next)
            return;
        this.next = now + 250;
        try {
            if (!window.EvergrowAndroid.hasCompanion())
                return;
            const map = now >= this.nextMap;
            if (map)
                this.nextMap = now + 500;
            const state = this.host.snapshot(map);
            let payload = JSON.stringify(state);
            if (payload.length > 400000) {
                delete state.map;
                payload = JSON.stringify(state);
            }
            if (payload.length <= 400000)
                window.EvergrowAndroid.publish(payload);
        }
        catch (error) {
            console.warn('Companion display update failed', error);
        }
    }
    dispose() { this.abort.abort(); }
}
