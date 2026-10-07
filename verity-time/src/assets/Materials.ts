import * as THREE from 'three';
import { fbm, heightToNormal } from './noise';
import { RECIPES, type RecipeParams } from './recipes';
import { Surface } from './Surface';

export interface MatDef {
  recipe: string;
  params?: RecipeParams;
  /** Metres covered by one texture repeat (used by world-space UVs). */
  tile: number;
  normalScale?: number;
  heightStrength?: number;
  transparent?: boolean;
  opacity?: number;
  side?: THREE.Side;
  physical?: boolean;
  envIntensity?: number;
  /** Strength of world-space macro variation that hides tiling. */
  macro?: number;
  seed?: number;
}

/** Central registry of every surface material in the game. */
export const MAT_DEFS: Record<string, MatDef> = {
  floor_terrazzo: { recipe: 'terrazzo', tile: 2.5, params: { wear: 0.55 }, macro: 0.6 },
  floor_checker: { recipe: 'checker', tile: 2, params: { tiles: 4, wear: 0.6 }, macro: 0.5 },
  floor_carpet_theater: { recipe: 'carpet', tile: 2.2, params: { wear: 0.6 }, macro: 0.6, normalScale: 0.6 },
  floor_carpet_red: { recipe: 'carpet', tile: 2.2, params: { color: '#6b1f28', color2: '#d9a441', color3: '#2d6f8c', wear: 0.6 }, macro: 0.6, normalScale: 0.6 },
  floor_carpet_blue: { recipe: 'carpet', tile: 2.2, params: { color: '#24456b', color2: '#f2cf63', color3: '#e88f8f', wear: 0.5 }, macro: 0.6, normalScale: 0.6 },
  wall_wallpaper: { recipe: 'wallpaper', tile: 1.8, params: { wear: 0.55 }, macro: 0.7 },
  wall_wallpaper_teal: { recipe: 'wallpaper', tile: 1.8, params: { color: '#cfe7df', color2: '#f6d8a8', color3: '#e07a7a', wear: 0.6 }, macro: 0.7 },
  wall_wallpaper_kids: { recipe: 'wallpaper', tile: 1.6, params: { color: '#fbe9c7', color2: '#bfe3f2', color3: '#ef8a7e', wear: 0.45 }, macro: 0.6 },
  wall_plaster: { recipe: 'plaster', tile: 2.2, params: { wear: 0.6 }, macro: 0.8 },
  wall_plaster_mint: { recipe: 'plaster', tile: 2.2, params: { color: '#b7d3c4', wear: 0.6 }, macro: 0.8 },
  wall_plaster_peach: { recipe: 'plaster', tile: 2.2, params: { color: '#e5c2a6', wear: 0.55 }, macro: 0.8 },
  wall_plaster_lab: { recipe: 'plaster', tile: 2.2, params: { color: '#dfe3df', wear: 0.35 }, macro: 0.6 },
  wall_plaster_dark: { recipe: 'plaster', tile: 2.2, params: { color: '#6f746f', wear: 0.8 }, macro: 0.8 },
  concrete: { recipe: 'concrete', tile: 3, params: { wear: 0.5 }, macro: 0.8 },
  concrete_dark: { recipe: 'concrete', tile: 3, params: { color: '#64615b', wear: 0.85 }, macro: 0.9 },
  floor_painted: { recipe: 'paintedFloor', tile: 3, params: { wear: 0.55 }, macro: 0.7 },
  floor_painted_grey: { recipe: 'paintedFloor', tile: 3, params: { color: '#6a6f72', wear: 0.6 }, macro: 0.7 },
  floor_painted_red: { recipe: 'paintedFloor', tile: 3, params: { color: '#7b3a33', wear: 0.6 }, macro: 0.7 },
  ceiling_tiles: { recipe: 'ceilingTile', tile: 1.2, params: { wear: 0.6 }, macro: 0.5 },
  ceiling_tiles_clean: { recipe: 'ceilingTile', tile: 1.2, params: { wear: 0.2 }, macro: 0.3 },
  metal_teal: { recipe: 'paintedMetal', tile: 1.2, params: { color: '#3d6b70', wear: 0.5 } },
  metal_locker: { recipe: 'paintedMetal', tile: 1.2, params: { color: '#71838a', wear: 0.45 } },
  metal_yellow: { recipe: 'paintedMetal', tile: 1.2, params: { color: '#d4a32a', wear: 0.6 } },
  metal_red: { recipe: 'paintedMetal', tile: 1.2, params: { color: '#9a2e27', wear: 0.55 } },
  metal_white: { recipe: 'paintedMetal', tile: 1.2, params: { color: '#d7d6cf', wear: 0.4 } },
  metal_green: { recipe: 'paintedMetal', tile: 1.2, params: { color: '#4e6b4a', wear: 0.55 } },
  metal_dark: { recipe: 'paintedMetal', tile: 1.2, params: { color: '#2e3336', wear: 0.5 } },
  metal_cream: { recipe: 'paintedMetal', tile: 1.2, params: { color: '#e4d6b4', wear: 0.5 } },
  metal_brushed: { recipe: 'brushedMetal', tile: 1, params: { wear: 0.4 } },
  metal_chrome: { recipe: 'brushedMetal', tile: 1, params: { color: '#c9cdd1', wear: 0.15 } },
  metal_rust: { recipe: 'rust', tile: 1.5 },
  metal_rust_paint: { recipe: 'rust', tile: 1.5, params: { color2: '#3d6b70' } },
  diamond_plate: { recipe: 'diamondPlate', tile: 1.2, params: { wear: 0.5 }, normalScale: 1.4 },
  wood_panel: { recipe: 'wood', tile: 2.4, params: { tiles: 6, color: '#6e4528', wear: 0.4 }, macro: 0.4 },
  wood_floor: { recipe: 'wood', tile: 2.4, params: { tiles: 8, color: '#8a5a32', wear: 0.6 }, macro: 0.5 },
  wood_light: { recipe: 'wood', tile: 1.6, params: { tiles: 4, color: '#b98d5d', wear: 0.35 } },
  wood_dark: { recipe: 'wood', tile: 1.6, params: { tiles: 4, color: '#4a2e1b', wear: 0.4 } },
  tile_white: { recipe: 'ceramic', tile: 1.2, params: { tiles: 8, wear: 0.5 }, macro: 0.5 },
  tile_pastel: { recipe: 'ceramic', tile: 1.6, params: { tiles: 8, color: '#f3e2c4', color2: '#bfe0d8', color3: '#f2b9b0', wear: 0.45 }, macro: 0.5 },
  tile_blue: { recipe: 'ceramic', tile: 1.2, params: { tiles: 8, color: '#a8c9d3', wear: 0.6 }, macro: 0.6 },
  tile_floor_dark: { recipe: 'ceramic', tile: 1.6, params: { tiles: 6, color: '#4b4e4f', color2: '#3d4142', wear: 0.6 }, macro: 0.6 },
  playmat: { recipe: 'playMat', tile: 2, params: { tiles: 2, wear: 0.55 }, macro: 0.4 },
  fabric_red: { recipe: 'fabric', tile: 1.5, params: { color: '#6e1a25', wear: 0.5 } },
  fabric_blue: { recipe: 'fabric', tile: 1.5, params: { color: '#2b4a6e', wear: 0.5 } },
  fabric_cream: { recipe: 'fabric', tile: 1.5, params: { color: '#d8ccb4', wear: 0.6 } },
  fabric_green: { recipe: 'fabric', tile: 1.5, params: { color: '#3e5e4a', wear: 0.5 } },
  brick_old: { recipe: 'brick', tile: 2, params: { tiles: 8, wear: 0.65 }, macro: 0.8 },
  brick_painted: { recipe: 'brick', tile: 2, params: { tiles: 8, color: '#b8b1a1', wear: 0.6 }, macro: 0.8 },
  linoleum_green: { recipe: 'linoleum', tile: 3, params: { wear: 0.5 }, macro: 0.6 },
  linoleum_beige: { recipe: 'linoleum', tile: 3, params: { color: '#c9bba0', wear: 0.55 }, macro: 0.6 },
  padded_cream: { recipe: 'padded', tile: 1.5, params: { tiles: 4, wear: 0.55 }, normalScale: 1.5 },
  padded_blue: { recipe: 'padded', tile: 1.5, params: { tiles: 4, color: '#b9cfe0', wear: 0.5 }, normalScale: 1.5 },
  cardboard: { recipe: 'cardboard', tile: 1, params: { wear: 0.5 } },
  grate: { recipe: 'grate', tile: 1, side: THREE.DoubleSide },
  stone_old: { recipe: 'stone', tile: 3, params: { wear: 0.75 }, macro: 0.9, normalScale: 1.4 },
  rubber: { recipe: 'rubber', tile: 1 },
  asphalt: { recipe: 'asphalt', tile: 4, params: { wear: 0.6 }, macro: 0.9 },
  dead_grass: { recipe: 'deadGrass', tile: 3, macro: 1 },
  glass: { recipe: 'glass', tile: 1.5, physical: true, transparent: true, opacity: 0.25, envIntensity: 1 },
  glass_dirty: { recipe: 'glass', tile: 1.5, params: { wear: 1, color: '#8a9a8c' }, physical: true, transparent: true, opacity: 0.45 },
};

