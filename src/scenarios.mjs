/**
 * Independently authored, full-team synthetic football scenes.
 * Tactical boards and observed possession drive this generator. It does not import
 * an opportunity model, a score, match data, or unlicensed reference code.
 */
export const PITCH = Object.freeze({ length: 105, width: 68, originX: -52.5, originY: -34 });
export const MOTION_LIMITS = Object.freeze({ maxSpeed: 7.6, maxAcceleration: 3.2, goalkeeperMaxSpeed: 4.5 });
export const GENERATOR_VERSION = 'tactical-state-v3.0.0';
// Authored ranges by action purpose, not measured professional-football norms.
// Actual speed is distance / flight time and is reported by the independent audit.
export const BALL_FLIGHT_PROFILES = Object.freeze({
  firm_pass: Object.freeze({minimumSpeed:12,maximumSpeed:22}),
  short_combination: Object.freeze({minimumSpeed:9,maximumSpeed:18}),
  switch: Object.freeze({minimumSpeed:14,maximumSpeed:24}),
  shot: Object.freeze({minimumSpeed:18,maximumSpeed:28})
});
const DT = 0.1;
const IDS = ['A', 'B'].flatMap(team => Array.from({length: 11}, (_, i) => `${team}${i + 1}`));
const clone = value => JSON.parse(JSON.stringify(value));
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const point = ([x, y]) => ({x, y});

export const SCENARIOS = Object.freeze([
  { id: 'used', title: 'Right-side combination', titleZh: '右侧配合', subtitle: 'Follow the near-side run through a moving defensive block.', subtitleZh: '跟随近侧跑动，观察移动中的防守阵形。', duration: 32, sampleRate: 10, targetId: 'A7' },
  { id: 'unused', title: 'Switch across the block', titleZh: '横向转移', subtitle: 'Watch two receiving options develop around the ball.', subtitleZh: '观察持球者周围的两种接应选择。', duration: 34, sampleRate: 10, targetId: 'A7' },
  { id: 'blocked', title: 'Run beyond the line', titleZh: '冲击防线', subtitle: 'Follow the runner, the passing lane, and the recovering defenders.', subtitleZh: '同时跟随跑动者、传球线路和回收的防守者。', duration: 30, sampleRate: 10, targetId: 'A7' }
]);
export const listScenarios = () => SCENARIOS.map(s => ({ ...s }));

const ROLES = {
  A1: ['goalkeeper', 'Goalkeeper', '门将', 'Move behind the rest defence and offer a safe reset.'],
  A2: ['right_back', 'Near-side full-back', '近侧边后卫', 'Support outside the ball, then overlap or recover behind the winger.'],
  A3: ['right_centre_back', 'Near-side centre-back', '近侧中卫', 'Start circulation and advance the rest defence after release.'],
  A4: ['left_centre_back', 'Far-side centre-back', '远侧中卫', 'Keep the central safety line and balance the ball-side centre-back.'],
  A5: ['left_back', 'Far-side full-back', '远侧边后卫', 'Provide a weak-side outlet while retaining recovery depth.'],
  A6: ['holding_midfielder', 'Holding midfielder', '后腰', 'Receive from defence, carry, and remain available behind the attack.'],
  A7: ['right_winger', 'Near-side winger', '近侧边锋', 'Adjust width and timing to offer a direct receiving route.'],
  A8: ['left_midfielder', 'Far-side midfielder', '远侧中场', 'Offer a second passing angle and support switches of play.'],
  A9: ['centre_forward', 'Centre-forward', '中锋', 'Occupy the centre-backs, check to the ball, and attack the next line.'],
  A10: ['attacking_midfielder', 'Attacking midfielder', '前腰', 'Provide a third-player option between the lines.'],
  A11: ['left_winger', 'Far-side winger', '远侧边锋', 'Hold useful width, then arrive as the ball crosses the pitch.'],
  B1: ['goalkeeper', 'Defending goalkeeper', '防守门将', 'Adjust the set position to the ball angle and depth.'],
  B2: ['left_back', 'Near-side full-back', '近侧边后卫', 'Manage the winger and overlapping full-back without abandoning the line.'],
  B3: ['left_centre_back', 'Near-side centre-back', '近侧中卫', 'Cover behind the full-back and track the centre-forward.'],
  B4: ['right_centre_back', 'Far-side centre-back', '远侧中卫', 'Protect the centre and hand over runners across the line.'],
  B5: ['right_back', 'Far-side full-back', '远侧边后卫', 'Narrow toward the ball, then engage a switch to the far winger.'],
  B6: ['holding_midfielder', 'Near-side holding midfielder', '近侧后腰', 'Press the carrier or screen the direct pass into the front line.'],
  B7: ['left_midfielder', 'Near-side wide midfielder', '近侧边中场', 'Recover with the overlapping full-back and close the outside route.'],
  B8: ['central_midfielder', 'Far-side central midfielder', '远侧中场', 'Cover the pressing midfielder and contest the second option.'],
  B9: ['centre_forward', 'First-line presser', '第一线压迫者', 'Press circulation, then recover into the central return lane.'],
  B10: ['second_forward', 'Second-line presser', '第二线压迫者', 'Screen the pivot and recover as the ball goes beyond the first line.'],
  B11: ['right_midfielder', 'Far-side wide midfielder', '远侧边中场', 'Track the weak-side outlet and narrow with the defensive block.']
};

