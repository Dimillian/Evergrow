import { cp, access, rm } from 'node:fs/promises';

// Sites expects static output at the repository root; keep Vite's local layout.
const source = new URL('../game/dist/', import.meta.url);
const destination = new URL('../dist/', import.meta.url);
await access(new URL('index.html', source));
await rm(destination, { recursive: true, force: true });
await cp(source, destination, { recursive: true });
