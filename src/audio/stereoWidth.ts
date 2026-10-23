// Control de amplitud estéreo por procesamiento Mid/Side.
// width 0 % = mono, 100 % = original, 200 % = extra ancho.

export interface StereoWidthUnit {
  input: GainNode;
  output: GainNode;
  update(widthPercent: number): void;
}

export function createStereoWidth(ctx: BaseAudioContext, widthPercent: number): StereoWidthUnit {
  const input = ctx.createGain();
  // Fuerza estéreo aunque la fuente sea mono
  input.channelCount = 2;
  input.channelCountMode = 'explicit';
  input.channelInterpretation = 'speakers';

  const splitter = ctx.createChannelSplitter(2);
  const merger = ctx.createChannelMerger(2);
  const output = ctx.createGain();

  const midFromL = ctx.createGain();
  const midFromR = ctx.createGain();
  const sideFromL = ctx.createGain();
  const sideFromR = ctx.createGain();
  midFromL.gain.value = 0.5;
  midFromR.gain.value = 0.5;
  sideFromL.gain.value = 0.5;
  sideFromR.gain.value = -0.5;

  const midSum = ctx.createGain();
  const sideGain = ctx.createGain(); // aquí vive el control de amplitud
  const sideInv = ctx.createGain();
  sideInv.gain.value = -1;

  input.connect(splitter);
  splitter.connect(midFromL, 0);
  splitter.connect(midFromR, 1);
  splitter.connect(sideFromL, 0);
  splitter.connect(sideFromR, 1);
  midFromL.connect(midSum);
  midFromR.connect(midSum);
  sideFromL.connect(sideGain);
  sideFromR.connect(sideGain);

  // L = mid + side·w ; R = mid − side·w
  midSum.connect(merger, 0, 0);
  midSum.connect(merger, 0, 1);
  sideGain.connect(merger, 0, 0);
  sideGain.connect(sideInv);
  sideInv.connect(merger, 0, 1);

  merger.connect(output);

  const unit: StereoWidthUnit = {
    input,
    output,
    update(w: number) {
      sideGain.gain.value = Math.max(0, Math.min(2, w / 100));
    },
  };
  unit.update(widthPercent);
  return unit;
}