const PROP_RECIPES = new Set(['plastic', 'paintedMetal', 'flat', 'fabric', 'rubber', 'wood', 'brushedMetal']);

export interface TexSet {
  map: THREE.Texture;
  normalMap: THREE.Texture;
  orm: THREE.Texture;
  hasAlpha: boolean;
}

export type TextureQuality = 'low' | 'medium' | 'high';

/**
 * Generates and caches procedural texture sets and the materials using them.
 */
export class Materials {
  private texCache = new Map<string, TexSet>();
  private matCache = new Map<string, THREE.Material>();
  macroNoise: THREE.DataTexture;
  anisotropy = 4;
  quality: TextureQuality = 'high';
  /** Shared uniforms injected into every patched material. */
  readonly shared = {
    uMacro: { value: null as THREE.Texture | null },
    uTime: { value: 0 },
    uWrong: { value: 0 },
  };

  constructor() {
    const N = 256;
    const n = fbm(N, N, 4, 5, 1234);
    const n2 = fbm(N, N, 16, 3, 999);
    const data = new Uint8Array(N * N * 4);
    for (let i = 0; i < N * N; i++) {
      data[i * 4] = n[i] * 255;
      data[i * 4 + 1] = n2[i] * 255;
      data[i * 4 + 2] = 128;
      data[i * 4 + 3] = 255;
    }
    this.macroNoise = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
    this.macroNoise.wrapS = this.macroNoise.wrapT = THREE.RepeatWrapping;
    this.macroNoise.magFilter = THREE.LinearFilter;
    this.macroNoise.minFilter = THREE.LinearMipmapLinearFilter;
    this.macroNoise.generateMipmaps = true;
    this.macroNoise.needsUpdate = true;
    this.shared.uMacro.value = this.macroNoise;
  }

