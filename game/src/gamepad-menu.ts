import { PAD, type GamepadInput } from './gamepad-input.ts';

/** Adapt controller navigation to the panels' existing focus/keyboard contracts. */
export class GamepadMenu {
  private direction = '';
  private nextRepeat = 0;
  clear() { this.direction = ''; this.nextRepeat = 0; }

  update(root: HTMLElement, pad: GamepadInput, now: number) {
    const controls = [...root.querySelectorAll<HTMLElement>('button, input, select, textarea, [tabindex]')]
      .filter(el => el.tabIndex >= 0 && !el.matches(':disabled') && !el.closest('[hidden], [inert]') && el.getClientRects().length > 0);
    if (!controls.length) return;
    const step = (delta: number) => {
      const index = controls.indexOf(document.activeElement as HTMLElement);
      const next = index < 0 ? (delta > 0 ? 0 : controls.length - 1) : (index + delta + controls.length) % controls.length;
      controls[next].focus(); controls[next].scrollIntoView({ block: 'nearest', inline: 'nearest' });
    };
    if (pad.pressed.has(PAD.potion)) step(-1);
    else if (pad.pressed.has(PAD.skill2)) step(1);
    if (!root.contains(document.activeElement) && pad.active) step(1);
    const target = document.activeElement;
    if (!(target instanceof HTMLElement) || !root.contains(target)) return;
    const key = pad.held.has(PAD.left) || pad.move.x < -.5 ? 'ArrowLeft'
      : pad.held.has(PAD.right) || pad.move.x > .5 ? 'ArrowRight'
      : pad.held.has(PAD.up) || pad.move.y < -.5 ? 'ArrowUp'
      : pad.held.has(PAD.down) || pad.move.y > .5 ? 'ArrowDown' : '';
    if (key && (key !== this.direction || now >= this.nextRepeat)) {
      const delta = key === 'ArrowLeft' || key === 'ArrowUp' ? -1 : 1;
      if (target instanceof HTMLSelectElement) {
        const options = [...target.options];
        let next = target.selectedIndex + delta;
        while (next >= 0 && next < options.length && options[next].disabled) next += delta;
        if (next >= 0 && next < options.length) {
          target.selectedIndex = next; target.dispatchEvent(new Event('change', { bubbles: true }));
        }
      } else {
        const event = new KeyboardEvent('keydown', { key, code: key, bubbles: true, cancelable: true });
        target.dispatchEvent(event);
        if (!event.defaultPrevented) step(delta);
      }
      this.nextRepeat = now + (key === this.direction ? 120 : 350);
    }
    this.direction = key;
    if (pad.pressed.has(PAD.interact)) {
      if (target instanceof HTMLCanvasElement) target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true }));
      else target.click();
    }
    // Inventory exposes equip/unequip through its ordinary Shift-click action.
    if (pad.pressed.has(PAD.skill3) && root.querySelector('.character-bag') && target.matches('[data-location]'))
      target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, shiftKey: true }));
    if (target instanceof HTMLCanvasElement) {
      for (const [button, key] of [[PAD.skill1, '-'], [PAD.attack, '+']] as const)
        if (pad.pressed.has(button)) target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    }
  }
}
