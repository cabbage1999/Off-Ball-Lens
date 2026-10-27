import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {heatmapRgba, observationCueAtTime} from '../src/presentation.mjs';

const frame = t => ({t, players:[{id:'A7'}, {id:'B2'}, {id:'A6'}]});
const cue = {id:'check', startTime:6, endTime:7.7, evidenceTime:6,
  focusPlayerIds:['A7','B2'], text:'A7 checks back; B2 follows.', textZh:'A7 回撤，B2 跟随。',
  kind:'observed_movement', provenance:'authored_tracking_cue'};
const scene = (...cues) => ({metadata:{observationCues:cues}});

test('cue timing, selected player, and backward seeks never borrow future observations', () => {
  const s = scene(cue);
  assert.equal(observationCueAtTime(s,frame(5.9),'A7'),null);
  assert.equal(observationCueAtTime(s,frame(6),'A7'),cue);
  assert.equal(observationCueAtTime(s,frame(7.7),'B2'),cue);
  assert.equal(observationCueAtTime(s,frame(7.8),'A7'),null);
  assert.equal(observationCueAtTime(s,frame(6),'A6'),null);
  assert.equal(observationCueAtTime(s,frame(6),'UNKNOWN'),null);
  assert.equal(observationCueAtTime(s,frame(5.9),'A7'),null);
});

test('malformed, future-backed, or unlabelled observations are unavailable', () => {
  for (const change of [{evidenceTime:6.1},{startTime:8,endTime:7},
    {evidenceTime:NaN},{provenance:'model-generated'},{kind:'forecast'},
    {focusPlayerIds:['A7','UNKNOWN']},{textZh:''},{text:'  '}]) {
    assert.equal(observationCueAtTime(scene({...cue,...change}),frame(6.5),'A7'),null);
  }
  assert.equal(observationCueAtTime(scene(cue),frame(NaN),'A7'),null);
  assert.equal(observationCueAtTime({},frame(6),'A7'),null);
});

test('a new eligible observation replaces an older overlap deterministically', () => {
  const next={...cue,id:'turn',startTime:7,evidenceTime:7,endTime:9};
  assert.equal(observationCueAtTime(scene(next,cue),frame(6.9),'A7'),cue);
  assert.equal(observationCueAtTime(scene(cue,next),frame(7),'A7'),next);
});

test('all shipped player/time cues equal physically truncated metadata', () => {
  for(const id of ['used','unused','blocked']) {
    const s=JSON.parse(readFileSync(new URL(`../data/${id}.json`,import.meta.url)));
    for(const f of s.frames) {
      const prefix=scene(...s.metadata.observationCues.filter(c=>c.evidenceTime<=f.t));
      for(const p of f.players) assert.deepEqual(observationCueAtTime(s,f,p.id),
        observationCueAtTime(prefix,f,p.id),`${id} ${f.t} ${p.id}`);
    }
  }
});

test('fixed sequential field colours preserve transparent zero and bounded integer channels', () => {
  assert.deepEqual(heatmapRgba(0),[0,0,0,0]);
  assert.deepEqual(heatmapRgba(-1),heatmapRgba(0));
  assert.deepEqual(heatmapRgba(300),heatmapRgba(255));
  assert.equal(heatmapRgba(255)[3],255);
  for(let q=1;q<=255;q++) {
    const rgba=heatmapRgba(q);
    assert.equal(rgba.length,4);
    assert(rgba.every(channel=>Number.isInteger(channel)&&channel>=0&&channel<=255));
    assert(rgba[3]>0);
    assert(rgba[3]>=heatmapRgba(q-1)[3]);
  }
  // The opaque high end is bright and distinguishable from the midrange.
  assert(heatmapRgba(255).slice(0,3).every(channel=>channel>=170));
  assert.notDeepEqual(heatmapRgba(64),heatmapRgba(255));
});