  texSize(kind: 'surface' | 'prop' = 'surface'): number {
    const base = this.quality === 'low' ? 256 : this.quality === 'medium' ? 512 : 1024;
    return kind === 'prop' ? Math.max(256, base / 2) : base;
  }

  /** Texture set for a recipe+params; generated once and cached. */
  textures(recipe: string, params: RecipeParams = {}, size = this.texSize(), seed = 1, heightStrength = 2): TexSet {
    const key = `${recipe}|${JSON.stringify(params)}|${size}|${seed}|${heightStrength}`;
    const hit = this.texCache.get(key);
    if (hit) return hit;
    const fn = RECIPES[recipe];
    if (!fn) throw new Error('unknown recipe ' + recipe);
    const s = new Surface(size, seed * 7919 + hashStr(recipe + JSON.stringify(params)));
    fn(s, params);
    s.clampAll();
    const set = this.upload(s, heightStrength * (size / 512));
    this.texCache.set(key, set);
    return set;
  }

  private upload(s: Surface, heightStrength: number): TexSet {
    const N = s.size;
    const albedo = new Uint8Array(N * N * 4);
    const orm = new Uint8Array(N * N * 4);
    for (let i = 0; i < s.n; i++) {
      albedo[i * 4] = s.r[i] * 255;
      albedo[i * 4 + 1] = s.g[i] * 255;
      albedo[i * 4 + 2] = s.b[i] * 255;
      albedo[i * 4 + 3] = s.alpha ? s.alpha[i] * 255 : 255;
      orm[i * 4] = s.ao[i] * 255;
      orm[i * 4 + 1] = Math.max(0.04, s.rough[i]) * 255;
      orm[i * 4 + 2] = s.metal[i] * 255;
      orm[i * 4 + 3] = 255;
    }
    const normal = heightToNormal(s.height, N, N, heightStrength);
    const mk = (data: Uint8Array, srgb: boolean) => {
      const t = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.magFilter = THREE.LinearFilter;
      t.minFilter = THREE.LinearMipmapLinearFilter;
      t.generateMipmaps = true;
      t.anisotropy = this.anisotropy;
      t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      t.needsUpdate = true;
      return t;
    };
    return { map: mk(albedo, true), normalMap: mk(normal, false), orm: mk(orm, false), hasAlpha: !!s.alpha };
  }

