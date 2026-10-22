/** Independently authored tactical scenes. No score is used to generate motion. */
export const PITCH = Object.freeze({ length: 105, width: 68, originX: 0, originY: 0 });
export const MOTION_LIMITS = Object.freeze({ maxSpeed: 7.8, maxAcceleration: 3.2 });
export const SCENARIOS = Object.freeze([
  { id: 'diagonal', title: 'An angled option', titleZh: '斜向接应', subtitle: 'A wide runner moves towards an inside passing option.', duration: 16, sampleRate: 10, targetId: 'A7', compareStart: 2.5, horizon: 2.5, hypothesis: 'A diagonal run may improve a direct receiving option; this is a hypothesis, not a ground-truth label.' },
  { id: 'crowded', title: 'Into traffic', titleZh: '跑入封锁区', subtitle: 'A forward run approaches a defended passing corridor.', duration: 16, sampleRate: 10, targetId: 'A7', compareStart: 2.5, horizon: 2.5, hypothesis: 'Forward progress alone need not improve a receiving option.' },
  { id: 'early', title: 'Too early?', titleZh: '启动过早', subtitle: 'The runner threatens to cross the defensive line before release.', duration: 16, sampleRate: 10, targetId: 'A7', compareStart: 2.5, horizon: 2.5, hypothesis: 'An attractive location can be unavailable at the current hypothetical release time.' }
]);

export const listScenarios = () => SCENARIOS.map(s => ({ ...s }));
const clone = value => JSON.parse(JSON.stringify(value));
const norm = (x, y) => Math.hypot(x, y);

