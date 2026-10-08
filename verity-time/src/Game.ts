import * as THREE from 'three';
import { EventBus, type GameEvents } from './core/EventBus';
import { Coroutines, type CoGen } from './core/Coroutines';
import { Input } from './core/Input';
import { applyPreset, loadSettings, saveSettings, type Settings } from './core/Settings';
import { GameState, type GameStateData } from './core/GameState';
import { SaveSystem, type SlotId } from './core/SaveSystem';
import { Renderer } from './render/Renderer';
import { LightManager } from './render/LightManager';
import { Materials } from './assets/Materials';
import { CollisionWorld } from './physics/CollisionWorld';
import { Player } from './player/Player';
import { Flashlight } from './player/Flashlight';
import { InteractionSystem } from './interaction/Interaction';
import { AudioEngine, type Sound } from './audio/AudioEngine';
import { Music } from './audio/Music';
import { synthLine, VOICES, speechDuration } from './audio/Voice';
import { UI } from './ui/UI';
import { LevelBuilder } from './world/LevelBuilder';
import type { Zone } from './world/Zone';
import { ZONES } from './zones';
import { SPEAKERS } from './narrative/types';
import { DOCS, LOGS, ITEMS, SECRETS } from './narrative/registry';
import { NavGrid } from './ai/NavGrid';
import { buildEnvMap, ENV_PRESETS } from './render/EnvMap';
import { Verity } from './ai/Verity';
import { tallOptions } from './models/verity/TallForm';
import { Director } from './ai/Director';
import { Carry } from './player/Carry';
import { MainMenu } from './ui/screens/MainMenu';
import { PauseMenu } from './ui/screens/PauseMenu';
import { LoadingScreen } from './ui/screens/Loading';
import { ReaderScreen } from './ui/screens/Reader';
import { JournalScreen } from './ui/screens/Journal';
import { InventoryScreen } from './ui/screens/Inventory';
import { CaughtScreen } from './ui/screens/Caught';
import { Debug } from './debug/Debug';
import { formatTime } from './ui/dom';

export type Mode = 'boot' | 'menu' | 'loading' | 'play' | 'cutscene' | 'dead' | 'ending';

export interface DialogueOpts {
  pos?: THREE.Vector3;
  degrade?: number;
  /** Skip voice synthesis (subtitle only). */
  silent?: boolean;
  duration?: number;
}

/**
 * The game: owns every system, the main loop and high-level flow
 * (menus, zone streaming, checkpoints, death, endings).
 */
export class Game {
  readonly bus = new EventBus<GameEvents>();
  readonly co = new Coroutines();
  settings: Settings;
  readonly input: Input;
  readonly state: GameState;
  readonly saves = new SaveSystem();
  readonly renderer: Renderer;
  readonly mats = new Materials();
  readonly lights: LightManager;
  readonly world = new CollisionWorld();
  readonly player: Player;
  readonly flashlight: Flashlight;
  readonly interact: InteractionSystem;
  readonly audio: AudioEngine;
  readonly music: Music;
  readonly ui: UI;
  readonly carry: Carry;
  readonly verity: Verity;
  readonly director: Director;
  debug: Debug | null = null;
  zone: Zone | null = null;
  mode: Mode = 'boot';
  time = 0;
  timeScale = 1;
  fear = 0;
  /** Set by automated QA runs: no auto-pause on pointer-lock loss. */
  qa = false;
  /** Cutscene / scripted control flag (disables saving and the pause menu UI). */
  scripted = 0;
  canSave = true;
  private last = performance.now();
  private fpsAcc = 0;
  private fpsFrames = 0;
  private fps = 60;
  private hemi: THREE.HemisphereLight;
  private ambient: THREE.AmbientLight;
  private ambienceSounds: Sound[] = [];
  private emitterSounds: Array<{ def: Zone['emitters'][number] }> = [];
  private emitterTimer = 0;
  private heartbeat: Sound | null = null;
  private voiceQueueEnd = 0;
  private currentLog: { stop: () => void; id: string } | null = null;
  readonly params = new URLSearchParams(location.search);

