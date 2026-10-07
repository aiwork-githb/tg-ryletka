import type { ZoneDef } from './types';
import { sandbox } from './sandbox';
import { outside } from './outside';
import { lobby } from './lobby';
import { menu } from './menu';

export const ZONES: Record<string, ZoneDef> = {
  sandbox,
  outside,
  lobby,
  menu,
};
