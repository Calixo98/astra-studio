import { audibleTracks, projectDuration, comparisonGains, type Asset, type Project, type Settings } from './model';
import { createMasterChain } from '../audio/masterChain';
import { createVocalChain } from '../audio/vocalChain';
import { measureLoudness } from '../audio/lufs';
import type { VocalParams } from '../audio/state';

export function vocalSettings(s: Settings): VocalParams {
  return {eqLow:0,eqMid:0,eqHigh:s.clarity/50,clarity:s.clarity,deesser:s.clarity*0.4,compThreshold:-12-s.level*0.1,compAttack:10,compRelease:120,reverbSize:30,reverbDecay:45,reverbMix:s.ambience*0.35,width:100};
}
export async function renderProject(project: Project, assets: Map<string,Asset>, processed: boolean): Promise<AudioBuffer> {
  const p=structuredClone(project);
  const duration=projectDuration(p);
  if (!duration) throw new Error('Importa audio antes de reproducir.');
  // Fixed output rate and shared render path make preview and downloads use exactly the same samples.
  const ctx=new OfflineAudioContext(2,Math.ceil((duration+1.7)*44100),44100);
  const master=createMasterChain(ctx,{eq:processed && p.settings.goal==='master' ? [0,0,0,p.settings.clarity*0.015,p.settings.clarity*0.02] : [0,0,0,0,0],maximizer:processed ? p.settings.level*0.06 : 0,ceiling:-1});
  master.output.connect(ctx.destination);
  for (const track of audibleTracks(p)) {
    const fader=ctx.createGain(); fader.gain.value=(track.volume/100)**2;
    fader.connect(master.input);
    let destination: AudioNode=fader;
    if (processed && p.settings.goal!=='master' && (track.role==='voice' || p.settings.goal==='voice')) {
      const chain=createVocalChain(ctx,vocalSettings(p.settings)); chain.output.connect(fader); destination=chain.input;
    }
    for (const clip of track.clips) {
      const asset=assets.get(clip.assetId); if (!asset) throw new Error('Falta audio original.');
      const source=ctx.createBufferSource(); source.buffer=asset.buffer;
      const envelope=ctx.createGain(); source.connect(envelope); envelope.connect(destination);
      const start=clip.start,end=start+clip.duration;
      const fadeIn=Math.min(clip.fadeIn,clip.duration/2),fadeOut=Math.min(clip.fadeOut,clip.duration/2);
      envelope.gain.setValueAtTime(fadeIn>0 ? 0 : 1,start);
      if (fadeIn>0) envelope.gain.linearRampToValueAtTime(1,start+fadeIn);
      envelope.gain.setValueAtTime(1,end-fadeOut);
      if (fadeOut>0) envelope.gain.linearRampToValueAtTime(0,end);
      source.start(start,clip.offset,clip.duration);
    }
  }
  return ctx.startRendering();
}
export interface RenderPair { before: AudioBuffer; after: AudioBuffer; gains: {before:number;after:number}; integrated: number; peak: number; matched: boolean }
export async function renderPair(project: Project, assets: Map<string,Asset>): Promise<RenderPair> {
  const snapshot=structuredClone(project);
  const registry=new Map(assets);
  const before=await renderProject(snapshot,registry,false);
  const after=await renderProject(snapshot,registry,true);
  const a=measureLoudness(before),b=measureLoudness(after);
  return {before,after,gains:comparisonGains(a.integrated,b.integrated),integrated:b.integrated,peak:b.truePeak,matched:Number.isFinite(a.integrated)&&Number.isFinite(b.integrated)};
}
