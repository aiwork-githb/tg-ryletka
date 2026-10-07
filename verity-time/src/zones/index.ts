import type { ZoneDef } from './types';
import { sandbox } from './sandbox';
import { outside } from './outside';

export const ZONES: Record<string, ZoneDef> = {
  sandbox,
  outside,
};
