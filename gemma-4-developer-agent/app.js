/*
Author: GPT-6.1 Sol (reasoning effort not exposed)
Date: 13-November-2026
PURPOSE: Render source-backed screening points, searchable experiment history and explicit evidence boundaries from the local aggregate JSON; no outside services or dependencies.
SRP/DRY check: Pass — one shared result formatter powers ledger rows and accessible chart descriptions.
*/
'use strict';
const byId = id => document.getElementById(id);
const signed = n => `${n > 0 ? '+' : ''}${n.toFixed(1)}`;
const authorName = name => ({claude: 'Claude', gpt: 'GPT', gemini: 'Gemini'}[name] || name);
const node = (tag, text, cls) => {const el = document.createElement(tag); if (text !== undefined) el.textContent = text; if (cls) el.className = cls; return el;};
const stateName = state => ({queued_s1: 'Stage 1 queued', queued_s2: 'Stage 2 queued', parked: 'Parked', done: 'Screen recorded', running: 'Recorded running', queued: 'Queued', proposed: 'Proposed', abandoned: 'Abandoned'}[state] || state);
const resultText = r => `${r.batch} · ${r.solved}/${r.tasks} solved · reference ${r.base_solved}/${r.tasks} and ${r.repeat_solved}/${r.tasks} · gain ${signed(r.gain)} tasks · ${r.corrected ? 'corrected' : 'provisional'}`;

function drawChart(experiments, bars) {
  // Only verified stage-1, old-clock batches share these axes and this advance bar.
  // There are deliberately no lines joining batches or best-so-far accumulation.
  const points = experiments.flatMap(e => e.results.filter(r => r.stage === 1).map(r => ({...r, entry: e})));
  const chart = byId('chart'); chart.replaceChildren();
  if (!points.length) {chart.append(node('p', 'No classified stage-1 result is available.')); return;}
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg'); svg.setAttribute('viewBox','0 0 1000 330'); svg.setAttribute('role','img');
  const title = document.createElementNS(ns,'title'); title.textContent = 'Screening gain by tested edit. '+points.map(p => `Entry ${p.entry.id}: ${resultText(p)}`).join('. '); svg.append(title);
  const min = Math.floor(Math.min(-10,...points.map(p=>p.gain))/5)*5-5;
  const max = Math.ceil(Math.max(5,...points.map(p=>p.gain))/5)*5;
  const y = v => 25+(max-v)/(max-min)*225;
  function shape(tag, attrs, text) {const el=document.createElementNS(ns,tag);Object.entries(attrs).forEach(([k,v])=>el.setAttribute(k,v));if(text!==undefined)el.textContent=text;svg.append(el);return el;}
  for(let value=min;value<=max;value+=5){shape('line',{x1:65,x2:970,y1:y(value),y2:y(value),stroke:value===0?'#83968d':'#e6e9e1','stroke-width':value===0?1.5:1});shape('text',{x:50,y:y(value)+4,'text-anchor':'end',fill:'#586965','font-size':11},value>0?`+${value}`:String(value));}
  shape('line',{x1:65,x2:970,y1:y(bars.s1_promote),y2:y(bars.s1_promote),stroke:'#15644d','stroke-dasharray':'5 5'});
  shape('text',{x:970,y:y(bars.s1_promote)-8,'text-anchor':'end',fill:'#15644d','font-size':10},`Advance bar +${bars.s1_promote} tasks`);
  points.forEach((p,i)=>{const x=110+i*(800/Math.max(1,points.length-1));const color=p.corrected?'#15644d':'#a65a28';shape('line',{x1:x,x2:x,y1:y(0),y2:y(p.gain),stroke:color,opacity:.25,'stroke-width':2});const c=shape('circle',{cx:x,cy:y(p.gain),r:7,fill:p.corrected?color:'#fffef9',stroke:color,'stroke-width':2});const tip=document.createElementNS(ns,'title');tip.textContent=resultText(p);c.append(tip);shape('text',{x,y:y(p.gain)+(p.gain>=0?-15:24),'text-anchor':'middle',fill:color,'font-size':13,'font-weight':700},signed(p.gain));shape('text',{x,y:278,'text-anchor':'middle',fill:'#1d302e','font-size':12},`#${p.entry.id}`);shape('text',{x,y:297,'text-anchor':'middle',fill:'#586965','font-size':10},`${p.batch} · ${p.tasks} tasks`);});
  chart.append(svg);
}