  /** Architectural material (vertex colours carry baked AO). */
  arch(id: string): THREE.Material {
    return this.get(id, true);
  }

  /** Material by registry id. `vc` enables vertex colours. */
  get(id: string, vc = false): THREE.Material {
    const key = id + (vc ? '|vc' : '');
    const hit = this.matCache.get(key);
    if (hit) return hit;
    const def = MAT_DEFS[id];
    if (!def) throw new Error('unknown material ' + id);
    const tex = this.textures(def.recipe, def.params, this.texSize(), def.seed ?? 1, def.heightStrength ?? 2);
    const opts: THREE.MeshStandardMaterialParameters = {
      map: tex.map,
      normalMap: tex.normalMap,
      roughnessMap: tex.orm,
      metalnessMap: tex.orm,
      aoMap: tex.orm,
      aoMapIntensity: 1,
      roughness: 1,
      metalness: 1,
      vertexColors: vc,
      normalScale: new THREE.Vector2(def.normalScale ?? 1, def.normalScale ?? 1),
      side: def.side ?? THREE.FrontSide,
      envMapIntensity: def.envIntensity ?? 0.6,
    };
    let m: THREE.MeshStandardMaterial;
    if (def.physical) {
      m = new THREE.MeshPhysicalMaterial({ ...opts, metalness: 0, transparent: true, opacity: def.opacity ?? 0.3, depthWrite: false, clearcoat: 0.6 });
    } else m = new THREE.MeshStandardMaterial(opts);
    if (tex.hasAlpha) {
      m.alphaTest = 0.5;
      m.side = THREE.DoubleSide;
    }
    if (def.transparent && !def.physical) {
      m.transparent = true;
      m.opacity = def.opacity ?? 0.5;
    }
    m.name = id;
    m.userData.tile = def.tile;
    this.patch(m, def.macro ?? 0.35);
    this.matCache.set(key, m);
    return m;
  }

  /** Tile size (metres) of a registry material. */
  tileOf(id: string): number {
    return MAT_DEFS[id]?.tile ?? 1;
  }

  // ---- ad-hoc prop materials ---------------------------------------------

  private propMat(recipe: string, color: string, opts: { wear?: number; rough?: number; metal?: number; emissive?: string; emissiveIntensity?: number; vc?: boolean } = {}): THREE.MeshStandardMaterial {
    const key = `prop|${recipe}|${color}|${JSON.stringify(opts)}`;
    const hit = this.matCache.get(key);
    if (hit) return hit as THREE.MeshStandardMaterial;
    if (!PROP_RECIPES.has(recipe)) throw new Error('not a prop recipe ' + recipe);
    const tex = this.textures(recipe, { color, wear: opts.wear ?? 0.35 }, this.texSize('prop'), 3, 1.5);
    const m = new THREE.MeshStandardMaterial({
      map: tex.map,
      normalMap: tex.normalMap,
      roughnessMap: tex.orm,
      metalnessMap: tex.orm,
      roughness: opts.rough ?? 1,
      metalness: opts.metal ?? 1,
      vertexColors: !!opts.vc,
    });
    if (opts.emissive) {
      m.emissive = new THREE.Color(opts.emissive);
      m.emissiveIntensity = opts.emissiveIntensity ?? 1;
    }
    m.name = key;
    m.userData.tile = 0.5;
    this.patch(m, 0.25);
    this.matCache.set(key, m);
    return m;
  }

  plastic(color: string, wear = 0.3): THREE.MeshStandardMaterial {
    return this.propMat('plastic', color, { wear });
  }
  painted(color: string, wear = 0.45): THREE.MeshStandardMaterial {
    return this.propMat('paintedMetal', color, { wear });
  }
  flat(color: string, rough = 1, metal = 1): THREE.MeshStandardMaterial {
    return this.propMat('flat', color, { rough, metal });
  }
  cloth(color: string, wear = 0.4): THREE.MeshStandardMaterial {
    return this.propMat('fabric', color, { wear });
  }
  rubber(color = '#1c1c1e'): THREE.MeshStandardMaterial {
    return this.propMat('rubber', color, {});
  }
  woodProp(color: string, wear = 0.35): THREE.MeshStandardMaterial {
    return this.propMat('wood', color, { wear });
  }
  steel(color = '#a7a9ab', wear = 0.3): THREE.MeshStandardMaterial {
    return this.propMat('brushedMetal', color, { wear });
  }

