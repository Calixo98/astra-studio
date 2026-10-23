// Same-origin AudioWorklet asset; no blob-script or eval CSP permission required.
// Implementa BS.1770-4: ponderación K + bloques 400 ms + gating.

export interface LufsData {
  momentary: number;
  shortTerm: number;
  integrated: number;
}


export interface LufsMeterNode {
  node: AudioWorkletNode;
  reset(): void;
}

/** Crea el nodo medidor. Devuelve null si AudioWorklet no está disponible. */
export async function createLufsMeter(
  ctx: AudioContext,
  onData: (d: LufsData) => void,
): Promise<LufsMeterNode | null> {
  try {
    await ctx.audioWorklet.addModule(new URL('./lufsProcessor.js', import.meta.url).href);
    const node = new AudioWorkletNode(ctx, 'lufs-processor', {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [2],
      channelCount: 2,
      channelCountMode: 'explicit',
    });
    node.port.onmessage = (e) => onData(e.data as LufsData);
    return {
      node,
      reset() {
        node.port.postMessage('reset');
      },
    };
  } catch (err) {
    console.warn('AudioWorklet no disponible; medidor LUFS en vivo desactivado', err);
    return null;
  }
}