  constructor(canvas: HTMLCanvasElement, uiRoot: HTMLElement) {
    this.settings = loadSettings();
    this.input = new Input(canvas, this.settings.bindings);
    this.state = new GameState(this.bus);
    this.renderer = new Renderer(canvas);
    this.mats.anisotropy = Math.min(8, this.renderer.maxAnisotropy);
    this.mats.quality = this.settings.textures;
    this.lights = new LightManager(this.renderer.scene);
    this.player = new Player(this.world, this.input, this.renderer.camera, this.settings);
    this.flashlight = new Flashlight(this.renderer.scene);
    this.interact = new InteractionSystem(this.world);
    this.audio = new AudioEngine();
    this.audio.world = this.world;
    this.music = new Music(this.audio);
    this.ui = new UI(uiRoot);
    this.ui.playUi = (n) => this.audio.ui(n);
    this.carry = new Carry(this);
    this.verity = new Verity(this);
    this.director = new Director(this);
    this.hemi = new THREE.HemisphereLight(0x6a7080, 0x201a14, 0.25);
    this.ambient = new THREE.AmbientLight(0x404850, 0.2);
    this.renderer.scene.add(this.hemi, this.ambient);
    this.renderer.scene.fog = new THREE.FogExp2(0x050505, 0.04);
    this.applySettings();

    this.player.onFootstep = (surface, intensity) => {
      this.audio.play('step_' + surface, {
        volume: 0.22 + intensity * 0.35,
        rateJitter: 0.06,
        pos: this.player.pos.clone().setY(this.player.pos.y + 0.05),
        noOcclusion: true,
        reverb: 0.35,
      });
    };
    this.player.onLand = (sp) => {
      this.audio.play('land', { volume: Math.min(1, sp / 8), pos: this.player.pos, noOcclusion: true });
      this.player.addTrauma(Math.min(0.4, sp / 25));
    };
    this.player.onNoise = (r) => this.bus.emit('noise', { x: this.player.pos.x, y: this.player.pos.y, z: this.player.pos.z, radius: r, source: 'player' });
    this.player.surfaceAt = (c) => this.zone?.surfaceOf(c?.tag) ?? 'concrete';

    this.input.onLockChange = (locked) => {
      if (!locked && this.mode === 'play' && !this.ui.open_ && !this.ui.pausing && !this.qa) this.openPause();
      if (locked) this.ui.showResume(false);
    };
    window.addEventListener('resize', () => this.renderer.resize());
    // resume audio on first gesture
    const resume = () => this.audio.resume();
    window.addEventListener('pointerdown', resume);
    window.addEventListener('keydown', resume);

    this.bus.on('item:add', ({ id }) => {
      const it = ITEMS[id];
      if (it) this.ui.hud.notify(it.name, 'item', 'Получено');
    });
    this.bus.on('secret', ({ id }) => {
      const s = SECRETS[id];
      this.ui.hud.notify(`${s?.name ?? id}  (${this.state.data.secrets.length}/${Object.keys(SECRETS).length})`, 'secret', 'Секрет найден');
      this.music.sting('soft');
    });
    this.bus.on('objective', ({ text }) => {
      this.ui.hud.setObjective(text);
      if (text) this.ui.hud.notify(text, 'objective', 'Новая цель');
    });
    this.bus.on('fear', ({ amount }) => this.addFear(amount));

    // debug tools, test URLs and the console handle exist only in debug builds
    if (__DEBUG__) {
      this.debug = new Debug(this);
      (window as any).__VT = this;
    }
  }

  // ===================================================================== flow

  async boot(): Promise<void> {
    await document.fonts.ready;
    const zoneParam = __DEBUG__ ? this.params.get('zone') : null;
    if (zoneParam && ZONES[zoneParam]) {
      // direct start for testing / QA
      this.state.reset();
      this.state.data.zone = zoneParam;
      for (const f of (this.params.get('flags') ?? '').split(',').filter(Boolean)) {
        const [k, v] = f.split('=');
        this.state.set(k, v === undefined ? true : isNaN(Number(v)) ? v : Number(v));
      }
      for (const it of (this.params.get('items') ?? '').split(',').filter(Boolean)) this.state.addItem(it);
      await this.loadZone(zoneParam, this.params.get('spawn') ?? 'start');
      (window as any).__VT_READY = true;
      return;
    }
    this.toMenu();
    (window as any).__VT_READY = true;
    this.loop();
  }

  private loopStarted = false;
  loop = (): void => {
    if (!this.loopStarted) {
      this.loopStarted = true;
      this.last = performance.now();
    }
    requestAnimationFrame(this.loop);
    const now = performance.now();
    if (this.qa) {
      // automated runs drive the simulation themselves through advance()
      this.last = now;
      return;
    }
    let dt = (now - this.last) / 1000;
    const cap = !this.settings.vsync && this.settings.fpsLimit > 0 ? 1 / this.settings.fpsLimit : 0;
    if (cap && dt < cap * 0.95) return;
    this.last = now;
    dt = Math.min(dt, 0.1);
    this.frame(dt);
  };

