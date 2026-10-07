import type { Game } from '../Game';
import type { LevelBuilder } from '../world/LevelBuilder';

export interface ZoneDef {
  id: string;
  name: string;
  chapter?: string;
  /** Registry materials to pre-generate during loading. */
  materials: string[];
  /** Navigation grid bounds for AI (omit for zones without AI). */
  nav?: { minX: number; minZ: number; maxX: number; maxZ: number; probeY?: number };
  build(g: Game, b: LevelBuilder): void | Promise<void>;
  onEnter?(g: Game, spawn: string, restored: boolean): void;
}
