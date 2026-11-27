import {buildRawGraphs, emptyProgressRecords} from '../src/progress/progressSeries.ts';
import assert from 'node:assert/strict';
import {calculateORI} from '../src/recovery/objectiveRecovery.ts';
const day='2026-10-30';
const sample=(metric,value,date)=>({id:metric+date,externalId:metric+date,metric,value,unit:metric==='hrv'?'ms':metric==='rhr'?'bpm':'min',measuredAt:date+'T10:00:00Z',recordedAt:date+'T11:00:00Z',localDate:date,timezone:'UTC',platform:'health_connect',source:'watch',subtype:metric==='hrv'?'RMSSD':null,protocol:null,quality:'valid'});
const history=Array.from({length:14},(_,i)=>'2026-10-'+String(i+16).padStart(2,'0')).flatMap(d=>[sample('hrv',50,d),sample('rhr',60,d),sample('sleep_duration',480,d)]);
const today=[sample('hrv',50,day),sample('rhr',60,day),sample('sleep_duration',480,day)];
const base=calculateORI(day,[...history,...today]);assert.equal(base.score,100);assert.equal(base.coverage,100);
assert.equal(calculateORI(day,history).score,null);
assert.equal(calculateORI(day,[...history,...today.filter(s=>s.metric!=='hrv')]).score,null);
assert.equal(calculateORI(day,[...history.slice(3),...today]).score,null);
assert.ok(calculateORI(day,[...history,...today.map(s=>s.metric==='rhr'?{...s,value:70}:s)]).score<base.score);
assert.ok(calculateORI(day,[...history,...today.map(s=>s.metric==='sleep_duration'?{...s,value:240}:s)]).score<base.score);
assert.equal(calculateORI(day,[...history,...today.map(s=>s.metric==='hrv'?{...s,subtype:'SDNN'}:s)]).score,null);
assert.equal(calculateORI(day,[...history,...today.map(s=>({...s,source:'new watch'}))]).score,null);
assert.equal(calculateORI(day,[...history,...today],{hrv:'missing'}).score,null);
assert.equal(calculateORI(day,[...history,...today],{},0).score,null);
assert.equal(calculateORI(day,[...history,...today.map(s=>({...s,quality:'unverified'}))]).score,null);
for(const value of [0,1,100,10000]){const r=calculateORI(day,[...history,...today.map(s=>s.metric==='hrv'?{...s,value}:s)]);assert.ok(r.score===null||r.score>=0&&r.score<=100);}
console.log('CAPS ORI v1 eligibility, transforms, source/subtype isolation and coverage passed');


const details=calculateORI(day,[...history,...today]);
const graphs=buildRawGraphs({...emptyProgressRecords,snapshots:[{localDate:day,sri:null,ori:details.score,sriVersion:'sri_v1',oriVersion:details.version,oriDetails:details,inputCount:3,computedAt:'2026-10-30T12:00:00Z'}]},'recovery',false,day);
assert.equal(graphs[0].series[0].observations.length,0);
assert.equal(graphs[0].title,'Recovery Index');
console.log('Persisted legacy CAPS ORI does not populate the Recovery Index');