function renderTable(experiments) {
  const query=byId('query').value.trim().toLowerCase(), author=byId('author').value, evidence=byId('evidence').value;
  const filtered=experiments.filter(e=>(!author||e.author===author)&&(!query||`${e.id} ${e.title} ${e.author} ${e.status}`.toLowerCase().includes(query))&&(!evidence||(evidence==='measured'&&e.results.length)||(evidence==='corrected'&&e.results.some(r=>r.corrected))||(evidence==='unmeasured'&&!e.results.length)));
  byId('shown').textContent=`${filtered.length} of ${experiments.length} entries`;byId('empty').hidden=!!filtered.length;
  const body=byId('rows');body.replaceChildren();
  filtered.forEach(e=>{const tr=node('tr'); const idea=node('td');idea.append(node('span',`#${e.id} · ${e.date}`,'entry-id'),node('span',e.title,'entry-title'));tr.append(idea,node('td',authorName(e.author)));const status=node('td');status.append(node('span',stateName(e.status),`state ${e.results.length?'measured':''}`));tr.append(status);const result=node('td');
    if(e.results.length){e.results.forEach(r=>{result.append(node('span',`${signed(r.gain)} tasks`,'result-main '+(r.gain>0?'gain-positive':'gain-negative')),node('span',`${r.batch} · ${r.solved}/${r.tasks} solved`,'detail'),node('span',`${r.corrected?'Corrected':'Provisional'} · ${r.decision}`,'detail'));const details=node('details');details.append(node('summary','Reference and measurement details'));details.append(node('p',`Unedited references: ${r.base_solved}/${r.tasks} and ${r.repeat_solved}/${r.tasks}. Mean: ${(r.base_solved+r.repeat_solved)/2}. ${r.clock}. ${r.task_set}. ${r.corrected?`Original ${r.batch} counts are superseded.`:'Environment rerun not established by this aggregate.'}`,'detail'));result.append(details);});}
    else{result.append(node('span','Not measured','detail'));}tr.append(result);const source=node('td');const link=node('a','Source ↗');link.href=e.source_url;source.append(link);tr.append(source);body.append(tr);});
}

async function main() {
  const response=await fetch('data.json',{cache:'no-cache'});if(!response.ok)throw new Error('Aggregate evidence unavailable');const data=await response.json();if(data.schema!=='gemma-iterations/1')throw new Error('Unexpected evidence format');
  byId('observed').textContent=data.observed;byId('source-link').href=data.source_url;byId('protocol-link').href=data.protocol_url;
  byId('edits').textContent=data.experiments.length;byId('screened').textContent=data.experiments.filter(e=>e.results.length).length;
  const positive=data.experiments.flatMap(e=>e.results.filter(r=>r.stage===1&&r.gain>0).map(r=>({...r,id:e.id}))).at(-1);
  byId('positive').textContent=positive?`${signed(positive.gain)} tasks`:'None recorded';byId('positive-note').textContent=positive?`#${positive.id} · ${positive.corrected?'corrected':'provisional'} screen, not confirmation`:'No classified positive screen';
  byId('bar1').textContent=`Gain at least +${data.bars.s1_promote} tasks to advance; a loss of ${Math.abs(data.bars.s1_harmful)} tasks is harmful under the recorded rule.`;
  byId('bar2').textContent=`At least +${data.bars.s2_min} tasks in stage 2, +${data.bars.ctrl_margin} over its matched control, and +${data.bars.total_pass} across both stages. These recorded absolute task-count bars do not establish statistical significance.`;
  drawChart(data.experiments,data.bars);renderTable(data.experiments);
  ['query','author','evidence'].forEach(id=>byId(id).addEventListener(id==='query'?'input':'change',()=>renderTable(data.experiments)));
}
main().catch(error=>{byId('load-error').hidden=false;byId('observed').textContent='Evidence failed to load';console.error(error);});