const ROLE_ACTIONS = {
  used: {
    A1:'Follow A3 from the goal area|Advance behind the two centre-backs|Keep central reset depth|Shift behind the right-side attack|Hold the central safety position|Adjust toward the switched ball|Hold depth, then settle after the save',
    A2:'Open the right-side outlet|Accelerate outside A7|Continue the outside overlap|Support beneath A7 after his reception|Remain outside the central combination|Advance as the ball moves away|Recover several steps after the save',
    A3:'Carry and release under an angled press|Advance after finding the pivot|Maintain the near-side rest-defence line|Follow the attack without joining the box|Stay beneath A6 as a reset|Move centrally beneath the switch|Retreat after the goalkeeper gathers',
    A4:'Balance A3 from the central safety lane|Advance while remaining behind A6|Narrow beneath the developing attack|Keep cover behind the near-side centre-back|Move up with the safety line|Hold central protection as A5 advances|Retreat after possession changes',
    A5:'Move forward as the weak-side outlet|Narrow to support circulation|Keep a deeper far-side receiving angle|Advance without duplicating A11 width|Move outside as the ball approaches A10|Support A11 from below the ball|Recover when the shot is saved',
    A6:'Check toward A3 for the first pass|Receive and carry toward B6|Release into A7’s inside run|Follow the ball as the return option|Offer a deeper reset behind A9|Move centrally underneath the switch|Hold recovery depth and step back',
    A7:'Advance outside the near-side full-back|Approach B2, check toward A6, then curve inside at reduced speed|Accelerate out of the hook toward A6’s release|Carry inside and pass to A9|Continue across the defensive line as support|Retain an inside option as the ball switches|Slow and recover after the save',
    A8:'Present a second midfield angle|Advance on the far side of A6|Move centrally below A10|Provide an unselected central support option|Remain under the third-player combination|Advance beneath A11 for a cutback|Recover centrally after the save',
    A9:'Occupy the central defensive pair|Adjust between the centre-backs|Keep a central receiving angle for A7|Check toward the passing lane and receive|Lay the ball off to A10|Move into the central finishing channel|Arrive centrally, then retreat after the save',
    A10:'Check between the midfield and back line|Advance as A6 attracts the pivot|Offer the second route inside A7|Move underneath A9 for the layoff|Receive the short connection from A9|Carry and switch the ball toward A11|Follow the shot at recovery speed',
    A11:'Keep far-side width|Advance while the ball remains opposite|Maintain the far-side outlet|Move forward as the near-side attack develops|Prepare to receive the cross-field switch|Receive outside the narrowing back line|Carry inside, shoot low, then recover',
    B1:'Adjust to A3’s ball angle|Move toward the near-side ball line|Set for the channel pass|Adjust behind the full-back and centre-back|Return toward the central passing angle|Shift across as the ball switches|Set on the near-side shot line, gather, then settle centrally',
    B2:'Retain depth behind the first press|Follow A7’s checking movement while staying goal-side|Turn inward after A7 changes direction|Close A7 after he controls the ball|Recover inside after the central pass|Narrow while the ball travels away|Open slightly as a goalkeeper outlet',
    B3:'Cover inside the near-side full-back|Stay goal-side of the striker|Protect the channel behind B2|Track A9 while B2 closes the ball|Cover behind the striker’s layoff|Retain central depth beneath the switch|Hold the middle, then offer a short outlet',
    B4:'Maintain the far-side central cover|Move with B3 as the ball advances|Narrow around the centre-forward|Hold the central lane opposite B3|Follow the third-player combination|Protect the central shot lane|Remain inside the shot route, then reset',
    B5:'Narrow from the far touchline|Compress the weak side of the block|Move inside while retaining recovery width|Stay connected to the centre-backs|Prepare to engage the far-side switch|Move outward to the receiving winger|Close A11, then widen after the save',
    B6:'Screen the pass beyond A6|Step out to pressure A6’s carry|Recover toward the inside route after release|Move behind B2 to cover the channel|Recover underneath the central combination|Protect the lane below A10|Return centrally after the save',
    B7:'Recover toward the advancing full-back|Follow A2’s outside movement|Track the overlap behind B2|Remain with the full-back beneath A7|Recover into the wide passing lane|Narrow as the ball leaves the near side|Hold an outlet position after the save',
    B8:'Balance the midfield screen|Move toward the ball-side interior|Protect the alternative route through A10|Follow the central receiving movement|Keep cover beyond A9’s layoff|Press A10 from the inside before the switch|Recover toward the far-side second ball',
    B9:'Curve toward A3 to pressure circulation|Recover centrally after the pass bypasses him|Close the return lane to A6|Follow the attack from behind the ball|Move toward the central reset route|Recover through the centre|Turn into a counterattack outlet after the save',
    B10:'Screen A6 while A3 carries|Recover inside the progressing pivot|Track the central support below A7|Close the route back through A6|Follow the supporting midfielders|Recover beneath the far-side combination|Offer a central outlet after the save',
    B11:'Recover toward the far-side winger|Narrow while tracking A11’s progress|Hold the weak-side recovery lane|Move back with the far-side option|Keep contact as the ball approaches A10|Recover outside B8 toward A11|Follow A11 inside, then reset'
  },
  unused: {
    A1:'Follow the left centre-back’s advance|Stay behind the advancing safety line|Hold a central reset position|Shift with the ball’s far-side angle|Keep depth beneath the overlapping full-back|Move centrally as possession recycles|Settle after the goalkeeper gathers',
    A2:'Offer the opposite-side outlet|Advance while preserving defensive depth|Remain below A7’s inside run|Narrow as the ball stays on the far side|Maintain balance opposite A5’s overlap|Move up with the centre-backs|Recover after the shot is saved',
    A3:'Balance A4’s initial carry|Advance behind the central pivot|Keep the near-side recovery lane|Follow the ball without joining the forward line|Stay beneath the opposite full-back|Advance beneath the recycled possession|Retreat after the save',
    A4:'Carry and release toward A8|Follow the pass into the safety line|Advance beneath the selected inside route|Support the far-side attack from depth|Keep cover behind the overlapping full-back|Advance as A8 receives the return pass|Retreat after the save',
    A5:'Start outside the initial carrier|Advance along the far touchline|Accelerate beyond A8’s outside shoulder|Continue outside A11 toward an overlap|Receive outside the winger and advance|Return the ball underneath to A8|Maintain width, then recover after the save',
    A6:'Show a central alternative to A8|Follow the ball as a safe return|Stay below A10 and A7’s receiving routes|Advance beneath the chosen wide attack|Remain central while A5 goes beyond the ball|Support the recycle from A5 to A8|Hold the safety position below the striker',
    A7:'Hold width on the opposite flank|Start an inside run behind midfield|Continue as A10 receives the selected pass|Run beyond the ball without receiving|Check back toward width as the block recovers|Offer the opposite-side switch again|Move inside, then recover after the save',
    A8:'Check toward A4 and receive|Carry toward the pressing B8|Release to A10 instead of A7|Follow the selected wide attack|Move beneath A5’s outside route|Receive the return pass below the winger|Find A9 for the next forward action',
    A9:'Occupy the two central defenders|Move along the central line|Keep the centre-backs occupied during A7’s run|Offer a central target while play goes wide|Adjust toward the positive-y side of the box|Check toward the recycled ball|Receive, carry and shoot low before the save',
    A10:'Show between the two midfield lines|Check inside A8’s carry|Receive the selected central pass|Carry toward the wide option and release A11|Support underneath the full-back combination|Remain available beside A8|Offer a second option behind the striker',
    A11:'Keep the far-side width|Move forward above A8|Retain the wide passing route|Receive from A10 near the touchline|Pass outside to the advancing A5|Move inside as A5 recycles underneath|Hold an inside support position then recover',
    B1:'Adjust toward the left-side build-up|Set toward A8’s carrying angle|Return toward A10’s central position|Shift to the incoming wide pass|Protect the near post during the overlap|Reset centrally as the ball returns inside|Gather the striker’s low shot',
    B2:'Keep goal-side depth against A7|Follow the start of A7’s inside run|Track the runner without following beyond the line|Retain contact while the pass goes elsewhere|Recover wider as A7 checks back|Maintain the far-side defensive outlet|Open toward the touchline after the save',
    B3:'Hold the near-side central cover|Remain goal-side of A9|Cover the space inside A7’s run|Protect the middle as the ball goes wide|Stay connected to the other centre-back|Follow the striker’s checking movement|Hold beside the shot lane then reset',
    B4:'Balance the back line above A4|Move centrally as A8 advances|Cover behind the selected inside link|Narrow inside the defending full-back|Protect the central lane during the overlap|Follow the recycled central possession|Hold the middle as the keeper gathers',
    B5:'Retain width behind the midfield press|Narrow toward A8’s route|Prepare for a pass to A11|Close A11 after the wide reception|Manage A11 while A5 overlaps outside|Recover toward the full-back’s outside lane|Return inside and widen after the save',
    B6:'Screen the central route beyond A6|Move across behind B8’s press|Protect A9’s lane as A10 receives|Stay inside the far-side defending pair|Hold the central cutback route|Move under the returning ball|Close central space as A9 receives',
    B7:'Recover toward the opposite full-back|Keep the far-side edge of the block|Follow A2 while A7 runs inside|Narrow away from the ball|Hold recovery width opposite the overlap|Follow A2 up the pitch|Retain a counterattack outlet after the save',
    B8:'Step toward A8’s first reception|Press A8’s advance from goal-side|Recover as the pass finds A10|Close A10 from the inside before release|Cover underneath B5’s wide challenge|Step toward A8 as the ball recycles|Pressure the return passer before the shot',
    B9:'Curve toward A4’s inside shoulder|Recover after A4 bypasses the press|Follow into the central return lane|Recover behind the developing attack|Move centrally below the wide combination|Close the route toward the centre-backs|Turn into an outlet after the goalkeeper save',
    B10:'Screen A6 while A4 carries|Recover toward the selected midfield route|Follow the support below A10|Protect the return lane through A6|Recover toward the second central option|Follow the recycled midfield possession|Move into a central outlet position',
    B11:'Recover on the ball-side flank|Move back as A5 advances outside|Stay connected to B5 above the winger|Recover toward A11 instead of matching the full-back|Follow A11 inside while A5 receives outside|Track the winger’s inward movement|Retain central contact before the save'
  },
  blocked: {
    A1:'Follow the initial centre-back carry|Advance behind the safety line|Shift toward the cross-field option|Keep a central reset position|Hold depth as the central pass is contested|Retreat behind the counter-press|Set deeper behind the recovering centre-backs',
    A2:'Open the right-side outlet|Advance outside the sprinting winger|Keep width below A7’s advanced position|Offer a safe pass as A7 bends back|Begin recovering when the pass is intercepted|Retreat toward the counterattack channel|Delay B7 from the goal-side lane',
    A3:'Carry and find A6 against pressure|Advance after the first pass|Keep central cover beneath the early run|Follow the attack at safety depth|Turn backward after the interception|Retreat inside the near-side full-back|Keep the central recovery line',
    A4:'Balance A3’s initial progression|Advance in parallel behind the pivot|Hold opposite-side central cover|Remain beneath the midfield support|Turn toward the own goal after the loss|Retreat with the other centre-back|Narrow behind the delaying full-back',
    A5:'Move up as the far-side outlet|Keep useful width opposite A7|Advance while A6 looks across the pitch|Support A8 from outside|Narrow after the central turnover|Recover toward the middle of the pitch|Continue retreating behind the midfield',
    A6:'Check toward A3 and receive|Carry into B6’s pressure|Pass across to A8 as A7 runs beyond the line|Follow the selected route into midfield|Move toward the intercepted ball|Counter-press B6 before the wide release|Recover centrally after B7 receives',
    A7:'Hold a starting lane outside the block|Accelerate diagonally toward the back line|Continue beyond the second-last defender|Bend backward to recover an onside position|Check wide as the central route is contested|Recover rapidly toward the counterattack side|Track back behind the delaying full-back',
    A8:'Present a second midfield angle|Advance on the far side of the pivot|Receive the cross-field choice from A6|Carry and release toward A10|Support behind the contested central pass|Turn and recover after the interception|Continue retreating through central midfield',
    A9:'Occupy the centre-backs|Adjust along the defensive line|Hold a central option below A7|Remain available in front of the centre-backs|Check toward A10 but the pass is intercepted|Turn back as the counterattack develops|Recover below the advancing B midfielders',
    A10:'Show between midfield and defence|Advance beneath the sprinting winger|Move into A8’s forward passing angle|Receive the selected central pass|Attempt the forward pass that B6 intercepts|Turn and recover after losing the passing route|Retreat toward the ball-side interior',
    A11:'Keep the far-side width|Move forward opposite the sprint|Stay outside for a cross-field alternative|Advance while A8 uses the inside route|Narrow as A10 attempts the central pass|Recover toward the middle after the loss|Retreat while keeping an outside counter-press angle',
    B1:'Set behind the initial defensive block|Move with A6’s ball angle|Hold depth while A7 runs beyond the line|Adjust toward the selected inside passes|Remain ready behind the interception|Advance slightly behind the counterattack|Follow the team out of the defending third',
    B2:'Hold depth above the wide midfielder|Protect the line as A7 accelerates|Stay with the line instead of chasing the offside run|Follow A7 only after he bends back|Recover inside as the central pass is contested|Move forward behind B7’s breakout|Support the counterattack from the outside lane',
    B3:'Cover the near-side channel|Hold the central line behind B6|Stay goal-side of A9 while A7 runs beyond|Protect the lane to the striker|Hold behind B6’s interception|Advance behind the secured ball|Follow the counterattack at safety depth',
    B4:'Balance the centre-back line|Remain connected as the wide runner sprints|Maintain depth beside B3|Protect the central space behind B8|Hold the centre during the interception|Step forward with the far-side cover|Keep a central safety position for the counterattack',
    B5:'Narrow from the far touchline|Compress the weak side of the block|Shift toward the pass to A8|Retain cover outside B8|Prepare to advance after possession changes|Move up beneath the counterattack|Support centrally behind the advancing winger',
    B6:'Screen A6 from midfield|Press the carrier while blocking the forward lane|Recover across as A6 releases to A8|Drop into the route between A10 and A9|Intercept the attempted central pass and turn|Carry away from A6 and release B7|Follow the wide counterattack as inside support',
    B7:'Recover with A2’s early advance|Track the outside support behind A7|Hold the touchline route below the back line|Remain available wide of the central contest|Turn toward the attacking half after the interception|Receive B6’s pass in the wide channel|Carry forward with A2 delaying from goal-side',
    B8:'Balance the central screen|Move across behind B6’s pressure|Close A8 when the cross-field pass arrives|Follow the carry and cover the A10 route|Stay near the interception without claiming the ball|Advance inside the recovering A midfield|Support the counterattack through the central lane',
    B9:'Curve into A3’s build-up press|Recover after A3 finds the pivot|Hold the return lane beneath A6|Follow the attack from behind the midfield|Turn forward once B6 intercepts|Accelerate inside the wide breakout|Offer an advanced central counterattack option',
    B10:'Screen the pivot during build-up|Recover through the central support lane|Close the return angle from A8|Follow the selected inside combination|Turn toward the attacking half after the loss|Advance between B6 and the first forward|Provide the second central option for B7',
    B11:'Recover with the far-side winger|Narrow while the ball stays opposite|Move toward the cross-field passing side|Track A11 beneath the far-side attack|Turn inward after the interception|Advance through the far-side interior|Offer width beyond the counterattack support'
  }
};
for (const scene of Object.values(ROLE_ACTIONS)) for (const id of IDS) scene[id] = scene[id].split('|');

