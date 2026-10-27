import { loadSceneData, analysisAtTime, trackingAtTime, interpolatedFrame, playerAnalysis, curveSegments, visibleMoments, visibleEvents, decodeHeatmap, playerTrail } from './src/analysis.mjs';
import { offlineExplain } from './src/agent.mjs';
import { heatmapRgba, observationCueAtTime, HEATMAP_OPACITY_FLOOR } from './src/presentation.mjs';

const $ = id => document.getElementById(id);
const english = new Map([...document.querySelectorAll('[data-i]')].map(element => [element, element.textContent]));
const zh = {
  skip:'跳转至回放',headercaption:'从另一个角度读懂足球',methodnav:'方法说明 ↗',eyebrow:'在球到来之前，看懂足球',title:'触球之前，先看跑动。',intro:'跟随一名球员，看见危险接应空间，找到机会出现的时刻。',viewlabel:'观看模式',fan:'球迷',analyst:'分析师',sceneused:'右侧配合',sceneusedsub:'观察近侧接应',sceneunused:'横向转移',sceneunusedsub:'观察远侧接应',sceneblocked:'冲击防线',sceneblockedsub:'观察跑动时机',synthetic:'合成场景回放',trail:'3 秒轨迹',heatmap:'接应空间',pitchhint:'点击任意球员，开始跟随',loading:'正在载入轨迹与作者模型分析……',teama:'A 队',teamb:'B 队',intensity:'危险接应空间 · 相对强度',recorded:'实际记录轨迹 · 22 人与球',curveeyebrow:'机会随时间变化',curvetitle:'的危险接应空间',dasunit:'DAS · 危险度加权 m²',curvenote:'仅显示已发生帧；无效状态与持球者切换处断开。',chartclick:'点击回看 ↗',following:'球员视角',followinglive:'跟随中',asunit:'m² 有效可接应面积',dasunitshort:'危险度加权 m²',analysistime:'分析时刻',frame:'帧编号',model:'模型',sampling:'计算方式',datasource:'数据来源',config:'配置标识',latestcue:'最新观察',cuestart:'播放片段，跟随这名球员的接应机会。',revisit:'回看这个时刻',playerlimit:'衡量直接接应面积，并非概率，也不是跑动的全部价值。',explainheading:'这一刻发生了什么？',localsource:'本地模板',explaincopy:'针对所选球员，询问截至此刻的比赛画面。',questionnow:'解释这一刻',questionchange:'机会如何变化？',questionlimits:'模型局限',questionlabel:'关于所选球员的问题',answerempty:'解释会绑定其证据帧。提问后暂停回放，查看依据。',offlinenote:'本地解释使用已记录的事实；尚未进行云端调用。',tooltrace:'证据与工具活动',revieweyebrow:'片段结束，回看机会',watchagain:'再看一遍 ↺',reviewcaveat:'有接应选项未被选择，本身并不能说明持球者作出了错误决策。',eventseyebrow:'截至此刻的比赛',eventstitle:'比赛事件',eventsempty:'事件会随回放逐步出现。',momentseyebrow:'可以回看的证据',momentstitle:'接应窗口',momentsempty:'只有证据已出现，才显示检测到的接应窗口。',methodtitle:'这个视角衡量什么',methodspace:'有明确含义的空间',methodcopy:'AS 是有效可接应面积，单位为 m²。DAS 以作者的危险度模型对该面积加权。两者直接读取 accessible-space 2.1.0 的结果，输入包括全员 22 人、球、球权与进攻方向。',methodlimits:'接应机会的一种视角',methodlimitcopy:'这是直接接应机会，不是进球概率或传球成功率，也不表示跑动的因果贡献。个人空间可以重叠。牵制跑动可能帮助队友，却不增加自身 DAS。',methoddata:'可回放、可复现',methoddatacopy:'三个独立编排的合成进攻片段。轨迹以 10 Hz 记录，作者模型以 5 Hz 预计算，动画只对位置插值。热图采用固定色标，越位仅为点位几何近似。',methodlink:'阅读方法说明 ↗',integrationlink:'查看作者实现适配 ↗',export:'下载当前证据 ↓',footer:'在触球之前，看见机会。',footernote:'独立编排的合成数据 · 与英超联赛无隶属关系'
};
Object.assign(zh, { intensity:'危险接应空间', low:'低', high:'高', movementlabel:'跟随跑动', movementstart:'跟随高亮球员，短轨迹显示过去 3 秒的跑动。' });
const state = { language:'en', audience:'fan', sceneId:'used', scenario:null, analysis:null, selectedId:'A7', t:0, playing:false, speed:1, generation:0, loadGeneration:0, answer:null, requestController:null, loadController:null, server:false, cloudConfigured:false, orchestrator:null, loading:true, loadFailed:false, cueTime:null, latestRenderKey:'', heatmapCache:new Map(), drawnPlayers:[], toastTimer:null };
const tr = (en, cn) => state.language === 'zh' ? cn : en;
const fmt = (value, places=1) => Number.isFinite(value) ? value.toFixed(places) : '—';
const metricText = value => !Number.isFinite(value)?'—':value===0?'0':Math.abs(value)<.01?value.toPrecision(2):Math.abs(value)<1?value.toFixed(3):Math.abs(value)<10?value.toFixed(2):value.toFixed(1);
const clockText = time => `${time < 10 ? '0' : ''}${fmt(time)}`;
const duration = () => state.scenario?.metadata?.duration ?? 30;
const activeFacts = () => {
  const analysis = analysisAtTime(state.analysis, state.t), tracking = trackingAtTime(state.scenario, state.t);
  return { analysis, tracking, value: playerAnalysis(analysis, tracking, state.selectedId, state.analysis?.model?.config?.filters), player:tracking?.players.find(player => player.id === state.selectedId) };
};
function setText(id, value) { $(id).textContent = value; }
function element(tag, className, text) { const item = document.createElement(tag); if (className) item.className = className; if (text !== undefined) item.textContent = text; return item; }
function toast(message) { setText('toast', message); $('toast').hidden = false; clearTimeout(state.toastTimer); state.toastTimer = setTimeout(() => $('toast').hidden = true, 4000); }
function invalidateAnswer() {
  state.generation++;
  $('pitch').dataset.explanationOverlay='';
  state.requestController?.abort(); state.requestController = null; state.answer = null;
  $('ask').disabled = false;
  $('answer').replaceChildren(element('p', 'answer-placeholder', tr('An explanation stays with its evidence frame. Ask to pause and inspect.','解释会绑定其证据帧。提问后暂停回放，查看依据。')));
  $('evidence-buttons').replaceChildren(); setText('tool-trace','');
  renderSource();
}
function renderSource(answer = null) {
  const cloud = answer?.source === 'microsoft-foundry' && answer?.cloud?.verified === true;
  const maf = cloud && answer.orchestrator === 'microsoft-agent-framework';
  $('cloud-status').classList.toggle('cloud', cloud);
  const badge = maf ? tr('Foundry + Agent Framework · verified','Foundry + Agent Framework · 已核验')
    : cloud ? tr('Foundry · verified','Foundry · 已核验')
    : answer ? (['fallback','browser-fallback'].includes(answer.status) ? tr('Local fallback','本地回退') : tr('Local template','本地模板'))
    : state.cloudConfigured ? tr('Foundry ready','Foundry 已配置') : tr('Local template','本地模板');
  setText('cloud-status',badge);
  const description = maf
    ? tr('Microsoft Agent Framework ran the analyst and its evidence tools with a Foundry model. The application verified the returned facts.','Microsoft Agent Framework 使用 Foundry 模型运行分析 Agent 和证据工具，应用已核验返回的事实。')
    : cloud ? tr('Microsoft Foundry selected tools and evidence. Returned claims passed the evidence checks.','Microsoft Foundry 选择工具与证据，返回的结论已通过证据检查。')
    : answer ? tr('Deterministic local wording from the recorded facts. No cloud-model answer is shown.','当前展示记录事实生成的确定性本地文本，未展示云端模型回答。')
    : state.cloudConfigured ? tr('The server is configured. A successful explanation is needed to verify the model and tools.','服务器已有配置；需成功完成一次解释，才能核验模型与工具调用。')
    : state.audience==='analyst' ? tr('Local explanations use recorded facts. Run the configured Node service for Agent Framework explanations.','本地解释使用记录事实；运行已配置的 Node 服务可使用 Agent Framework 解释。')
    : tr('Local explanations use recorded facts. No cloud-model answer is shown.','本地解释使用已记录的事实，当前未展示云端模型回答。');
  setText('explanation-source',description);
}
function renderLanguage() {
  document.documentElement.lang = state.language === 'zh' ? 'zh-CN' : 'en';
  document.title = tr('Off-Ball Lens — The run before the touch','Off-Ball Lens — 触球之前，先看跑动');
  for (const [item, text] of english) item.textContent = state.language === 'zh' ? (zh[item.dataset.i] ?? text) : text;
  setText('language', state.language === 'zh' ? 'EN' : '中文');
  $('language').setAttribute('aria-label', state.language === 'zh' ? 'Switch to English' : '切换为中文');
  document.body.classList.toggle('analyst', state.audience === 'analyst');
  for (const mode of ['fan','analyst']) $(mode).setAttribute('aria-pressed',String(state.audience === mode));
  $('question').placeholder = tr('Ask about this player…','询问这名球员……');
  $('timeline').setAttribute('aria-label',tr('Replay time','回放时间'));
  $('player-select').setAttribute('aria-label',tr('Select player','选择球员'));
  $('restart').setAttribute('aria-label',tr('Restart replay','从头回放'));
  $('speed').setAttribute('aria-label',tr('Playback speed','播放速度'));
  $('ask').setAttribute('aria-label',tr('Ask about this player','询问这名球员'));
  for(const [index,group] of [...$('player-select').querySelectorAll('optgroup')].entries())group.label=tr(`Team ${index===0?'A':'B'}`,`${index===0?'A':'B'} 队`);
  document.querySelector('.scenarios').setAttribute('aria-label',tr('Synthetic football scenes','合成足球片段'));
  document.querySelector('.mode-switch').setAttribute('aria-label',tr('Audience','观看模式'));
  $('replay').setAttribute('aria-label',tr('Football replay','足球回放'));
  if(state.loadFailed)renderLoadState();
  renderSource(state.answer); renderFrame(true);
}

