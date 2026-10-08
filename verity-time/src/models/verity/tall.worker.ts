/// <reference lib="webworker" />
import { tallGeometry } from './TallSculpt';
import { packTall } from './tallPack';

// Builds the tall form's meshes off the main thread.
self.onmessage = (e: MessageEvent<{ quality: number }>) => {
  const packed = packTall(tallGeometry(e.data.quality));
  (self as unknown as Worker).postMessage(packed.data, packed.transfer);
};
