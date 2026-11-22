import { personalBaseline } from './calculations';
import { shiftDate } from './dates';
import type { HealthMeasurement, HealthMetric, PreferredSources } from './types';

export const ORI_VERSION = 'caps_ori_v1' as const;
export type OriContributor = { metric: HealthMetric; score: number | null; weight: number; reason: string; source: string | null; identity: string | null; baselineCount: number; z: number | null; value: number | null; unit: string | null };
export type OriResult = { score: number | null; version: typeof ORI_VERSION; coverage: number; contributors: OriContributor[]; inputSet: string; reason: string };
const config: { metric: HealthMetric; weight: number }[] = [{metric:'hrv',weight:0.4},{metric:'rhr',weight:0.3},{metric:'sleep_duration',weight:0.3}];
const clamp = (n: number) => Math.max(0, Math.min(100, n));
/** CAPS product heuristic, not a validated readiness model or physiological percentage. */
export function calculateORI(day: string, observations: HealthMeasurement[], preferred: PreferredSources = {}, asOf = Date.now()): OriResult {
  const contributors = config.map(({metric,weight}): OriContributor => {
    const valid = observations.filter(m => m.metric === metric && m.quality === 'valid' && Number.isFinite(m.value) && Date.parse(m.measuredAt) <= asOf && (!m.measuredUntil || Date.parse(m.measuredUntil) <= asOf) && (metric !== 'hrv' || ['RMSSD','SDNN'].includes(m.subtype ?? '')) && (metric === 'sleep_duration' ? m.unit === 'min' && m.value >= 0 && m.value <= 1440 : m.unit === (metric === 'hrv' ? 'ms' : 'bpm') && m.value > 0));
    // Pin the most recent historical source identity across the entire preceding window.
    // Do not silently switch source to fill an absent day.
    const candidates = valid.filter(m => m.localDate <= day && m.localDate >= shiftDate(day,-28) && (!preferred[metric] || preferred[metric] === m.source)).sort((a,b) => b.measuredAt.localeCompare(a.measuredAt) || a.id.localeCompare(b.id));
    const anchor = candidates[0];
    const identity = anchor ? JSON.stringify([anchor.platform,anchor.source,anchor.sourceDevice ?? '',anchor.sourceApp ?? '',anchor.subtype,anchor.protocol,anchor.unit]) : null;
    const same = (m: HealthMeasurement) => JSON.stringify([m.platform,m.source,m.sourceDevice ?? '',m.sourceApp ?? '',m.subtype,m.protocol,m.unit]) === identity;
    const sample = candidates.find(m => m.localDate === day && same(m));
    const result: OriContributor = {metric,weight,score:null,reason:'No eligible reading for this day/source.',source:anchor?.source ?? null,identity,baselineCount:0,z:null,value:sample?.value ?? null,unit:sample?.unit ?? null};
    if (!sample) return result;
    const baseline = personalBaseline(sample, valid.filter(same));
    result.baselineCount = baseline.count;
    result.z = baseline.zScore;
    if (baseline.count < 14 || baseline.mean === null || baseline.sd === null) { result.reason = `Building baseline: ${baseline.count}/14 comparable prior days.`; return result; }
    // Constant observed history is usable: normalized deviation has a conservative noise floor.
    // This does not change the raw baseline Z-score (which remains null when SD=0).
    const current = metric === 'hrv' && sample.subtype === 'RMSSD' ? Math.log(sample.value) : sample.value;
    const floor = metric === 'rhr' ? 2 : metric === 'hrv' ? sample.subtype === 'RMSSD' ? 0.1 : Math.max(1, baseline.mean * 0.1) : 30;
    const deviation = (current - baseline.mean) / Math.max(baseline.sd, floor);
    // Baseline=100. No bonus for unusually high HRV or unusually low RHR.
    result.score = metric === 'hrv' ? clamp(100 - 25 * Math.max(0,-deviation) - 10 * Math.max(0,deviation-2)) : metric === 'rhr' ? clamp(100 - 25 * Math.max(0,deviation) - 10 * Math.max(0,-deviation-2)) : clamp(Math.min(100 * Math.min(sample.value / 480,1), 100 - 25 * Math.max(0,-deviation)));
    result.reason = 'Eligible · CAPS experimental transform.';
    return result;
  });
  const coverage = contributors.filter(c => c.score !== null).reduce((sum,c) => sum+c.weight,0);
  const complete = contributors.every(c => c.score !== null);
  return { score:complete ? Math.round(contributors.reduce((sum,c) => sum+c.weight*c.score!,0)) : null,version:ORI_VERSION,coverage:Math.round(100*coverage),contributors,inputSet:JSON.stringify(contributors.map(c => [c.metric,c.identity])),reason:complete ? 'Experimental biometric index; not a percentage recovered.' : 'Requires HRV, resting HR and measured sleep, each with 14 comparable prior days.' };
}