function renderLoadState() {
  $('loading-state').dataset.state=state.loadFailed?'error':'loading';
  const message=state.loadFailed?tr('Replay unavailable. Choose a sequence to retry.','回放暂不可用。请选择片段重试。'):tr('Loading tracking & author analysis…','正在载入轨迹与作者模型分析……');
  setText('loading-message',message);
  $('pitch').setAttribute('aria-label',message);
  $('chart').setAttribute('aria-label',message);
  if(state.loadFailed){setText('observation-label',tr('REPLAY UNAVAILABLE','回放暂不可用'));setText('observation-text',tr('This sequence has no available replay or analysis.','当前片段没有可用的回放或分析。'));}
}

function renderHeatmapLegend() {
  const canvas=$('heatmap-key'),ctx=canvas.getContext('2d'),pixels=ctx.createImageData(canvas.width,canvas.height);
  for(let y=0;y<canvas.height;y++)for(let q=0;q<canvas.width;q++)pixels.data.set(heatmapRgba(q),4*(y*canvas.width+q));
  ctx.putImageData(pixels,0,0);
}

function renderObservation(tracking) {
  const cue=observationCueAtTime(state.scenario,tracking,state.selectedId),box=$('pitch-observation');
  box.dataset.cueId=cue?.id??'';
  box.dataset.trackingFrameId=tracking?.frameId??'';
  box.dataset.evidenceTime=cue?String(cue.evidenceTime):'';
  box.dataset.focusPlayerIds=cue?.focusPlayerIds.join(',')??'';
  setText('observation-label',cue?tr('SCRIPTED OBSERVATION','预设场景解说'):tr('FOLLOW THE MOVEMENT','跟随跑动'));
  setText('observation-time',cue?`${fmt(cue.evidenceTime)} s`:'');
  setText('observation-text',cue?(state.language==='zh'?cue.textZh:cue.text):state.t>=duration()
    ?tr('Sequence complete. Replay to watch the movement again.','片段结束。再次播放，回看球员的跑动。')
    :$('trail').checked?tr(`Follow ${state.selectedId}. The short trail shows the last 3 seconds.`,`跟随 ${state.selectedId}，短轨迹显示过去 3 秒的跑动。`)
    :tr(`Follow ${state.selectedId}. Turn on the trail to see the recent movement.`,`跟随 ${state.selectedId}，开启轨迹可查看刚刚发生的跑动。`));
}

async function loadScene(id) {
  state.loadController?.abort(); state.loadController = new AbortController();
  const generation = ++state.loadGeneration;
  state.sceneId=id; state.playing=false; state.t=0; state.loading=true; state.loadFailed=false; state.latestRenderKey=''; state.heatmapCache.clear();
  state.scenario=null;state.analysis=null;state.drawnPlayers=[];state.cueTime=null;
  const pitch=$('pitch'),pitchContext=pitch.getContext('2d');
  pitchContext.clearRect(0,0,pitch.width,pitch.height);pitchContext.fillStyle='#16382f';pitchContext.fillRect(0,0,pitch.width,pitch.height);
  for(const key of Object.keys(pitch.dataset))delete pitch.dataset[key];
  for(const key of Object.keys($('chart').dataset))delete $('chart').dataset[key];
  for(const key of Object.keys($('pitch-observation').dataset))if(key!=='placement')delete $('pitch-observation').dataset[key];
  setText('pitch-direction','—');setText('observation-label',tr('FOLLOW THE MOVEMENT','跟随跑动'));renderLoadState();
  setText('observation-text',tr('Loading this sequence…','正在载入此片段……'));setText('observation-time','');
  for(const id of ['metric-as','metric-das','analysis-time','frame-id','model-version','analysis-mode','stage-title','model-clock','ball-state','animation-clock','player-role','data-source','config-hash','player-title','player-shirt','curve-player'])setText(id,'—');
  setText('live-insight',tr('Loading this sequence…','正在载入此片段……'));setText('player-status',tr('Loading','载入中'));
  setText('clock','00.0 / — s');setText('event-count','0');setText('moment-count','0');$('timeline').value=0;
  $('events').replaceChildren(element('p','empty-state',tr('Events appear as the sequence unfolds.','事件会随回放逐步出现。')));$('moments').replaceChildren(element('p','empty-state',tr('Detected windows appear only when the evidence is available.','只有证据已出现，才显示检测到的接应窗口。')));
  setText('cue-text',tr('Play the sequence to follow this player’s opportunities.','播放片段，跟随这名球员的接应机会。'));$('cue-jump').hidden=true;
  $('chart').getContext('2d').clearRect(0,0,$('chart').width,$('chart').height);$('player-select').replaceChildren();
  invalidateAnswer(); $('load-error').hidden=true; $('loading-state').hidden=false; $('workspace').setAttribute('aria-busy','true');
  $('play').disabled=true; $('restart').disabled=true; $('timeline').disabled=true; $('review-card').hidden=true;
  document.querySelectorAll('[data-scene]').forEach(button => { const active = button.dataset.scene===id; button.classList.toggle('active',active); button.setAttribute('aria-pressed',String(active)); });
  try {
    const {scenario,analysis}=await loadSceneData(id,{signal:state.loadController.signal});
    if(generation!==state.loadGeneration)return;
    state.scenario=scenario;state.analysis=analysis;state.selectedId=scenario.metadata.targetId??'A7';state.loading=false;
    $('timeline').max=duration();$('timeline').value=0;
    $('player-select').replaceChildren();
    for (const team of ['A','B']) { const group=element('optgroup');group.label=tr(`Team ${team}`,`${team} 队`);for(const player of scenario.frames[0].players.filter(player=>player.team===team)){const option=element('option','',player.id);option.value=player.id;group.append(option);}$('player-select').append(group); }
    $('player-select').value=state.selectedId;
    $('loading-state').hidden=true;$('workspace').setAttribute('aria-busy','false');$('play').disabled=false;$('restart').disabled=false;$('timeline').disabled=false;
    renderFrame(true);
  } catch(error) {
    if(generation!==state.loadGeneration||error.name==='AbortError')return;
    state.loading=false;state.loadFailed=true;$('loading-state').hidden=false;renderLoadState();$('workspace').setAttribute('aria-busy','false');
    setText('live-insight',tr('Analysis unavailable. The recorded author output is required for this sequence.','分析不可用，此片段需要记录的作者模型输出。'));setText('player-status',tr('Data unavailable','数据不可用'));
    setText('load-error',tr('The tracking or author analysis could not be loaded. No replacement values are shown. Reload once the scene files are available.','轨迹或作者模型分析暂时无法载入，界面不会显示替代数值。场景文件就绪后请刷新。')+` (${error.message})`);$('load-error').hidden=false;
  }
}