  /** QA helper: simulate `sec` seconds of game time quickly (no rendering). */
  advance(sec: number, step = 1 / 30): void {
    const n = Math.ceil(sec / step);
    for (let i = 0; i < n; i++) this.frame(step, false);
    if (!this.qa) this.renderer.render(0);
  }

  /** Advances the simulation one frame (also used by the QA harness). */
  frame(dt: number, render = true): void {
    this.fpsAcc += dt;
    this.fpsFrames++;
    if (this.fpsAcc >= 0.5) {
      this.fps = this.fpsFrames / this.fpsAcc;
      this.fpsAcc = 0;
      this.fpsFrames = 0;
    }
    this.handleGlobalKeys();
    const playing = (this.mode === 'play' || this.mode === 'cutscene') && !this.ui.pausing;
    const sdt = dt * this.timeScale;
    if (playing && !this.qa) this.autoTune(dt);
    if (playing) {
      this.time += sdt;
      this.state.data.playTime += dt;
      this.mats.shared.uTime.value = this.time;
      this.player.update(sdt);
      this.carry.update(sdt);
      const blocked = this.mode !== 'play' || this.ui.open_ || !!this.player.hidden && false;
      this.interact.braceletOn = this.state.is('bracelet.on');
      this.interact.update(this.renderer.camera, sdt, this.input.pressed('interact'), this.input.isDown('interact'), blocked || this.carry.holding !== null);
      if (this.zone) {
        this.zone.updateTriggers(this.player.pos, sdt);
        for (const u of this.zone.updaters) u(sdt);
      }
      this.verity.update(sdt);
      this.director.update(sdt);
      this.co.update(sdt);
      this.updateFear(sdt);
      this.updateEmitters(sdt);
    }
    if (this.mode === 'menu' && this.zone) {
      this.time += dt;
      this.mats.shared.uTime.value = this.time;
      for (const u of this.zone.updaters) u(dt);
      this.lights.update(dt, this.renderer.camera);
      this.co.update(dt);
    }
    // visuals keep updating while paused (lights flicker etc. frozen otherwise)
    const cam = this.renderer.camera;
    const vis = this.zone?.updateCells(cam.position) ?? null;
    this.lights.visibleCells = vis;
    if (playing) this.lights.update(sdt, cam);
    this.flashlight.update(dt, cam, this.time);
    this.audio.update(dt, cam);
    this.music.update();
    this.updateHud(dt);
    this.ui.update(dt);
    this.debug?.update(dt);
    if (render) this.renderer.render(dt);
    this.input.endFrame();
  }

  private tune = { t: 0, frames: 0, acc: 0 };
  /** First run only: if the machine can't hold ~40 fps, step the preset down once or twice. */
  private autoTune(dt: number): void {
    const s = this.settings;
    if (s.autoTuned || s.preset === 'custom') return;
    const tu = this.tune;
    tu.t += dt;
    if (tu.t < 4) return; // let shaders and textures settle
    tu.frames++;
    tu.acc += dt;
    if (tu.acc < 8) return;
    const fps = tu.frames / tu.acc;
    tu.frames = 0;
    tu.acc = 0;
    const order: Array<'ultra' | 'high' | 'medium' | 'low'> = ['ultra', 'high', 'medium', 'low'];
    const i = order.indexOf(s.preset as 'ultra');
    if (fps < 40 && i >= 0 && i < order.length - 1) {
      applyPreset(s, order[i + 1]);
      this.applySettings();
      this.ui.hud.notify(`Качество графики снижено до «${{ ultra: 'ультра', high: 'высокое', medium: 'среднее', low: 'низкое' }[order[i + 1]]}» (${Math.round(fps)} FPS). Можно изменить в настройках.`, 'info');
      if (fps >= 30 || order[i + 1] === 'low') s.autoTuned = true;
    } else s.autoTuned = true;
    saveSettings(s);
  }

