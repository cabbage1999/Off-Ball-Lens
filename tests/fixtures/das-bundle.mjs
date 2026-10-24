/** Deliberately tiny non-football fixture for temporal and evidence contracts only. */
export function fixture(){
  const frames=Array.from({length:21},(_,i)=>({index:i,frameId:`used:${String(i).padStart(4,'0')}`,t:i/10,carrierId:i<12?'A6':'A7',attackingTeam:'A',
    players:Array.from({length:22},(_,j)=>({id:`${j<11?'A':'B'}${j%11+1}`,team:j<11?'A':'B',x:j,y:0,vx:0,vy:0})),ball:{state:i===10||i===11?'in_flight':'possessed'}}));
  const scenario={metadata:{id:'used',duration:2,sampleRate:10,targetId:'A7'},frames,events:[
    {id:'pass-1',type:'pass',t:1,frameIndex:10,frameId:'used:0010',playerId:'A6',targetId:'A7',passId:'p1'},
    {id:'receive-1',type:'reception',t:1.2,frameIndex:12,frameId:'used:0012',playerId:'A7',passId:'p1'}]};
  const analysis={scenarioId:'used',schemaVersion:'2.0',sampleRate:5,model:{version:'accessible-space==2.1.0',configHash:'fixture-only'},frames:frames.filter(f=>f.index%2===0).map(f=>{
    const invalid=f.index===10;return {frameId:f.frameId,frameIndex:f.index,t:f.t,status:invalid?'invalid':'valid',reason:invalid?'ball_in_flight':null,carrierId:f.carrierId,attackingTeam:'A',players:{
      A7:invalid?{status:'invalid',as:null,das:null}:f.index>=12?{status:'carrier',as:null,das:null}:{status:'eligible',as:20+f.index,das:f.index<6?2+f.index:4},
      A9:invalid?{status:'invalid',as:null,das:null}:{status:'eligible',as:35,das:f.index>=12?8:5},
      B3:{status:'defending',as:null,das:null}}};}),moments:[]};
  return {scenario,analysis};
}