function statusCopy(value) {
  const reason=String(value.reason||'');
  if(value.status==='carrier')return{label:tr('On the ball','持球中'),text:tr(`${state.selectedId} is carrying the ball. Follow an off-ball teammate to see receiving space.`,`${state.selectedId} 正在持球。选择当前攻方的无球队友，查看接应空间。`),className:'neutral'};
  if(value.status==='defending')return{label:tr('Defending team','当前守方'),text:tr(`${state.selectedId} is defending. This lens measures attacking receiving options.`,`${state.selectedId} 当前属于守方。此视角衡量攻方的直接接应机会。`),className:'neutral'};
  if(value.status==='offside')return{label:tr('Offside position · approximate','越位位置 · 点位近似'),text:tr(`${state.selectedId} is beyond the positional offside line at this frame. Receiving analysis is unavailable.`,`${state.selectedId} 在此帧处于点位近似的越位位置，接应分析不可用。`),className:'unavailable'};
  if(value.status!=='eligible') {
    if(reason.includes('flight'))return{label:tr('Ball in flight','球在飞行'),text:tr('The pass is travelling. The space layer returns when a player controls the ball.','传球正在飞行，球员重新控球后恢复接应空间图层。'),className:'unavailable'};
    if(reason.includes('ground')||reason.includes('height'))return{label:tr('Ball off the ground','非地面球'),text:tr('This model covers ground passing. The space layer is unavailable for this ball state.','该模型适用于地面传球，当前球状态不显示接应空间。'),className:'unavailable'};
    if(reason.includes('dead')||reason.includes('stopped'))return{label:tr('Play stopped','比赛停止'),text:tr('Play has stopped. There is no current receiving-space estimate.','当前比赛已停止，不显示此刻的接应空间估计。'),className:'neutral'};
    if(reason==='awaiting_sample')return{label:tr('Possession changed','持球者已切换'),text:tr('A new player controls the ball. Waiting for the next recorded analysis frame.','新的球员已控制球，等待下一个记录的分析帧。'),className:'neutral'};
    if(reason.includes('loose')||reason.includes('unknown')||reason.includes('possession'))return{label:tr('No controlled possession','未确认控制球'),text:tr('The ball is not under confirmed control. Receiving space is unavailable.','球尚未被明确控制，当前接应空间分析不可用。'),className:'unavailable'};
    return{label:tr('Analysis unavailable','分析不可用'),text:tr('This frame does not meet the model input requirements. No space estimate is shown.','此帧不满足模型输入要求，不显示接应空间估计。'),className:'unavailable'};
  }
  if(value.das<=0)return{label:tr('Off-ball receiving option','无球接应选项'),text:tr(`No dangerous receiving space is resolved for ${state.selectedId} at this model frame.`,`模型在此帧未识别出 ${state.selectedId} 的危险接应空间。`),className:'neutral'};
  if(value.heatmap&&!decodeHeatmap(value.heatmap,state.analysis.heatmapMeta)?.some(cell=>cell>0))return{label:tr('Off-ball receiving option','无球接应选项'),text:tr(`${state.selectedId}'s dangerous receiving space is too faint to resolve at this fixed display scale.`,`${state.selectedId} 的危险接应空间在此固定显示色标下过弱，无法显示。`),className:'neutral'};
  return{label:tr('Off-ball receiving option','无球接应选项'),text:tr(`The highlight shows the dangerous space ${state.selectedId} can receive into now.`,`高亮区域显示 ${state.selectedId} 此刻可接应的危险空间。`),className:''};
}
function ballCopy(ball) { const states={possessed:tr('Controlled ball','受控球'),in_flight:tr('Pass in flight · layer paused','传球飞行 · 图层暂停'),loose:tr('Loose ball · layer paused','失控球 · 图层暂停'),dead:tr('Dead ball · layer paused','死球 · 图层暂停')};return states[ball?.state]??tr('Unknown ball state','球状态未知'); }
function playerRole(player) {
  if(!player)return'—';
  const info=state.scenario.metadata.roles?.[player.id];
  const role=state.language==='zh'?(info?.nameZh??info?.roleZh):(info?.name??info?.role);
  return role || (player.role==='goalkeeper'?tr('Goalkeeper','守门员'):tr(`Team ${player.team} · outfield`,`${player.team} 队 · 场上球员`));
}
function renderFrame(force=false) {
  if(!state.scenario||!state.analysis||state.loading)return;
  const facts=activeFacts(),{analysis,tracking,value,player}=facts;
  if(!analysis||!tracking)return;
  $('timeline').value=state.t;
  $('timeline').setAttribute('aria-valuetext',tr(`${fmt(state.t)} of ${fmt(duration())} seconds`,`${fmt(duration())} 秒中的第 ${fmt(state.t)} 秒`));
  $('clock').replaceChildren(document.createTextNode(`${clockText(state.t)} `),element('span','',`/ ${fmt(duration())} s`));
  $('play').innerHTML=`<span aria-hidden="true">${state.playing?'Ⅱ':'▶'}</span>`;
  $('play').setAttribute('aria-label',state.playing?tr('Pause','暂停'):tr('Play','播放'));
  $('play').setAttribute('aria-pressed',String(state.playing));
  const key=`${tracking.frameId}:${analysis.frameId}:${state.selectedId}:${state.language}:${state.audience}:${state.t>=duration()}`;
  if(force||key!==state.latestRenderKey) {
    state.latestRenderKey=key;
    const status=statusCopy(value);
    setText('player-title',state.selectedId);setText('player-shirt',player?.number??state.selectedId.slice(1));
    $('player-shirt').classList.toggle('defender',player?.team==='B');setText('player-role',playerRole(player));
    setText('player-status',status.label);$('player-status').className=`player-status ${status.className}`;setText('live-insight',status.text);
    setText('metric-as',metricText(value.as));setText('metric-das',metricText(value.das));setText('analysis-time',`${fmt(analysis.t)} s`);setText('frame-id',analysis.frameId);
    setText('model-version',`${state.analysis.model.package??'accessible-space'} ${state.analysis.model.version??'2.1.0'}`);
    setText('analysis-mode',tr(`Precomputed · ${state.analysis.sampleRate} Hz`,`预计算 · ${state.analysis.sampleRate} Hz`));
    setText('data-source',tr('Authored synthetic tracking','独立编排合成轨迹'));setText('config-hash',state.analysis.model.configHash?.slice(0,12)??'—');$('config-hash').title=state.analysis.model.configHash??'';
    setText('model-clock',value.status==='eligible'?tr(`SPACE @ ${fmt(analysis.t)} s`,`空间 @ ${fmt(analysis.t)} 秒`):tr('SPACE PAUSED','空间图层暂停'));
    setText('ball-state',ballCopy(tracking.ball));
    const direction=typeof tracking.attackDirection==='number'?tracking.attackDirection:tracking.attackDirection?.[tracking.attackingTeam];
    $('pitch-direction').replaceChildren(document.createTextNode(tracking.attackingTeam??'—'),element('i','',direction===-1?'←':'→'));
    setText('stage-title',tr('Key movement','关键跑动'));
    setText('curve-player',state.selectedId);
    const meta=state.analysis.heatmapMeta;
    setText('scale-range',`0–${fmt(meta.scaleMax,2)}`);
    const opacityFloor=HEATMAP_OPACITY_FLOOR.toFixed(2),opacityWeight=(1-HEATMAP_OPACITY_FLOOR).toFixed(2);
    $('heatmap-legend').title=tr(`Fixed colour scale 0–${meta.scaleMax}. ${meta.quantity}. For recorded intensity q (0–255), colour follows s=√(q/255); opacity is 0 when q=0, otherwise ${opacityFloor}+${opacityWeight}s, rounded to 8-bit alpha. Same display across every frame, player and scene; not a probability.`,`固定色标 0–${meta.scaleMax}。${meta.quantity}。对记录强度 q（0–255），颜色按 s=√(q/255) 映射；q=0 时完全透明，否则不透明度为 ${opacityFloor}+${opacityWeight}s，并取整为 8 位 alpha。所有帧、球员和场景使用相同映射，不是概率。`);
    renderObservation(tracking);renderHistory();renderReview();drawChart();
  }
  setText('animation-clock',tr(`Animation ${fmt(state.t)} s · analysis ${fmt(analysis.t)} s / ${state.analysis.sampleRate} Hz`,`动画 ${fmt(state.t)} 秒 · 分析 ${fmt(analysis.t)} 秒 / ${state.analysis.sampleRate} Hz`));
  drawPitch(facts);
}