// Eight boards delimit seven phases. Each row is a complete tactical route for one
// player; remote players have deliberately smaller, role-dependent displacements.
const USED_PATHS = {
  A1:[[-46,0],[-45,-1],[-43,-2],[-42,-2],[-41,-1],[-40,0],[-40,1],[-41,1]],
  A2:[[-23,-26],[-17,-27],[-5,-29],[8,-29],[20,-26],[24,-24],[27,-22],[28,-19]],
  A3:[[-28,-8],[-23,-9],[-16,-10],[-9,-11],[-2,-10],[3,-8],[6,-6],[7,-5]],
  A4:[[-29,10],[-25,8],[-18,7],[-11,6],[-5,7],[0,7],[4,8],[6,9]],
  A5:[[-22,27],[-18,25],[-12,23],[-5,21],[1,21],[7,24],[13,25],[17,24]],
  A6:[[-8,-6],[-7,-9],[4,-12],[11,-11],[17,-8],[21,-5],[24,-2],[26,0]],
  A7:[[12,-25],[18,-25],[16.2,-23.3],[25,-16.5],[31,-14],[34,-10],[36,-7],[38,-8]],
  A8:[[-5,13],[-1,12],[5,10],[11,8],[17,9],[22,11],[26,13],[28,11]],
  A9:[[17,1],[20,0],[23,-1],[26,-1],[30,0],[33,1],[37,2],[41,3]],
  A10:[[3,6],[7,5],[12,3],[18,3],[24,5],[28,5],[32,6],[36,7]],
  A11:[[10,27],[13,26],[17,25],[20,24],[23,25],[27,24],[31,20],[37,14]],
  B1:[[48,0],[48,-1],[47,-2],[47,-3],[47,-2],[47,0],[47,5.5],[47,5.5]],
  B2:[[22,-24],[23,-24],[24,-25],[27,-23],[32,-17],[35,-13],[38,-10],[42,-7]],
  B3:[[25,-8],[26,-8],[28,-9],[30,-9],[34,-5],[36,-3],[39,-2],[44,0]],
  B4:[[25,9],[27,8],[29,7],[31,6],[34,6],[37,6],[40,4],[44,2]],
  B5:[[21,25],[23,23],[25,20],[28,17],[31,17],[34,18],[36,20],[40,16]],
  B6:[[11,-9],[9,-10],[9,-11],[17,-12],[25,-11],[29,-7],[32,-4],[35,0]],
  B7:[[-4,-26],[0,-26],[7,-27],[15,-27],[23,-25],[28,-23],[31,-20],[33,-17]],
  B8:[[10,11],[13,10],[17,7],[21,5],[27,7],[31,8],[33,13],[36,13]],
  B9:[[-18,-5],[-18,-8],[-10,-6],[-2,-5],[6,-3],[12,-1],[18,0],[23,1]],
  B10:[[-10,11],[-5,5],[1,1],[9,0],[16,2],[21,4],[25,7],[28,8]],
  B11:[[-3,27],[3,24],[10,22],[17,20],[23,21],[28,22],[31,23],[34,21]]
};