  private handleGlobalKeys(): void {
    const inp = this.input;
    if (this.mode === 'play' && !this.ui.open_) {
      if (inp.pressed('pause')) this.openPause();
      else if (inp.pressed('inventory')) this.openInventory();
      else if (inp.pressed('journal')) this.openJournal();
      else if (inp.pressed('flashlight')) {
        const on = this.flashlight.toggle();
        this.audio.play('switch', { volume: 0.5 });
        this.state.set('flashlight', on);
      } else if (inp.pressed('bracelet') && this.state.is('bracelet.owned')) {
        const on = !this.state.is('bracelet.on');
        this.state.set('bracelet.on', on);
        this.audio.play(on ? 'keypad_ok' : 'switch', { volume: 0.4 });
        this.ui.hud.notify(on ? 'Браслет «Друг» включён' : 'Браслет «Друг» выключен', 'info');
      } else if (inp.pressed('throw')) this.carry.throwHeld();
    } else if (this.ui.open_ && (inp.rawPressed('Escape') || ((inp.pressed('inventory') || inp.pressed('journal')) && this.ui.top?.id !== 'pause'))) {
      if (this.ui.top?.id === 'mainmenu') return;
      this.ui.escape();
      this.afterUiClose();
    }
  }

  afterUiClose(): void {
    if (this.ui.open_ || (this.mode !== 'play' && this.mode !== 'cutscene')) return;
    this.input.enabled = true;
    this.input.resetAll();
    this.input.requestLock();
    setTimeout(() => {
      if (!this.input.locked && !this.ui.open_ && (this.mode === 'play' || this.mode === 'cutscene')) {
        this.ui.showResume(true, () => {
          this.input.requestLock();
          this.ui.showResume(false);
        });
      }
    }, 250);
  }

  toMenu(): void {
    this.mode = 'menu';
    this.co.stop();
    this.verity.reset();
    this.director.reset();
    this.unloadZone();
    this.ui.closeAll();
    this.ui.hud.setVisible(false);
    this.input.exitLock();
    this.input.enabled = false;
    this.renderer.fx.fade = 0;
    this.music.play('lullaby', { fade: 3, volume: 0.6 });
    this.ui.open(new MainMenu(this));
    this.setupMenuScene();
  }

  /** A slowly drifting view of the welcome hall behind the main menu. */
  private async setupMenuScene(): Promise<void> {
    if (this.params.has('nomenuscene')) return;
    try {
      const def = ZONES.menu;
      if (!def) return;
      await this.mats.prepare(def.materials);
      if (this.mode !== 'menu') return;
      const b = new LevelBuilder({ mats: this.mats, world: this.world, lights: this.lights }, 'menu', 'menu');
      await def.build(this, b);
      if (this.mode !== 'menu') return;
      this.zone = b.finish();
      this.renderer.scene.add(this.zone.root);
      this.applyEnv(this.zone);
      this.flashlight.on = false;
      this.player.lookLocked = true;
      this.player.movementLocked = true;
      // fade on the wall clock: on a slow first frame a per-frame fade would
      // leave the menu black for many seconds
      this.renderer.fx.fade = 1;
      void this.fadeIn(1.5);
      this.mode = 'menu';
    } catch (e) {
      console.warn('menu scene failed', e);
    }
  }

  async newGame(): Promise<void> {
    this.audio.resume();
    this.ui.closeAll();
    this.state.reset();
    this.state.set('flashlight', true);
    this.music.stop(1.5);
    await this.loadZone('outside', 'start');
  }

  async continueGame(): Promise<void> {
    const f = this.saves.latest();
    if (!f) return this.newGame();
    await this.restore(f.state);
  }

  async loadSlot(slot: SlotId): Promise<void> {
    const f = this.saves.read(slot);
    if (!f) return;
    await this.restore(f.state);
  }

  async restore(data: GameStateData): Promise<void> {
    this.audio.resume();
    this.ui.closeAll();
    this.state.load(data);
    const p = this.state.data.player;
    await this.loadZone(this.state.data.zone, this.state.data.checkpoint, p ?? undefined);
  }

  saveTo(slot: SlotId): boolean {
    if (!this.zone || !this.canSave) return false;
    this.snapshotPlayer();
    const ok = this.saves.write(slot, this.state.snapshot(), {
      zoneName: this.zone.name,
      chapter: this.state.data.chapter,
      playTime: this.state.data.playTime,
      thumb: this.renderer.snapshot(),
    });
    if (ok) this.ui.hud.notify('Игра сохранена', 'save');
    return ok;
  }

  snapshotPlayer(): void {
    const p = this.player;
    this.state.data.player = { x: p.pos.x, y: p.pos.y, z: p.pos.z, yaw: p.yaw, pitch: p.pitch, crouched: p.crouched, flashlight: this.flashlight.on };
  }

