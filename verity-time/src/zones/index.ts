import type { ZoneDef } from './types';
import { sandbox } from './sandbox';
import { outside } from './outside';
import { lobby } from './lobby';
import { menu } from './menu';
import { factory } from './factory';
import { research } from './research';
import { playland } from './playland';
import { oldworks } from './oldworks';

export const ZONES: Record<string, ZoneDef> = {
  sandbox,
  outside,
  lobby,
  menu,
  factory,
  research,
  playland,
  oldworks,
};
