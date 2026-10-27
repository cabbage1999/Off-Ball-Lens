import {validateExplainRequest,makeFactPack,LIMITATIONS} from './evidence.mjs';

export const OVERLAYS=Object.freeze(['receiving_heatmap','player_trail','das_curve','event','none']);
export const OUTPUT_SCHEMA={type:'object',properties:{claim_ids:{type:'array',items:{type:'string'}},evidence_ids:{type:'array',items:{type:'string'}},overlay_type:{type:'string',enum:[...OVERLAYS]}},required:['claim_ids','evidence_ids','overlay_type'],additionalProperties:false};

/** Validate model selections before rendering; rendering itself is not validation. */
export function validatePlan(plan,pack,knownClaims,knownEvidence,request){
  if(!plan||typeof plan!=='object'||Array.isArray(plan)||Object.keys(plan).some(k=>!['claim_ids','evidence_ids','overlay_type'].includes(k)))throw new Error('invalid_model_output');
  if(!Array.isArray(plan.claim_ids)||!plan.claim_ids.length||plan.claim_ids.length>8||!Array.isArray(plan.evidence_ids)||plan.evidence_ids.length>8||!OVERLAYS.includes(plan.overlay_type))throw new Error('invalid_model_output');
  if([...plan.claim_ids,...plan.evidence_ids].some(id=>typeof id!=='string')||new Set(plan.claim_ids).size!==plan.claim_ids.length||new Set(plan.evidence_ids).size!==plan.evidence_ids.length)throw new Error('invalid_model_output');
  if(plan.claim_ids.some(id=>!knownClaims.has(id)||!pack.claims.some(c=>c.id===id))||plan.evidence_ids.some(id=>!knownEvidence.has(id)||!pack.evidence.some(e=>e.id===id)))throw new Error('invalid_evidence_reference');
  const chosen=pack.claims.filter(c=>plan.claim_ids.includes(c.id));
  if(chosen.every(c=>c.kind==='limits')&&!/limit|assumption|局限|限制|假设/i.test(request.question))throw new Error('missing_substantive_claim');
  const needed=new Set(chosen.flatMap(c=>c.evidence_ids));
  if([...needed].some(id=>!plan.evidence_ids.includes(id)))throw new Error('missing_claim_evidence');
  if(plan.overlay_type==='receiving_heatmap'&&!pack.evidence.some(e=>plan.evidence_ids.includes(e.id)&&e.status==='eligible'&&Number.isFinite(e.das)))throw new Error('unsupported_overlay');
  if(plan.overlay_type==='event'&&!pack.evidence.some(e=>plan.evidence_ids.includes(e.id)&&e.status==='event'))throw new Error('unsupported_overlay');
}

/** One request's authoritative tools and actual retrieval ledger, browser safe. */
export function createAnalysisTools(input,bundle){
  const request=validateExplainRequest(input,bundle);
  let pack=makeFactPack(bundle,request),analyzed=false,everRetrieved=false;
  const seenClaims=new Set(),seenEvidence=new Set();
  function execute(name,args){
    if(!args||typeof args!=='object'||Array.isArray(args))throw new TypeError('Tool arguments must be an object');
    if(name==='analyze_window'){
      if(Object.keys(args).some(k=>!['player_id','start_time','end_time'].includes(k))||args.player_id!==request.playerId||!Number.isFinite(args.start_time)||!Number.isFinite(args.end_time))throw new RangeError('Use the selected player and explicit finite times');
      // Compute first: a rejected analysis must not corrupt the current ledger.
      const nextPack=makeFactPack(bundle,request,args.start_time,args.end_time);
      pack=nextPack;analyzed=true;seenClaims.clear();seenEvidence.clear();
      return {context:pack.context,summary:pack.summary,available_evidence_ids:pack.evidence.map(e=>e.id),limitations:LIMITATIONS};
    }
    if(name==='get_evidence'){
      if(!analyzed)throw new RangeError('Analyze a window before requesting evidence');
      if(Object.keys(args).some(k=>k!=='evidence_ids')||!Array.isArray(args.evidence_ids)||args.evidence_ids.length>8||args.evidence_ids.some(x=>typeof x!=='string'))throw new RangeError('Invalid evidence request');
      const ids=args.evidence_ids.length?args.evidence_ids:pack.evidence.map(e=>e.id);
      if(ids.some(id=>!pack.evidence.some(e=>e.id===id)))throw new RangeError('Unknown evidence ID');
      const result={context:pack.context,claims:pack.claims.filter(c=>c.evidence_ids.every(id=>ids.includes(id))),evidence:pack.evidence.filter(e=>ids.includes(e.id)),limitations:pack.limitations};
      for(const claim of result.claims)seenClaims.add(claim.id);
      for(const evidence of result.evidence)seenEvidence.add(evidence.id);
      everRetrieved=true;
      return result;
    }
    throw new RangeError('Unknown tool');
  }
  function validate(plan){
    if(!analyzed||!everRetrieved)throw new Error('missing_tool_evidence');
    validatePlan(plan,pack,seenClaims,seenEvidence,request);
    return plan;
  }
  return {request,execute,validate,getPack:()=>pack};
}

export const createEvidenceSession=createAnalysisTools;