  /** Marks a checkpoint and autosaves. */
  checkpoint(id: string, opts: { silent?: boolean } = {}): void {
    this.state.data.checkpoint = id;
    this.bus.emit('checkpoint', { id });
    if (!this.zone) return;
    this.snapshotPlayer();
    this.saves.write('auto', this.state.snapshot(), {
      zoneName: this.zone.name,
      chapter: this.state.data.chapter,
      playTime: this.state.data.playTime,
      thumb: this.renderer.snapshot(),
    });
    if (!opts.silent) this.ui.hud.notify('Автосохранение', 'save');
  }

  // ===================================================================== zones

  private unloadZone(): void {
    this.co.stop('zone');
    this.carry.drop(true);
    this.stopLog();
    if (this.zone) {
      this.zone.dispose();
      this.zone = null;
    }
    this.interact.clear();
    this.lights.clear();
    this.world.clear();
    this.audio.stopWorld();
    for (const s of this.ambienceSounds) s.stop(1);
    this.ambienceSounds = [];
    this.emitterSounds = [];
    this.verity.reset();
  }

  async loadZone(id: string, spawn = 'start', at?: { x: number; y: number; z: number; yaw: number; pitch?: number; crouched?: boolean; flashlight?: boolean }): Promise<void> {
    const def = ZONES[id];
    if (!def) throw new Error('unknown zone ' + id);
    this.mode = 'loading';
    this.input.enabled = false;
    this.ui.hud.setVisible(false);
    this.ui.hud.clearSubtitles();
    const loading = new LoadingScreen(this, def.name);
    this.ui.closeAll();
    this.ui.open(loading);
    await new Promise((r) => setTimeout(r, 30));
    this.co.stop();
    this.director.reset();
    this.unloadZone();
    this.state.data.zone = id;
    if (def.chapter) this.state.data.chapter = def.chapter;
    await this.mats.prepare(def.materials, (p) => loading.progress(p * 0.7));
    const b = new LevelBuilder({ mats: this.mats, world: this.world, lights: this.lights }, id, def.name);
    await def.build(this, b);
    const zone = b.finish();
    this.zone = zone;
    this.renderer.scene.add(zone.root);
    loading.progress(0.8);
    await new Promise((r) => setTimeout(r, 10));
    if (def.nav) {
      const n = def.nav;
      zone.nav = new NavGrid(this.world, n.minX, n.minZ, n.maxX, n.maxZ, 0.4, n.probeY ?? 2.2, 0.3);
    }
    this.applyEnv(zone);
    this.startEmitters();
    loading.progress(0.95);
    // place the player
    if (at) {
      this.player.teleport(at.x, at.y, at.z, at.yaw, at.pitch ?? 0);
      this.player.crouched = !!at.crouched;
      this.flashlight.on = at.flashlight ?? true;
    } else {
      const sp = zone.spawns[spawn] ?? zone.spawns.start ?? { pos: new THREE.Vector3(), yaw: 0 };
      this.player.teleport(sp.pos.x, sp.pos.y, sp.pos.z, sp.yaw);
      this.flashlight.on = this.state.get('flashlight') !== false;
    }
    this.player.lookLocked = false;
    this.player.movementLocked = false;
    this.player.speedMul = 1;
    this.renderer.camera.fov = this.settings.fov;
    this.renderer.camera.updateProjectionMatrix();
    zone.forceAllVisible();
    this.renderer.precompile();
    this.renderer.render(0);
    loading.progress(1);
    await new Promise((r) => setTimeout(r, 60));
    this.ui.close(loading);
    this.mode = 'play';
    this.ui.hud.setVisible(true);
    this.ui.hud.setObjective(this.state.data.objective);
    this.renderer.fx.fade = 1;
    this.fadeIn(1.2);
    this.input.enabled = true;
    this.input.resetAll();
    this.input.requestLock();
    this.bus.emit('zone:enter', { id });
    def.onEnter?.(this, spawn, !!at);
    if (!this.loopStarted) this.loop();
    if (!at) this.checkpoint(this.state.data.checkpoint === 'start' && id === 'outside' ? 'start' : id + ':' + spawn, { silent: true });
    if (!this.input.locked) setTimeout(() => this.afterUiClose(), 300);
  }

  private envCache = new Map<string, THREE.Texture>();