function eventText(event) {
  const player=event.playerId??'—',target=event.targetId??'';
  const copy={pass:tr(`${player} passes${target?' to '+target:''}`,`${player} 传球${target?'给 '+target:''}`),pass_release:tr(`${player} releases the pass`,`${player} 出球`),release:tr(`${player} releases the pass`,`${player} 出球`),reception:tr(`${player} receives the ball`,`${player} 接到球`),receive:tr(`${player} receives the ball`,`${player} 接到球`),shot:tr(`${player} takes a shot`,`${player} 射门`),save:tr(`${player} makes the save`,`${player} 完成扑救`),interception:tr(`${player} intercepts`,`${player} 完成拦截`),carry_start:tr(`${player} carries forward`,`${player} 开始持球推进`)};
  return copy[event.type]??tr(`${player} · ${event.type}`,`${player} · ${event.type}`);
}
function outcomeLabel(moment) {
  const outcome=typeof moment.outcome==='string'?moment.outcome:moment.outcome?.status;
  return {pending:tr('Open','进行中'),passed_to:tr('Pass released','已向其出球'),received:tr('Received','已接到球'),not_selected:tr('Not used','未被利用'),closed:tr('Closed','窗口结束')}[outcome]??(moment.endTime!==undefined?tr('Closed','窗口结束'):tr('Open','进行中'));
}
function renderHistory() {
  const events=visibleEvents(state.scenario,state.t),moments=visibleMoments(state.analysis,state.selectedId,state.t);
  setText('event-count',events.length);setText('moment-count',moments.length);
  const rule=state.analysis.momentDetector??state.analysis.model?.config?.momentDetector;
  setText('moment-rule',state.audience==='analyst'&&rule?tr(`Exploratory rule: DAS ≥ ${rule.openDas} for ${rule.minOpenSeconds} s opens; below ${rule.closeDas} for ${rule.minCloseSeconds} s closes. Not a calibrated quality threshold.`,`探索性规则：DAS ≥ ${rule.openDas} 持续 ${rule.minOpenSeconds} 秒开启；低于 ${rule.closeDas} 持续 ${rule.minCloseSeconds} 秒关闭。这不是经校准的质量标准。`):tr('Exploratory prompts, not a judgment of run quality.','探索性提示，不是对跑动质量的评判。'));
  $('events').replaceChildren();$('moments').replaceChildren();
  if(!events.length)$('events').append(element('p','empty-state',tr('Events appear as the sequence unfolds.','事件会随回放逐步出现。')));
  for(const event of events.slice(-6).reverse()) {
    const button=element('button','event-row');button.dataset.frameId=event.frameId;button.append(element('span','event-time',`${fmt(event.t)} s`),element('span','event-content',eventText(event)),element('span','event-arrow','↶'));button.addEventListener('click',()=>seek(event.t));$('events').append(button);
  }
  if(!moments.length)$('moments').append(element('p','empty-state',tr('Detected windows appear only when the evidence is available.','只有证据已出现，才显示检测到的接应窗口。')));
  for(const moment of moments.slice(-6).reverse()) {
    const time=moment.detectedAtTime??moment.knownAtTime??moment.startTime;
    const button=element('button','moment-row');button.dataset.momentId=moment.id;button.dataset.frameId=moment.detectedAtFrameId??moment.knownAtFrameId??moment.startFrameId;
    const content=element('span','event-content',tr(`${state.selectedId} receiving window`,`${state.selectedId} 的接应窗口`));
    content.append(element('small','',tr(`Detected at ${fmt(time)} s${moment.endTime!==undefined?' · ended '+fmt(moment.endTime)+' s':''}`,`${fmt(time)} 秒检测到${moment.endTime!==undefined?' · '+fmt(moment.endTime)+' 秒结束':''}`)));
    button.append(element('span','event-time',`${fmt(moment.startTime??time)} s`),content,element('span','moment-status',outcomeLabel(moment)));button.addEventListener('click',()=>seek(time));$('moments').append(button);
  }
  const recentEvent=events.filter(event=>event.playerId===state.selectedId||event.targetId===state.selectedId).at(-1);
  const recentMoment=moments.at(-1),momentTime=recentMoment?.knownAtTime??recentMoment?.detectedAtTime??-1;
  if(recentEvent&&recentEvent.t>=momentTime) {state.cueTime=recentEvent.t;setText('cue-text',`${fmt(recentEvent.t)} s · ${eventText(recentEvent)}`);}
  else if(recentMoment) {state.cueTime=recentMoment.detectedAtTime??recentMoment.startTime;setText('cue-text',tr(`A receiving window was detected at ${fmt(state.cueTime)} s. ${outcomeLabel(recentMoment)}.`,`${fmt(state.cueTime)} 秒检测到接应窗口，${outcomeLabel(recentMoment)}。`));}
  else {state.cueTime=null;setText('cue-text',tr('Play the sequence to follow this player’s opportunities.','播放片段，跟随这名球员的接应机会。'));}
  $('cue-jump').hidden=state.cueTime===null;
  $('current-cue').hidden=state.audience==='fan'&&state.cueTime===null;
}

