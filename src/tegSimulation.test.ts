import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ALL_FAULT_IDS,
  CAREER_RANKS,
  DEFAULT_PARAMS,
  FAULT_LIBRARY,
  computeEquilibriumDewPointC,
  computeExamScore,
  computeTegProcess,
  generateExamFaultSchedule,
  stepVesselLevels,
} from './tegSimulation';

test('nominal operating case achieves pipeline moisture spec (<7 lb/MMscf)', () => {
  const m = computeTegProcess(DEFAULT_PARAMS);
  assert.ok(m.tegPurityPct > 98.3 && m.tegPurityPct < 99.3);
  assert.ok(m.dryWaterLbMMscf < 7.0);
  assert.equal(m.specPass, true);
  assert.equal(m.alarms.length, 0);
  assert.equal(m.trayProfile.length, DEFAULT_PARAMS.numTrays);
  assert.ok(m.trayProfile[0].gasWaterLbMMscf > m.trayProfile[m.trayProfile.length - 1].gasWaterLbMMscf);
});

test('more trays and packing improve Kremser dehydration performance', () => {
  const fewTrays = computeTegProcess({ ...DEFAULT_PARAMS, numTrays: 4, inletTempC: 42 });
  const manyTrays = computeTegProcess({ ...DEFAULT_PARAMS, numTrays: 12, inletTempC: 42 });
  const packed = computeTegProcess({ ...DEFAULT_PARAMS, numTrays: 10, internalsType: 'packing', inletTempC: 42 });
  assert.ok(manyTrays.dryWaterLbMMscf < fewTrays.dryWaterLbMMscf);
  assert.ok(packed.effectiveStages > manyTrays.effectiveStages * 0.8);
});

test('stripping gas and makeup TEG raise purity and lower dew point', () => {
  const base = computeTegProcess(DEFAULT_PARAMS);
  const stripped = computeTegProcess({ ...DEFAULT_PARAMS, strippingGasBoost: 0.9, makeupBoost: 0.25 });
  assert.ok(stripped.tegPurityPct > base.tegPurityPct);
  assert.ok(stripped.dewPointC < base.dewPointC);
});

test('turning gas-glycol cooler off degrades absorption performance', () => {
  const coolOn = computeTegProcess({ ...DEFAULT_PARAMS, coolerOn: true });
  const coolOff = computeTegProcess({ ...DEFAULT_PARAMS, coolerOn: false });
  assert.ok(coolOff.effectiveGlycolInTempC > coolOn.effectiveGlycolInTempC);
  assert.ok(coolOff.dryWaterLbMMscf > coolOn.dryWaterLbMMscf);
});

test('equilibrium curve moves monotonically with purity and contactor temperature', () => {
  const dp98 = computeEquilibriumDewPointC(98.0, 35, 55);
  const dp995 = computeEquilibriumDewPointC(99.5, 35, 55);
  const dpHot = computeEquilibriumDewPointC(99.5, 50, 55);
  assert.ok(dp995 < dp98);
  assert.ok(dpHot > dp995);
});

test('complete fault library covers all 9 categories and >75 distinct faults with actions and cascades', () => {
  const categories = new Set(Object.values(FAULT_LIBRARY).map((f) => f.category));
  for (const req of [
    'absorber',
    'glycol',
    'regeneration',
    'flash_filter',
    'pump_loop',
    'controls',
    'gas_upset',
    'safety',
    'operations',
  ]) {
    assert.ok(categories.has(req as any), `Missing category ${req}`);
  }
  assert.ok(ALL_FAULT_IDS.length >= 75, `Expected >= 75 faults, got ${ALL_FAULT_IDS.length}`);
  for (const f of Object.values(FAULT_LIBRARY)) {
    assert.ok(f.correctActions.length >= 1, `${f.id} missing correctActions`);
    assert.ok(f.wrongActions.length >= 1, `${f.id} missing wrongActions`);
    assert.ok(f.visualCue.length > 5 && f.debriefPhysics.length > 10, `${f.id} missing visual/debrief`);
    if (f.cascadeTo) {
      assert.ok(FAULT_LIBRARY[f.cascadeTo], `${f.id} cascade target ${f.cascadeTo} not found`);
    }
  }
});

