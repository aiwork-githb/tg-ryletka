import type { DocDef, ItemDef, LogDef, SecretDef } from './types';
import { ITEM_LIST } from './items';
import * as Z0 from './content/outside';
import * as Z1 from './content/lobby';
import * as Z2 from './content/factory';

function index<T extends { id: string }>(...lists: T[][]): Record<string, T> {
  const out: Record<string, T> = {};
  for (const l of lists) for (const x of l) out[x.id] = x;
  return out;
}

export const ITEMS: Record<string, ItemDef> = index(ITEM_LIST);
export const DOCS: Record<string, DocDef> = index(Z0.DOCS, Z1.DOCS, Z2.DOCS);
export const LOGS: Record<string, LogDef> = index(Z0.LOGS, Z1.LOGS, Z2.LOGS);
export const SECRETS: Record<string, SecretDef> = index(Z0.SECRETS, Z1.SECRETS, Z2.SECRETS);
