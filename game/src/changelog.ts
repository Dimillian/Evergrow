export const CHANGELOG_SECTIONS = ['New', 'Tweaks', 'Fixes'] as const;
export type ChangelogSection = typeof CHANGELOG_SECTIONS[number];
export interface ChangelogEntry {
  date: string; title: string; notices: string[];
  sections: Array<{ title: ChangelogSection; items: string[] }>;
}

/** Deliberately small Markdown contract: dated releases, section headings, bullets,
 * bold text and notices. No HTML, links, embeds or runtime requests. */
export function parseChangelog(markdown: string): ChangelogEntry[] {
  const entries: ChangelogEntry[] = [];
  let entry: ChangelogEntry | undefined, section: ChangelogEntry['sections'][number] | undefined;
  for (const raw of markdown.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const heading = /^## (\d{4}-\d{2}-\d{2}) — (.+)$/.exec(line);
    if (heading) {
      const [, date, title] = heading;
      const parsed = new Date(`${date}T12:00:00Z`);
      if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) throw new Error('Invalid changelog date');
      if (entries.some(e => e.date === date && e.title === title)) throw new Error('Duplicate changelog entry');
      if (entries.length && entries.at(-1)!.date < date) throw new Error('Changelog must be newest first');
      entry = { date, title, notices: [], sections: [] }; entries.push(entry); section = undefined;
    } else if (!entry) {
      if (line.startsWith('## ')) throw new Error('Expected ## YYYY-MM-DD — Title');
    } else if (line.startsWith('### ')) {
      const title = line.slice(4) as ChangelogSection;
      if (!CHANGELOG_SECTIONS.includes(title) || entry.sections.some(s => s.title === title)) throw new Error('Invalid changelog section');
      section = { title, items: [] }; entry.sections.push(section);
    } else if (line.startsWith('- ') && section && line.length > 2) section.items.push(line.slice(2));
    else if (line.startsWith('> ') && line.length > 2) entry.notices.push(line.slice(2));
    else throw new Error(`Unsupported changelog line: ${line}`);
  }
  if (!entries.length || entries.some(e => !e.sections.length || e.sections.some(s => !s.items.length))) throw new Error('Empty changelog entry or section');
  return entries;
}

export function changelogDate(date: string): string {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));
}
