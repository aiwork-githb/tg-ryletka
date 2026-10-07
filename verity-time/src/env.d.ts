/// <reference types="vite/client" />
declare const __DEBUG__: boolean;

interface NativeBridge {
  isElectron: true;
  setDisplayMode(mode: 'fullscreen' | 'borderless' | 'windowed'): void;
  setResolution(width: number, height: number): void;
  setVSync(on: boolean): void;
  quit(): void;
  getDisplayInfo(): Promise<{ resolutions: Array<[number, number]>; current: [number, number] }>;
}
interface Window { native?: NativeBridge }