function random(seed) {
  let n = seed >>> 0;
  return () => { n += 0x6D2B79F5; let t = n; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

/** Velocity controller with bounded vector acceleration and trapezoidal position integration. */
export function stepMotion(player, desiredVelocity, dt, limits = MOTION_LIMITS) {
  const maxSpeed = limits.maxSpeed;
  const maxAcceleration = limits.maxAcceleration ?? limits.maxAccel;
  let dx = desiredVelocity.vx, dy = desiredVelocity.vy;
  const desiredSpeed = norm(dx, dy);
  if (desiredSpeed > maxSpeed) { dx *= maxSpeed / desiredSpeed; dy *= maxSpeed / desiredSpeed; }
  let ax = dx - player.vx, ay = dy - player.vy;
  const change = norm(ax, ay), maxChange = maxAcceleration * dt;
  if (change > maxChange) { ax *= maxChange / change; ay *= maxChange / change; }
  const vx = player.vx + ax, vy = player.vy + ay;
  return { ...player, x: player.x + (player.vx + vx) * dt / 2, y: player.y + (player.vy + vy) * dt / 2, vx, vy };
}

function towards(player, target, speed = 2.2) {
  const dx = target.x - player.x, dy = target.y - player.y, distance = norm(dx, dy);
  const magnitude = Math.min(speed, Math.sqrt(2 * MOTION_LIMITS.maxAcceleration * distance));
  return distance < 0.02 ? { vx: 0, vy: 0 } : { vx: magnitude * dx / distance, vy: magnitude * dy / distance };
}

function initialPlayers(id, rng) {
  const attack = [[8,34],[32,12],[34,29],[34,44],[31,58],[58,34],[68,13],[59,51],[80,41],[75,55],[55,20]];
  const defense = [[101,34],[84,12],[86,29],[86,44],[82,59],[72,49],[66,57],[64,43],[45,24],[49,43],[62,8]];
  if (id === 'crowded') {
    attack[6] = [70,13]; defense[1] = [85,10]; defense[2] = [85,34]; defense[5] = [73,28];
  }
  if (id === 'early') {
    attack[6] = [76,19]; defense[1] = [84,9]; defense[2] = [84,29]; defense[3] = [84,44];
  }
  return ['A', 'B'].flatMap(team => (team === 'A' ? attack : defense).map(([x,y], i) => {
    const active = (team === 'A' && [5,6,8,9].includes(i)) || (team === 'B' && [0,1,2,3,5].includes(i));
    return { id: `${team}${i+1}`, team, number: i+1, role: i === 0 ? 'goalkeeper' : 'outfield',
      x: x + (active ? 0 : (rng()-.5)*.6), y: y + (active ? 0 : (rng()-.5)*.6),
      vx: team === 'A' && i === 5 ? .5 : team === 'A' && i === 6 ? 1.2 : 0, vy: 0 };
  }));
}

function desired(player, t, scene, anchor) {
  if (player.id === 'A7') {
    if (t < 2.5) return { vx: 1.2, vy: 0 };
    if (t < 6.5) return towards(player, scene === 'early' ? {x:95,y:25} : scene === 'crowded' ? {x:83,y:34} : {x:85,y:26}, scene === 'early' ? 6.4 : 4.9);
    return towards(player, scene === 'early' ? {x:85,y:25} : scene === 'crowded' ? {x:84,y:31} : {x:86,y:24}, 2.1);
  }
  if (player.id === 'A6') return t < 7.5 ? { vx: .5, vy: 0 } : towards(player, {x:67,y:35}, 1.4);
  if (player.id === 'A9') return t < 9 ? {vx:0,vy:0} : t < 12 ? {vx:1.2,vy:-.5} : {vx:.2,vy:0};
  if (player.id === 'A10') return t < 13.5 ? {vx:0,vy:0} : {vx:.7,vy:-.5};
  if (player.team === 'B' && player.id !== 'B1') {
    // Authored defensive block; no response to either counterfactual branch.
    const sway = .35 * Math.sin(t * .65 + player.number);
    return towards(player, {x:anchor.x + .15*t, y:anchor.y+sway}, .65);
  }
  return towards(player, {x:anchor.x + (player.team === 'A' ? 1.6 : 0)*Math.sin(t/7), y:anchor.y+.5*Math.sin(t/5+player.number)}, .8);
}

const foot = player => ({x:player.x+.45, y:player.y+.2});

export function generateScenario(id = 'diagonal', seed = 20261022) {
  const spec = SCENARIOS.find(s => s.id === id);
  if (!spec) throw new RangeError(`Unknown scenario: ${id}`);
  if (!Number.isSafeInteger(seed)) throw new TypeError('seed must be a safe integer');
  const rng = random(seed), dt = 1/spec.sampleRate;
  let players = initialPlayers(id, rng);
  const anchors = Object.fromEntries(players.map(p => [p.id, {x:p.x,y:p.y}]));
  const frames = [];
  for (let index=0; index<=spec.duration*spec.sampleRate; index++) {
    const t = Number((index*dt).toFixed(6));
    if (index) players = players.map(p => stepMotion(p, desired(p, t-dt, id, anchors[p.id]), dt));
    frames.push({index,t,pitch:{...PITCH},attackDirection:1,attackingTeam:'A',carrierId:null,players:clone(players),ball:null});
  }
  const passages = [{from:'A6',to:'A9',release:7.5,receive:9}, {from:'A9',to:'A10',release:12,receive:13.5}];
  for (const frame of frames) {
    const pass = passages.find(p => frame.t >= p.release && frame.t < p.receive);
    if (pass) {
      const startFrame = frames[Math.round(pass.release/dt)], endFrame = frames[Math.round(pass.receive/dt)];
      const from = foot(startFrame.players.find(p => p.id===pass.from)), to = foot(endFrame.players.find(p => p.id===pass.to));
      const f = (frame.t-pass.release)/(pass.receive-pass.release);
      frame.ball = {x:from.x+(to.x-from.x)*f,y:from.y+(to.y-from.y)*f,vx:(to.x-from.x)/(pass.receive-pass.release),vy:(to.y-from.y)/(pass.receive-pass.release),state:'in_flight'};
    } else {
      frame.carrierId = frame.t < passages[0].release ? 'A6' : frame.t < passages[1].release ? 'A9' : 'A10';
      const p = frame.players.find(p=>p.id===frame.carrierId);
      frame.ball = {...foot(p),vx:p.vx,vy:p.vy,state:'possessed'};
    }
  }
  const events = passages.flatMap((p,i) => [
    {id:`pass-${i+1}`,type:'pass',t:p.release,frameIndex:Math.round(p.release/dt),playerId:p.from,targetId:p.to},
    {id:`receive-${i+1}`,type:'reception',t:p.receive,frameIndex:Math.round(p.receive/dt),playerId:p.to,fromId:p.from}
  ]);
  return {metadata:{...spec,seed,synthetic:true,coordinateUnits:'m',timeUnits:'s',pitch:{...PITCH},attackingTeam:'A',attackDirection:1,motionLimits:{...MOTION_LIMITS},generatorVersion:'authored-kinematic-v1',source:'Independently authored synthetic scene; no real match data.',labelsAreHypotheses:true},frames,events};
}

export const getScenario = generateScenario;

/** No interpolation and no future frame: latest sample at or before t. */
export function frameAt(scenario, t) {
  if (!Number.isFinite(t)) throw new TypeError('time must be finite');
  const index = Math.max(0, Math.min(scenario.frames.length-1, Math.floor((t+1e-8)*scenario.metadata.sampleRate)));
  return scenario.frames[index];
}
