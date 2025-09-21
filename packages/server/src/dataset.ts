import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import type { ItemRecord } from '@facetzoom/filters';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function loadDataset(): ItemRecord[] {
  const file = resolve(__dirname, '../../../data/items.json');
  const raw = readFileSync(file, 'utf-8');
  const items = JSON.parse(raw) as ItemRecord[];
  return items.map((item) => ({
    ...item,
    facets: {
      ...item.facets,
      Added: item.facets.Added ? new Date(String(item.facets.Added)) : undefined,
    },
  }));
}
