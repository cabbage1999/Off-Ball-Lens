import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {SCENARIOS, generateScenario, frameAt} from '../src/scenarios.mjs';
import {analyzeFrame, arrivalEstimate, compareRun, DEFAULT_PARAMS} from '../src/model.mjs';
import {offlineExplain, explain} from '../src/agent.mjs';

// Independent acceptance properties: analytical bounds, raw-data audits, and
// observational equivalences. These do not copy the controller or scoring code.
const close = (a, b, tolerance = 1e-8) => assert.ok(Math.abs(a - b) <= tolerance, `${a} versus ${b}`);
const freeze = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const item of Object.values(value)) freeze(item);
  }
  return value;
};

test('acceptance: stationary one-dimensional arrival respects the analytic speed/acceleration bound', () => {
  const p = DEFAULT_PARAMS, reaction = .2;
  for (const distance of [1, 4, 12, 25]) {
    const travel = distance - p.interceptionRadius;
    const accelerationDistance = p.maxSpeed ** 2 / (2 * p.maxAcceleration);
    const lowerBound = reaction + (travel <= accelerationDistance
      ? Math.sqrt(2 * travel / p.maxAcceleration)
      : p.maxSpeed / p.maxAcceleration + (travel - accelerationDistance) / p.maxSpeed);
    const result = arrivalEstimate({x: 0, y: 0, vx: 0, vy: 0}, {x: distance, y: 0}, p,
      {reactionTime: reaction, maxTime: 8});
    assert.ok(result.time >= lowerBound - 1e-8, `arrival before physical lower bound at ${distance} m`);
    assert.ok(result.time - lowerBound <= p.integrationStep + 1e-6,
      `simple straight motion differs by more than one integration interval at ${distance} m`);
  }
});

test('acceptance: the alternative braking displacement agrees with a physical stopping-distance bound', () => {
  const c = compareRun(generateScenario('diagonal'));
  const start = c.states[0].alternative, end = c.states.at(-1).alternative;
  const speed = Math.hypot(start.vx, start.vy);
  const exactMinimum = speed ** 2 / (2 * DEFAULT_PARAMS.maxAcceleration);
  const travelled = Math.hypot(end.x - start.x, end.y - start.y);
  assert.ok(travelled >= exactMinimum - 1e-8, 'braking must not stop before the physical minimum');
  assert.ok(travelled <= exactMinimum + DEFAULT_PARAMS.maxAcceleration * .1 ** 2 / 8 + 1e-8,
    'the final partial braking step must account for the small numerical surplus');
  close(Math.hypot(end.vx, end.vy), 0);
});

test('acceptance: adding a lane defender cannot improve any receiving candidate when offside is unchanged', () => {
  const frame = {index: 0, t: 0, pitch: {length: 105, width: 68}, attackDirection: 1,
    attackingTeam: 'A', carrierId: 'A6', ball: {x: 30.45, y: 34.2, vx: 0, vy: 0, state: 'possessed'},
    players: [
      {id: 'A6', team: 'A', x: 30, y: 34, vx: 0, vy: 0},
      {id: 'A7', team: 'A', x: 55, y: 34, vx: 0, vy: 0},
      {id: 'B1', team: 'B', x: 100, y: 0, vx: 0, vy: 0},
      {id: 'B2', team: 'B', x: 90, y: 68, vx: 0, vy: 0}
    ]};
  const before = analyzeFrame(frame);
  const crowded = structuredClone(frame);
  crowded.players.push({id: 'B3', team: 'B', x: 45, y: 34, vx: 0, vy: 0});
  const after = analyzeFrame(crowded);
  assert.equal(before.offside.lineProgress, after.offside.lineProgress);
  assert.ok(after.index < before.index);
  for (const candidate of before.candidates) {
    const altered = after.candidates.find(x => x.id === candidate.id);
    assert.equal(altered.reachable, candidate.reachable);
    close(altered.U, candidate.U);
    close(altered.R, candidate.R);
    assert.ok(altered.index <= candidate.index + 1e-8);
  }
});

test('acceptance: an irrelevant attacking teammate does not alter the direct target index', () => {
  const frame = structuredClone(frameAt(generateScenario('diagonal'), 4));
  const baseline = analyzeFrame(frame);
  frame.players = frame.players.filter(p => p.team !== 'A' || ['A6', 'A7'].includes(p.id));
  assert.deepEqual(analyzeFrame(frame), baseline);
});

