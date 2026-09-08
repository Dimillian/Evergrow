
const files = { ...import.meta.glob<string>('./assets/music-auditions/*.mp3', { eager: true, query: '?url', import: 'default' }),
  ...import.meta.glob<string>('./assets/music/*.mp3', { eager: true, query: '?url', import: 'default' }) };
export const MUSIC_FILES: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(files).map(([path, url]) => [path.split('/').at(-1)!.replace('.mp3', ''), url]));
