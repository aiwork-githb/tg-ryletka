import type * as THREE from 'three';
import type { Materials } from '../assets/Materials';

export type DocStyle = 'typed' | 'hand' | 'child' | 'memo' | 'screen' | 'ad';

export interface DocDef {
  id: string;
  title: string;
  style: DocStyle;
  body: string;
  zone: string;
  stamp?: string;
  /** Short line shown in the journal list. */
  from?: string;
}

export interface LogDef {
  id: string;
  title: string;
  zone: string;
  /** Voice profile key (see audio/Voice.ts). */
  voice: string;
  speaker: string;
  lines: string[];
  date?: string;
}

export interface ItemDef {
  id: string;
  name: string;
  desc: string;
  /** Builds a small 3D model used for pickups and inventory icons. */
  model: (m: Materials) => THREE.Object3D;
}

export interface SecretDef {
  id: string;
  name: string;
  desc: string;
  zone: string;
}

export const SPEAKERS: Record<string, { name: string; color: string; voice: string }> = {
  verity: { name: 'Верити', color: '#f2c94c', voice: 'verity' },
  theo: { name: 'Тео Ламберт', color: '#9fd3c7', voice: 'male' },
  hale: { name: 'Д-р Хейл', color: '#c9c9d6', voice: 'old' },
  nadia: { name: 'Надя Керр', color: '#ef8a7e', voice: 'female' },
  irina: { name: 'Ирина Сол', color: '#c3b1e1', voice: 'female' },
  pell: { name: 'Артур Пелл', color: '#e8c07d', voice: 'male' },
  eva: { name: 'Ева Краль', color: '#e0a080', voice: 'female' },
  marc: { name: 'Марк Дюваль', color: '#a7c4a0', voice: 'male' },
  pa: { name: 'Динамик', color: '#bbbbbb', voice: 'pa' },
  child: { name: 'Ребёнок', color: '#ffd1dc', voice: 'child' },
  player: { name: 'Вы', color: '#ffffff', voice: 'male' },
  ad: { name: 'Реклама', color: '#f6d365', voice: 'pa' },
};