  /** Unlit-looking emissive material for lamps, screens, LEDs. */
  emissive(color: string, intensity = 2, key = ''): THREE.MeshStandardMaterial {
    const k = `emis|${color}|${intensity}|${key}`;
    const hit = this.matCache.get(k);
    if (hit) return hit as THREE.MeshStandardMaterial;
    const m = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: new THREE.Color(color), emissiveIntensity: intensity, roughness: 0.4 });
    m.name = k;
    this.matCache.set(k, m);
    return m;
  }

  /** Wraps a canvas as a texture-mapped material (posters, screens, signs). */
  canvasMaterial(canvas: HTMLCanvasElement, opts: { emissive?: number; transparent?: boolean; rough?: number; alphaTest?: number } = {}): THREE.MeshStandardMaterial {
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = this.anisotropy;
    const m = new THREE.MeshStandardMaterial({
      map: t,
      roughness: opts.rough ?? 0.8,
      metalness: 0,
      transparent: !!opts.transparent,
      alphaTest: opts.alphaTest ?? 0,
    });
    if (opts.emissive) {
      m.emissive = new THREE.Color(0xffffff);
      m.emissiveMap = t;
      m.emissiveIntensity = opts.emissive;
    }
    if (opts.transparent) {
      m.depthWrite = false;
      m.polygonOffset = true;
      m.polygonOffsetFactor = -2;
    }
    return m;
  }

  /**
   * Injects world-space macro variation (breaks visible tiling) and a global
   * "wrongness" hook used by horror effects.
   */
  patch(m: THREE.Material, macro: number): void {
    const shared = this.shared;
    m.userData.macro = macro;
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uMacro = shared.uMacro;
      shader.uniforms.uMacroStrength = { value: macro };
      shader.uniforms.uWrong = shared.uWrong;
      shader.uniforms.uTime = shared.uTime;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nvarying vec3 vWNrm;')
        .replace(
          '#include <worldpos_vertex>',
          '#include <worldpos_vertex>\n vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\n vWNrm = normalize(mat3(modelMatrix) * objectNormal);',
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
varying vec3 vWPos; varying vec3 vWNrm;
uniform sampler2D uMacro; uniform float uMacroStrength; uniform float uWrong; uniform float uTime;
float macroSample(){
  vec3 an = abs(vWNrm) + 1e-4; an /= (an.x+an.y+an.z);
  float a = texture2D(uMacro, vWPos.zy*0.061).r;
  float b = texture2D(uMacro, vWPos.xz*0.057).r;
  float c = texture2D(uMacro, vWPos.xy*0.063).r;
  return a*an.x + b*an.y + c*an.z;
}`,
        )
        .replace(
          '#include <map_fragment>',
          `#include <map_fragment>
  float mcr = macroSample();
  diffuseColor.rgb *= mix(1.0, 0.84 + mcr*0.32, uMacroStrength);`,
        )
        .replace(
          '#include <roughnessmap_fragment>',
          `#include <roughnessmap_fragment>
  roughnessFactor = clamp(roughnessFactor + (mcr-0.5)*0.22*uMacroStrength, 0.04, 1.0);`,
        );
    };
    m.customProgramCacheKey = () => 'vtpatch';
  }

  /** Generates all textures used by a list of material ids, yielding between each. */
  async prepare(ids: string[], onProgress?: (p: number) => void): Promise<void> {
    const todo = ids.filter((id) => MAT_DEFS[id] && !this.matCache.has(id) && !this.matCache.has(id + '|vc'));
    for (let i = 0; i < todo.length; i++) {
      this.get(todo[i]);
      onProgress?.((i + 1) / todo.length);
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  /** Drops every generated texture (used when texture quality changes). */
  disposeAll(): void {
    for (const t of this.texCache.values()) {
      t.map.dispose();
      t.normalMap.dispose();
      t.orm.dispose();
    }
    this.texCache.clear();
    for (const m of this.matCache.values()) m.dispose();
    this.matCache.clear();
  }
}

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 100000;
}
