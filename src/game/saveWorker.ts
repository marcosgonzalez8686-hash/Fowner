import { compressToUTF16 } from 'lz-string';

// Comprime la partida fuera del hilo principal: el juego no se traba al guardar.
self.onmessage = (e: MessageEvent<{ slot: number; seq: number; state: unknown }>) => {
  const { slot, seq, state } = e.data;
  try {
    (self as unknown as Worker).postMessage({ slot, seq, data: compressToUTF16(JSON.stringify(state)) });
  } catch {
    (self as unknown as Worker).postMessage({ slot, seq, error: true });
  }
};