  applyEnv(z: Zone): void {
    const e = z.env;
    let env = this.envCache.get(e.envMap);
    if (!env) {
      env = buildEnvMap(this.renderer.gl, ENV_PRESETS[e.envMap] ?? ENV_PRESETS.hall);
      this.envCache.set(e.envMap, env);
    }
    this.renderer.scene.environment = env;
    this.renderer.scene.environmentIntensity = e.envIntensity;
    const fog = this.renderer.scene.fog as THREE.FogExp2;
    fog.color.copy(e.fogColor);
    fog.density = e.fogDensity;
    this.renderer.scene.background = e.fogColor.clone();
    this.ambient.color.copy(e.ambient);
    this.ambient.intensity = e.ambientIntensity;
    this.hemi.color.copy(e.hemiSky);
    this.hemi.groundColor.copy(e.hemiGround);
    this.hemi.intensity = e.hemiIntensity;
    this.audio.setReverb(e.reverb);
    for (const s of this.ambienceSounds) s.stop(1.5);
    this.ambienceSounds = e.ambience.map((n, i) => this.audio.play(n, { loop: true, bus: 'ambience', volume: i === 0 ? 0.35 : 0.22, fadeIn: 2, reverb: 0 })!).filter(Boolean);
  }

  private startEmitters(): void {
    if (!this.zone) return;
    this.emitterSounds = this.zone.emitters.map((def) => ({ def }));
    this.emitterTimer = 0;
    this.updateEmitters(1);
  }

  private updateEmitters(dt: number): void {
    this.emitterTimer -= dt;
    if (this.emitterTimer > 0) return;
    this.emitterTimer = 0.5;
    for (const { def } of this.emitterSounds) {
      const want = !def.when || def.when();
      if (want && !def.sound) def.sound = this.audio.play(def.name, { pos: def.pos, loop: true, volume: def.volume, ref: def.ref ?? 1.5, rate: def.rate, fadeIn: 0.6 });
      else if (!want && def.sound) {
        def.sound.stop(0.5);
        def.sound = null;
      }
    }
  }

  fadeOut(sec = 1, color = 0x000000): Promise<void> {
    this.renderer.fx.fadeColor.set(color);
    return this.tweenFade(1, sec);
  }

  fadeIn(sec = 1): Promise<void> {
    return this.tweenFade(0, sec);
  }

  private fadeToken = 0;

  private tweenFade(target: number, sec: number): Promise<void> {
    // a newer fade supersedes this one (e.g. "New game" during the menu fade-in)
    const token = ++this.fadeToken;
    return new Promise((res) => {
      const fx = this.renderer.fx;
      const from = fx.fade;
      const t0 = performance.now();
      const step = () => {
        if (token !== this.fadeToken) return res();
        const k = Math.min(1, (performance.now() - t0) / (sec * 1000));
        fx.fade = from + (target - from) * k;
        if (k < 1) requestAnimationFrame(step);
        else res();
      };
      step();
    });
  }

  // ================================================================= dialogue

  /**
   * Speaks a line with subtitles + synthesized voice. Lines queue so they
   * never overlap. Returns the time (s) until this line finishes.
   */
  say(speaker: string, text: string, opts: DialogueOpts = {}): number {
    const sp = SPEAKERS[speaker] ?? { name: speaker, color: '#fff', voice: 'male' };
    const prof = { ...(VOICES[sp.voice] ?? VOICES.male) };
    if (speaker === 'verity') prof.degrade = opts.degrade ?? this.verity.stage;
    // queue on the game clock so pauses and fast-forward keep lines in order
    const now = this.time;
    const startIn = Math.max(0, this.voiceQueueEnd - now);
    let dur = opts.duration ?? speechDuration(text, prof);
    if (!opts.silent) {
      const data = synthLine(text, prof, this.audio.ctx.sampleRate, hashStr(text));
      dur = Math.max(dur, data.length / this.audio.ctx.sampleRate);
      const buf = this.audio.ctx.createBuffer(1, data.length, this.audio.ctx.sampleRate);
      buf.copyToChannel(data as Float32Array<ArrayBuffer>, 0);
      setTimeout(() => {
        this.audio.playBuffer(buf, { bus: 'voice', pos: opts.pos, volume: 0.9, ref: 2.5, reverb: opts.pos ? 0.3 : 0.1, noOcclusion: true });
        this.audio.duck(0.4, dur);
      }, startIn * 1000);
    }
    const subDur = Math.max(2.2, dur + 0.8);
    setTimeout(() => this.ui.hud.subtitle(text, subDur, sp.name, sp.color), startIn * 1000);
    this.voiceQueueEnd = now + startIn + dur + 0.25;
    return startIn + dur + 0.25;
  }

