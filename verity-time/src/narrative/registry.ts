import type { DocDef, ItemDef, LogDef, SecretDef } from './types';
import { ITEM_LIST } from './items';
import * as Z0 from './content/outside';
import * as Z1 from './content/lobby';
import * as Z2 from './content/factory';
import * as Z3 from './content/research';
import * as Z4 from './content/playland';
import * as Z5 from './content/oldworks';
import * as Z6 from './content/core';

function index<T extends { id: string }>(...lists: T[][]): Record<string, T> {
  const out: Record<string, T> = {};
  for (const l of lists) for (const x of l) out[x.id] = x;
  return out;
}

export const ITEMS: Record<string, ItemDef> = index(ITEM_LIST);
export const DOCS: Record<string, DocDef> = index(Z0.DOCS, Z1.DOCS, Z2.DOCS, Z3.DOCS, Z4.DOCS, Z5.DOCS, Z6.DOCS);
export const LOGS: Record<string, LogDef> = index(Z0.LOGS, Z1.LOGS, Z2.LOGS, Z3.LOGS, Z4.LOGS, Z5.LOGS, Z6.LOGS);
export const SECRETS: Record<string, SecretDef> = index(Z0.SECRETS, Z1.SECRETS, Z2.SECRETS, Z3.SECRETS, Z4.SECRETS, Z5.SECRETS, Z6.SECRETS);