const UNUSED_PATHS = {
  A1:[[-46,0],[-45,1],[-43,2],[-42,2],[-41,2],[-40,2],[-40,1],[-41,0]],
  A2:[[-24,-27],[-20,-26],[-15,-24],[-8,-23],[0,-22],[8,-20],[13,-18],[18,-16]],
  A3:[[-30,-9],[-26,-7],[-20,-6],[-13,-6],[-5,-7],[1,-7],[7,-6],[11,-5]],
  A4:[[-29,11],[-24,12],[-18,10],[-11,9],[-4,10],[3,11],[7,11],[11,10]],
  A5:[[-22,27],[-16,28],[-6,30],[8,30],[28,30],[35,30],[37,27],[38,23]],
  A6:[[-10,-6],[-6,-4],[0,-2],[7,-1],[13,0],[18,1],[23,1],[26,1]],
  A7:[[-2,-26],[3,-27],[11,-24],[24,-17],[30,-19],[27,-24],[31,-25],[35,-22]],
  A8:[[-7,15],[-6,15],[6,13],[12,12],[18,13],[23,16],[27,14],[30,11]],
  A9:[[17,0],[20,0],[23,-1],[27,0],[30,2],[32,4],[35,3],[40,2]],
  A10:[[4,5],[8,3],[13,2],[19,2],[24,7],[29,10],[33,9],[37,7]],
  A11:[[10,26],[15,26],[20,25],[24,24],[28,23],[31,21],[32,18],[35,14]],
  B1:[[48,0],[48,1],[47,2],[47,1],[47,3],[47,4],[47,2],[47,1]],
  B2:[[21,-23],[23,-23],[25,-22],[28,-17],[33,-17],[32,-21],[35,-21],[39,-17]],
  B3:[[25,-7],[27,-7],[29,-7],[31,-6],[35,-4],[37,-3],[39,-2],[43,0]],
  B4:[[25,9],[27,9],[29,8],[31,7],[34,8],[37,9],[40,8],[44,7]],
  B5:[[22,24],[24,23],[27,21],[30,22],[32,23],[35,25],[38,22],[41,17]],
  B6:[[10,-8],[12,-5],[14,-3],[22,-4],[26,-5],[29,-3],[32,0],[35,1]],
  B7:[[-4,-25],[1,-25],[6,-23],[12,-22],[17,-21],[21,-19],[23,-17],[25,-15]],
  B8:[[10,12],[8,13],[10,12],[21,7],[25,12],[27,16],[30,15],[34,10]],
  B9:[[-18,6],[-20,10],[-10,8],[-2,7],[6,8],[13,9],[19,8],[24,8]],
  B10:[[-8,-9],[-3,-3],[2,1],[9,3],[16,6],[21,9],[25,10],[29,9]],
  B11:[[-4,26],[2,26],[10,27],[17,28],[25,25],[32,20],[35,17],[38,14]]
};