function renderReview() {
  const ended=state.t>=duration()-1e-7;$('review-card').hidden=!ended;if(!ended)return;
  const moments=visibleMoments(state.analysis,state.selectedId,state.t),events=visibleEvents(state.scenario,state.t);
  const receptions=events.filter(event=>['reception','receive'].includes(event.type)&&event.playerId===state.selectedId);
  const used=moments.filter(moment=>['received','passed_to'].includes(moment.outcome?.status)),other=moments.filter(moment=>moment.outcome?.status==='not_selected');
  setText('review-title',tr(`${state.selectedId} · what the sequence showed`,`${state.selectedId} · 这段进攻中的机会`));
  let copy=tr(`${moments.length} receiving window${moments.length===1?'':'s'} detected. ${state.selectedId} received the ball ${receptions.length} time${receptions.length===1?'':'s'}.`, `检测到 ${moments.length} 个接应窗口，${state.selectedId} 在片段中接到球 ${receptions.length} 次。`);
  if(used.length)copy+=' '+tr(`${used.length} window${used.length===1?' was':'s were'} followed by a pass towards this player.`,`${used.length} 个窗口随后有传球传向这名球员。`);
  if(other.length)copy+=' '+tr(`${other.length} window${other.length===1?' ended':'s ended'} without a pass to this player.`,`${other.length} 个窗口结束时未向这名球员传球。`);
  setText('review-copy',copy);$('review-moments').replaceChildren();
  for(const moment of moments.slice(0,6)) {const t=moment.peakTime??moment.detectedAtTime??moment.startTime;const button=element('button','',`${fmt(t)} s · ${outcomeLabel(moment)} ↶`);button.addEventListener('click',()=>seek(t));$('review-moments').append(button);}
  if(!moments.length&&receptions.length)for(const event of receptions){const button=element('button','',`${fmt(event.t)} s · ${tr('Reception','接球')} ↶`);button.addEventListener('click',()=>seek(event.t));$('review-moments').append(button);}
}