for (const spec of SCENARIOS) {
  test(`acceptance: ${spec.id} export exactly reproduces its declared generator and has coherent ground passes`, async () => {
    const data = JSON.parse(await readFile(new URL(`../data/${spec.id}.json`, import.meta.url), 'utf8'));
    assert.deepEqual(data, generateScenario(spec.id, data.metadata.seed));
    assert.equal(data.metadata.synthetic, true);
    assert.equal(data.metadata.labelsAreHypotheses, true);
    const dt = 1 / data.metadata.sampleRate;
    for (let i = 0; i < data.frames.length; i++) {
      const f = data.frames[i];
      assert.ok(f.ball.x >= 0 && f.ball.x <= 105 && f.ball.y >= 0 && f.ball.y <= 68);
      for (let a = 0; a < f.players.length; a++) for (let b = a + 1; b < f.players.length; b++) {
        const p = f.players[a], q = f.players[b];
        assert.ok(Math.hypot(p.x - q.x, p.y - q.y) > .8, 'no overlapping point-player bodies in the authored clip');
      }
      if (!i) continue;
      const prev = data.frames[i - 1];
      const displacement = Math.hypot(f.ball.x - prev.ball.x, f.ball.y - prev.ball.y);
      assert.ok(displacement <= 25 * dt + 1e-7, 'ball must not teleport between recorded frames');
      if (prev.ball.state === 'in_flight') {
        close(f.ball.x, prev.ball.x + prev.ball.vx * dt);
        close(f.ball.y, prev.ball.y + prev.ball.vy * dt);
      }
    }
    for (const pass of data.events.filter(e => e.type === 'pass')) {
      const release = data.frames[pass.frameIndex];
      const receiver = release.players.find(p => p.id === pass.targetId);
      const opponents = release.players.filter(p => p.team !== receiver.team).map(p => p.x).sort((a, b) => b - a);
      assert.ok(receiver.x <= Math.max(105 / 2, release.ball.x, opponents[1]) + 1e-8,
        'the actually completed passes must have an onside receiver at release');
      assert.ok(Math.hypot(release.ball.vx, release.ball.vy) >= 5, 'authored ground pass is not a stationary ball');
    }
  });
}

test('acceptance: analytical calls are read-only even when every input object is frozen', () => {
  const scene = freeze(generateScenario('crowded'));
  const original = JSON.stringify(scene);
  const params = freeze({ballSpeed: 15});
  analyzeFrame(frameAt(scene, 4), 'A7', params);
  compareRun(scene, 2.5, 2.5, params);
  assert.equal(JSON.stringify(scene), original);
  const request = freeze({scenarioId: 'crowded', language: 'zh', params: {ballSpeed: 15}});
  const first = offlineExplain(request), second = offlineExplain(request);
  assert.deepEqual(first, second);
  assert.equal(first.source, 'offline-template');
  assert.equal(first.cloud.verified, false);
});

test('acceptance: changing frames and events after the comparison horizon cannot alter a completed window', () => {
  const scene = generateScenario('diagonal'), altered = structuredClone(scene);
  for (const frame of altered.frames.filter(f => f.t > 5)) {
    frame.players = [{id: 'unreadable-future', team: 'B', x: NaN, y: NaN, vx: NaN, vy: NaN}];
    frame.ball = null;
  }
  altered.events = [{type: 'pass', t: 10, frameIndex: 100}];
  assert.deepEqual(compareRun(scene, 2.5, 2.5), compareRun(altered, 2.5, 2.5));
});

test('acceptance: release and in-flight starts cannot fabricate a positive-duration comparison', () => {
  for (const spec of SCENARIOS) {
    const scene = generateScenario(spec.id);
    for (const time of [7.5, 8, 12, 12.5, 16]) {
      const result = compareRun(scene, time, 2.5);
      assert.equal(result.valid, false);
      assert.equal(result.duration, 0);
      assert.equal(result.summary.meanDelta, 0);
      assert.ok(result.samples.length <= 1);
    }
  }
  const answer = offlineExplain({startTime: 7.5, language: 'en'});
  assert.equal(answer.context.valid, false);
  assert.ok(answer.claims.some(c => c.id === 'C_NO_WINDOW'));
  assert.ok(!answer.claims.some(c => c.id === 'C_AVG'));
});

test('acceptance: missing configuration performs no fetch and provider failure remains an explicitly local fallback', async () => {
  let calls = 0;
  const fetchImpl = async () => { calls++; throw new Error('test-only-network-failure'); };
  const local = await explain({}, {env: {}, fetchImpl});
  assert.equal(calls, 0);
  assert.equal(local.source, 'offline-template');
  assert.deepEqual(local.cloud, {configured: false, verified: false});
  const fallback = await explain({}, {env: {
    AZURE_OPENAI_ENDPOINT: 'https://acceptance-test.openai.azure.com',
    AZURE_OPENAI_API_KEY: 'mock-only', AZURE_OPENAI_DEPLOYMENT: 'mock-only'
  }, fetchImpl});
  assert.equal(calls, 1);
  assert.equal(fallback.source, 'offline-template');
  assert.equal(fallback.status, 'fallback');
  assert.deepEqual(fallback.cloud, {configured: true, verified: false});
  assert.ok(!JSON.stringify(fallback).includes('mock-only'));
});