const BLOCKED_PATHS = {
  A1:[[-46,0],[-45,-1],[-43,-1],[-42,1],[-41,1],[-42,0],[-45,-2],[-48,-2]],
  A2:[[-23,-27],[-17,-28],[-7,-29],[4,-28],[13,-27],[8,-26],[-1,-24],[-11,-22]],
  A3:[[-28,-8],[-23,-9],[-16,-10],[-10,-10],[-3,-9],[-5,-10],[-12,-12],[-21,-12]],
  A4:[[-30,10],[-26,9],[-19,8],[-12,7],[-5,8],[-8,8],[-15,6],[-23,5]],
  A5:[[-22,27],[-18,25],[-12,24],[-5,23],[3,22],[2,20],[-6,16],[-15,13]],
  A6:[[-9,-5],[-8,-7],[3,-9],[8,-5],[14,-2],[20,-1],[13,-6],[2,-10]],
  A7:[[3,-25],[7,-25],[32,-16],[39,-10],[33,-18],[27,-23],[17,-20],[5,-21]],
  A8:[[-4,14],[0,13],[6,12],[13,11],[20,10],[24,8],[17,4],[8,-1]],
  A9:[[17,0],[21,0],[24,-1],[27,0],[30,0],[32,-2],[28,-1],[20,-3]],
  A10:[[3,5],[7,4],[12,3],[18,4],[23,6],[26,7],[20,5],[11,2]],
  A11:[[9,27],[14,26],[18,25],[23,23],[27,22],[30,20],[25,16],[17,12]],
  B1:[[48,0],[48,-1],[47,-2],[47,1],[47,1],[47,0],[46,-1],[44,-2]],
  B2:[[22,-24],[24,-23],[27,-21],[29,-17],[33,-17],[32,-20],[25,-20],[15,-20]],
  B3:[[26,-7],[27,-7],[28,-6],[30,-5],[33,-5],[34,-4],[29,-5],[21,-7]],
  B4:[[26,8],[27,8],[29,7],[31,7],[33,7],[35,6],[30,5],[23,2]],
  B5:[[22,25],[24,23],[26,21],[28,19],[31,19],[33,17],[28,13],[21,9]],
  B6:[[11,-8],[9,-8],[8,-9],[16,-2],[23,1],[28,3],[17,-6],[6,-12]],
  B7:[[-4,-26],[2,-27],[10,-27],[16,-26],[23,-25],[22,-23],[10,-21],[-3,-22]],
  B8:[[10,12],[12,11],[16,9],[18,10],[25,11],[28,11],[21,6],[12,1]],
  B9:[[-17,-5],[-18,-7],[-10,-5],[-3,-2],[5,1],[10,0],[1,-4],[-12,-7]],
  B10:[[-9,11],[-4,6],[2,2],[9,3],[16,5],[20,4],[12,0],[1,-5]],
  B11:[[-3,27],[4,25],[11,23],[17,21],[23,20],[27,17],[20,11],[11,5]]
};

const DEFINITIONS = {
  used: {
    times: [0,4.3,9.5,13.5,18.7,22,27,32], paths: USED_PATHS, initialCarrier:'A3',
    // A local, authored fish-hook: approach the marker, check toward the carrier,
    // round the turn at reduced speed, then accelerate inside near A6's release.
    // Tangents describe tactical rhythm; the same bounded controller emits every
    // position and velocity. No opportunity score enters these control points.
    routes: {A7:[
      {t:0,x:12,y:-25,vx:1.3,vy:0},
      {t:4.3,x:18,y:-25,vx:1.2,vy:0},
      {t:5.8,x:20,y:-25.5,vx:0,vy:-.7},
      {t:7.4,x:17.5,y:-27,vx:-2,vy:0},
      {t:8.6,x:15.6,y:-25.9,vx:-.5,vy:1.9},
      {t:9.4,x:16,y:-23.6,vx:1.5,vy:3},
      {t:11.9,x:24,y:-17.2,vx:3,vy:1.4},
      {t:13.5,x:25,y:-16.5,vx:1.15,vy:.48}
    ]},
    phases: [
      ['Draw the first press','引出第一线压迫','A3 carries into B9’s press. A6 checks into the near-side pocket; the full-backs create width.'],
      ['Check and curve inside','回撤后弧线转向','A6 carries as B6 steps toward him. A7 checks back in front of B2 and rounds the hook at reduced speed; A2 advances outside.'],
      ['Accelerate into the channel','加速切入近侧肋部','A7 accelerates inside as A6 releases. B2 turns toward the runner; A9 stays between the centre-backs and A10 remains inside.'],
      ['Receive and connect','接球并衔接中路','A7 carries after reception. B2 closes the ball, B3 covers inside, and A9 checks toward the next pass.'],
      ['Third-player support','第三人接应','A9 receives with pressure behind and connects to A10. A6 and A8 stay available beneath the attack.'],
      ['Move the block across','调动防线横移','A10 carries and switches toward A11; B5 and B11 release from narrow cover to defend the far side.'],
      ['Finish and reset','完成进攻并回位','A11 moves inside for a low shot. B1 adjusts and gathers; nearby attackers slow and the back line holds recovery depth.']
    ],
    actions: [
      {id:'p1',from:'A3',to:'A6',release:3.2,receive:4.2,flightProfile:'firm_pass'},
      {id:'p2',from:'A6',to:'A7',release:11.2,receive:12.1,flightProfile:'firm_pass'},
      {id:'p3',from:'A7',to:'A9',release:17.5,receive:18.4,flightProfile:'firm_pass'},
      {id:'p4',from:'A9',to:'A10',release:21,receive:21.5,flightProfile:'short_combination'},
      {id:'p5',from:'A10',to:'A11',release:25.3,receive:26.2,flightProfile:'switch'},
      {id:'s1',from:'A11',to:'B1',release:29.6,receive:30.4,type:'shot',outcome:'save',flightProfile:'shot'}
    ]
  },
  unused: {
    times:[0,4.6,9,13.3,18.4,23.5,28.5,34],paths:UNUSED_PATHS,initialCarrier:'A4',
    phases:[
      ['Circulate on the far side','远侧组织推进','A4 draws B9 and releases A8, with A5 preparing the outside route.'],
      ['Develop two angles','建立两个接应角度','A8 advances under B8 pressure. A7 starts an inside run across the pitch while A10 checks between the lines.'],
      ['Select the inside link','选择中路衔接','A10 receives the pass. A7 continues the actual run without receiving, and B2 follows goal-side.'],
      ['Find the wide receiver','寻找边路接应者','A10 carries before releasing A11. A5 overlaps; B5 closes the winger and B11 recovers outside.'],
      ['Overlap and protect','套边并保持保护','A11 uses A5 outside. A7 checks back toward width as the far-side defence recovers.'],
      ['Recycle the second ball','回做后的再组织','A5 finds A8 underneath. A6 remains a central safety option and the centre-backs step up together.'],
      ['Connect to the striker','衔接中锋','A8 releases A9, who carries into a low shot. B1 gathers while the other attackers retain recovery positions.']
    ],
    actions:[
      {id:'p1',from:'A4',to:'A8',release:3.5,receive:4.5,flightProfile:'firm_pass'},
      {id:'p2',from:'A8',to:'A10',release:11.8,receive:12.6,flightProfile:'firm_pass'},
      {id:'p3',from:'A10',to:'A11',release:16.9,receive:18,flightProfile:'firm_pass'},
      {id:'p4',from:'A11',to:'A5',release:21.8,receive:22.5,flightProfile:'short_combination'},
      {id:'p5',from:'A5',to:'A8',release:26.7,receive:27.7,flightProfile:'firm_pass'},
      {id:'p6',from:'A8',to:'A9',release:30,receive:30.9,flightProfile:'firm_pass'},
      {id:'s1',from:'A9',to:'B1',release:32.6,receive:33,type:'shot',outcome:'save',flightProfile:'shot'}
    ]
  },
  blocked:{
    times:[0,4.2,8,11.8,16.3,21,25.5,30],paths:BLOCKED_PATHS,initialCarrier:'A3',
    phases:[
      ['Build under pressure','压力下组织','A3 advances against B9 and finds A6. The wide players prepare different receiving depths.'],
      ['Accelerate at the line','向防线加速','A7 sprints inside while B2 and the centre-backs maintain their line. B6 presses A6 and screens the forward lane.'],
      ['Run beyond the release line','跑过可传球位置','A7 continues beyond the second-last defender. A6 uses A8 across the pitch instead of forcing the forward route.'],
      ['Recover an onside option','回到可接应位置','A7 bends back as A8 finds A10. B6 recovers into the central pass corridor and B3 protects the striker.'],
      ['Contest the central pass','争夺中路传球','A10 attempts the pass toward A9. B6 steps into the route, intercepts, and turns into space.'],
      ['Break out after recovery','夺回球权后推进','B6 carries toward the near side and releases B7. A6 counter-presses and both A centre-backs retreat.'],
      ['Support the counterattack','支援反击','B7 advances with B9 and B10 supporting inside. A2 delays the carrier and A7 recovers behind the ball.']
    ],
    actions:[
      {id:'p1',from:'A3',to:'A6',release:3.1,receive:4.1,flightProfile:'firm_pass'},
      {id:'p2',from:'A6',to:'A8',release:10.4,receive:11.5,flightProfile:'switch'},
      {id:'p3',from:'A8',to:'A10',release:15.1,receive:15.7,flightProfile:'short_combination'},
      {id:'p4',from:'A10',to:'B6',intendedTarget:'A9',release:19.6,receive:20,outcome:'interception',flightProfile:'short_combination'},
      {id:'p5',from:'B6',to:'B7',release:24.1,receive:25.2,flightProfile:'switch'}
    ]
  }
};