  /** Coroutine helper: speak and wait. */
  *talk(speaker: string, text: string, opts: DialogueOpts = {}): CoGen {
    yield this.say(speaker, text, opts);
  }

  playLog(id: string): void {
    const log = LOGS[id];
    if (!log) return;
    this.stopLog();
    const first = this.state.hearLog(id);
    if (first) this.ui.hud.notify(log.title, 'item', 'Аудиозапись');
    this.audio.play('tape_click', { volume: 0.6 });
    const hiss = this.audio.play('tape_hiss_loop', { loop: true, volume: 0.25, bus: 'voice', fadeIn: 0.3 });
    const sp = SPEAKERS[log.speaker];
    const handle = this.co.start(
      (function* (g: Game): CoGen {
        yield 0.6;
        for (const line of log.lines) {
          let who = log.speaker;
          let text = line;
          const m = /^@(\w+):\s*(.*)$/.exec(line);
          if (m) {
            who = m[1];
            text = m[2];
          }
          const s2 = SPEAKERS[who] ?? sp;
          const prof = { ...(VOICES[who === log.speaker ? log.voice : s2.voice] ?? VOICES.male), tape: true };
          if (who === 'verity') prof.degrade = 0;
          const data = synthLine(text, prof, g.audio.ctx.sampleRate, hashStr(text));
          const buf = g.audio.ctx.createBuffer(1, data.length, g.audio.ctx.sampleRate);
          buf.copyToChannel(data as Float32Array<ArrayBuffer>, 0);
          g.audio.playBuffer(buf, { bus: 'voice', volume: 0.75, reverb: 0.05 });
          const dur = data.length / g.audio.ctx.sampleRate;
          g.ui.hud.subtitle(text, dur + 0.6, s2.name, s2.color);
          yield dur + 0.35;
        }
        yield 0.4;
        g.audio.play('tape_click', { volume: 0.5 });
        hiss?.stop(0.3);
        g.currentLog = null;
      })(this),
      'log',
    );
    this.currentLog = {
      id,
      stop: () => {
        handle.cancel();
        hiss?.stop(0.2);
      },
    };
  }

  stopLog(): void {
    this.currentLog?.stop();
    this.currentLog = null;
  }

  // ============================================================ collectables

  readDoc(id: string): void {
    const d = DOCS[id];
    if (!d) return;
    this.audio.play('paper', { volume: 0.6 });
    this.state.readDoc(id);
    this.openScreen(new ReaderScreen(this, d));
  }

  giveItem(id: string, silent = false): void {
    if (this.state.has(id)) return;
    if (!silent) this.audio.play('pickup', { volume: 0.7 });
    this.state.addItem(id);
  }

  secret(id: string): void {
    this.state.findSecret(id);
  }

  objective(text: string): void {
    this.state.setObjective(text);
  }

  chapter(act: string, title: string): void {
    this.state.data.chapter = `${act}. ${title}`;
    this.ui.hud.chapterCard(act, title);
  }

  notify(text: string, kind: 'item' | 'objective' | 'info' | 'secret' | 'save' = 'info'): void {
    this.ui.hud.notify(text, kind);
  }

  // =================================================================== fear

  addFear(a: number): void {
    this.fear = Math.min(1, Math.max(0, this.fear + a));
  }

  private updateFear(dt: number): void {
    const near = this.verity.threat; // 0..1 from proximity / chase
    const target = Math.max(near, 0);
    this.fear += (target - this.fear) * Math.min(1, dt * (target > this.fear ? 1.5 : 0.25));
    const fx = this.renderer.fx;
    fx.grain = 0.05 + this.fear * 0.08;
    fx.vignette = 0.42 + this.fear * 0.3 + (this.player.hidden ? 0.25 : 0);
    fx.aberration = 0.0005 + this.fear * 0.0025;
    fx.saturation = 1 - this.fear * 0.25;
    // heartbeat
    if (this.fear > 0.45 && !this.heartbeat) {
      this.heartbeat = this.audio.play('heartbeat_loop', { loop: true, volume: 0, bus: 'sfx', reverb: 0 });
    }
    if (this.heartbeat) {
      this.heartbeat.setVolume(Math.max(0, (this.fear - 0.4) * 1.2));
      this.heartbeat.setRate(0.9 + this.fear * 0.6);
      if (this.fear < 0.3) {
        this.heartbeat.stop(1);
        this.heartbeat = null;
      }
    }
  }

