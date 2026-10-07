import { DEFAULT_BINDINGS, type Action } from './Input';

export type Preset = 'low' | 'medium' | 'high' | 'ultra' | 'custom';
export type Level3 = 'low' | 'medium' | 'high';
export type ShadowLevel = 'off' | 'low' | 'high';
export type DisplayMode = 'fullscreen' | 'borderless' | 'windowed';

export interface Settings {
  preset: Preset;
  displayMode: DisplayMode;
  resolution: string; // "native" or "1920x1080"
  renderScale: number;
  vsync: boolean;
  fpsLimit: number; // 0 = unlimited (only meaningful without vsync)
  shadows: ShadowLevel;
  textures: Level3;
  effects: Level3;
  ssao: boolean;
  fov: number;
  brightness: number;
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  voiceVolume: number;
  ambienceVolume: number;
  subtitles: boolean;
  subtitleSize: 'small' | 'medium' | 'large' | 'xl';
  subtitleBackground: boolean;
  sensitivity: number;
  invertY: boolean;
  crouchToggle: boolean;
  headBob: boolean;
  reduceFlashing: boolean;
  showFps: boolean;
  /** First-run frame-time check has run (the preset may have been lowered). */
  autoTuned: boolean;
  bindings: Record<Action, string[]>;
}

export const PRESETS: Record<Exclude<Preset, 'custom'>, Pick<Settings, 'shadows' | 'textures' | 'effects' | 'ssao' | 'renderScale'>> = {
  low: { shadows: 'off', textures: 'low', effects: 'low', ssao: false, renderScale: 0.75 },
  medium: { shadows: 'low', textures: 'medium', effects: 'medium', ssao: false, renderScale: 1 },
  high: { shadows: 'high', textures: 'high', effects: 'high', ssao: false, renderScale: 1 },
  ultra: { shadows: 'high', textures: 'high', effects: 'high', ssao: true, renderScale: 1 },
};

export function defaultSettings(): Settings {
  return {
    preset: 'high',
    displayMode: 'fullscreen',
    resolution: 'native',
    vsync: true,
    fpsLimit: 0,
    ...PRESETS.high,
    fov: 75,
    brightness: 1,
    masterVolume: 0.9,
    musicVolume: 0.7,
    sfxVolume: 0.9,
    voiceVolume: 1,
    ambienceVolume: 0.8,
    subtitles: true,
    subtitleSize: 'medium',
    subtitleBackground: true,
    sensitivity: 1,
    invertY: false,
    crouchToggle: true,
    headBob: true,
    reduceFlashing: false,
    showFps: false,
    autoTuned: false,
    bindings: structuredClone(DEFAULT_BINDINGS),
  };
}

const KEY = 'verity-time.settings.v1';

export function loadSettings(storage: Pick<Storage, 'getItem'> | null = safeStorage()): Settings {
  const d = defaultSettings();
  if (!storage) return d;
  try {
    const raw = storage.getItem(KEY);
    if (!raw) return d;
    const parsed = JSON.parse(raw) as Partial<Settings>;
    const merged: Settings = { ...d, ...parsed, bindings: { ...d.bindings, ...(parsed.bindings ?? {}) } };
    // sanitise numbers
    merged.fov = clamp(merged.fov, 60, 110);
    merged.sensitivity = clamp(merged.sensitivity, 0.1, 4);
    merged.brightness = clamp(merged.brightness, 0.5, 1.6);
    merged.renderScale = clamp(merged.renderScale, 0.5, 1);
    return merged;
  } catch {
    return d;
  }
}

export function saveSettings(s: Settings, storage: Pick<Storage, 'setItem'> | null = safeStorage()): void {
  try {
    storage?.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage full / blocked */
  }
}

export function applyPreset(s: Settings, p: Preset): void {
  s.preset = p;
  if (p !== 'custom') Object.assign(s, PRESETS[p]);
}

export function clamp(v: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, Number.isFinite(v) ? v : a));
}

export function safeStorage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}
