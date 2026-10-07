import * as THREE from 'three';
import type { Game } from '../Game';
import { h } from '../ui/dom';
import { ZONES } from '../zones';
import { ITEMS } from '../narrative/registry';

/**
 * In-game debug tools (F1). Compiled out of release builds unless the page
 * is opened with ?debug. Teleport, god mode, noclip, puzzle/trigger reset,
 * FPS, collision & AI visualisation, zone reload, console commands.
 */
export class Debug {
  private el: HTMLElement;
  private visible = false;
  showFps = false;
  private colGroup = new THREE.Group();
  private navGroup = new THREE.Group();
  private aiLine: THREE.Line | null = null;
  private showCol = false;
  private showAI = false;
  private info: HTMLElement;

  constructor(private g: Game) {
    this.info = h('div');
    this.el = h('div', { class: 'debug', style: { display: 'none' } });
    g.ui.root.append(this.el);
    g.renderer.scene.add(this.colGroup, this.navGroup);
    window.addEventListener('keydown', (e) => {
      if (e.code === 'F1') {
        e.preventDefault();
        this.toggle();
      } else if (e.code === 'F3') {
        this.showFps = !this.showFps;
      } else if (e.code === 'F5' && g.mode === 'play') {
        e.preventDefault();
        g.checkpoint('debug-quick');
      }
    });
    this.render();
  }

  toggle(): void {
    this.visible = !this.visible;
    this.el.style.display = this.visible ? 'block' : 'none';
    if (this.visible) {
      this.g.input.exitLock();
      this.render();
    } else this.g.afterUiClose();
  }

  private btn(label: string, fn: () => void): HTMLElement {
    return h('button', { onclick: () => { fn(); this.render(); } }, label);
  }

  render(): void {
    const g = this.g;
    this.el.innerHTML = '';
    const zoneButtons = h('div');
    for (const id of Object.keys(ZONES)) {
      if (id === 'menu') continue;
      const spawns = ['start'];
      zoneButtons.append(this.btn(id, () => g.loadZone(id, spawns[0])));
    }
    const spawnButtons = h('div');
    for (const id of Object.keys(g.zone?.spawns ?? {})) {
      spawnButtons.append(
        this.btn(id, () => {
          const s = g.zone!.spawns[id];
          g.player.teleport(s.pos.x, s.pos.y, s.pos.z, s.yaw);
        }),
      );
    }
    const cmd = h('input', { placeholder: 'команда: flag k=v | item id | solve id | stage n | verity chase|hunt|off | time 0.2 | log id | doc id', onkeydown: (e: KeyboardEvent) => {
      e.stopPropagation();
      if (e.code === 'Enter') {
        this.exec((e.target as HTMLInputElement).value);
        (e.target as HTMLInputElement).value = '';
      }
    } });
    this.el.append(
      h('div', { class: 'title' }, 'DEBUG (F1) · F3 FPS · F5 quicksave'),
      this.info,
      h('div', { class: 'title' }, 'Зоны'),
      zoneButtons,
      h('div', { class: 'title' }, 'Точки появления'),
      spawnButtons,
      h('div', { class: 'title' }, 'Игрок'),
      this.btn(`God: ${g.player.god ? 'ON' : 'off'}`, () => (g.player.god = !g.player.god)),
      this.btn(`Noclip: ${g.player.noclip ? 'ON' : 'off'}`, () => (g.player.noclip = !g.player.noclip)),
      this.btn('x0.25 speed', () => (g.timeScale = g.timeScale === 1 ? 0.25 : 1)),
      this.btn('Все предметы', () => Object.keys(ITEMS).forEach((i) => g.giveItem(i, true))),
      h('div', { class: 'title' }, 'Мир'),
      this.btn(`Коллизии: ${this.showCol ? 'ON' : 'off'}`, () => {
        this.showCol = !this.showCol;
        this.drawColliders();
      }),
      this.btn(`ИИ: ${this.showAI ? 'ON' : 'off'}`, () => {
        this.showAI = !this.showAI;
        this.drawNav();
      }),
      this.btn('Сброс триггеров', () => g.zone?.triggers.forEach((t) => ((t.fired = false), (t.inside = false)))),
      this.btn('Сброс головоломок', () => {
        for (const k of Object.keys(g.state.data.flags)) if (k.startsWith('solved.') || k.startsWith('puzzle.')) delete g.state.data.flags[k];
        g.state.data.puzzles = {};
        g.loadZone(g.state.data.zone, 'start');
      }),
      this.btn('Перезагрузить зону', () => g.loadZone(g.state.data.zone, 'start')),
      this.btn('FPS', () => (this.showFps = !this.showFps)),
      cmd,
    );
  }