  // ================================================================ screens

  openScreen(s: import('./ui/UI').Screen): void {
    this.input.enabled = false;
    this.input.exitLock();
    this.ui.open(s);
  }

  openPause(): void {
    if (this.mode !== 'play' && this.mode !== 'cutscene') return;
    if (this.ui.top?.id === 'pause') return;
    this.openScreen(new PauseMenu(this));
  }

  openInventory(): void {
    this.openScreen(new InventoryScreen(this));
  }

  openJournal(): void {
    this.openScreen(new JournalScreen(this));
  }

  closeScreen(s?: import('./ui/UI').Screen): void {
    this.ui.close(s);
    this.afterUiClose();
  }

  // ============================================================ death / end

  caught(by: string, line?: string): void {
    if (this.mode === 'dead' || this.player.god) return;
    this.mode = 'dead';
    this.state.data.deaths++;
    this.bus.emit('player:caught', { by });
    this.co.stop();
    this.music.stop(0.2);
    this.audio.play('glitch', { volume: 0.9 });
    this.renderer.fx.glitch = 1;
    this.input.enabled = false;
    this.ui.hud.setVisible(false);
    setTimeout(() => {
      this.renderer.fx.glitch = 0;
      this.renderer.fx.fade = 1;
      this.input.exitLock();
      this.ui.open(new CaughtScreen(this, line ?? 'Не уходи.'));
    }, 900);
  }

  async retry(): Promise<void> {
    // deaths and play time belong to the run, not to the checkpoint
    const deaths = this.state.data.deaths;
    const playTime = this.state.data.playTime;
    const f = this.saves.read('auto');
    if (f) await this.restore(f.state);
    else await this.newGame();
    this.state.data.deaths = Math.max(this.state.data.deaths, deaths);
    this.state.data.playTime = Math.max(this.state.data.playTime, playTime);
  }

  quit(): void {
    saveSettings(this.settings);
    if (window.native) window.native.quit();
    else this.toMenu();
  }

  // =============================================================== settings

  applySettings(): void {
    const s = this.settings;
    this.input.bindings = s.bindings;
    this.player.setSettings(s);
    this.renderer.apply(s);
    this.flashlight.configure(s.shadows);
    const pts = s.effects === 'low' ? 4 : s.effects === 'medium' ? 6 : 8;
    this.lights.configure(pts, 2);
    this.audio.applySettings(s);
    this.ui.hud.subtitleSettings = { enabled: s.subtitles, size: s.subtitleSize, bg: s.subtitleBackground };
    // a lighter sculpt of Verity's last form on low settings
    tallOptions.quality = s.textures === 'low' ? 0.72 : s.textures === 'medium' ? 0.86 : 1;
    if (this.mats.quality !== s.textures) {
      this.mats.quality = s.textures;
      // takes effect on next zone load
    }
    if (window.native) {
      window.native.setDisplayMode(s.displayMode);
      if (s.resolution !== 'native') {
        const [w, h] = s.resolution.split('x').map(Number);
        window.native.setResolution(w, h);
      }
      window.native.setVSync(s.vsync);
    } else if (s.displayMode === 'fullscreen' && document.fullscreenElement == null) {
      // browsers need a gesture: handled by the settings screen button
    }
    saveSettings(s);
  }

  // ==================================================================== HUD

  private updateHud(dt: number): void {
    const hud = this.ui.hud;
    const f = this.interact.focused;
    if (this.mode === 'play' && f && !this.ui.open_) {
      const key = f.signal ? 'E' : 'E';
      hud.setPrompt(f.prompt(), { key, signal: f.signal, hold: f.hold ? this.interact.holdProgress : 0 });
    } else if (this.mode === 'play' && this.carry.holding && !this.ui.open_) {
      hud.setPrompt(this.carry.prompt(), { key: 'ПКМ' });
    } else hud.setPrompt(null);
    hud.setStamina(this.player.stamina, this.player.exhausted);
    hud.setBracelet(this.state.is('bracelet.owned'), this.state.is('bracelet.on'));
    hud.setFps(this.settings.showFps || !!this.debug?.showFps, this.fps, this.debug?.showFps ? `| ${this.renderer.gl.info.render.calls} dc | ${formatTime(this.state.data.playTime)}` : '');
    void dt;
  }
}

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h) + 1;
}