test('fault injection: foaming raises glycol loss and filter plugging drains surge level', () => {
  const foam = computeTegProcess({ ...DEFAULT_PARAMS, faults: ['abs_foaming'] });
  assert.ok(foam.glycolLossGalMMscf > 1.0);
  assert.ok(foam.alarms.some((a) => a.id === 'ALM-LOSS-H'));

  const plugParams = { ...DEFAULT_PARAMS, faults: ['flt_plugging'] };
  const plug = computeTegProcess(plugParams);
  assert.ok(plug.filterDpBar > 1.0);
  assert.ok(plug.alarms.some((a) => a.id === 'ALM-PDI101'));

  let levels = { flashTankLevelPct: 52, reboilerLevelPct: 62, surgeLevelPct: 58 };
  for (let i = 0; i < 60; i++) {
    levels = stepVesselLevels(levels, plugParams, plug, 0.1, i * 0.1);
  }
  assert.ok(levels.surgeLevelPct < 24);
});

test('double overlapping faults & safety faults trigger realistic alarms and trip risk', () => {
  const fire = computeTegProcess({ ...DEFAULT_PARAMS, faults: ['saf_reboiler_fire', 'pmp_trip'] });
  assert.equal(fire.plantTripped, true);
  assert.ok(fire.alarms.some((a) => a.id === 'ALM-FIRE'));
  assert.ok(fire.alarms.some((a) => a.id === 'ALM-P101'));

  const hotReb = computeTegProcess({ ...DEFAULT_PARAMS, reboilerTempC: 210 });
  assert.equal(hotReb.decompositionActive, true);
  assert.ok(hotReb.alarms.some((a) => a.id === 'ALM-TI104-HH'));
});

test('career ranks 1-6 follow progressive disclosure rules', () => {
  assert.equal(CAREER_RANKS.length, 6);
  assert.equal(CAREER_RANKS[0].controlTier, 'basic');
  assert.equal(CAREER_RANKS[3].failedGaugesCount, 1);
  assert.equal(CAREER_RANKS[5].allowsLearnDrawer, false);
  assert.equal(CAREER_RANKS[5].hintsMode, 'none');
});

test('seeded exam generator prioritizes unseen faults to guarantee 100% coverage', () => {
  const allExceptThree = ALL_FAULT_IDS.slice(0, ALL_FAULT_IDS.length - 3);
  const unseenThree = ALL_FAULT_IDS.slice(ALL_FAULT_IDS.length - 3);
  const sched = generateExamFaultSchedule('quick', 42, {
    seen: allExceptThree,
    fixed: allExceptThree,
  });
  assert.equal(sched.length, 3);
  const pickedIds = sched.map((s) => s.id).sort();
  assert.deepEqual(pickedIds, [...unseenThree].sort());

  const certSched = generateExamFaultSchedule('certification', 99, { seen: [], fixed: [] });
  assert.equal(certSched.length, 10);
  assert.ok(certSched.some((s) => s.overlapped), 'certification exam includes overlapping faults');
});

test('exam scoring model rewards fast accurate responses and penalizes wrong actions / violations', () => {
  const high = computeExamScore({
    totalShiftSec: 600,
    onSpecSec: 590,
    faultsTotal: 3,
    faultsFixed: 3,
    avgDetectSec: 6,
    avgFixSec: 18,
    diagnosisCorrect: 3,
    diagnosisTotal: 3,
    harmfulActionsCount: 0,
    avgTegLoss: 0.12,
    safetyViolations: 0,
    hintsUsed: 0,
  });
  assert.ok(high.totalScore >= 95);
  assert.equal(high.passed, true);

  const low = computeExamScore({
    totalShiftSec: 600,
    onSpecSec: 200,
    faultsTotal: 3,
    faultsFixed: 1,
    avgDetectSec: 55,
    avgFixSec: 120,
    diagnosisCorrect: 0,
    diagnosisTotal: 3,
    harmfulActionsCount: 3,
    avgTegLoss: 1.6,
    safetyViolations: 2,
    hintsUsed: 1,
  });
  assert.ok(low.totalScore < 55);
  assert.equal(low.passed, false);
});