function heatmapCanvas(frame, value) {
  if(!value.heatmap)return null;
  const key=`${frame.frameId}:${state.selectedId}`;
  if(state.heatmapCache.has(key))return state.heatmapCache.get(key);
  const meta=state.analysis.heatmapMeta,values=decodeHeatmap(value.heatmap,meta);if(!values)return null;
  const canvas=document.createElement('canvas');canvas.width=meta.width;canvas.height=meta.height;
  const context=canvas.getContext('2d'),pixels=context.createImageData(meta.width,meta.height);
  values.forEach((q,index)=>pixels.data.set(heatmapRgba(q),index*4));
  context.putImageData(pixels,0,0);state.heatmapCache.set(key,canvas);
  if(state.heatmapCache.size>90)state.heatmapCache.delete(state.heatmapCache.keys().next().value);
  return canvas;
}
function drawPitch(facts=activeFacts()) {
  if(state.loading||!state.scenario||!facts.tracking)return;
  const {analysis,tracking,value}=facts,display=interpolatedFrame(state.scenario,state.t);
  const canvas=$('pitch'),ctx=canvas.getContext('2d'),W=canvas.width,H=canvas.height;
  const scale=Math.min((W-116)/105,(H-78)/68),left=(W-105*scale)/2,top=(H-68*scale)/2;
  const x=value=>left+(value+52.5)*scale,y=value=>top+(value+34)*scale;
  const point=player=>[x(player.x),y(player.y)];
  ctx.clearRect(0,0,W,H);ctx.fillStyle='#16382f';ctx.fillRect(0,0,W,H);
  for(let i=0;i<10;i++){ctx.fillStyle=i%2?'#1b4133':'#214638';ctx.fillRect(left+i*10.5*scale,top,10.5*scale,68*scale);}
  const hasHeatmap=$('heatmap').checked&&value.status==='eligible'&&value.heatmap;
  if(hasHeatmap) {
    const heatmap=heatmapCanvas(analysis,value),meta=state.analysis.heatmapMeta;
    if(heatmap){ctx.save();ctx.beginPath();ctx.rect(left,top,105*scale,68*scale);ctx.clip();ctx.imageSmoothingEnabled=true;ctx.drawImage(heatmap,x(meta.xMin),y(meta.yMin),(meta.xMax-meta.xMin)*scale,(meta.yMax-meta.yMin)*scale);ctx.restore();}
  }
  canvas.dataset.analysisFrameId=analysis?.frameId??'';canvas.dataset.heatmapFrameId=hasHeatmap?analysis.frameId:'';canvas.dataset.playerId=state.selectedId;canvas.dataset.playerStatus=value.status;
  ctx.strokeStyle='#d7e4c96b';ctx.lineWidth=1.8;
  const line=(x1,y1,x2,y2)=>{ctx.beginPath();ctx.moveTo(x(x1),y(y1));ctx.lineTo(x(x2),y(y2));ctx.stroke();};
  const rectangle=(x0,y0,width,height)=>ctx.strokeRect(x(x0),y(y0),width*scale,height*scale);
  rectangle(-52.5,-34,105,68);line(0,-34,0,34);ctx.beginPath();ctx.arc(x(0),y(0),9.15*scale,0,Math.PI*2);ctx.stroke();
  ctx.fillStyle='#d7e4c98a';ctx.beginPath();ctx.arc(x(0),y(0),2.5,0,Math.PI*2);ctx.fill();
  for(const side of [-1,1]) {
    rectangle(side===-1?-52.5:36,-20.16,16.5,40.32);rectangle(side===-1?-52.5:47,-9.16,5.5,18.32);
    const penalty=side*41.5;ctx.beginPath();ctx.arc(x(penalty),y(0),2.5,0,Math.PI*2);ctx.fill();
    ctx.beginPath();ctx.arc(x(penalty),y(0),9.15*scale,side===-1?-.925:Math.PI-.925,side===-1?.925:Math.PI+.925);ctx.stroke();
    ctx.strokeStyle='#e6eee29c';rectangle(side===-1?-54.2:52.5,-3.66,1.7,7.32);ctx.strokeStyle='#d7e4c96b';
  }
  const cue=observationCueAtTime(state.scenario,tracking,state.selectedId),cuePlayers=new Set(cue?.focusPlayerIds??[]);
  canvas.dataset.observationCueId=cue?.id??'';canvas.dataset.observationFocusIds=[...cuePlayers].join(',');
  const displayRatio=Math.max(.15,canvas.clientWidth/W),markerRadius=Math.max(17,10.5/displayRatio),numberSize=Math.max(19,11.5/displayRatio);
  // Every highlighted path is recorded history. A cue never draws a future route.
  if($('trail').checked) {
    const trailIds=new Set([...cuePlayers,state.selectedId]);
    for(const id of trailIds) {
      const trail=playerTrail(state.scenario,id,state.t,3),current=display.players.find(player=>player.id===id);
      if(current)trail.push({...current,t:state.t});
      ctx.save();ctx.lineWidth=Math.max(id===state.selectedId?4.8:3.4,(id===state.selectedId?2.3:1.6)/displayRatio);ctx.lineCap='round';
      if(id!==state.selectedId)ctx.setLineDash([6/displayRatio,4/displayRatio]);
      for(let i=1;i<trail.length;i++){ctx.strokeStyle=`rgba(${current?.team==='B'?'255,230,212':'173,225,255'},${.15+.8*i/trail.length})`;ctx.beginPath();ctx.moveTo(...point(trail[i-1]));ctx.lineTo(...point(trail[i]));ctx.stroke();}
      ctx.restore();
    }
  }
  if(value.status==='offside') {
    const modelTracking=state.scenario.frames[analysis.frameIndex]??tracking,direction=typeof modelTracking.attackDirection==='number'?modelTracking.attackDirection:modelTracking.attackDirection?.[modelTracking.attackingTeam];
    const defenders=modelTracking.players.filter(player=>player.team!==modelTracking.attackingTeam).map(player=>player.x*(direction||1)).sort((a,b)=>b-a);
    if(defenders.length>=2){const offside=Math.max(0,modelTracking.ball.x*(direction||1),defenders[1])*(direction||1);ctx.save();ctx.setLineDash([7,7]);ctx.strokeStyle='#e7ae76a3';ctx.lineWidth=2;line(offside,-34,offside,34);ctx.restore();}
  }
  const selectedPlayer=display.players.find(player=>player.id===state.selectedId);
  state.drawnPlayers=[];
  for(const player of [...display.players].sort((a,b)=>Number(a.id===state.selectedId)-Number(b.id===state.selectedId))) {
    const [px,py]=point(player),selected=player.id===state.selectedId,radius=selected?markerRadius+2:markerRadius;
    state.drawnPlayers.push({id:player.id,x:px,y:py,radius});
    ctx.save();ctx.shadowColor='#071d2470';ctx.shadowBlur=8;ctx.shadowOffsetY=2;
    if(selected||cuePlayers.has(player.id)){ctx.beginPath();ctx.arc(px,py,markerRadius+Math.max(9,4.5/displayRatio),0,Math.PI*2);ctx.fillStyle=selected?'#b8e5ff24':'#fff5dd0d';ctx.fill();ctx.shadowBlur=0;ctx.strokeStyle=selected?'#c9eeff':'#fff2d8';ctx.lineWidth=Math.max(2.6,1.7/displayRatio);if(!selected)ctx.setLineDash([4/displayRatio,3/displayRatio]);ctx.stroke();ctx.setLineDash([]);}
    ctx.beginPath();ctx.arc(px,py,radius,0,Math.PI*2);ctx.fillStyle=player.team==='A'?'#fcfeff':'#efac94';
    if(player.role==='goalkeeper')ctx.fillStyle=player.team==='A'?'#d3d0ef':'#f1ca9e';
    ctx.fill();ctx.shadowBlur=0;
    if(player.team==='A'&&player.role!=='goalkeeper') {
      ctx.save();ctx.clip();ctx.fillStyle='#91ceee';
      ctx.fillRect(px-radius*.85,py-radius,radius*.4,radius*2);ctx.fillRect(px+radius*.45,py-radius,radius*.4,radius*2);ctx.restore();
    }
    ctx.strokeStyle='#142b43';ctx.lineWidth=Math.max(2.6,1.4/displayRatio);ctx.stroke();
    ctx.fillStyle='#13273d';ctx.font=`800 ${numberSize}px sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(player.number,px,py+.7);
    if(selected||cuePlayers.has(player.id)||player.id===tracking.carrierId){
      const label=player.id,font=Math.max(15,10.5/displayRatio),lw=font*2.9,lh=font*1.5;
      const above=py-radius-Math.max(10,5/displayRatio)-lh,below=py+radius+Math.max(10,5/displayRatio);
      const others=[...display.players.filter(item=>item.id!==player.id),display.ball].map(point);
      const collisions=ly=>others.filter(([ox,oy])=>ox>px-lw/2-markerRadius&&ox<px+lw/2+markerRadius&&oy>ly-markerRadius&&oy<ly+lh+markerRadius).length;
      const ly=above>top&&collisions(above)<=collisions(below)?above:Math.min(H-lh-3,below);
      ctx.fillStyle=selected?'#c9eeff':'#f5f1e3';ctx.beginPath();ctx.roundRect(px-lw/2,ly,lw,lh,4);ctx.fill();ctx.strokeStyle='#142b43';ctx.lineWidth=1.2/displayRatio;ctx.stroke();ctx.fillStyle='#142b43';ctx.font=`750 ${font}px sans-serif`;ctx.fillText(label,px,ly+lh/2);
    }
    ctx.restore();
  }
  if(selectedPlayer&&hasHeatmap&&state.t-analysis.t>.03) {
    const modelPlayer=state.scenario.frames[analysis.frameIndex]?.players.find(player=>player.id===state.selectedId);
    if(modelPlayer){const[px,py]=point(modelPlayer);ctx.beginPath();ctx.arc(px,py,4,0,Math.PI*2);ctx.strokeStyle='#e3f4beaa';ctx.lineWidth=1.3;ctx.stroke();}
  }
  const[bx,by]=point(display.ball),ballRadius=Math.max(6.2,4.1/displayRatio);ctx.save();ctx.shadowBlur=5;ctx.shadowColor='#0e292d';ctx.beginPath();ctx.arc(bx,by,ballRadius,0,Math.PI*2);ctx.fillStyle='#fffef3';ctx.fill();ctx.strokeStyle='#102334';ctx.lineWidth=Math.max(2,1.2/displayRatio);ctx.stroke();ctx.beginPath();ctx.arc(bx,by,ballRadius*.29,0,Math.PI*2);ctx.fillStyle='#102334';ctx.fill();ctx.restore();
  canvas.setAttribute('aria-label',tr(`Synthetic football replay at ${fmt(state.t)} seconds. Following ${state.selectedId}. ${statusCopy(value).label}. Space and metrics refer to frame ${analysis.frameId} at ${fmt(analysis.t)} seconds.`,`${fmt(state.t)} 秒合成足球回放，当前跟随 ${state.selectedId}。${statusCopy(value).label}。空间与数值对应 ${fmt(analysis.t)} 秒的 ${analysis.frameId} 帧。`));
}

function drawChart() {
  if(!state.analysis||state.audience!=='analyst')return;
  const canvas=$('chart'),ctx=canvas.getContext('2d'),W=canvas.clientWidth,H=canvas.clientHeight,ratio=Math.min(window.devicePixelRatio||1,2),p={left:44,right:14,top:20,bottom:32};
  if(W<=0||H<=0)return;
  canvas.width=Math.round(W*ratio);canvas.height=Math.round(H*ratio);ctx.setTransform(ratio,0,0,ratio,0,0);
  const segments=curveSegments(state.analysis,state.selectedId,state.t),values=segments.flatMap(segment=>segment.map(point=>point.das)),observedMax=Math.max(...values,0);
  const ceiling=observedMax>0?Math.pow(10,Math.floor(Math.log10(observedMax))):1;
  const max=Math.max(.1,Math.ceil(observedMax/ceiling*1.12)*ceiling);
  const x=time=>p.left+time/duration()*(W-p.left-p.right),y=value=>H-p.bottom-value/max*(H-p.top-p.bottom);
  ctx.clearRect(0,0,W,H);ctx.font='12px ui-monospace,SFMono-Regular,monospace';ctx.textBaseline='middle';
  const nowX=x(state.t);ctx.fillStyle='#f8faf5';ctx.fillRect(nowX,p.top,W-p.right-nowX,H-p.top-p.bottom);
  ctx.textAlign='right';
  for(let i=0;i<3;i++){const value=max*i/2;ctx.strokeStyle='#dfe7d6';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(p.left,y(value));ctx.lineTo(W-p.right,y(value));ctx.stroke();ctx.fillStyle='#506747';ctx.fillText(max<1?value.toFixed(2):value<10?value.toFixed(1):value.toFixed(0),p.left-7,y(value));}
  ctx.textAlign='center';for(let i=0;i<=4;i++){const time=duration()*i/4;ctx.fillStyle='#506747';ctx.fillText(`${time.toFixed(0)}s`,x(time),H-11);}
  if(state.t<duration()*.8){ctx.fillStyle='#647a59';ctx.font='12px sans-serif';ctx.fillText(tr('Not played yet','尚未播放'),nowX+(W-p.right-nowX)/2,p.top+15);}
  for(const segment of segments) {
    if(!segment.length)continue;
    if(segment.length>1){ctx.beginPath();ctx.moveTo(x(segment[0].t),y(0));for(const point of segment)ctx.lineTo(x(point.t),y(point.das));ctx.lineTo(x(segment.at(-1).t),y(0));ctx.closePath();const gradient=ctx.createLinearGradient(0,p.top,0,H-p.bottom);gradient.addColorStop(0,'#b4d18e42');gradient.addColorStop(1,'#dcebbd05');ctx.fillStyle=gradient;ctx.fill();}
    ctx.beginPath();segment.forEach((point,index)=>index?ctx.lineTo(x(point.t),y(point.das)):ctx.moveTo(x(point.t),y(point.das)));ctx.strokeStyle='#37674f';ctx.lineWidth=2.4;ctx.lineJoin='round';ctx.stroke();
    if(segment.length===1){ctx.beginPath();ctx.arc(x(segment[0].t),y(segment[0].das),2.4,0,Math.PI*2);ctx.fillStyle='#37674f';ctx.fill();}
  }
  const analysis=analysisAtTime(state.analysis,state.t),current=analysis?.players?.[state.selectedId];
  ctx.beginPath();ctx.moveTo(nowX,p.top);ctx.lineTo(nowX,H-p.bottom);ctx.strokeStyle='#8ca6758a';ctx.lineWidth=1.5;ctx.setLineDash([4,5]);ctx.stroke();ctx.setLineDash([]);
  if(current?.status==='eligible'&&Number.isFinite(current.das)){ctx.beginPath();ctx.arc(x(analysis.t),y(current.das),4,0,Math.PI*2);ctx.fillStyle='#37674f';ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.stroke();}
  canvas.dataset.asOfTime=fmt(state.t,3);canvas.dataset.playerId=state.selectedId;
  canvas.setAttribute('aria-label',tr(`${state.selectedId} dangerous accessible space, danger-weighted square metres, through ${fmt(state.t)} seconds. ${segments.length} continuous segments. Future values are hidden.`,`${state.selectedId} 的危险可达空间，单位为危险度加权平方米，显示至 ${fmt(state.t)} 秒，共 ${segments.length} 个连续区段，未来数值已隐藏。`));
}

function seek(time) {
  if(!state.scenario)return;
  state.playing=false;state.t=Math.max(0,Math.min(duration(),Number(time)||0));invalidateAnswer();renderFrame(true);
}
function selectPlayer(playerId) {
  if(!state.scenario?.frames[0].players.some(player=>player.id===playerId)||playerId===state.selectedId)return;
  state.selectedId=playerId;$('player-select').value=playerId;invalidateAnswer();renderFrame(true);
}
function togglePlayback() {
  if(!state.scenario||state.loading)return;
  if(state.t>=duration()){state.t=0;invalidateAnswer();}
  state.playing=!state.playing;
  if(state.playing)invalidateAnswer();
  renderFrame(true);
}
async function ask(question) {
  if(!state.scenario||state.loading)return;
  question=question.trim()||tr('Explain this moment.','解释这一刻。');
  // A response has a fixed evidence time. Pause at the current model frame before requesting it.
  const frame=analysisAtTime(state.analysis,state.t);if(!frame)return;
  state.playing=false;state.t=frame.t;invalidateAnswer();renderFrame(true);
  const generation=state.generation,controller=new AbortController();state.requestController=controller;
  const request={scenarioId:state.sceneId,playerId:state.selectedId,asOfTime:frame.t,windowSeconds:6,question,audience:state.audience,language:state.language};
  $('ask').disabled=true;$('answer').replaceChildren(element('p','answer-placeholder',tr('Reading the play so far and its evidence…','正在读取截至此刻的比赛与证据……')));
  try {
    let answer;
    if(state.server) {
      try {
        const timeout=setTimeout(()=>controller.abort(),45000);
        try { const response=await fetch('./api/explain',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(request),signal:controller.signal});if(!response.ok)throw new Error(`Explanation unavailable (${response.status})`);answer=await response.json(); }
        finally {clearTimeout(timeout);}
      } catch(error) { if(generation!==state.generation)return;answer=offlineExplain(request,{scenario:state.scenario,analysis:state.analysis});answer.status='browser-fallback'; }
    } else answer=offlineExplain(request,{scenario:state.scenario,analysis:state.analysis});
    if(generation!==state.generation)return;
    state.answer=answer;renderAnswer(answer,request);
  } catch(error) {
    if(generation!==state.generation)return;
    $('answer').replaceChildren(element('p','answer-placeholder',tr('An explanation could not be produced. The recorded replay and analysis remain available.','暂时无法生成解释，记录的回放与分析仍可使用。')));
    renderSource();
  } finally {if(generation===state.generation){$('ask').disabled=false;state.requestController=null;}}
}
function renderAnswer(answer,request) {
  $('answer').replaceChildren();
  const context=answer.context??{},end=context.endTime??request.asOfTime,start=context.startTime??Math.max(0,end-request.windowSeconds),cutoff=context.asOfTime??request.asOfTime;
  $('answer').append(element('p','answer-context',`${state.selectedId} · ${tr('Analyzed','分析时段')} ${fmt(start)}–${fmt(end)} s · ${tr('Replay cutoff','回放截至')} ${fmt(cutoff)} s · ${context.analysisFrameId??''}`));
  for(const paragraph of String(answer.text??'').split(/\n\n+/).filter(Boolean))$('answer').append(element('p','',paragraph));
  $('evidence-buttons').replaceChildren();
  for(const evidence of answer.evidence??[]) {
    const time=evidence.t??evidence.time;
    if(!Number.isFinite(time)||time>request.asOfTime+1e-7)continue;
    const button=element('button','',`${evidence.playerId??state.selectedId} · ${fmt(time)} s ↶`);button.dataset.frameId=evidence.frameId??'';button.title=evidence.frameId??'';button.addEventListener('click',()=>seek(time));$('evidence-buttons').append(button);
  }
  const activityLabels={agent_run:tr('Analysis Agent','分析 Agent'),model_request:tr('Model request','模型请求'),candidate:tr('Evidence plan','证据计划'),validation:tr('Application evidence check','应用证据校验')};
  const activityStatus={completed:tr('completed','完成'),submitted:tr('submitted','已提交'),accepted:tr('accepted','通过'),rejected:tr('rejected','未通过')};
  const agentEvents=(answer.agentTrace??[])
    .filter(item=>activityLabels[item.event]&&item.status!=='started')
    .map(item=>activityLabels[item.event]+(item.modelRequest?' '+item.modelRequest:'')+' · '+(activityStatus[item.status]??String(item.status)));
  const toolEvents=(answer.toolTrace??[]).map(item=>String(item.source??'local')+' → '+String(item.name??item.tool??'evidence')+' · '+String(item.status??'complete'));
  setText('tool-trace',[...agentEvents,...toolEvents].join('\n'));
  renderSource(answer);
  applyOverlay(answer.overlay);
}

function applyOverlay(spec) {
  if(!spec||!['receiving_heatmap','player_trail','das_curve','event','none'].includes(spec.type))return;
  if(spec.type==='none')return;
  const frame=analysisAtTime(state.analysis,state.t);
  if(!spec.playerIds?.includes(state.selectedId))return;
  const evidenceFrame=state.scenario.frames.find(item=>item.frameId===spec.frameId);
  if(!evidenceFrame||evidenceFrame.t>state.t+1e-7)return;
  const displayedFrameId=spec.type==='event'?trackingAtTime(state.scenario,state.t)?.frameId:frame?.frameId;
  if(spec.frameId!==displayedFrameId){
    const button=element('button','overlay-revisit',tr(`View ${spec.type==='receiving_heatmap'?'heatmap':'evidence'} at ${fmt(evidenceFrame.t)} s ↶`,`查看 ${fmt(evidenceFrame.t)} 秒${spec.type==='receiving_heatmap'?'热图':'证据'} ↶`));
    button.dataset.frameId=spec.frameId;
    button.addEventListener('click',()=>{seek(evidenceFrame.t);applyOverlay(spec);});
    $('evidence-buttons').prepend(button);
    return;
  }
  if(spec.type==='receiving_heatmap')$('heatmap').checked=true;
  if(spec.type==='player_trail')$('trail').checked=true;
  $('pitch').dataset.explanationOverlay=spec.type;
  if(state.audience==='fan'&&['das_curve','event'].includes(spec.type)) {
    const button=element('button','overlay-revisit',spec.type==='das_curve'?tr('Inspect this curve in Analyst ↗','在分析师视图查看曲线 ↗'):tr('Inspect this event in Analyst ↗','在分析师视图查看事件 ↗'));
    button.dataset.frameId=spec.frameId;
    button.addEventListener('click',()=>{$('analyst').click();applyOverlay(spec);(spec.type==='das_curve'?$('chart'):$('events')).scrollIntoView({block:'nearest'});});
    $('evidence-buttons').prepend(button);
    return;
  }
  const target=spec.type==='das_curve'?$('chart'):spec.type==='event'?$('events'):$('pitch-wrap');
  target.classList.remove('evidence-highlight');void target.offsetWidth;target.classList.add('evidence-highlight');
  drawPitch();
}

function exportEvidence() {
  if(!state.scenario||!state.analysis)return;
  const facts=activeFacts();
  const report={schemaVersion:'2.0',exportedAt:new Date().toISOString(),scenarioId:state.sceneId,synthetic:true,source:{inputFileHash:state.analysis.inputFileHash,inputHash:state.analysis.inputHash,generatorVersion:state.scenario.metadata.generatorVersion,seed:state.scenario.metadata.seed},playerId:state.selectedId,asOfTime:state.t,analysisFrame:facts.analysis,displayedPlayer:facts.value,model:state.analysis.model,heatmapMeta:state.analysis.heatmapMeta,heatmapDisplayTransfer:`Fixed sequential colour palette at s=sqrt(q/255), where q is the recorded uint8 intensity. RGBA alpha=0 for q=0; otherwise alpha=round(255*(${HEATMAP_OPACITY_FLOOR.toFixed(2)}+${(1-HEATMAP_OPACITY_FLOOR).toFixed(2)}*s)). Identical across frames, players and scenes; no frame-wise rescaling.`,moments:visibleMoments(state.analysis,state.selectedId,state.t),events:visibleEvents(state.scenario,state.t),curves:curveSegments(state.analysis,state.selectedId,state.t),explanation:state.answer,limitations:['Direct receiving space, not causal contribution.','DAS is danger-weighted area, not a probability.','All facts are limited to the selected playback time.']};
  const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));const anchor=element('a');anchor.href=url;anchor.download=`off-ball-lens-${state.sceneId}-${state.selectedId}-${fmt(state.t)}s.json`;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

for(const button of document.querySelectorAll('[data-scene]'))button.addEventListener('click',()=>loadScene(button.dataset.scene));
$('language').addEventListener('click',()=>{state.language=state.language==='en'?'zh':'en';invalidateAnswer();renderLanguage();});
for(const mode of ['fan','analyst'])$(mode).addEventListener('click',()=>{if(state.audience===mode)return;state.audience=mode;invalidateAnswer();renderLanguage();});
$('play').addEventListener('click',togglePlayback);$('restart').addEventListener('click',()=>seek(0));$('replay-scene').addEventListener('click',()=>{seek(0);togglePlayback();});
$('timeline').addEventListener('input',event=>seek(Number(event.target.value)));$('speed').addEventListener('change',event=>state.speed=Number(event.target.value));
$('player-select').addEventListener('change',event=>selectPlayer(event.target.value));
$('heatmap').addEventListener('change',()=>drawPitch());$('trail').addEventListener('change',()=>{if(state.scenario)renderObservation(trackingAtTime(state.scenario,state.t));drawPitch();});
$('cue-jump').addEventListener('click',()=>{if(state.cueTime!==null)seek(state.cueTime);});
$('pitch').addEventListener('click',event=>{const box=$('pitch').getBoundingClientRect(),px=(event.clientX-box.left)/box.width*$('pitch').width,py=(event.clientY-box.top)/box.height*$('pitch').height;const nearest=state.drawnPlayers.map(player=>({...player,distance:Math.hypot(player.x-px,player.y-py)})).sort((a,b)=>a.distance-b.distance)[0];if(nearest&&nearest.distance<Math.max(32,nearest.radius+10))selectPlayer(nearest.id);});
$('chart').addEventListener('click',event=>{const box=$('chart').getBoundingClientRect(),px=event.clientX-box.left,time=(px-44)/(box.width-58)*duration();if(time>state.t+.1){toast(tr('Play the sequence to reveal later evidence.','继续播放片段，后续证据才会出现。'));return;}seek(Math.max(0,Math.floor(time*5)/5));});
$('question-form').addEventListener('submit',event=>{event.preventDefault();ask($('question').value);});
for(const button of document.querySelectorAll('[data-q]'))button.addEventListener('click',()=>{$('question').value=button.textContent;ask(button.textContent);});
$('export').addEventListener('click',exportEvidence);
document.addEventListener('keydown',event=>{if(['INPUT','TEXTAREA','SELECT','BUTTON'].includes(event.target.tagName))return;if(event.code==='Space'){event.preventDefault();togglePlayback();}if(event.code==='ArrowRight'){event.preventDefault();seek(state.t+.2);}if(event.code==='ArrowLeft'){event.preventDefault();seek(state.t-.2);}});
new ResizeObserver(()=>{if(!state.loading){drawPitch();drawChart();}}).observe($('workspace'));
renderHeatmapLegend();renderLanguage();loadScene('used');
fetch('./api/health').then(response=>response.ok?response.json():null).then(result=>{if(result?.ok){state.server=true;state.cloudConfigured=Boolean(result.cloud?.configured);state.orchestrator=result.orchestrator??null;renderSource(state.answer);}}).catch(()=>{});
let previous=0;
function tick(now){const elapsed=Math.min(.1,(now-previous)/1000||0);previous=now;if(state.playing&&!state.loading){state.t=Math.min(duration(),state.t+elapsed*state.speed);if(state.t>=duration())state.playing=false;renderFrame();}requestAnimationFrame(tick);}
requestAnimationFrame(tick);