  exec(line: string): void {
    const g = this.g;
    const [c, ...rest] = line.trim().split(/\s+/);
    const arg = rest.join(' ');
    try {
      switch (c) {
        case 'flag': {
          const [k, v] = arg.split('=');
          g.state.set(k, v === undefined ? true : v === 'false' ? false : isNaN(Number(v)) ? v : Number(v));
          break;
        }
        case 'item':
          g.giveItem(arg);
          break;
        case 'solve':
          g.state.markSolved(arg);
          break;
        case 'stage':
          g.verity.stage = Number(arg);
          break;
        case 'verity': {
          const p = g.player.pos.clone().add(g.player.forward(new THREE.Vector3()).setY(0).normalize().multiplyScalar(6));
          if (arg === 'off') g.verity.hide();
          else {
            if (!g.verity.visible) g.verity.spawn(p, 0, 'scripted');
            if (arg === 'chase') g.verity.startChase();
            if (arg === 'hunt') g.verity.startHunt();
            if (arg === 'stalk') g.verity.startStalk();
            if (arg === 'watch') g.verity.watch(p);
          }
          break;
        }
        case 'time':
          g.timeScale = Number(arg) || 1;
          break;
        case 'log':
          g.playLog(arg);
          break;
        case 'doc':
          g.readDoc(arg);
          break;
        case 'tp': {
          const [x, y, z] = arg.split(/[ ,]+/).map(Number);
          g.player.teleport(x, y, z);
          break;
        }
        default:
          console.log('unknown command', c);
      }
    } catch (e) {
      console.error(e);
    }
  }

  private drawColliders(): void {
    this.colGroup.clear();
    if (!this.showCol) return;
    const mat = new THREE.LineBasicMaterial({ color: 0x00ff66, transparent: true, opacity: 0.5, depthTest: false });
    for (const c of this.g.world.colliders) {
      if (!c.enabled) continue;
      const box = new THREE.Box3(new THREE.Vector3(c.min.x, c.min.y, c.min.z), new THREE.Vector3(c.max.x, c.max.y, c.max.z));
      const helper = new THREE.Box3Helper(box, c.ramp ? 0xffaa00 : c.solid ? 0x00ff66 : 0x6688ff);
      (helper.material as THREE.Material).depthTest = false;
      this.colGroup.add(helper);
    }
    void mat;
  }

  private drawNav(): void {
    this.navGroup.clear();
    if (!this.showAI) return;
    const nav = this.g.zone?.nav;
    if (!nav) return;
    const pts: number[] = [];
    for (let i = 0; i < nav.walk.length; i++) {
      if (!nav.walk[i]) continue;
      const p = nav.center(i);
      pts.push(p.x, p.y + 0.05, p.z);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    this.navGroup.add(new THREE.Points(geo, new THREE.PointsMaterial({ color: 0x33aaff, size: 0.08 })));
  }

  update(_dt: number): void {
    const g = this.g;
    if (this.showAI) {
      const path = g.verity.debugPath;
      if (this.aiLine) this.navGroup.remove(this.aiLine);
      if (path.length) {
        const geo = new THREE.BufferGeometry().setFromPoints(path.map((p) => new THREE.Vector3(p.x, p.y + 0.3, p.z)));
        this.aiLine = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xff3355, depthTest: false }));
        this.navGroup.add(this.aiLine);
      }
    }
    if (this.visible) {
      const p = g.player.pos;
      this.info.textContent = `pos ${p.x.toFixed(2)} ${p.y.toFixed(2)} ${p.z.toFixed(2)} yaw ${g.player.yaw.toFixed(2)} | zone ${g.zone?.id} | verity ${g.verity.state} st${g.verity.stage} | fear ${g.fear.toFixed(2)} | calls ${g.renderer.gl.info.render.calls} tris ${g.renderer.gl.info.render.triangles}`;
    }
  }
}