// These are human-written summaries of already-realised tracking/event evidence.
// They are deliberately separate from phase intentions and must be gated by both
// interval and evidenceTime. No cue claims a later reception or causal value.
const OBSERVATION_CUES = {
  used:[
    [0,4.2,['A7','B2'],'A7 holds width; B2 stays goal-side.','A7 拉开宽度，B2 保持球门侧位置。'],
    [4.3,5.9,['A7','A6','B2'],'A6 carries; A7 has approached B2.','A6 持球，A7 已靠近 B2。'],
    [6,7.7,['A7','B2'],'A7 has slowed and turned back.','A7 已减速并回撤。'],
    [7.8,8.7,['A7','B2'],'A7 checks back; B2 follows.','A7 回撤，B2 跟随。'],
    [8.8,9.5,['A7','B2'],'A7 has curved inside and turned forward.','A7 已弧线转向内侧，重新向前。'],
    [9.6,11.1,['A7','A6'],'A7 has accelerated inside; A6 still carries.','A7 已加速内切，A6 仍在持球。'],
    [11.2,12,['A7','A6','B2'],'A6 has passed; B2 moves inward.','A6 已传球，B2 向内移动。'],
    [12.1,17.4,['A7','A2','B2'],'A7 controls inside B2; A2 advances outside.','A7 在 B2 内侧控球，A2 外侧前进。'],
    [17.5,20.9,['A7','A9'],'A7 has passed and is moving inside.','A7 已传球，仍向内侧移动。'],
    [21,25.2,['A7','A9','A10'],'A9 has passed toward A10; A7 stays central.','A9 已传向 A10，A7 保持中路位置。'],
    [25.3,29.5,['A7','A10','A11'],'A10 has switched toward A11; A7 stays inside.','A10 已转移至 A11 方向，A7 留在内侧。'],
    [29.6,30.7,['A7','A11','B1'],'A11 has shot; A7 stays inside.','A11 已射门，A7 留在内侧。'],
    [30.8,32,['A7','B1'],'B1 has saved; A7 turns back.','B1 已扑住射门，A7 转身回撤。']
  ],
  unused:[
    [0,4.4,['A7','B2'],'A7 holds opposite-side width; B2 stays goal-side.','A7 在另一侧拉开，B2 保持球门侧位置。'],
    [4.5,8.8,['A7','A8','B2'],'A8 has control; A7 advances from wide.','A8 已控球，A7 从边路前进。'],
    [8.9,11.7,['A7','B2'],'A7 runs diagonally inside; B2 tracks goal-side.','A7 斜向内切，B2 从球门侧跟随。'],
    [11.8,12.5,['A7','A8','A10'],'A8 has passed; A7 keeps running.','A8 已传球，A7 继续跑动。'],
    [12.6,15,['A7','A10'],'A10 has control; A7 continues without the ball.','A10 已控球，A7 继续无球前进。'],
    [15.1,18.3,['A7','B2'],'A7 runs forward; B2 stays goal-side.','A7 向前跑动，B2 保持球门侧位置。'],
    [18.7,23.4,['A7','B2'],'A7 has checked back; B2 has followed.','A7 已回撤至边路，B2 已跟随。'],
    [23.7,29.9,['A7','B2'],'A7 advances again from wide.','A7 从边路再次前进。'],
    [30,32.5,['A7','A8','A9'],'A8 has passed toward A9; A7 moves inside.','A8 已传向 A9，A7 向内侧移动。'],
    [32.6,33.5,['A7','A9','B1'],'A9 has taken a low shot.','A9 已起脚低射。'],
    [33.6,34,['A7','B1'],'B1 has saved; A7 moves back.','B1 已扑住射门，A7 开始回撤。']
  ],
  blocked:[
    [0,4,['A7','B2'],'A7 holds width; B2 is ahead.','A7 拉开宽度，B2 位于前方。'],
    [4.1,6.9,['A7','A6'],'A6 has control; A7 accelerates diagonally.','A6 已控球，A7 斜向加速。'],
    [7,8.3,['A7','B2'],'A7 sprints forward; B2 retreats.','A7 向前冲刺，B2 后退。'],
    [8.4,10.3,['A7','B3','B4'],'A7 is beyond the second-last defender.','A7 已跑到倒数第二名防守者身后。'],
    [10.4,11.4,['A7','A6','A8'],'A6 has passed across; A7 continues forward.','A6 已横传，A7 继续前进。'],
    [11.5,12.5,['A7','A8'],'A8 has control; A7 has slowed.','A8 已控球，A7 已减速。'],
    [12.6,15.6,['A7','B2'],'A7 has turned back toward the flank.','A7 已转身回到边路。'],
    [15.7,19.5,['A7','A10'],'A10 has control; A7 continues back wide.','A10 已控球，A7 继续向边路回撤。'],
    [20,24,['A7','B6','A10'],'B6 has intercepted A10’s pass; A7 tracks back.','B6 已截下 A10 的传球，A7 回追。'],
    [24.1,25.1,['A7','B6','B7'],'B6 has passed wide; A7 tracks back.','B6 已传向边路，A7 继续回追。'],
    [25.2,30,['A7','B7','A2'],'B7 has control; A7 continues retreating.','B7 已控球，A7 继续回撤。']
  ]
};

