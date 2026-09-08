import { DEFAULT_AUDIO, type AudioChannel } from './audio-preferences.ts';
import './audio-controls.css';
export interface AudioControlActions {
  sound?(): void; muted?(): boolean;
  volume?(channel: AudioChannel): number;
  setVolume?(channel: AudioChannel, value: number): void;
  panelSound?(open: boolean): void;
}
export function audioControlsMarkup(includeMute = false) {
  return `<div class="audio-sliders">${includeMute ? '<div class="audio-master"><span>Sound</span><button type="button" data-audio-mute aria-pressed="true">On</button></div>' : ''}${(['music', 'sfx'] as const).map(channel => `<label class="audio-slider"><span>${channel === 'music' ? 'Music' : 'SFX'}</span><input type="range" data-audio-volume="${channel}" aria-label="${channel === 'music' ? 'Music volume' : 'Sound effects volume'}" min="0" max="100" step="5" value="${DEFAULT_AUDIO[channel] * 100}"><output>${DEFAULT_AUDIO[channel] * 100}%</output></label>`).join('')}</div>`;
}
export function bindAudioControls(root: HTMLElement, actions: AudioControlActions, signal: AbortSignal) {
  const refresh = () => {
    const mute = root.querySelector<HTMLButtonElement>('[data-audio-mute]');
    if (mute) { mute.disabled = !actions.sound; mute.textContent = actions.muted?.() ? 'Off' : 'On'; mute.setAttribute('aria-pressed', String(!actions.muted?.())); }
    for (const input of root.querySelectorAll<HTMLInputElement>('[data-audio-volume]')) {
      const channel = input.dataset.audioVolume as AudioChannel;
      input.value = String(Math.round((actions.volume?.(channel) ?? DEFAULT_AUDIO[channel]) * 100));
      input.parentElement!.querySelector('output')!.textContent = `${input.value}%`;
    }
  };
  root.querySelector('[data-audio-mute]')?.addEventListener('click', () => { actions.sound?.(); refresh(); }, { signal });
  root.addEventListener('input', event => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || !input.dataset.audioVolume) return;
    actions.setVolume?.(input.dataset.audioVolume as AudioChannel, Number(input.value) / 100);
    refresh();
  }, { signal });
  root.addEventListener('change', event => {
    if ((event.target as HTMLElement).matches('[data-audio-volume=sfx]')) actions.panelSound?.(true);
  }, { signal });
  refresh(); return refresh;
}
