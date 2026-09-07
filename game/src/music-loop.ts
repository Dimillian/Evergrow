/** WebM assets contain 250 ms of circular audio on each side of the loop.
 * Keep codec startup/tail outside playback, then reconcile the lossy seam once
 * after decode. Work at the AudioContext's decoded rate, including 44.1 kHz. */
export function prepareMusicLoop(ctx: Pick<AudioContext, 'createBuffer'>, decoded: AudioBuffer,
  frames48k: number): AudioBuffer {
  const rate = decoded.sampleRate;
  const start = Math.round(.25 * rate), length = Math.round(frames48k * rate / 48000);
  const blend = Math.round(.12 * rate);
  if (!Number.isFinite(rate) || rate < 8000 || !Number.isInteger(frames48k) ||
      length < blend || length > 65 * rate || decoded.numberOfChannels !== 2 ||
      decoded.length < start + length + blend)
    throw new Error('Invalid music loop');
  const output = ctx.createBuffer(2, length, rate);
  for (let channel = 0; channel < 2; channel++) {
    const source = decoded.getChannelData(channel), target = output.getChannelData(channel);
    target.set(source.subarray(start, start + length));
    for (let i = 0; i < blend; i++) {
      const t = i / (blend - 1), weight = t * t * (3 - 2 * t);
      const at = length - blend + i;
      target[at] = target[at] * (1 - weight) + source[start - blend + i] * weight;
    }
  }
  return output;
}