function observationCues(sceneId){
  return OBSERVATION_CUES[sceneId].map(([startTime,endTime,focusPlayerIds,text,textZh],i)=>({id:`${sceneId}:observation-${i+1}`,startTime,endTime,evidenceTime:startTime,focusPlayerIds:[...focusPlayerIds],text,textZh,kind:'observed_movement',provenance:'authored_tracking_cue'}));
}

/** Bounded vector acceleration; positions integrate the emitted velocities. */
export function stepMotion(player, desiredVelocity, dt, limits = MOTION_LIMITS) {
  if (!(dt > 0)) throw new RangeError('dt must be positive');
  let {vx,vy} = desiredVelocity;
  const speed = Math.hypot(vx,vy);
  const maxSpeed = player.role === 'goalkeeper' ? Math.min(limits.maxSpeed, limits.goalkeeperMaxSpeed ?? limits.maxSpeed) : limits.maxSpeed;
  if (speed > maxSpeed) { vx *= maxSpeed/speed; vy *= maxSpeed/speed; }
  let dvx = vx-player.vx, dvy = vy-player.vy;
  const change = Math.hypot(dvx,dvy), maxChange = (limits.maxAcceleration ?? limits.maxAccel)*dt;
  if (change > maxChange) { dvx *= maxChange/change; dvy *= maxChange/change; }
  const nextVx = player.vx+dvx, nextVy = player.vy+dvy;
  return {...player,x:player.x+(player.vx+nextVx)*dt/2,y:player.y+(player.vy+nextVy)*dt/2,vx:nextVx,vy:nextVy};
}

function phaseAt(definition,t) {
  for(let i=0;i<definition.times.length-1;i++) if(t < definition.times[i+1]-1e-8) return i;
  return definition.times.length-2;
}

function boardPosition(definition,id,t) {
  const route=definition.routes?.[id];
  if(route && t<=route.at(-1).t){
    const index=Math.max(0,route.findIndex((knot,i)=>i<route.length-1&&t<=route[i+1].t));
    const a=route[index],b=route[index+1],span=b.t-a.t,f=clamp((t-a.t)/span,0,1);
    const h00=2*f*f*f-3*f*f+1,h10=f*f*f-2*f*f+f,h01=-2*f*f*f+3*f*f,h11=f*f*f-f*f;
    return {x:h00*a.x+h10*span*a.vx+h01*b.x+h11*span*b.vx,y:h00*a.y+h10*span*a.vy+h01*b.y+h11*span*b.vy};
  }
  const phase=phaseAt(definition,t), a=point(definition.paths[id][phase]), b=point(definition.paths[id][phase+1]);
  const span=definition.times[phase+1]-definition.times[phase];
  const f=clamp((t-definition.times[phase])/span,0,1);
  return {x:a.x+(b.x-a.x)*f,y:a.y+(b.y-a.y)*f};
}

function possessionAt(definition,t) {
  let carrierId=definition.initialCarrier;
  for(const action of definition.actions){
    if(t < action.release-1e-8) break;
    if(t < action.receive-1e-8) return {carrierId:null,team:action.from[0],action};
    carrierId=action.to;
  }
  return {carrierId,team:carrierId[0],action:null};
}

function tacticalTarget(definition,sceneId,player,players,t) {
  const state=possessionAt(definition,t), byId=Object.fromEntries(players.map(p=>[p.id,p]));
  const phase=phaseAt(definition,t), anchor=boardPosition(definition,player.id,t+.55);
  // During flight, reference the declared intended receiver. In particular, the
  // future interceptor must not become the defensive focus before contact.
  const carrier=byId[state.carrierId ?? state.action.intendedTarget ?? state.action.to];
  // Defensive response is local to current carrier/runner, not to an AS/DAS value.
  const blend=(target,weight)=>({x:anchor.x+(target.x-anchor.x)*weight,y:anchor.y+(target.y-anchor.y)*weight});
  const goalSide=(id,gap=2.8,lateral=0)=>({x:byId[id].x+gap,y:byId[id].y+lateral});
  const lastArrival=definition.actions.filter(action=>action.receive<=t+1e-8).at(-1);
  if(lastArrival?.outcome==='save' && player.role!=='goalkeeper'){
    const reset=boardPosition(definition,player.id,lastArrival.receive),elapsed=t-lastArrival.receive;
    if(player.team==='A') return {x:reset.x-.7*elapsed,y:reset.y};
    return {x:reset.x-.45*elapsed,y:reset.y+(['B2','B5'].includes(player.id)?Math.sign(reset.y)*.6*elapsed:0)};
  }
  if(player.id==='A1') return {x:anchor.x,y:clamp(carrier.y*.10,-4,4)};
  if(player.id==='B1'){
    // The final near-side set covers an on-target low shot. Keep that set
    // through flight instead of treating the goalkeeper himself as the ball.
    if(sceneId==='used' && phase===6 && lastArrival?.outcome!=='save') return anchor;
    return {x:anchor.x,y:clamp(carrier.y*.16,-5,5)};
  }
  if(player.id==='B9' && ['A3','A4'].includes(state.carrierId)) return blend(goalSide(state.carrierId,2.1,1.8),.82);
  if(player.id==='B10' && phase<2) return blend(goalSide('A6',4.4,3.6),.32);
  if(player.id==='B7') return blend(goalSide('A2',3.6,2.4),.42);
  if(player.id==='B11') return blend(goalSide('A11',2.8,-3.2),.24);
  if(player.id==='B3') return blend(goalSide('A9',3.5,-3.4),.24);
  if(player.id==='B4') return blend(goalSide('A9',3.8,5.0),.22);
  if(player.id==='B5' && state.carrierId!=='A11') return blend({x:anchor.x,y:anchor.y+clamp(carrier.y*.11,-2.3,2.3)},.6);
  if(player.id==='B6' && state.carrierId==='A6') return blend(goalSide('A6',2.5,.9),.75);
  if(player.id==='B8' && state.carrierId==='A8') return blend(goalSide('A8',2.8,-1.0),.68);
  if(player.id==='B5' && state.carrierId==='A11') return blend(goalSide('A11',2.6,1.4),.64);
  if(player.id==='B8' && state.carrierId==='A10') return blend(goalSide('A10',2.8,-2.0),.72);
  if(player.id==='B2' && (state.carrierId==='A7'||state.action?.to==='A7')) return blend(goalSide('A7',2.6,-1.9),.62);
  if(sceneId==='used' && player.id==='B2' && t>=4.3 && t<9.5) return blend(goalSide('A7',3.6,-.3),.55);
  if(sceneId==='unused' && player.id==='B2') return blend(goalSide('A7',3.1,1.7),.38);
  if(state.team==='B' && player.id==='A6' && state.carrierId==='B6') return blend({x:carrier.x-2.3,y:carrier.y+1.4},.65);
  if(state.team==='B' && player.id==='A2' && state.carrierId==='B7') return blend({x:carrier.x-2.6,y:carrier.y-1.6},.55);
  return anchor;
}

function desiredVelocity(player,target,players) {
  let dx=target.x-player.x,dy=target.y-player.y;
  const d=Math.hypot(dx,dy), cap=player.role==='goalkeeper'?3.2:player.id==='A7'?7.25:6.6;
  const speed=Math.min(cap,d*2.1,Math.sqrt(2*MOTION_LIMITS.maxAcceleration*d));
  let vx=d>1e-9?dx/d*speed:0,vy=d>1e-9?dy/d*speed:0;
  // Predictive personal-space steering. This adjusts desired velocity, never
  // projects positions; emitted motion keeps its speed/acceleration guarantees.
  for(const other of players){
    if(other.id===player.id) continue;
    const rx=player.x-other.x,ry=player.y-other.y,now=Math.hypot(rx,ry);
    const px=rx+(player.vx-other.vx)*.5,py=ry+(player.vy-other.vy)*.5,pred=Math.hypot(px,py);
    const safe=player.team===other.team?1.5:1.2;
    if(now<safe+1.8 || pred<safe+1.2){
      const nx=now>.001?rx/now:player.id<other.id?1:-1,ny=now>.001?ry/now:0;
      const force=clamp((safe+1.05-Math.min(now,pred))*2.8,0,4.2);
      vx+=nx*force;vy+=ny*force;
    }
  }
  // A continuous inward steering band keeps stopping distance within the pitch.
  const margin=3;
  if(player.x>52.5-margin)vx-=Math.max(0,player.x-(52.5-margin))*2;
  if(player.x< -52.5+margin)vx+=Math.max(0,(-52.5+margin)-player.x)*2;
  if(player.y>34-margin)vy-=Math.max(0,player.y-(34-margin))*2;
  if(player.y< -34+margin)vy+=Math.max(0,(-34+margin)-player.y)*2;
  return {vx,vy};
}

function foot(player) { return {x:player.x+(player.team==='A'?.35:-.35),y:player.y+.12}; }

function stageRoles(definition,sceneId,index) {
  const roles={};
  for(const id of IDS){
    const a=definition.paths[id][index],b=definition.paths[id][index+1];
    roles[id]={role:ROLES[id][1],reason:ROLE_ACTIONS[sceneId][id][index],start:{x:a[0],y:a[1]},target:{x:b[0],y:b[1]}};
  }
  return roles;
}

export function generateScenario(id='used',seed=20261024) {
  const spec=SCENARIOS.find(s=>s.id===id),definition=DEFINITIONS[id];
  if(!spec) throw new RangeError(`Unknown scenario: ${id}`);
  if(!definition) throw new Error(`Scenario ${id} is still being authored`);
  if(!Number.isSafeInteger(seed))throw new TypeError('seed must be a safe integer');
  let players=IDS.map(id=>({id,team:id[0],number:Number(id.slice(1)),role:ROLES[id][0],...point(definition.paths[id][0]),vx:0,vy:0}));
  const frames=[];
  for(let index=0;index<=Math.round(spec.duration/DT);index++){
    const t=Number((index*DT).toFixed(6));
    if(index){
      const previous=players;
      players=previous.map(player=>stepMotion(player,desiredVelocity(player,tacticalTarget(definition,id,player,previous,t-DT),previous),DT));
    }
    const state=possessionAt(definition,t);
    frames.push({index,frameId:`${id}:${String(index).padStart(4,'0')}`,t,periodId:1,pitch:{...PITCH},attackDirection:state.team==='A'?1:-1,attackingTeam:state.team,carrierId:state.carrierId,gameMode:'open_play',players:clone(players),ball:null});
  }
  const events=[];
  for(const action of definition.actions){
    const releaseFrame=frames[Math.round(action.release/DT)],receiveFrame=frames[Math.round(action.receive/DT)];
    const passId=`${id}:${action.id}`;
    const common={passId,releaseFrameId:releaseFrame.frameId,flightProfile:action.flightProfile};
    events.push({id:`${passId}:release`,type:action.type??'pass',t:action.release,frameIndex:releaseFrame.index,frameId:releaseFrame.frameId,playerId:action.from,targetId:action.intendedTarget??action.to,...common});
    events.push({id:`${passId}:arrival`,type:action.outcome??'reception',t:action.receive,frameIndex:receiveFrame.index,frameId:receiveFrame.frameId,playerId:action.to,fromId:action.from,...common});
  }
  for(const frame of frames){
    const state=possessionAt(definition,frame.t);
    if(state.action){
      const action=state.action,releaseFrame=frames[Math.round(action.release/DT)],receiveFrame=frames[Math.round(action.receive/DT)];
      const from=foot(releaseFrame.players.find(p=>p.id===action.from)),to=foot(receiveFrame.players.find(p=>p.id===action.to));
      const span=action.receive-action.release,f=(frame.t-action.release)/span;
      frame.ball={x:from.x+(to.x-from.x)*f,y:from.y+(to.y-from.y)*f,z:4*(action.height??0)*f*(1-f),vx:(to.x-from.x)/span,vy:(to.y-from.y)/span,state:'in_flight',passId:`${id}:${action.id}`,releaseFrameId:releaseFrame.frameId};
    }else{
      const carrier=frame.players.find(p=>p.id===frame.carrierId);
      frame.ball={...foot(carrier),z:0,vx:carrier.vx,vy:carrier.vy,state:'possessed'};
    }
  }
  return {metadata:{...spec,seed,synthetic:true,coordinateUnits:'m',timeUnits:'s',pitch:{...PITCH},attackingTeam:'A',attackDirection:1,motionLimits:{...MOTION_LIMITS},ballFlightProfiles:clone(BALL_FLIGHT_PROFILES),ballFlightModel:'Authored action-specific constant horizontal flight speeds; release and control impulses. Profile bounds are simulator choices, not empirical football norms.',generatorVersion:GENERATOR_VERSION,source:'Independently authored synthetic tactical boards and bounded kinematic simulation; no recorded match tracking or third-party scene source.',seedUsage:'Provenance identifier; this authored version has no random motion.',labelsAreHypotheses:true,roles:Object.fromEntries(IDS.map(id=>[id,{role:ROLES[id][0],name:ROLES[id][1],nameZh:ROLES[id][2],rationale:ROLES[id][3]}])),observationCues:observationCues(id),stages:definition.phases.map(([title,titleZh,description],i)=>({id:`${id}:stage-${i+1}`,startTime:definition.times[i],endTime:definition.times[i+1],title,titleZh,description,roles:stageRoles(definition,id,i)}))},frames,events};
}
export const getScenario=generateScenario;
/** Latest sample at or before t: never an interpolated or future metric frame. */
export function frameAt(scenario,t){
  if(!Number.isFinite(t))throw new TypeError('time must be finite');
  return scenario.frames[clamp(Math.floor((t+1e-8)*scenario.metadata.sampleRate),0,scenario.frames.length-1)];
}
