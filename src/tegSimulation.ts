export type FaultCategory =
  | 'absorber'
  | 'glycol'
  | 'regeneration'
  | 'flash_filter'
  | 'pump_loop'
  | 'controls'
  | 'gas_upset'
  | 'safety'
  | 'operations';

export type FieldActionId =
  | 'inspect_unit'
  | 'sample_teg'
  | 'sample_gas'
  | 'read_sightglass'
  | 'check_dp'
  | 'drain_boot'
  | 'clean_mist'
  | 'replace_filter'
  | 'close_bypass'
  | 'restart_burner'
  | 'tune_combustion'
  | 'descale_tube'
  | 'add_makeup'
  | 'add_stripping'
  | 'vent_gaslock'
  | 'clean_strainer'
  | 'reset_pump'
  | 'toggle_cooler'
  | 'flush_exchanger'
  | 'stroke_valve'
  | 'verify_gauge'
  | 'clean_sightglass'
  | 'leak_sniffer'
  | 'contain_spill'
  | 'apply_ppe_lockout'
  | 'neutralize_ph'
  | 'add_antifoam'
  | 'isolate_leak'
  | 'verify_psv';

export interface FaultDefinition {
  id: string;
  name: string;
  category: FaultCategory;
  unitId: string;
  severity: 'WARN' | 'CRIT';
  visualCue: string;
  gaugeEffect: string;
  rootCause: string;
  correctActions: string[];
  wrongActions: string[];
  requiredFieldAction?: FieldActionId;
  requiredParamCheck?: (p: TegParams) => boolean;
  cascadeTo?: string;
  cascadeDelaySec?: number;
  physicsEffects: {
    trayEffMult?: number;
    circMult?: number;
    carryoverAdd?: number;
    lossAdd?: number;
    reboilerDeltaC?: number;
    inletWaterMult?: number;
    inletTempDeltaC?: number;
    pressureDeltaBar?: number;
    gasFlowMult?: number;
    purityPenalty?: number;
    filterDpAdd?: number;
    absorberDpAdd?: number;
    flashPressAdd?: number;
    fuelMult?: number;
    coolerForcedOff?: boolean;
    exchEffDrop?: number;
    pumpZero?: boolean;
    pumpCavitate?: boolean;
    burnerOut?: boolean;
    flareSurge?: boolean;
    sourH2s?: boolean;
    btexHigh?: boolean;
    frozenGaugeTag?: string;
    driftGaugeTag?: string;
    falseAlarmTag?: string;
    reboilerFire?: boolean;
    gasLeak?: boolean;
    spillHazard?: boolean;
  };
  debriefPhysics: string;
}

export interface TegParams {
  gasFlowMMscfd: number;
  circRateGalPerLb: number;
  reboilerTempC: number;
  absorberPressureBar: number;
  inletTempC: number;
  inletWaterLbMMscf: number;
  glycolInTempC: number;
  numTrays: number;
  internalsType: 'trays' | 'packing';
  leanPurityOverride: number | null;
  strippingGasBoost: number;
  makeupBoost: number;
  coolerOn: boolean;
  exchangerEffPct: number;
  pumpTripped: boolean;
  lcv101ManualPct: number | null;
  lcv102ManualPct: number | null;
  pcv102ManualPct: number | null;
  faults: string[];
  fault?: string; // legacy convenience single-fault alias for unit tests
}

export interface TegDynamicLevels {
  flashTankLevelPct: number;
  reboilerLevelPct: number;
  surgeLevelPct: number;
}

export interface TrayProfilePoint {
  trayIndex: number;
  gasWaterLbMMscf: number;
  tegPurityWtPct: number;
  waterLoadingFrac: number;
  liquidLevelPct: number;
  stageEfficiencyPct: number;
}

export interface TegAlarm {
  id: string;
  tag: string;
  equipmentId: string;
  severity: 'CRIT' | 'WARN';
  message: string;
}

export interface TegMetrics {
  tegPurityPct: number;
  effectiveGlycolInTempC: number;
  dryWaterLbMMscf: number;
  dewPointC: number;
  dewPointDepressionC: number;
  glycolLossGalMMscf: number;
  fuelGasMscfd: number;
  reboilerDutyMMBtuHr: number;
  glycolGpm: number;
  waterRemovedLbHr: number;
  ventGasMscfd: number;
  flashPressureBar: number;
  filterDpBar: number;
  absorberDpBar: number;
  stillOverheadTempC: number;
  tegPh: number;
  h2sPpm: number;
  btexLbDay: number;
  lcv101OpenPct: number;
  lcv102OpenPct: number;
  pcv102OpenPct: number;
  kremserFactorA: number;
  effectiveStages: number;
  specPass: boolean;
  decompositionActive: boolean;
  plantTripped: boolean;
  trayProfile: TrayProfilePoint[];
  alarms: TegAlarm[];
}

export const FAULT_LIBRARY: Record<string, FaultDefinition> = {
  // === 1. ABSORBER / CONTACTOR (16) ===
  abs_foaming: {
    id: 'abs_foaming',
    name: 'Contactor Foaming',
    category: 'absorber',
    unitId: 'V-101',
    severity: 'CRIT',
    visualCue: 'White/amber froth surging across V-101 X-ray trays and mist pad.',
    gaugeEffect: 'V-101 ΔP climbs ~0.9 bar, dry gas H2O spikes >7 lb/MMscf, TEG loss jumps.',
    rootCause: 'Surface tension reduction from hydrocarbons, salt, or treating chemicals stabilizing foam.',
    correctActions: ['Inject antifoam / clean TEG', 'Sample TEG & check V-102 HC', 'Reduce gas velocity briefly'],
    wrongActions: ['Crank glycol circulation up', 'Overheat reboiler >204°C'],
    requiredFieldAction: 'add_antifoam',
    cascadeTo: 'abs_carryover',
    cascadeDelaySec: 40,
    physicsEffects: { trayEffMult: 0.52, carryoverAdd: 4.8, lossAdd: 1.45, absorberDpAdd: 0.68 },
    debriefPhysics: 'Foam fills vapor spaces on trays, destroying counter-current contact area and carrying glycol mist overhead.',
  },
  abs_flooding: {
    id: 'abs_flooding',
    name: 'Column Flooding',
    category: 'absorber',
    unitId: 'V-101',
    severity: 'CRIT',
    visualCue: 'Liquid backs up completely between upper V-101 trays with heavy overhead entrainment.',
    gaugeEffect: 'V-101 ΔP > 1.3 bar, severe dry gas moisture spike & massive TEG loss.',
    rootCause: 'Excess gas velocity or blocked downcomers prevents liquid from descending against rising gas.',
    correctActions: ['Reduce gas flow rate', 'Lower excessive circulation', 'Inspect trays/downcomers'],
    wrongActions: ['Increase gas rate', 'Raise glycol circulation rate'],
    requiredParamCheck: (p) => p.gasFlowMMscfd <= 50 && p.circRateGalPerLb <= 3.5,
    physicsEffects: { trayEffMult: 0.45, carryoverAdd: 6.2, lossAdd: 1.85, absorberDpAdd: 1.2 },
    debriefPhysics: 'When upward vapor drag exceeds hydrostatic head in downcomers, liquid bridges trays and exits overhead.',
  },
  abs_weeping: {
    id: 'abs_weeping',
    name: 'Tray Weeping / Dumping',
    category: 'absorber',
    unitId: 'V-101',
    severity: 'WARN',
    visualCue: 'Liquid rains straight down through tray caps instead of flowing across weirs.',
    gaugeEffect: 'V-101 ΔP abnormally low (<0.12 bar), tray levels <20%, sales gas wets up.',
    rootCause: 'Gas velocity too low (deep turndown) to hold liquid seal on valve/bubble-cap trays.',
    correctActions: ['Raise gas rate into operating envelope', 'Inspect tray seals'],
    wrongActions: ['Lower gas flow further', 'Drop pressure needlessly'],
    requiredParamCheck: (p) => p.gasFlowMMscfd >= 32,
    physicsEffects: { trayEffMult: 0.44, absorberDpAdd: -0.18 },
    debriefPhysics: 'Insufficient vapor ΔP lets TEG bypass downcomers and dump vertically, cutting stage contact time.',
  },
  abs_tray_damage: {
    id: 'abs_tray_damage',
    name: 'Tray Damage / Plugging',
    category: 'absorber',
    unitId: 'V-101',
    severity: 'CRIT',
    visualCue: 'Uneven dark froth & bypassed stages visible inside V-101 X-ray view.',
    gaugeEffect: 'High absorber ΔP (+0.55 bar) and sluggish moisture response despite good TEG purity.',
    rootCause: 'Mechanical tray uplift from past pressure surge or salt/iron sulfide plugging valve openings.',
    correctActions: ['Inspect V-101 internals', 'Clean/flush plugged internals', 'Compensate with circulation'],
    wrongActions: ['Overfire reboiler', 'Ignore rising ΔP'],
    requiredFieldAction: 'inspect_unit',
    physicsEffects: { trayEffMult: 0.56, absorberDpAdd: 0.55, lossAdd: 0.32 },
    debriefPhysics: 'Plugged or collapsed trays halve effective theoretical stages N in the Kremser equation.',
  },
  abs_downcomer_block: {
    id: 'abs_downcomer_block',
    name: 'Downcomer Blockage',
    category: 'absorber',
    unitId: 'V-101',
    severity: 'CRIT',
    visualCue: 'Liquid piles onto upper trays while lower trays look starved.',
    gaugeEffect: 'Rising V-101 ΔP and cyclic overhead slugging.',
    rootCause: 'Sludge, scale, or failed packing debris lodged in tray downcomer seal.',
    correctActions: ['Inspect & clear V-101 tray downcomer', 'Check F-101 filter integrity'],
    wrongActions: ['Raise circulation pump speed'],
    requiredFieldAction: 'inspect_unit',
    cascadeTo: 'abs_flooding',
    cascadeDelaySec: 45,
    physicsEffects: { trayEffMult: 0.54, absorberDpAdd: 0.72, carryoverAdd: 2.6 },
    debriefPhysics: 'A blocked downcomer forces liquid over the active deck, initiating localized flooding.',
  },
  abs_mist_plugged: {
    id: 'abs_mist_plugged',
    name: 'Mist Extractor Plugged / Damaged',
    category: 'absorber',
    unitId: 'V-101',
    severity: 'CRIT',
    visualCue: 'Heavy golden aerosol mist carried out V-101 overhead line into E-101.',
    gaugeEffect: 'Elevated tower ΔP and high glycol carryover loss (>0.9 gal/MMscf).',
    rootCause: 'Wire-mesh demister pad fouled by wax/solids or dislodged by surge.',
    correctActions: ['Clean / service mist extractor', 'Check inlet scrubber'],
    wrongActions: ['Increase gas throughput'],
    requiredFieldAction: 'clean_mist',
    physicsEffects: { absorberDpAdd: 0.45, lossAdd: 1.15, carryoverAdd: 3.1 },
    debriefPhysics: 'Without coalescing mesh at the tower top, fine 5–20 μm TEG droplets exit with dry sales gas.',
  },
  abs_carryover: {
    id: 'abs_carryover',
    name: 'Liquid Carryover to Sales',
    category: 'absorber',
    unitId: 'V-101',
    severity: 'CRIT',
    visualCue: 'Rich liquid droplets streaking upward into E-101 cooler and sales line.',
    gaugeEffect: 'Dry gas moisture fails spec & glycol inventory drains steadily.',
    rootCause: 'Uncontrolled foaming, flooding, or failed mist pad carrying liquid TEG/water out top.',
    correctActions: ['Clean mist extractor', 'Drain V-101 scrubber & reduce gas surge'],
    wrongActions: ['Ignore V-104 makeup alarm'],
    requiredFieldAction: 'clean_mist',
    physicsEffects: { carryoverAdd: 5.0, lossAdd: 1.35, trayEffMult: 0.68 },
    debriefPhysics: 'Entrained liquid water and glycol bypass thermodynamic equilibrium and contaminate sales gas.',
  },
  abs_scrubber_fail: {
    id: 'abs_scrubber_fail',
    name: 'Inlet Scrubber Failure',
    category: 'absorber',
    unitId: 'V-101',
    severity: 'CRIT',
    visualCue: 'V-101 bottom boot floods past Tray 1 with dark wet condensate.',
    gaugeEffect: 'Rapid water/hydrocarbon load spike; cascades to foaming if not drained.',
    rootCause: 'Blocked scrubber boot dump or failed separator vane lets free water/condensate hit trays.',
    correctActions: ['Drain V-101 bottom scrubber boot', 'Inspect scrubber internals'],
    wrongActions: ['Leave bottom drain closed'],
    requiredFieldAction: 'drain_boot',
    cascadeTo: 'abs_foaming',
    cascadeDelaySec: 38,
    physicsEffects: { inletWaterMult: 1.4, trayEffMult: 0.65, lossAdd: 0.4 },
    debriefPhysics: 'Free liquids entering Tray 1 dilute TEG instantly and introduce surfactant hydrocarbons.',
  },
  abs_channeling: {
    id: 'abs_channeling',
    name: 'Packing Channeling',
    category: 'absorber',
    unitId: 'V-101',
    severity: 'WARN',
    visualCue: 'TEG distributor sprays unevenly down one wall of structured packing.',
    gaugeEffect: 'Lower stage efficiency despite normal ΔP; gas exits above 7 lb/MMscf.',
    rootCause: 'Partially plugged liquid distributor or tilted packing bed creates dry vapor bypass.',
    correctActions: ['Inspect/clear V-101 internals', 'Verify distributor flow'],
    wrongActions: ['Drop glycol circulation'],
    requiredFieldAction: 'inspect_unit',
    physicsEffects: { trayEffMult: 0.58 },
    debriefPhysics: 'If liquid maldistribution leaves dry gas channels, gas skips mass-transfer stages.',
  },
  abs_temp_high: {
    id: 'abs_temp_high',
    name: 'High Contactor Temperature',
    category: 'absorber',
    unitId: 'V-101',
    severity: 'WARN',
    visualCue: 'Warm vapor haze rises through V-101; E-101 temperature differential narrowed.',
    gaugeEffect: 'Elevated equilibrium dew point even with high-purity TEG.',
    rootCause: 'Hot feed gas or poor lean TEG cooling pushes contactor above 45 °C.',
    correctActions: ['Verify E-101 cooler ON', 'Lower glycol/inlet temperature'],
    wrongActions: ['Shut off E-101 cooler'],
    requiredParamCheck: (p) => p.coolerOn && p.glycolInTempC <= 42 && p.inletTempC <= 38,
    physicsEffects: { inletTempDeltaC: 16, trayEffMult: 0.85 },
    debriefPhysics: 'Higher temperature sharply raises water vapor pressure over TEG, lifting equilibrium dew point.',
  },
  abs_temp_low: {
    id: 'abs_temp_low',
    name: 'Low Contactor Temperature (Too Cold)',
    category: 'absorber',
    unitId: 'V-101',
    severity: 'WARN',
    visualCue: 'Sluggish, thick TEG sheets slowly across V-101 trays.',
    gaugeEffect: 'High TEG viscosity and HC condensation risk; ΔP creeps up.',
    rootCause: 'Winter ambient overcooling pushes contactor <12 °C.',
    correctActions: ['Raise lean glycol-in temp above feed gas +5°C', 'Check hydrate risk'],
    wrongActions: ['Cool glycol further'],
    requiredParamCheck: (p) => p.glycolInTempC >= 30,
    cascadeTo: 'abs_hc_condensation',
    cascadeDelaySec: 45,
    physicsEffects: { inletTempDeltaC: -18, trayEffMult: 0.72, absorberDpAdd: 0.25 },
    debriefPhysics: 'Below ~15 °C, TEG viscosity spikes sharply, hurting mass transfer and condensing heavy gas.',
  },
  abs_press_high: {
    id: 'abs_press_high',
    name: 'High Contactor Pressure',
    category: 'absorber',
    unitId: 'V-101',
    severity: 'CRIT',
    visualCue: 'PI-101 alarm flashes red; PSV safety vent shudders.',
    gaugeEffect: 'PI-101 > 80 bar limit, risks PSV lifting.',
    rootCause: 'Downstream sales block valve restriction or upstream wellhead surge.',
    correctActions: ['Bring absorber pressure back <=75 bar', 'Verify PSV status'],
    wrongActions: ['Keep pressurizing tower'],
    requiredParamCheck: (p) => p.absorberPressureBar <= 75,
    cascadeTo: 'saf_psv_lift',
    cascadeDelaySec: 35,
    physicsEffects: { pressureDeltaBar: 28 },
    debriefPhysics: 'Exceeding 80 bar design pressure challenges vessel MAWP and lifts safety relief valves.',
  },
  abs_press_low: {
    id: 'abs_press_low',
    name: 'Low Contactor Pressure',
    category: 'absorber',
    unitId: 'V-101',
    severity: 'WARN',
    visualCue: 'High-velocity gas bubbles race rapidly through V-101 trays.',
    gaugeEffect: 'PI-101 < 32 bar; gas holds more water per MMscf, ΔP climbs.',
    rootCause: 'Upstream gathering drop reduces tower pressure below design.',
    correctActions: ['Restore pressure >=45 bar or add circulation/stages'],
    wrongActions: ['Lower pressure further'],
    requiredParamCheck: (p) => p.absorberPressureBar >= 42,
    physicsEffects: { pressureDeltaBar: -24, trayEffMult: 0.74, lossAdd: 0.45 },
    debriefPhysics: 'At lower pressure, gas volumetric velocity increases and saturated water content per MMscf climbs.',
  },
  abs_rate_turndown: {
    id: 'abs_rate_turndown',
    name: 'Gas Rate Turndown / Surge',
    category: 'absorber',
    unitId: 'V-101',
    severity: 'WARN',
    visualCue: 'Flow arrows stutter or surge erratically into V-101 base.',
    gaugeEffect: 'Gas rate swings outside optimal L/G ratio; moisture creeps toward 7 lb/MMscf.',
    rootCause: 'Wellhead cycling pushes gas flow outside stable tray hydraulic window.',
    correctActions: ['Adjust gas flow & glycol circulation to match', 'Verify tray hydraulics'],
    wrongActions: ['Leave circulation fixed at mismatch'],
    requiredParamCheck: (p) => p.gasFlowMMscfd >= 32 && p.gasFlowMMscfd <= 65 && p.circRateGalPerLb >= 2.5,
    physicsEffects: { gasFlowMult: 1.48, trayEffMult: 0.68, absorberDpAdd: 0.38 },
    debriefPhysics: 'Severe turndown causes weeping; severe surge drives entrainment and flooding.',
  },
  abs_hydrate: {
    id: 'abs_hydrate',
    name: 'Hydrate Formation in Tower',
    category: 'absorber',
    unitId: 'V-101',
    severity: 'CRIT',
    visualCue: 'Crystalline frost band plugs lower V-101 scrubber and Tray 1.',
    gaugeEffect: 'Steep V-101 ΔP spike (>1.1 bar) with erratic low-temp gas flow.',
    rootCause: 'High pressure + cold inlet gas + low TEG circulation forms methane-water clathrates.',
    correctActions: ['Raise glycol-in temp >=36°C & ensure lean TEG flow', 'Drain bottom boot'],
    wrongActions: ['Drop temperature or stop pump'],
    requiredParamCheck: (p) => p.glycolInTempC >= 36 && !p.pumpTripped && p.circRateGalPerLb >= 2.5,
    physicsEffects: { inletTempDeltaC: -20, pressureDeltaBar: 16, absorberDpAdd: 1.05, trayEffMult: 0.42 },
    debriefPhysics: 'Methane hydrates freeze solid above 0 °C under high pressure unless inhibited by sufficient warm TEG.',
  },
  abs_hc_condensation: {
    id: 'abs_hc_condensation',
    name: 'Hydrocarbon Condensation in Contactor',
    category: 'absorber',
    unitId: 'V-101',
    severity: 'WARN',
    visualCue: 'Oily sheen accumulates atop tray liquid inside V-101.',
    gaugeEffect: 'Rich glycol darkens; triggers foaming if lean TEG stays colder than feed gas.',
    rootCause: 'Lean TEG entering V-101 cooler than wet gas dew point condenses heavy C5+ liquids.',
    correctActions: ['Keep Lean TEG-in temp 5–10 °C warmer than wet gas', 'Drain V-101 boot'],
    wrongActions: ['Lower glycol-in temperature below gas temp'],
    requiredParamCheck: (p) => p.glycolInTempC >= p.inletTempC + 4,
    cascadeTo: 'abs_foaming',
    cascadeDelaySec: 40,
    physicsEffects: { trayEffMult: 0.72, lossAdd: 0.55 },
    debriefPhysics: 'Standard GPSA rule: keep lean TEG 5–8 °C above inlet gas to avoid condensing liquid hydrocarbons.',
  },
  abs_lcv_open: {
    id: 'abs_lcv_open',
    name: 'LCV-101 Stuck Open (Gas Blow-By)',
    category: 'absorber',
    unitId: 'LCV-101',
    severity: 'CRIT',
    visualCue: 'LCV-101 stem wide open; high-pressure gas bubbles violently into V-102 flash tank.',
    gaugeEffect: 'V-102 pressure climbs toward PSV limit, V-101 sump drains low.',
    rootCause: 'Actuator diaphragm failure or debris holds LCV-101 full open.',
    correctActions: ['Stroke / close LCV-101 back to auto control', 'Check V-102 pressure'],
    wrongActions: ['Close PCV-102 flare valve'],
    requiredFieldAction: 'stroke_valve',
    cascadeTo: 'flt_high_press',
    cascadeDelaySec: 32,
    physicsEffects: { flashPressAdd: 4.5, lossAdd: 0.5 },
    debriefPhysics: 'Losing the tower bottom liquid seal allows 55-bar gas to blow straight into the 10-bar flash vessel.',
  },
  abs_lcv_closed: {
    id: 'abs_lcv_closed',
    name: 'LCV-101 Stuck Closed (Tower Overfill)',
    category: 'absorber',
    unitId: 'LCV-101',
    severity: 'CRIT',
    visualCue: 'V-101 sump liquid rises rapidly above inlet nozzle toward Tray 1.',
    gaugeEffect: 'V-102 & V-104 levels fall toward starvation; V-101 ΔP climbs.',
    rootCause: 'Plugged valve trim or loss of instrument air freezes LCV-101 shut.',
    correctActions: ['Stroke / free LCV-101', 'Verify V-102 level recovery'],
    wrongActions: ['Speed up pump P-101'],
    requiredFieldAction: 'stroke_valve',
    cascadeTo: 'flt_suction_starved',
    cascadeDelaySec: 36,
    physicsEffects: { circMult: 0.35, absorberDpAdd: 0.65, trayEffMult: 0.6 },
    debriefPhysics: 'Trapping rich glycol in the tower starves the regeneration loop and floods bottom trays.',
  },

  // === 2. GLYCOL QUALITY (11) ===
  gly_salt: {
    id: 'gly_salt',
    name: 'Salt Contamination',
    category: 'glycol',
    unitId: 'H-101',
    severity: 'WARN',
    visualCue: 'White crystalline scale coats H-101 fire tube & sight glass.',
    gaugeEffect: 'Rising fuel gas demand, slow purity loss, higher ΔP across F-101/H-101.',
    rootCause: 'Produced formation brine carried past inlet scrubber evaporates in H-101 leaving salt deposits.',
    correctActions: ['Descale H-101 fire tube', 'Drain V-101 scrubber & sample TEG'],
    wrongActions: ['Raise reboiler temperature past 204°C'],
    requiredFieldAction: 'descale_tube',
    cascadeTo: 'reg_fouling',
    cascadeDelaySec: 42,
    physicsEffects: { purityPenalty: 0.45, fuelMult: 1.22, reboilerDeltaC: -5, filterDpAdd: 0.4 },
    debriefPhysics: 'Salts do not boil off in H-101; they concentrate and bake onto the fire tube as insulating scale.',
  },
  gly_hydrocarbon: {
    id: 'gly_hydrocarbon',
    name: 'Hydrocarbon Contamination',
    category: 'glycol',
    unitId: 'V-104',
    severity: 'WARN',
    visualCue: 'Dark oily layer floating in V-102 & V-104 sight glasses.',
    gaugeEffect: 'TEG sample shows heavy oil phase; triggers foaming in V-101.',
    rootCause: 'Liquid hydrocarbons dissolved/entrained in rich TEG bypass flash separation.',
    correctActions: ['Sample TEG & replace carbon filter', 'Drain V-102 skimmer/boot'],
    wrongActions: ['Turn off flash tank vent'],
    requiredFieldAction: 'replace_filter',
    cascadeTo: 'abs_foaming',
    cascadeDelaySec: 38,
    physicsEffects: { purityPenalty: 0.4, trayEffMult: 0.72, lossAdd: 0.35 },
    debriefPhysics: 'Dissolved aromatics and heavy oil lower surface tension and foul packing/exchangers.',
  },
  gly_solids: {
    id: 'gly_solids',
    name: 'Solids & Iron Sulfide',
    category: 'glycol',
    unitId: 'F-101',
    severity: 'WARN',
    visualCue: 'Black turbid glycol visible in V-104 & F-101 sight glass.',
    gaugeEffect: 'PDI-101 climbs rapidly; E-102 approach temperature degrades.',
    rootCause: 'Pipe rust & black FeS corrosion fines accumulate when filtration is bypassed or saturated.',
    correctActions: ['Replace F-101 cartridge', 'Ensure bypass closed & sample TEG'],
    wrongActions: ['Open filter bypass permanently'],
    requiredFieldAction: 'replace_filter',
    cascadeTo: 'flt_plugging',
    cascadeDelaySec: 36,
    physicsEffects: { filterDpAdd: 1.15, exchEffDrop: 12, circMult: 0.78 },
    debriefPhysics: 'Suspended iron sulfide abrades pump seals and packs heat-exchanger channels tight.',
  },
  gly_degradation: {
    id: 'gly_degradation',
    name: 'TEG Thermal Degradation',
    category: 'glycol',
    unitId: 'H-101',
    severity: 'CRIT',
    visualCue: 'Dark charred glycol in V-104 sight glass; TI-104 beacon flashes red.',
    gaugeEffect: 'TI-104 > 204 °C limit, pH drops acidic (<5.5), purity drops.',
    rootCause: 'Reboiler operated above 204 °C (400 °F) thermally cracks TEG molecules into acids & tars.',
    correctActions: ['Drop reboiler temp <=202°C', 'Add fresh makeup TEG & neutralize pH'],
    wrongActions: ['Raise boiler temp higher'],
    requiredParamCheck: (p) => p.reboilerTempC <= 202 && p.makeupBoost >= 0.2,
    physicsEffects: { reboilerDeltaC: 10, purityPenalty: 0.85, lossAdd: 0.3 },
    debriefPhysics: 'Above 204 °C, triethylene glycol decomposes exponentially into corrosive organic acids.',
  },
  gly_oxidation: {
    id: 'gly_oxidation',
    name: 'Oxidation from Oxygen Ingress',
    category: 'glycol',
    unitId: 'V-104',
    severity: 'WARN',
    visualCue: 'Rust-red oxidized glycol foam & sludge in V-104 surge drum.',
    gaugeEffect: 'Acidic TEG pH (~4.9), foaming tendency, dark sight glass.',
    rootCause: 'Air sucked into atmospheric surge drum V-104 or pump suction oxidizes hot TEG.',
    correctActions: ['Blanket/purge V-104 with fuel gas', 'Neutralize pH & add fresh TEG'],
    wrongActions: ['Vent V-104 hatch open to air'],
    requiredFieldAction: 'neutralize_ph',
    physicsEffects: { purityPenalty: 0.5, trayEffMult: 0.78, exchEffDrop: 10 },
    debriefPhysics: 'Even trace O2 contacting hot TEG (>120 °C) rapidly oxidizes glycol into acidic gums.',
  },
  gly_low_ph: {
    id: 'gly_low_ph',
    name: 'Low pH / Acidic Glycol & Corrosion',
    category: 'glycol',
    unitId: 'V-104',
    severity: 'WARN',
    visualCue: 'Dark tea-colored glycol in sight glass with metallic corrosion sheen.',
    gaugeEffect: 'Lab pH sample reads 4.6 (target 6.8–7.8); solids load rising.',
    rootCause: 'Absorbed H2S/CO2 acid gases or thermal cracking drop glycol pH, eating steel vessels.',
    correctActions: ['Neutralize TEG pH (amine buffer)', 'Check H2S / reboiler temp'],
    wrongActions: ['Ignore pH sample'],
    requiredFieldAction: 'neutralize_ph',
    cascadeTo: 'gly_solids',
    cascadeDelaySec: 45,
    physicsEffects: { purityPenalty: 0.38, filterDpAdd: 0.55 },
    debriefPhysics: 'Acidic TEG accelerates steel corrosion, creating black iron oxide/sulfide sludge.',
  },
  gly_high_water: {
    id: 'gly_high_water',
    name: 'High Water in Lean TEG',
    category: 'glycol',
    unitId: 'H-101',
    severity: 'CRIT',
    visualCue: 'Pale watery liquid film in V-104; dry gas fails moisture spec.',
    gaugeEffect: 'Lean TEG purity <97.8 wt%; dry gas H2O > 9 lb/MMscf.',
    rootCause: 'Insufficient reboiler heat or lost stripping gas leaves excess water in regenerated TEG.',
    correctActions: ['Raise H-101 temp to 198–202 °C', 'Add stripping gas'],
    wrongActions: ['Lower reboiler temp below 185 °C'],
    requiredParamCheck: (p) => p.reboilerTempC >= 196 && p.strippingGasBoost >= 0.25,
    physicsEffects: { reboilerDeltaC: -18, purityPenalty: 1.4 },
    debriefPhysics: 'Residual water in lean TEG sets the minimum equilibrium water vapor pressure at the tower top.',
  },
  gly_chemical: {
    id: 'gly_chemical',
    name: 'Chemical Contamination',
    category: 'glycol',
    unitId: 'V-101',
    severity: 'CRIT',
    visualCue: 'Thick soapy foam & milky emulsion surging through V-101 & V-102.',
    gaugeEffect: 'Sharp foaming ΔP and degraded tray efficiency.',
    rootCause: 'Upstream well-treating chemicals, methanol, or corrosion inhibitor carried into contactor.',
    correctActions: ['Add antifoam & replace carbon filter', 'Sample TEG & bleed dirty stock'],
    wrongActions: ['Pump more contaminated TEG faster'],
    requiredFieldAction: 'add_antifoam',
    cascadeTo: 'abs_foaming',
    cascadeDelaySec: 30,
    physicsEffects: { trayEffMult: 0.58, lossAdd: 1.0, purityPenalty: 0.45 },
    debriefPhysics: 'Surfactant well chemicals lower liquid surface tension and boost glycol volatility.',
  },
  gly_emulsion: {
    id: 'gly_emulsion',
    name: 'Glycol-Hydrocarbon Emulsion',
    category: 'glycol',
    unitId: 'V-102',
    severity: 'WARN',
    visualCue: 'Milky brown unsettled emulsion fills V-102 flash tank sight glass.',
    gaugeEffect: 'F-101 ΔP climbs, poor phase separation, foaming risk.',
    rootCause: 'High shear through LCV-101 + surfactants prevents hydrocarbon droplets from coalescing.',
    correctActions: ['Add antifoam / demulsifier', 'Drain V-102 & replace F-101 filter'],
    wrongActions: ['Increase flash pressure'],
    requiredFieldAction: 'drain_boot',
    physicsEffects: { trayEffMult: 0.72, filterDpAdd: 0.75, lossAdd: 0.55 },
    debriefPhysics: 'Emulsified oil passes through the flash tank into the still column, causing violent steam-distillation foaming.',
  },
  gly_cold_visc: {
    id: 'gly_cold_visc',
    name: 'TEG High Viscosity / Cold Weather',
    category: 'glycol',
    unitId: 'P-101',
    severity: 'WARN',
    visualCue: 'Slow, syrupy flow arrows along lean loop; pump shudders.',
    gaugeEffect: 'Pump suction starved, low GPM, absorber trays slug.',
    rootCause: 'Sub-zero ambient cools TEG lines so viscosity shoots past 100 cP.',
    correctActions: ['Restore exchanger/tracing heat (>=35°C)', 'Vent/check pump suction'],
    wrongActions: ['Shut off lean-rich exchanger'],
    requiredParamCheck: (p) => p.glycolInTempC >= 35 && p.exchangerEffPct >= 75,
    cascadeTo: 'pmp_cavitation',
    cascadeDelaySec: 40,
    physicsEffects: { circMult: 0.52, inletTempDeltaC: -15, trayEffMult: 0.74 },
    debriefPhysics: 'TEG viscosity rises steeply below 15 °C, choking pump NPSH and tray hydraulics.',
  },
  gly_low_inventory: {
    id: 'gly_low_inventory',
    name: 'Low Glycol Inventory',
    category: 'glycol',
    unitId: 'V-104',
    severity: 'CRIT',
    visualCue: 'V-104 sight glass drops to bottom red zone (<20%).',
    gaugeEffect: 'LC-104 low alarm, impending pump cavitation & fire-tube exposure risk.',
    rootCause: 'Cumulative carryover or seal leak depleted system glycol volume.',
    correctActions: ['Add fresh makeup TEG', 'Inspect for leaks or carryover'],
    wrongActions: ['Increase pump rate with empty surge drum'],
    requiredFieldAction: 'add_makeup',
    cascadeTo: 'pmp_cavitation',
    cascadeDelaySec: 34,
    physicsEffects: { circMult: 0.65 },
    debriefPhysics: 'Low V-104 level drops static suction head to P-101 and threatens fire-tube level in H-101.',
  },

  // === 3. REGENERATION (12) ===
  reg_overheat: {
    id: 'reg_overheat',
    name: 'Reboiler Overheating (>204 °C)',
    category: 'regeneration',
    unitId: 'H-101',
    severity: 'CRIT',
    visualCue: 'H-101 burner roars white-orange; TI-104 alarm beacon flashes bright red.',
    gaugeEffect: 'TI-104 > 205 °C; fuel gas high; decomposition risk.',
    rootCause: 'Fuel controller set too high or miscalibrated temperature loop.',
    correctActions: ['Lower reboiler temperature to 196–202 °C', 'Sample TEG purity/pH'],
    wrongActions: ['Push temperature even higher'],
    requiredParamCheck: (p) => p.reboilerTempC <= 202,
    cascadeTo: 'reg_thermal_decomp',
    cascadeDelaySec: 35,
    physicsEffects: { reboilerDeltaC: 11, fuelMult: 1.25 },
    debriefPhysics: '204 °C (400 °F) is the hard metallurgical/chemical ceiling for triethylene glycol.',
  },
  reg_fouling: {
    id: 'reg_fouling',
    name: 'Reboiler Fire-Tube Fouling',
    category: 'regeneration',
    unitId: 'H-101',
    severity: 'WARN',
    visualCue: 'Crusty dark scale patches visibly coat the submerged H-101 U-tube.',
    gaugeEffect: 'High fuel gas burn with sluggish lean TEG purity (~97.9%).',
    rootCause: 'Baked salt, iron sulfide, and tar isolate fire tube from boiling TEG.',
    correctActions: ['Descale H-101 fire tube', 'Inspect F-101 filter & add stripping gas'],
    wrongActions: ['Overfire burner >204°C to compensate'],
    requiredFieldAction: 'descale_tube',
    cascadeTo: 'reg_hotspot',
    cascadeDelaySec: 45,
    physicsEffects: { reboilerDeltaC: -9.5, fuelMult: 1.28, purityPenalty: 0.45 },
    debriefPhysics: 'Scale forces higher fire-tube wall temperature for less bath heat transfer, wasting fuel and scorching TEG.',
  },
  reg_hotspot: {
    id: 'reg_hotspot',
    name: 'Fire-Tube Hot Spots & Tube Failure',
    category: 'regeneration',
    unitId: 'H-101',
    severity: 'CRIT',
    visualCue: 'Bright cherry-orange glowing band on H-101 fire tube; steam puffs at stack.',
    gaugeEffect: 'Erratic TI-104 spikes, dark flue wisps, sudden decomposition.',
    rootCause: 'Severe local fouling or low liquid level exposes fire tube metal to flame impingement.',
    correctActions: ['Descale/inspect H-101 tube & cut temp <=198°C', 'Verify level'],
    wrongActions: ['Increase burner firing'],
    requiredFieldAction: 'descale_tube',
    physicsEffects: { reboilerDeltaC: 8, purityPenalty: 0.7, fuelMult: 1.32, lossAdd: 0.35 },
    debriefPhysics: 'Exposed or scale-blanketed fire tubes overheat locally past 450 °C, cracking TEG and risking tube rupture.',
  },
  reg_flameout: {
    id: 'reg_flameout',
    name: 'Burner Flame-Out / Pilot Loss',
    category: 'regeneration',
    unitId: 'H-101',
    severity: 'CRIT',
    visualCue: 'H-101 burner flame is completely OUT; cold dark vapor from still.',
    gaugeEffect: 'TI-104 plunges below 175 °C, TEG purity sinks <96.5%, gas fails spec.',
    rootCause: 'Wet slug in fuel gas or pilot thermocouple trip snuffed main burner.',
    correctActions: ['Purge & restart H-101 burner', 'Verify fuel gas knockout'],
    wrongActions: ['Force fuel valve wide open without reigniting'],
    requiredFieldAction: 'restart_burner',
    physicsEffects: { burnerOut: true, reboilerDeltaC: -34, purityPenalty: 1.8 },
    debriefPhysics: 'Without reboiler heat, water stays trapped in glycol and dehydration collapses within minutes.',
  },
  reg_poor_comb: {
    id: 'reg_poor_comb',
    name: 'Poor Combustion (Air/Fuel Ratio)',
    category: 'regeneration',
    unitId: 'H-101',
    severity: 'WARN',
    visualCue: 'Thick dark soot smoke pours out H-101 flue stack; lazy orange flame.',
    gaugeEffect: 'High fuel burn (+35%) with falling bath temperature.',
    rootCause: 'Plugged air register or erratic fuel pressure causes incomplete combustion.',
    correctActions: ['Tune burner air/fuel combustion', 'Check PCV-102 fuel pressure'],
    wrongActions: ['Shut off stripping gas'],
    requiredFieldAction: 'tune_combustion',
    physicsEffects: { reboilerDeltaC: -11, fuelMult: 1.38 },
    debriefPhysics: 'Fuel-rich incomplete combustion coats fire tubes with soot, drops efficiency, and creates CO hazard.',
  },
  reg_still_flood: {
    id: 'reg_still_flood',
    name: 'Still Column Flooding',
    category: 'regeneration',
    unitId: 'V-103',
    severity: 'CRIT',
    visualCue: 'Amber glycol foam spurts out top of V-103 steam vent.',
    gaugeEffect: 'TI-103 overhead > 112 °C, high TEG loss, H-101 level swings.',
    rootCause: 'Excessive boil-up rate or high stripping gas blows liquid up V-103 packing.',
    correctActions: ['Reduce reboiler temp/stripping surge', 'Inspect V-103 packing'],
    wrongActions: ['Add more stripping gas'],
    requiredParamCheck: (p) => p.reboilerTempC <= 200 && p.strippingGasBoost <= 0.4,
    physicsEffects: { lossAdd: 1.1, fuelMult: 1.15 },
    debriefPhysics: 'When upward steam + stripping vapor velocity floods V-103, TEG pukes out the atmospheric vent.',
  },
  reg_still_plug: {
    id: 'reg_still_plug',
    name: 'Still Column Packing Plugged',
    category: 'regeneration',
    unitId: 'V-103',
    severity: 'CRIT',
    visualCue: 'Choked wispy steam from V-103 vent; H-101 pressure relief shudders.',
    gaugeEffect: 'Poor lean TEG purity (steam trapped), rising H-101 pressure.',
    rootCause: 'Coked glycol or salt crust bridged the ceramic/structured packing in V-103.',
    correctActions: ['Inspect & clear V-103 packing', 'Check F-101 filter'],
    wrongActions: ['Seal still overhead'],
    requiredFieldAction: 'inspect_unit',
    cascadeTo: 'reg_still_flood',
    cascadeDelaySec: 40,
    physicsEffects: { purityPenalty: 1.05, lossAdd: 0.45 },
    debriefPhysics: 'Water vapor cannot escape freely through plugged still packing, raising H-101 partial water pressure.',
  },
  reg_excess_strip: {
    id: 'reg_excess_strip',
    name: 'Excess Stripping Gas',
    category: 'regeneration',
    unitId: 'V-103',
    severity: 'WARN',
    visualCue: 'Strong white vapor/glycol jet blasting out V-103 still top.',
    gaugeEffect: 'TI-103 elevated (>108 °C), elevated TEG vapor loss & wasted fuel.',
    rootCause: 'Stripping gas valve wide open sweeps glycol mist out with steam.',
    correctActions: ['Trim excess stripping gas back to target', 'Verify TI-103 ~101°C'],
    wrongActions: ['Raise reboiler temperature above 202°C'],
    requiredParamCheck: (p) => p.strippingGasBoost <= 0.45,
    physicsEffects: { lossAdd: 0.92, fuelMult: 1.18 },
    debriefPhysics: 'Too much stripping gas saturates overhead with glycol vapor and overloads the reflux section.',
  },
  reg_no_strip: {
    id: 'reg_no_strip',
    name: 'No Stripping Gas Flow',
    category: 'regeneration',
    unitId: 'V-103',
    severity: 'WARN',
    visualCue: 'Weak lazy steam from V-103; lean purity stalls below required spec.',
    gaugeEffect: 'TEG purity stuck ~98.3% while dry gas fails tight dew-point target.',
    rootCause: 'Stripping gas supply blocked or valve shut during high water-load operation.',
    correctActions: ['Add stripping gas to H-101/V-103', 'Confirm purity rises >99.1%'],
    wrongActions: ['Overheat reboiler >204°C instead of using stripping gas'],
    requiredParamCheck: (p) => p.strippingGasBoost >= 0.35,
    physicsEffects: { purityPenalty: 0.78 },
    debriefPhysics: 'Stripping gas lowers water partial pressure in H-101 so TEG reaches >99.3 wt% safely below 204 °C.',
  },
  reg_vapor_loss: {
    id: 'reg_vapor_loss',
    name: 'High TEG Loss Through Still (Vapor Carryover)',
    category: 'regeneration',
    unitId: 'V-103',
    severity: 'CRIT',
    visualCue: 'Dense golden-white mist plume rising off V-103 still top.',
    gaugeEffect: 'TI-103 > 115 °C, V-104 surge level drifting down steadily.',
    rootCause: 'Lost reflux cooling at top of V-103 allows vaporized TEG to escape uncondensed.',
    correctActions: ['Restore V-103 reflux / check rich feed temp', 'Lower H-101 temp slightly'],
    wrongActions: ['Increase reboiler heat'],
    requiredFieldAction: 'inspect_unit',
    physicsEffects: { lossAdd: 1.25, reboilerDeltaC: 4 },
    debriefPhysics: 'Cold rich TEG passing through the still top coil condenses TEG vapors; if hot or bypassed, TEG escapes as steam.',
  },
  reg_reflux_fail: {
    id: 'reg_reflux_fail',
    name: 'Still Reflux Coil Failure',
    category: 'regeneration',
    unitId: 'V-103',
    severity: 'WARN',
    visualCue: 'V-103 top shell glows warm; heavy mist plume overhead.',
    gaugeEffect: 'TI-103 > 112 °C; TEG loss climbs >0.8 gal/MMscf.',
    rootCause: 'Rich TEG preheat coil fouled or bypassed around V-103 top condenser.',
    correctActions: ['Inspect V-103 reflux coil', 'Check rich TEG feed route'],
    wrongActions: ['Add stripping gas without fixing reflux'],
    requiredFieldAction: 'inspect_unit',
    cascadeTo: 'reg_vapor_loss',
    cascadeDelaySec: 36,
    physicsEffects: { lossAdd: 0.85, fuelMult: 1.12 },
    debriefPhysics: 'The top reflux coil creates internal liquid reflux to knock TEG vapor back into the reboiler.',
  },
  reg_surge_level: {
    id: 'reg_surge_level',
    name: 'Surge / Accumulator Level Problem',
    category: 'regeneration',
    unitId: 'V-104',
    severity: 'CRIT',
    visualCue: 'V-104 sight glass critically low (<18%) or overfilled (>90%).',
    gaugeEffect: 'LC-104 alarm active; pump suction threatened.',
    rootCause: 'Unbalanced LCV-101/102 inventory or unreplenished glycol losses.',
    correctActions: ['Add makeup TEG / balance LCV-102', 'Read physical V-104 sight glass'],
    wrongActions: ['Ignore LC-104 alarm'],
    requiredFieldAction: 'add_makeup',
    cascadeTo: 'pmp_cavitation',
    cascadeDelaySec: 38,
    physicsEffects: { circMult: 0.72 },
    debriefPhysics: 'V-104 buffers loop inventory; losing level starves P-101 and drains H-101.',
  },
  reg_thermal_decomp: {
    id: 'reg_thermal_decomp',
    name: 'TEG Thermal Decomposition',
    category: 'regeneration',
    unitId: 'H-101',
    severity: 'CRIT',
    visualCue: 'Blackened tar-like liquid in V-104 & pungent brown still smoke.',
    gaugeEffect: 'TI-104 > 205 °C, severe purity drop, F-101 plugging rising.',
    rootCause: 'Sustained over-temperature >204 °C broke down TEG chains into acids and polymers.',
    correctActions: ['Drop reboiler temp <=200°C immediately', 'Add fresh TEG & neutralize pH'],
    wrongActions: ['Leave TI-104 above 204°C'],
    requiredParamCheck: (p) => p.reboilerTempC <= 200,
    physicsEffects: { reboilerDeltaC: 9, purityPenalty: 1.15, filterDpAdd: 0.7, lossAdd: 0.45 },
    debriefPhysics: 'Thermal cracking is irreversible; degraded glycol must be neutralized, filtered, and topped up with fresh TEG.',
  },

  // === 4. FLASH TANK / FILTERS (7) ===
  flt_high_press: {
    id: 'flt_high_press',
    name: 'High Flash Tank Pressure',
    category: 'flash_filter',
    unitId: 'V-102',
    severity: 'CRIT',
    visualCue: 'PCV-102 choked shut; V-102 pressure beacon flashes red.',
    gaugeEffect: 'PC-102 > 8.5 bar; poor hydrocarbon flashing -> foaming downstream.',
    rootCause: 'PCV-102 plugged or set too high traps methane/BTEX in rich TEG.',
    correctActions: ['Stroke/open PCV-102 back to 3.5–4.5 bar', 'Check flare backpressure'],
    wrongActions: ['Close PCV-102 further'],
    requiredFieldAction: 'stroke_valve',
    cascadeTo: 'abs_foaming',
    cascadeDelaySec: 42,
    physicsEffects: { flashPressAdd: 5.2, trayEffMult: 0.78 },
    debriefPhysics: 'Higher V-102 pressure keeps hydrocarbon gases dissolved in rich TEG until they flash violently in H-101.',
  },
  flt_level_upset: {
    id: 'flt_level_upset',
    name: 'Flash Tank Level Upset',
    category: 'flash_filter',
    unitId: 'V-102',
    severity: 'WARN',
    visualCue: 'V-102 sight glass climbs above 85% or drops near empty (<15%).',
    gaugeEffect: 'LC-102 alarm active; flare carryover or blow-by risk.',
    rootCause: 'LCV-102 sticky or mismatched flow between V-101 and F-101.',
    correctActions: ['Stroke/adjust LCV-102', 'Read V-102 sight glass'],
    wrongActions: ['Leave LCV-102 locked out'],
    requiredFieldAction: 'stroke_valve',
    physicsEffects: { circMult: 0.76, lossAdd: 0.45 },
    debriefPhysics: 'High flash level sends TEG out the flare header; low level blows flash gas into F-101.',
  },
  flt_pcv_fail: {
    id: 'flt_pcv_fail',
    name: 'Vent Control Valve PCV-102 Failure',
    category: 'flash_filter',
    unitId: 'PCV-102',
    severity: 'CRIT',
    visualCue: 'PCV-102 stem frozen while FL-101 flare dims or roars.',
    gaugeEffect: 'Flash pressure drifts abnormally high (>8 bar) or collapses (<1.2 bar).',
    rootCause: 'Failed diaphragm/positioner on PCV-102.',
    correctActions: ['Stroke/reset PCV-102 actuator', 'Check V-102 pressure'],
    wrongActions: ['Ignore V-102 pressure alarm'],
    requiredFieldAction: 'stroke_valve',
    physicsEffects: { flashPressAdd: 4.8, flareSurge: true },
    debriefPhysics: 'PCV-102 regulates residence pressure in V-102 to balance flashing and glycol retention.',
  },
  flt_plugging: {
    id: 'flt_plugging',
    name: 'Cartridge Filter F-101 Plugging',
    category: 'flash_filter',
    unitId: 'F-101',
    severity: 'CRIT',
    visualCue: 'F-101 flashes amber/red; rich flow downstream shrinks to a trickle.',
    gaugeEffect: 'PDI-101 > 1.8 bar; V-104 surge level drains below 22%.',
    rootCause: 'Accumulated iron sulfide, wax, and scale choked the 5-micron filter elements.',
    correctActions: ['Replace F-101 cartridge', 'Close bypass after swap'],
    wrongActions: ['Leave filter plugged & raise pump rate'],
    requiredFieldAction: 'replace_filter',
    cascadeTo: 'flt_suction_starved',
    cascadeDelaySec: 38,
    physicsEffects: { filterDpAdd: 1.65, circMult: 0.52 },
    debriefPhysics: 'High ΔP across F-101 starves the regeneration loop and risks collapsing filter cores.',
  },
  flt_carbon_sat: {
    id: 'flt_carbon_sat',
    name: 'Carbon Filter Saturation',
    category: 'flash_filter',
    unitId: 'F-101',
    severity: 'WARN',
    visualCue: 'Amber-brown discoloration slips past F-101 toward V-104.',
    gaugeEffect: 'Normal PDI-101 ΔP, but TEG darkens and V-101 starts foaming.',
    rootCause: 'Activated carbon bed exhausted; dissolved hydrocarbons & BTEX break through.',
    correctActions: ['Replace filter/carbon media', 'Sample TEG color'],
    wrongActions: ['Assume clean ΔP means clean TEG'],
    requiredFieldAction: 'replace_filter',
    cascadeTo: 'abs_foaming',
    cascadeDelaySec: 40,
    physicsEffects: { trayEffMult: 0.74, purityPenalty: 0.35, btexHigh: true },
    debriefPhysics: 'Carbon adsorbs dissolved hydrocarbons without changing ΔP; only sampling or foaming reveals saturation.',
  },
  flt_bypass_open: {
    id: 'flt_bypass_open',
    name: 'Filter Bypass Left Open',
    category: 'flash_filter',
    unitId: 'F-101',
    severity: 'WARN',
    visualCue: 'Bypass line open around F-101; zero pressure drop.',
    gaugeEffect: 'Suspiciously low PDI-101 (~0.02 bar) while fouling builds in E-102/H-101.',
    rootCause: 'Operator forgot to close manual filter bypass after past cartridge change.',
    correctActions: ['Close F-101 filter bypass', 'Check PDI-101'],
    wrongActions: ['Leave bypass open'],
    requiredFieldAction: 'close_bypass',
    cascadeTo: 'reg_fouling',
    cascadeDelaySec: 45,
    physicsEffects: { filterDpAdd: -0.24, exchEffDrop: 14, trayEffMult: 0.86 },
    debriefPhysics: 'An open bypass lets 100% of pipe scale bypass F-101 straight into the heat exchanger and fire tube.',
  },
  flt_suction_starved: {
    id: 'flt_suction_starved',
    name: 'Pump Suction Starved',
    category: 'flash_filter',
    unitId: 'P-101',
    severity: 'CRIT',
    visualCue: 'V-104 sight glass near empty; P-101 vibrates harshly.',
    gaugeEffect: 'Low V-104 level (<20%), erratic P-101 discharge PI-102.',
    rootCause: 'Upstream blockage or low V-104 level drops NPSHa below pump requirement.',
    correctActions: ['Check upstream F-101 / strainer', 'Add TEG & vent pump'],
    wrongActions: ['Run pump dry at maximum flow'],
    requiredFieldAction: 'clean_strainer',
    cascadeTo: 'pmp_cavitation',
    cascadeDelaySec: 28,
    physicsEffects: { circMult: 0.42, pumpCavitate: true },
    debriefPhysics: 'Starving pump suction vaporizes glycol/water pockets at the impeller eye, eroding metal.',
  },

  // === 5. PUMP AND LOOP (10) ===
  pmp_cavitation: {
    id: 'pmp_cavitation',
    name: 'Glycol Pump P-101 Cavitation',
    category: 'pump_loop',
    unitId: 'P-101',
    severity: 'CRIT',
    visualCue: 'P-101 pump skid rattles violently; erratic lean flow pulses.',
    gaugeEffect: 'PI-102 fluctuates wildly (22–44 bar), circulation falls 55%.',
    rootCause: 'Low NPSHa from hot pump suction, plugged strainer, or low V-104 level.',
    correctActions: ['Vent gas / clean strainer', 'Lower lean temp & check E-102'],
    wrongActions: ['Increase circulation demand further'],
    requiredFieldAction: 'clean_strainer',
    physicsEffects: { circMult: 0.45, pumpCavitate: true },
    debriefPhysics: 'Collapsing vapor bubbles hammer impeller vanes, destroying pump head and mechanical seals.',
  },
  pmp_gas_lock: {
    id: 'pmp_gas_lock',
    name: 'Pump Gas-Lock',
    category: 'pump_loop',
    unitId: 'P-101',
    severity: 'CRIT',
    visualCue: 'P-101 motor spins smoothly, yet lean TEG flow arrows are stalled!',
    gaugeEffect: 'PI-102 low near suction pressure; dry gas fails spec rapidly.',
    rootCause: 'Unvented vapor pocket trapped inside P-101 volute prevents liquid prime.',
    correctActions: ['Bleed/vent gas-lock from P-101 casing', 'Verify flow resumes'],
    wrongActions: ['Keep spinning dry pump without venting'],
    requiredFieldAction: 'vent_gaslock',
    physicsEffects: { pumpZero: true },
    debriefPhysics: 'Centrifugal or plunger pumps lose prime completely when compressible gas fills the chamber.',
  },
  pmp_seal_leak: {
    id: 'pmp_seal_leak',
    name: 'Pump Mechanical Seal Leak',
    category: 'pump_loop',
    unitId: 'P-101',
    severity: 'CRIT',
    visualCue: 'Amber glycol puddle forms directly beneath P-101 shaft seal.',
    gaugeEffect: 'V-104 level drifts downward; glycol loss climbs.',
    rootCause: 'Worn carbon seal face from solids or past cavitation.',
    correctActions: ['Isolate/repair seal & contain spill', 'Top up V-104 TEG'],
    wrongActions: ['Ignore deck puddle'],
    requiredFieldAction: 'contain_spill',
    cascadeTo: 'gly_low_inventory',
    cascadeDelaySec: 40,
    physicsEffects: { lossAdd: 0.85, circMult: 0.85, spillHazard: true },
    debriefPhysics: 'Mechanical seal leaks waste expensive TEG, cause slip/environmental hazards, and drain surge inventory.',
  },
  pmp_trip: {
    id: 'pmp_trip',
    name: 'Glycol Pump P-101 Trip',
    category: 'pump_loop',
    unitId: 'P-101',
    severity: 'CRIT',
    visualCue: 'P-101 impeller & cooling fan halted; lean TEG pipes completely static.',
    gaugeEffect: 'PI-102 = 0 bar, 0.0 GPM circulation, sales gas hits inlet moisture.',
    rootCause: 'Motor overload relay tripped or VFD fault shut down P-101.',
    correctActions: ['Reset / restart P-101 pump', 'Check strainer & motor amps'],
    wrongActions: ['Leave H-101 firing at max heat with zero flow'],
    requiredFieldAction: 'reset_pump',
    physicsEffects: { pumpZero: true },
    debriefPhysics: 'With zero lean TEG entering V-101 top, dehydration stops instantly while wet gas keeps flowing.',
  },
  pmp_stroke_wrong: {
    id: 'pmp_stroke_wrong',
    name: 'Pump Stroke / Speed Misadjusted',
    category: 'pump_loop',
    unitId: 'P-101',
    severity: 'WARN',
    visualCue: 'Impeller spins sluggishly; lean TEG circulation drops below 1.2 gal/lb.',
    gaugeEffect: 'Low glycol GPM, dry gas H2O creeps above 7 lb/MMscf.',
    rootCause: 'Manual pump stroke dial / VFD speed left at low setting after maintenance.',
    correctActions: ['Raise circulation rate >=3.0 gal/lb', 'Check P-101 stroke'],
    wrongActions: ['Drop circulation lower'],
    requiredParamCheck: (p) => p.circRateGalPerLb >= 2.8,
    physicsEffects: { circMult: 0.46 },
    debriefPhysics: 'Minimum 2–3 gal TEG per lb water removed is needed to maintain Kremser absorption factor A > 1.',
  },
  pmp_strainer_plug: {
    id: 'pmp_strainer_plug',
    name: 'Suction Strainer Plugged',
    category: 'pump_loop',
    unitId: 'P-101',
    severity: 'CRIT',
    visualCue: 'P-101 shudders; reduced flow downstream.',
    gaugeEffect: 'Cavitation alarm, low GPM, V-104 stays full while pump starves!',
    rootCause: 'Scale or gasket debris blocked P-101 suction basket strainer.',
    correctActions: ['Clean P-101 suction strainer', 'Verify smooth discharge'],
    wrongActions: ['Top up V-104 when it is already full'],
    requiredFieldAction: 'clean_strainer',
    physicsEffects: { circMult: 0.48, pumpCavitate: true },
    debriefPhysics: 'Unlike low V-104 level, a plugged strainer shows full V-104 sight glass alongside pump cavitation.',
  },
  pmp_check_fail: {
    id: 'pmp_check_fail',
    name: 'Discharge Check Valve Failure',
    category: 'pump_loop',
    unitId: 'P-101',
    severity: 'CRIT',
    visualCue: 'High-pressure gas/TEG leaks backward through pump check valve.',
    gaugeEffect: 'PI-102 unstable, V-104 overfills if pump slows, net forward GPM drops.',
    rootCause: 'Stuck-open check flapper allows 55-bar tower pressure to push back toward P-101.',
    correctActions: ['Inspect/stroke pump discharge check valve', 'Verify PI-102 steady'],
    wrongActions: ['Stop pump without closing discharge isolation'],
    requiredFieldAction: 'stroke_valve',
    physicsEffects: { circMult: 0.56, flashPressAdd: 1.5 },
    debriefPhysics: 'A leaking discharge check valve causes slip loss during pumping and high-pressure backflow on shutdown.',
  },
  pmp_low_circ: {
    id: 'pmp_low_circ',
    name: 'Low Glycol Circulation',
    category: 'pump_loop',
    unitId: 'P-101',
    severity: 'WARN',
    visualCue: 'Slow lean TEG arrows; V-101 upper trays lightly wetted.',
    gaugeEffect: 'Kremser A < 1.0, sales moisture > 8 lb/MMscf.',
    rootCause: 'Circulation rate set too low for current gas throughput and water load.',
    correctActions: ['Increase glycol circulation toward 3.0–3.8 gal/lb'],
    wrongActions: ['Lower circulation rate'],
    requiredParamCheck: (p) => p.circRateGalPerLb >= 2.8,
    physicsEffects: { circMult: 0.5 },
    debriefPhysics: 'Below ~2 gal TEG/lb water, the Kremser absorption factor drops below unity and pinches tower performance.',
  },
  pmp_exch_fouling: {
    id: 'pmp_exch_fouling',
    name: 'Lean-Rich Exchanger Fouling / Leak',
    category: 'pump_loop',
    unitId: 'E-102',
    severity: 'WARN',
    visualCue: 'E-102 shell glows hot toward pump; rich/lean heat recovery slumped.',
    gaugeEffect: 'Fuel gas surges +30%, lean TEG hits P-101 hot, purity may dip.',
    rootCause: 'Asphaltene/salt scale fouled tubes or internal gasket leak mixes rich into lean TEG.',
    correctActions: ['Flush/isolate E-102 exchanger', 'Check exchanger recovery efficiency'],
    wrongActions: ['Turn off E-101 cooler as well'],
    requiredFieldAction: 'flush_exchanger',
    physicsEffects: { exchEffDrop: 38, fuelMult: 1.32, purityPenalty: 0.45 },
    debriefPhysics: 'Exchanger fouling steals reboiler heat and sends hot TEG to P-101; internal leaks re-contaminate clean lean TEG.',
  },
  pmp_cooler_fail: {
    id: 'pmp_cooler_fail',
    name: 'Gas-Glycol Cooler E-101 Failure',
    category: 'pump_loop',
    unitId: 'E-101',
    severity: 'WARN',
    visualCue: 'E-101 cooler shell hot; warm lean TEG streams into V-101 top.',
    gaugeEffect: 'Lean TEG enters tower >60 °C; equilibrium dew point climbs.',
    rootCause: 'E-101 bypass left open or shell fouled so dry gas no longer cools lean TEG.',
    correctActions: ['Restore / toggle E-101 cooler ON', 'Check glycol-in temp'],
    wrongActions: ['Switch E-101 off'],
    requiredFieldAction: 'toggle_cooler',
    physicsEffects: { coolerForcedOff: true },
    debriefPhysics: 'Hot lean TEG warms the top tray of V-101 where final dry gas equilibrium is set.',
  },

  // === 6. CONTROLS AND INSTRUMENTS (7) ===
  ctl_lt_drift: {
    id: 'ctl_lt_drift',
    name: 'Level Transmitter Drift (LC-102)',
    category: 'controls',
    unitId: 'V-102',
    severity: 'WARN',
    visualCue: 'Physical V-102 sight glass disagrees sharply with panel level bar!',
    gaugeEffect: 'Panel LC-102 falsely reads ~52% while physical vessel climbs >84%.',
    rootCause: 'Zero-shift or plugged impulse leg on differential-pressure level transmitter.',
    correctActions: ['Read physical sight glass & calibrate/verify gauge', 'Adjust LCV-102 manually'],
    wrongActions: ['Trust frozen panel reading blindly'],
    requiredFieldAction: 'verify_gauge',
    physicsEffects: { driftGaugeTag: 'LC-102', lossAdd: 0.35 },
    debriefPhysics: 'Never trust a single transmitter over a live local sight glass when process behavior disagrees.',
  },
  ctl_stuck_valve: {
    id: 'ctl_stuck_valve',
    name: 'Stuck Control Valve (LCV-102)',
    category: 'controls',
    unitId: 'LCV-102',
    severity: 'CRIT',
    visualCue: 'LCV-102 valve stem does not move despite controller demand.',
    gaugeEffect: 'V-102 floods while V-104 drains.',
    rootCause: 'Salt/tar packing friction froze valve stem in place.',
    correctActions: ['Stroke / free LCV-102 valve', 'Monitor V-102 & V-104 sight glasses'],
    wrongActions: ['Increase pump speed'],
    requiredFieldAction: 'stroke_valve',
    physicsEffects: { circMult: 0.58 },
    debriefPhysics: 'Manually exercising/stroking a binding control valve restores loop balance until turnaround maintenance.',
  },
  ctl_frozen_gauge: {
    id: 'ctl_frozen_gauge',
    name: 'Frozen Panel Gauge (TI-104 / PI-101)',
    category: 'controls',
    unitId: 'H-101',
    severity: 'WARN',
    visualCue: 'H-101 burner roaring abnormally while panel needle appears locked steady.',
    gaugeEffect: 'Panel TI-104 frozen at 198.0 °C while real bath drifts hot (>206 °C)!',
    rootCause: 'I/O card hang or seized gauge needle masks real process upset.',
    correctActions: ['Verify gauge in field / sample unit', 'Lower reboiler setpoint safely'],
    wrongActions: ['Assume plant is fine because one needle did not move'],
    requiredFieldAction: 'verify_gauge',
    physicsEffects: { frozenGaugeTag: 'TI-104', reboilerDeltaC: 9, purityPenalty: 0.35 },
    debriefPhysics: 'Comparing multiple independent cues (fuel gas, still temp, sight glass color) catches a frozen transmitter.',
  },
  ctl_false_alarm: {
    id: 'ctl_false_alarm',
    name: 'False Instrument Alarm',
    category: 'controls',
    unitId: 'F-101',
    severity: 'WARN',
    visualCue: 'PDI-101 alarm lamp lit, yet F-101 flow & V-104 level are totally steady.',
    gaugeEffect: 'High ΔP alarm shown on panel while field check confirms normal flow & clean ΔP.',
    rootCause: 'Loose transmitter wire or faulty switch triggers nuisance alarm.',
    correctActions: ['Verify gauge/ΔP in field to clear false alarm'],
    wrongActions: ['Emergency shut down healthy plant or bypass filter'],
    requiredFieldAction: 'verify_gauge',
    physicsEffects: { falseAlarmTag: 'PDI-101' },
    debriefPhysics: 'Always verify an isolated single-instrument alarm with local checks before upsetting a steady plant.',
  },
  ctl_pc_fail: {
    id: 'ctl_pc_fail',
    name: 'Failed Pressure Controller (PC-102)',
    category: 'controls',
    unitId: 'V-102',
    severity: 'CRIT',
    visualCue: 'PCV-102 hunts erratically; FL-101 flare height pulses.',
    gaugeEffect: 'V-102 pressure swings high (>7.5 bar), risking poor degassing.',
    rootCause: 'Bad PID loop tuning or failed pressure transducer on V-102.',
    correctActions: ['Take manual control / stroke PCV-102', 'Verify gauge on V-102'],
    wrongActions: ['Ignore pressure swings'],
    requiredFieldAction: 'stroke_valve',
    physicsEffects: { flashPressAdd: 4.1, flareSurge: true },
    debriefPhysics: 'Putting a failing auto controller into manual stabilization prevents PSV lift and foaming.',
  },
  ctl_wrong_sp: {
    id: 'ctl_wrong_sp',
    name: 'Wrong Reboiler / Circ Setpoint',
    category: 'controls',
    unitId: 'H-101',
    severity: 'WARN',
    visualCue: 'H-101 flame weak; lean TEG under-concentrated.',
    gaugeEffect: 'TI-104 holds steady at wrong 182 °C setpoint; dry gas moisture >8 lb/MMscf.',
    rootCause: 'Previous shift lowered TI-104 setpoint during turndown and forgot to restore.',
    correctActions: ['Restore reboiler temp to 196–201 °C & circ >=2.8'],
    wrongActions: ['Leave TI-104 at 182 °C'],
    requiredParamCheck: (p) => p.reboilerTempC >= 195 && p.circRateGalPerLb >= 2.8,
    physicsEffects: { reboilerDeltaC: -16, purityPenalty: 1.1 },
    debriefPhysics: 'Below 188 °C, lean TEG purity drops under 98 wt%, failing pipeline water specs.',
  },
  ctl_sight_fouled: {
    id: 'ctl_sight_fouled',
    name: 'Sight Glass Fouled',
    category: 'controls',
    unitId: 'V-104',
    severity: 'WARN',
    visualCue: 'V-104 sight glass coated dark opaque brown, hiding true level.',
    gaugeEffect: 'Visual level ambiguous; possible hidden low inventory.',
    rootCause: 'Asphaltenes and degraded glycol stained the armored gauge glass.',
    correctActions: ['Flush / clean V-104 sight glass', 'Check LC-104 transmitter'],
    wrongActions: ['Drain vessel blindly'],
    requiredFieldAction: 'clean_sightglass',
    physicsEffects: { purityPenalty: 0.25 },
    debriefPhysics: 'Blowing down and cleaning fouled sight glasses restores physical level verification.',
  },

  // === 7. GAS-SIDE UPSETS (7) ===
  gas_hot_inlet: {
    id: 'gas_hot_inlet',
    name: 'Inlet Gas Hotter Than Design',
    category: 'gas_upset',
    unitId: 'V-101',
    severity: 'CRIT',
    visualCue: 'Shaking hot wet gas line into V-101; steam haze rises inside tower.',
    gaugeEffect: 'TI-101 > 50 °C, water load doubles, sales gas > 9 lb/MMscf.',
    rootCause: 'Upstream aftercooler failed, sending hot water-saturated gas to contactor.',
    correctActions: ['Boost circulation & trays/stripping gas', 'Keep E-101 cooler ON'],
    wrongActions: ['Turn off E-101 cooler'],
    requiredParamCheck: (p) => p.coolerOn && p.circRateGalPerLb >= 3.8 && (p.strippingGasBoost >= 0.3 || p.numTrays >= 8),
    physicsEffects: { inletTempDeltaC: 20, inletWaterMult: 1.45 },
    debriefPhysics: 'Every +10 °C in saturated feed gas roughly doubles the mass of water vapor entering V-101.',
  },
  gas_water_rise: {
    id: 'gas_water_rise',
    name: 'Sudden Rise in Water Content',
    category: 'gas_upset',
    unitId: 'V-101',
    severity: 'CRIT',
    visualCue: 'Dense golden wet-gas arrows enter V-101; rich TEG darkens.',
    gaugeEffect: 'Water load spikes to ~75 lb/MMscf; H-101 duty jumps.',
    rootCause: 'Reservoir water breakthrough or warmer wellhead gathering feed.',
    correctActions: ['Increase glycol circulation >=3.8 & add stripping gas', 'Hold H-101 at 200°C'],
    wrongActions: ['Lower circulation rate'],
    requiredParamCheck: (p) => p.circRateGalPerLb >= 3.6 && p.reboilerTempC >= 198,
    physicsEffects: { inletWaterMult: 1.65 },
    debriefPhysics: 'Higher lb H2O/MMscf demands proportionally higher GPM (gal/lb × lb/hr) and extra reboiler boil-up.',
  },
  gas_wet_slug: {
    id: 'gas_wet_slug',
    name: 'Wet Gas Slug Arrival',
    category: 'gas_upset',
    unitId: 'V-101',
    severity: 'CRIT',
    visualCue: 'V-101 bottom boot surges; V-102 flash tank level shoots >84%.',
    gaugeEffect: 'High V-102 level alarm, sudden ΔP bump, dry gas spike.',
    rootCause: 'Pipeline pigging or terrain slugging dumped liquid water into inlet.',
    correctActions: ['Drain V-101 scrubber boot', 'Stabilize V-102 flash level'],
    wrongActions: ['Turn off pump P-101'],
    requiredFieldAction: 'drain_boot',
    physicsEffects: { inletWaterMult: 1.65, carryoverAdd: 3.6, lossAdd: 0.65 },
    debriefPhysics: 'A liquid slug must be dumped quickly at the inlet scrubber before it dilutes the glycol loop.',
  },
  gas_sour_h2s: {
    id: 'gas_sour_h2s',
    name: 'Sour Gas Breakthrough (H2S Alarm)',
    category: 'gas_upset',
    unitId: 'V-102',
    severity: 'CRIT',
    visualCue: 'Toxic yellow-amber gas warning halo near V-102 & FL-101 flare.',
    gaugeEffect: 'H2S > 25 ppm alarm, TEG pH drops rapidly, corrosion risk.',
    rootCause: 'Sour gas well tied into sweet gathering header; H2S flashes at V-102 & still.',
    correctActions: ['Verify flare burning H2S & apply PPE/safety check', 'Neutralize TEG pH'],
    wrongActions: ['Vent V-102/V-104 without flare/PPE'],
    requiredFieldAction: 'apply_ppe_lockout',
    cascadeTo: 'gly_low_ph',
    cascadeDelaySec: 42,
    physicsEffects: { sourH2s: true, purityPenalty: 0.3 },
    debriefPhysics: 'H2S dissolves preferentially into rich TEG and concentrates in V-102/V-103 vent streams—deadly without flare incineration & SCBA PPE.',
  },
  gas_comp_oil: {
    id: 'gas_comp_oil',
    name: 'Compressor Oil Carryover',
    category: 'gas_upset',
    unitId: 'V-101',
    severity: 'WARN',
    visualCue: 'Oily film coats V-101 lower trays & darkens V-102 sight glass.',
    gaugeEffect: 'Rising ΔP and rapid onset of contactor foaming.',
    rootCause: 'Upstream gas compressor ring blow-by injects synthetic lube oil into wet gas.',
    correctActions: ['Drain V-101 scrubber & replace F-101 carbon filter', 'Add antifoam'],
    wrongActions: ['Ignore foaming ΔP'],
    requiredFieldAction: 'replace_filter',
    cascadeTo: 'abs_foaming',
    cascadeDelaySec: 34,
    physicsEffects: { trayEffMult: 0.66, filterDpAdd: 0.65, lossAdd: 0.6 },
    debriefPhysics: 'Compressor lube oils are potent foam stabilizers in TEG and poison carbon beds.',
  },
  gas_prod_surge: {
    id: 'gas_prod_surge',
    name: 'Production Surge',
    category: 'gas_upset',
    unitId: 'V-101',
    severity: 'CRIT',
    visualCue: 'High-speed gas chevrons race through V-101; trays churn hard.',
    gaugeEffect: 'Gas rate jumps +50%; ΔP & sales water climb fast.',
    rootCause: 'Additional wells brought online simultaneously without notifying plant.',
    correctActions: ['Adjust circulation / trays to absorb surge', 'Keep gas velocity safe'],
    wrongActions: ['Drop tower pressure'],
    requiredParamCheck: (p) => p.circRateGalPerLb >= 3.3 && p.numTrays >= 7,
    physicsEffects: { gasFlowMult: 1.5, absorberDpAdd: 0.45, trayEffMult: 0.78 },
    debriefPhysics: 'Sudden throughput jumps demand higher GPM and adequate stages to avoid breakthrough.',
  },
  gas_press_drop: {
    id: 'gas_press_drop',
    name: 'Upstream Pressure Drop',
    category: 'gas_upset',
    unitId: 'V-101',
    severity: 'CRIT',
    visualCue: 'High-volume gas bubbles race rapidly through V-101 trays.',
    gaugeEffect: 'PI-101 falls to ~29 bar; tower approaches flooding & sales gas wets up.',
    rootCause: 'Upstream compressor trip or pipeline break drops contactor pressure.',
    correctActions: ['Reduce gas flow rate & boost circ/purity', 'Protect tower from flooding'],
    wrongActions: ['Push maximum gas flow at 29 bar'],
    requiredParamCheck: (p) => p.gasFlowMMscfd <= 40 && p.circRateGalPerLb >= 3.4,
    physicsEffects: { pressureDeltaBar: -26, trayEffMult: 0.7, absorberDpAdd: 0.45 },
    debriefPhysics: 'At lower pressure, gas saturates with ~2x water per MMscf and moves faster through trays.',
  },

  // === 8. SAFETY AND ENVIRONMENT (7) ===
  saf_psv_lift: {
    id: 'saf_psv_lift',
    name: 'PSV Relief Valve Lifting',
    category: 'safety',
    unitId: 'FL-101',
    severity: 'CRIT',
    visualCue: 'FL-101 flare roars tall bright orange; relief vapor surges.',
    gaugeEffect: 'High pressure alarm on PI-101 or PC-102; flare over-pressure.',
    rootCause: 'Blocked outlet or stuck LCV/PCV pushed vessel above PSV set pressure.',
    correctActions: ['Lower pressure / open PCV-102 & verify PSV reseats'],
    wrongActions: ['Clamp PSV shut'],
    requiredFieldAction: 'verify_psv',
    physicsEffects: { pressureDeltaBar: 22, flareSurge: true, lossAdd: 0.4 },
    debriefPhysics: 'Never block a lifting PSV; eliminate the overpressure source so the relief valve reseats cleanly.',
  },
  saf_flare_op: {
    id: 'saf_flare_op',
    name: 'Flare / Vent Over-Pressure',
    category: 'safety',
    unitId: 'FL-101',
    severity: 'CRIT',
    visualCue: 'Massive roaring smoky flame towers over FL-101 stack.',
    gaugeEffect: 'High flare rate, dark soot smoke, V-102 backpressure climbing.',
    rootCause: 'Blow-by through LCV-101 or PCV-102 wide open floods flare header.',
    correctActions: ['Check PCV-102 & LCV-101, verify flare knockout'],
    wrongActions: ['Close flare stack root valve while venting'],
    requiredFieldAction: 'stroke_valve',
    physicsEffects: { flareSurge: true, flashPressAdd: 2.5 },
    debriefPhysics: 'Excess flare header backpressure stalls flash-tank degassing and risks flare flame instability.',
  },
  saf_btex: {
    id: 'saf_btex',
    name: 'BTEX Emission Limit Exceeded',
    category: 'safety',
    unitId: 'V-103',
    severity: 'CRIT',
    visualCue: 'Hazy yellowish-white vapor plume venting off V-103 still top.',
    gaugeEffect: 'BTEX monitor > 25 lb/day regulatory limit!',
    rootCause: 'Aromatics (Benzene, Toluene, Ethylbenzene, Xylenes) absorbed by excess TEG circulation vent out V-103.',
    correctActions: ['Optimize circulation down toward 2.5–3.0 gal/lb', 'Replace carbon filter & check V-102'],
    wrongActions: ['Over-pump glycol at 6 gal/lb'],
    requiredParamCheck: (p) => p.circRateGalPerLb <= 3.2,
    physicsEffects: { btexHigh: true },
    debriefPhysics: 'Excess TEG circulation absorbs aromatic BTEX linearly; keeping L/G lean and V-102 flashing cuts emissions.',
  },
  saf_reboiler_fire: {
    id: 'saf_reboiler_fire',
    name: 'Fire at Reboiler H-101',
    category: 'safety',
    unitId: 'H-101',
    severity: 'CRIT',
    visualCue: 'External fire flames & black smoke erupt around H-101 burner box!',
    gaugeEffect: 'CRITICAL SAFETY FIRE ALARM; immediate fuel shutdown required!',
    rootCause: 'Leaking fuel valve, ruptured fire tube, or spilled glycol ignited at H-101 burner.',
    correctActions: ['Trip burner/apply lockout & contain spill immediately', 'Drop heat safely'],
    wrongActions: ['Leave burner firing or walk in without lockout'],
    requiredFieldAction: 'apply_ppe_lockout',
    physicsEffects: { reboilerFire: true, reboilerDeltaC: 14, burnerOut: true },
    debriefPhysics: 'Process fires require immediate fuel isolation (ESD) and fire watch before any mechanical inspection.',
  },
  saf_gas_leak: {
    id: 'saf_gas_leak',
    name: 'Hydrocarbon Gas Leak Near Skid',
    category: 'safety',
    unitId: 'FL-101',
    severity: 'CRIT',
    visualCue: 'Translucent gas mist jets from flange near flash/absorber piping.',
    gaugeEffect: 'LEL gas detector alarm active; ignition risk near H-101!',
    rootCause: 'Loose flange gasket or cracked instrument tubing leaking natural gas.',
    correctActions: ['Run gas leak sniffer & isolate leak / apply safety lockout'],
    wrongActions: ['Ignore LEL warning near open burner flame'],
    requiredFieldAction: 'leak_sniffer',
    physicsEffects: { gasLeak: true, pressureDeltaBar: -6 },
    debriefPhysics: 'Gas leaks near direct-fired reboilers demand immediate leak pinpointing and ignition control.',
  },
  saf_spill: {
    id: 'saf_spill',
    name: 'Glycol Spill & Containment Issue',
    category: 'safety',
    unitId: 'P-101',
    severity: 'WARN',
    visualCue: 'Large golden-brown liquid spill spreading across skid deck.',
    gaugeEffect: 'V-104 inventory dropping; environmental containment alarm.',
    rootCause: 'Open sample drain or blown seal spilled rich/lean TEG onto uncontained pad.',
    correctActions: ['Contain & clean spill on skid', 'Close open drains & top up V-104'],
    wrongActions: ['Flush glycol into storm drain'],
    requiredFieldAction: 'contain_spill',
    physicsEffects: { spillHazard: true, lossAdd: 0.7 },
    debriefPhysics: 'TEG spills pose slip hazards and environmental liability; isolate the leak source and secure drip pans.',
  },
  saf_hot_ppe: {
    id: 'saf_hot_ppe',
    name: 'Hot-Surface / PPE Violation',
    category: 'safety',
    unitId: 'H-101',
    severity: 'WARN',
    visualCue: 'Missing insulation blanket on 200 °C H-101 head; caution hazard marker.',
    gaugeEffect: 'Safety compliance flag active until lockout/PPE verified.',
    rootCause: 'Removed fire-box insulation or hot sampling performed without thermal gloves/face shield.',
    correctActions: ['Apply thermal PPE & safety lockout on H-101'],
    wrongActions: ['Sample 200 °C glycol bare-handed'],
    requiredFieldAction: 'apply_ppe_lockout',
    physicsEffects: { fuelMult: 1.08 },
    debriefPhysics: '200 °C TEG causes instant severe burns; thermal PPE and insulation blankets are mandatory around H-101.',
  },

  // === 9. OPERATIONS AND HUMAN (5) ===
  ops_bad_startup: {
    id: 'ops_bad_startup',
    name: 'Wrong Startup Sequence',
    category: 'operations',
    unitId: 'P-101',
    severity: 'CRIT',
    visualCue: 'H-101 burner blazing while P-101 pump is stopped and gas surges!',
    gaugeEffect: 'TI-104 spiking fast (>204 °C) with zero circulation & wet sales gas.',
    rootCause: 'Operator fired reboiler and opened wet gas before priming P-101 glycol circulation.',
    correctActions: ['Reset/start P-101 pump first', 'Lower H-101 heat until circulation stabilizes'],
    wrongActions: ['Crank H-101 higher with pump off'],
    requiredFieldAction: 'reset_pump',
    physicsEffects: { pumpZero: true, reboilerDeltaC: 10 },
    debriefPhysics: 'Correct TEG startup: establish surge level -> circulate lean TEG -> warm reboiler gently -> introduce wet gas.',
  },
  ops_valve_left: {
    id: 'ops_valve_left',
    name: 'Isolation Valve Left Closed',
    category: 'operations',
    unitId: 'F-101',
    severity: 'CRIT',
    visualCue: 'Manual valve handwheel closed ahead of filter/pump; flow stalled.',
    gaugeEffect: 'Zero circulation or massive ΔP spike immediately after shift handover.',
    rootCause: 'Maintenance isolation valve was never reopened before restarting unit.',
    correctActions: ['Stroke/open left-closed valve & check ΔP'],
    wrongActions: ['Over-speed pump against deadhead'],
    requiredFieldAction: 'stroke_valve',
    physicsEffects: { circMult: 0.25, filterDpAdd: 1.5 },
    debriefPhysics: 'Line-walk verification before startup prevents deadheading pumps and starving vessels.',
  },
  ops_wrong_chem: {
    id: 'ops_wrong_chem',
    name: 'Wrong Chemical Added',
    category: 'operations',
    unitId: 'V-104',
    severity: 'CRIT',
    visualCue: 'Violent soapy froth fills V-101 & V-102 after wrong drum was dosed.',
    gaugeEffect: 'Severe foaming ΔP and high carryover loss.',
    rootCause: 'Surfactant/detergent or wrong amine added into V-104 instead of TEG/buffer.',
    correctActions: ['Add antifoam & bleed/replace contaminated TEG with fresh makeup'],
    wrongActions: ['Add more of the unknown chemical'],
    requiredFieldAction: 'add_antifoam',
    cascadeTo: 'abs_foaming',
    cascadeDelaySec: 25,
    physicsEffects: { trayEffMult: 0.52, lossAdd: 1.4, purityPenalty: 0.6 },
    debriefPhysics: 'Always verify chemical drum labels; incompatible surfactants ruin tower hydraulics instantaneously.',
  },
  ops_skipped_insp: {
    id: 'ops_skipped_insp',
    name: 'Skipped Shift Inspection',
    category: 'operations',
    unitId: 'F-101',
    severity: 'WARN',
    visualCue: 'Multiple minor symptoms: rising F-101 ΔP, low V-104 glass, warm E-101.',
    gaugeEffect: 'Combined drift pushes dry gas slowly past 7 lb/MMscf.',
    rootCause: 'Skipped field round allowed filter cake, low level, and cooler fouling to stack.',
    correctActions: ['Perform field inspection & replace dirty F-101 filter'],
    wrongActions: ['Stay in control room ignoring field gauges'],
    requiredFieldAction: 'replace_filter',
    cascadeTo: 'flt_plugging',
    cascadeDelaySec: 40,
    physicsEffects: { filterDpAdd: 0.95, exchEffDrop: 14, circMult: 0.78 },
    debriefPhysics: 'Routine skid walks catch creeping ΔP and sight-glass drift long before an emergency trip.',
  },
  ops_bad_sample: {
    id: 'ops_bad_sample',
    name: 'Incorrect Glycol Sampling',
    category: 'operations',
    unitId: 'V-104',
    severity: 'WARN',
    visualCue: 'Sample bomb unpurged; operator assumed 99.5% purity while gas stays wet.',
    gaugeEffect: 'True sample shows weak 97.6% TEG purity once sample line is properly purged.',
    rootCause: 'Dead-leg sample taken without purging left water condensate in sample valve.',
    correctActions: ['Take fresh purged TEG sample at V-104', 'Adjust H-101 / stripping gas'],
    wrongActions: ['Ignore wet sales gas'],
    requiredFieldAction: 'sample_teg',
    physicsEffects: { purityPenalty: 0.9, reboilerDeltaC: -12 },
    debriefPhysics: 'Always flush sample lines 3x line volume and cool hot TEG samples to avoid flashing errors.',
  },
};

export const ALL_FAULT_IDS = Object.keys(FAULT_LIBRARY);

export const DEFAULT_PARAMS: TegParams = {
  gasFlowMMscfd: 45,
  circRateGalPerLb: 3.0,
  reboilerTempC: 198,
  absorberPressureBar: 55,
  inletTempC: 32,
  inletWaterLbMMscf: 45,
  glycolInTempC: 37,
  numTrays: 6,
  internalsType: 'trays',
  leanPurityOverride: null,
  strippingGasBoost: 0,
  makeupBoost: 0,
  coolerOn: true,
  exchangerEffPct: 85,
  pumpTripped: false,
  lcv101ManualPct: null,
  lcv102ManualPct: null,
  pcv102ManualPct: null,
  faults: [],
};

export function computeEquilibriumDewPointC(
  tegPurityWtPct: number,
  contactorTempC: number,
  pressureBar: number
): number {
  const purity = Math.min(99.99, Math.max(94.0, tegPurityWtPct));
  const waterFrac = Math.max(0.0001, (100 - purity) / 100);
  const depressionBase = 29 + Math.log10(0.06 / waterFrac) * 20.5;
  const pressureAdj = 0.85 + 0.15 * (pressureBar / 55);
  return contactorTempC - Math.max(6, depressionBase * pressureAdj);
}

export function getActiveFaultList(params: TegParams): string[] {
  const list = Array.isArray(params.faults) ? [...params.faults] : [];
  if (params.fault && params.fault !== 'none' && !list.includes(params.fault)) {
    list.push(params.fault);
  }
  return list.filter((id) => Boolean(FAULT_LIBRARY[id]));
}

export function computeTegProcess(
  params: TegParams,
  levels: TegDynamicLevels = { flashTankLevelPct: 52, reboilerLevelPct: 62, surgeLevelPct: 58 }
): TegMetrics {
  const activeFaultIds = getActiveFaultList(params);

  let trayEffMult = 1.0;
  let circMult = 1.0;
  let carryoverAdd = 0;
  let lossAdd = 0;
  let reboilerDeltaC = 0;
  let inletWaterMult = 1.0;
  let inletTempDeltaC = 0;
  let pressureDeltaBar = 0;
  let gasFlowMult = 1.0;
  let purityPenalty = 0;
  let filterDpAdd = 0;
  let absorberDpAdd = 0;
  let flashPressAdd = 0;
  let fuelMult = 1.0;
  let coolerForcedOff = false;
  let exchEffDrop = 0;
  let pumpZero = false;
  let pumpCavitate = false;
  let burnerOut = false;
  let flareSurge = false;
  let sourH2s = false;
  let btexHigh = false;
  let reboilerFire = false;
  let gasLeak = false;
  let spillHazard = false;

  for (const fId of activeFaultIds) {
    const fx = FAULT_LIBRARY[fId]?.physicsEffects;
    if (!fx) continue;
    if (fx.trayEffMult !== undefined) trayEffMult *= fx.trayEffMult;
    if (fx.circMult !== undefined) circMult *= fx.circMult;
    if (fx.carryoverAdd) carryoverAdd += fx.carryoverAdd;
    if (fx.lossAdd) lossAdd += fx.lossAdd;
    if (fx.reboilerDeltaC) reboilerDeltaC += fx.reboilerDeltaC;
    if (fx.inletWaterMult) inletWaterMult *= fx.inletWaterMult;
    if (fx.inletTempDeltaC) inletTempDeltaC += fx.inletTempDeltaC;
    if (fx.pressureDeltaBar) pressureDeltaBar += fx.pressureDeltaBar;
    if (fx.gasFlowMult) gasFlowMult *= fx.gasFlowMult;
    if (fx.purityPenalty) purityPenalty += fx.purityPenalty;
    if (fx.filterDpAdd) filterDpAdd += fx.filterDpAdd;
    if (fx.absorberDpAdd) absorberDpAdd += fx.absorberDpAdd;
    if (fx.flashPressAdd) flashPressAdd += fx.flashPressAdd;
    if (fx.fuelMult) fuelMult *= fx.fuelMult;
    if (fx.coolerForcedOff) coolerForcedOff = true;
    if (fx.exchEffDrop) exchEffDrop += fx.exchEffDrop;
    if (fx.pumpZero) pumpZero = true;
    if (fx.pumpCavitate) pumpCavitate = true;
    if (fx.burnerOut) burnerOut = true;
    if (fx.flareSurge) flareSurge = true;
    if (fx.sourH2s) sourH2s = true;
    if (fx.btexHigh) btexHigh = true;
    if (fx.reboilerFire) reboilerFire = true;
    if (fx.gasLeak) gasLeak = true;
    if (fx.spillHazard) spillHazard = true;
  }

  const isPumpDead = params.pumpTripped || pumpZero;
  const effectiveGasFlow = Math.min(115, Math.max(12, params.gasFlowMMscfd * gasFlowMult));
  const effectivePressure = Math.min(105, Math.max(18, params.absorberPressureBar + pressureDeltaBar));
  const effectiveInletTemp = Math.min(68, Math.max(6, params.inletTempC + inletTempDeltaC));
  const effectiveInletWater = Math.min(110, Math.max(15, params.inletWaterLbMMscf * inletWaterMult));
  const effectiveReboilerT = Math.min(230, Math.max(145, params.reboilerTempC + reboilerDeltaC));

  const rawPurityFromReboiler =
    96.15 + 3.0 * (1 - Math.exp(-Math.max(0, effectiveReboilerT - 170) / 14));
  const decompositionActive =
    effectiveReboilerT > 204 ||
    activeFaultIds.includes('gly_degradation') ||
    activeFaultIds.includes('reg_thermal_decomp');
  const degradationPenalty = decompositionActive
    ? Math.max(0.35, (effectiveReboilerT - 204) * 0.12)
    : 0;

  let tegPurityPct =
    params.leanPurityOverride !== null
      ? params.leanPurityOverride
      : rawPurityFromReboiler + params.strippingGasBoost + params.makeupBoost - degradationPenalty - purityPenalty;
  if (burnerOut) tegPurityPct = Math.min(tegPurityPct, 96.4);
  tegPurityPct = Math.min(99.99, Math.max(93.2, tegPurityPct));

  const effectiveExchEff = Math.max(30, params.exchangerEffPct - exchEffDrop);
  const coolerActive = params.coolerOn && !coolerForcedOff;
  const exchangerCoolingLoss = ((85 - effectiveExchEff) / 45) * 14;
  const effectiveGlycolInTempC = coolerActive
    ? Math.max(effectiveInletTemp + 3, params.glycolInTempC + exchangerCoolingLoss * 0.35)
    : Math.min(92, params.glycolInTempC + 24 + exchangerCoolingLoss);

  const contactorTempC = 0.72 * effectiveInletTemp + 0.28 * effectiveGlycolInTempC;
  const effectiveCirc = isPumpDead ? 0 : Math.max(0.2, params.circRateGalPerLb * circMult);

  let baseTrayEff = params.internalsType === 'packing' ? 0.52 : 0.45;
  baseTrayEff *= trayEffMult;
  if (!coolerActive) baseTrayEff *= 0.86;
  baseTrayEff = Math.min(0.85, Math.max(0.1, baseTrayEff));

  const effectiveStages = Math.max(
    0.45,
    params.numTrays * baseTrayEff * (params.internalsType === 'packing' ? 1.15 : 1.0)
  );

  const tempNorm = Math.exp((contactorTempC - 30) * 0.028);
  const pressureNorm = effectivePressure / 55;
  const kremserFactorA = isPumpDead
    ? 0
    : Math.max(0.12, ((effectiveCirc / 1.55) * (0.65 + 0.35 * pressureNorm)) / tempNorm);

  let kremserApproach = 0;
  if (kremserFactorA > 0) {
    if (Math.abs(kremserFactorA - 1.0) < 0.02) {
      kremserApproach = effectiveStages / (effectiveStages + 1);
    } else {
      const aN1 = Math.pow(kremserFactorA, effectiveStages + 1);
      kremserApproach = (aN1 - kremserFactorA) / (aN1 - 1);
    }
    kremserApproach = Math.min(0.992, Math.max(0, kremserApproach));
  }

  const eqDewPointC = computeEquilibriumDewPointC(tegPurityPct, contactorTempC, effectivePressure);
  const actualDewPointC = contactorTempC - kremserApproach * (contactorTempC - eqDewPointC);

  const svpKpa = 0.61078 * Math.exp((17.27 * actualDewPointC) / (actualDewPointC + 237.3));
  let dryWaterLbMMscf = isPumpDead
    ? effectiveInletWater
    : Math.min(
        effectiveInletWater,
        Math.max(0.25, (svpKpa / (effectivePressure * 100)) * 47484 * 0.85)
      );

  if (!isPumpDead && carryoverAdd > 0) {
    dryWaterLbMMscf = Math.min(effectiveInletWater, dryWaterLbMMscf + carryoverAdd);
  }

  const dewPointDepressionC = Math.max(0, effectiveInletTemp - actualDewPointC);
  const specPass = dryWaterLbMMscf <= 7.0;

  // Tray profile
  const trayProfile: TrayProfilePoint[] = [];
  const totalDrop = Math.max(0, effectiveInletWater - dryWaterLbMMscf);
  for (let i = 1; i <= params.numTrays; i++) {
    const fracHeight = i / params.numTrays;
    const gasWater = isPumpDead
      ? effectiveInletWater
      : dryWaterLbMMscf + totalDrop * Math.pow(1 - fracHeight * 0.92, 1.35);
    const loading = isPumpDead ? 0.5 : 1 - (i - 0.5) / params.numTrays;
    const waterWtGain = loading * (effectiveCirc > 0 ? Math.min(4.8, 12 / Math.max(1.2, effectiveCirc)) : 2.5);
    const trayTegPurity = Math.max(89.5, tegPurityPct - waterWtGain);

    let trayLvl = 45 + (1 - fracHeight) * 20;
    if (activeFaultIds.includes('abs_flooding') || activeFaultIds.includes('abs_downcomer_block')) {
      trayLvl = Math.min(98, 72 + fracHeight * 24);
    } else if (activeFaultIds.includes('abs_foaming')) {
      trayLvl = Math.min(95, 65 + Math.sin(i) * 10);
    } else if (activeFaultIds.includes('abs_weeping')) {
      trayLvl = Math.max(12, 22 - fracHeight * 8);
    }

    trayProfile.push({
      trayIndex: i,
      gasWaterLbMMscf: Number(gasWater.toFixed(2)),
      tegPurityWtPct: Number(trayTegPurity.toFixed(2)),
      waterLoadingFrac: Math.min(1, Math.max(0, loading)),
      liquidLevelPct: Math.round(trayLvl),
      stageEfficiencyPct: Math.round(baseTrayEff * 100),
    });
  }

  const waterRemovedLbHr = (effectiveGasFlow * Math.max(0, effectiveInletWater - dryWaterLbMMscf)) / 24;
  const glycolGpm = isPumpDead ? 0 : (waterRemovedLbHr * effectiveCirc) / 60;

  const glycolLossGalMMscf =
    (isPumpDead ? 0 : 0.05) +
    0.0011 * effectiveGasFlow * (55 / Math.max(15, effectivePressure)) +
    Math.max(0, contactorTempC - 35) * 0.004 +
    (decompositionActive ? 0.14 : 0) +
    lossAdd;

  const exchFactor = 1.0 + ((85 - effectiveExchEff) / 100) * 0.45;
  const reboilerDutyMMBtuHr = burnerOut
    ? 0.01
    : (0.08 +
        glycolGpm * (0.042 * Math.max(0.2, (effectiveReboilerT - 135) / 63)) * exchFactor +
        waterRemovedLbHr * 0.00115) *
      fuelMult;

  const fuelGasMscfd = (reboilerDutyMMBtuHr * 24) / (0.8 * 1.02);
  const ventGasMscfd =
    glycolGpm * (0.32 + 0.004 * effectivePressure) +
    (flareSurge ? 4.2 : 0) +
    (activeFaultIds.includes('abs_lcv_open') ? 5.5 : 0);

  const flashPressureBar = Math.max(1.2, 3.6 + (ventGasMscfd / 20) * 0.8 + flashPressAdd);
  const filterDpBar = Math.max(0.02, 0.25 + (glycolGpm / 20) * 0.25 + filterDpAdd);
  const absorberDpBar = Math.max(0.05, 0.24 + (effectiveGasFlow / 100) * 0.22 + absorberDpAdd);

  const stillOverheadTempC =
    101.2 +
    Math.max(0, effectiveReboilerT - 198) * 0.45 +
    params.strippingGasBoost * 4.5 +
    (activeFaultIds.includes('reg_still_flood') || activeFaultIds.includes('reg_vapor_loss') || activeFaultIds.includes('reg_reflux_fail') ? 13.5 : 0) -
    (burnerOut ? 22 : 0);

  const tegPh =
    7.2 -
    (decompositionActive ? 1.4 : 0) -
    (activeFaultIds.includes('gly_low_ph') || activeFaultIds.includes('gly_oxidation') || sourH2s ? 1.9 : 0);

  const h2sPpm = sourH2s ? 38 : 0.4;
  const btexLbDay =
    glycolGpm * 1.15 +
    (btexHigh ? 24.5 : 0) +
    (params.circRateGalPerLb > 4.2 ? (params.circRateGalPerLb - 4.2) * 5.2 : 0);

  const lcv101OpenPct =
    params.lcv101ManualPct !== null
      ? params.lcv101ManualPct
      : activeFaultIds.includes('abs_lcv_open')
      ? 100
      : activeFaultIds.includes('abs_lcv_closed')
      ? 0
      : Math.min(100, Math.max(5, 18 + (glycolGpm / 16) * 65));

  const lcv102OpenPct =
    params.lcv102ManualPct !== null
      ? params.lcv102ManualPct
      : activeFaultIds.includes('ctl_stuck_valve')
      ? 12
      : Math.min(100, Math.max(5, 15 + (glycolGpm / 16) * 55 + (levels.flashTankLevelPct - 50) * 0.7));

  const pcv102OpenPct =
    params.pcv102ManualPct !== null
      ? params.pcv102ManualPct
      : flashPressAdd > 3 || activeFaultIds.includes('flt_pcv_fail')
      ? 8
      : Math.min(100, Math.max(8, 22 + (ventGasMscfd / 10) * 50));

  const alarms: TegAlarm[] = [];
  if (isPumpDead) {
    alarms.push({ id: 'ALM-P101', tag: 'PI-102', equipmentId: 'P-101', severity: 'CRIT', message: 'Glycol pump P-101 zero circulation' });
  } else if (pumpCavitate) {
    alarms.push({ id: 'ALM-P101-CAV', tag: 'PI-102', equipmentId: 'P-101', severity: 'CRIT', message: 'P-101 cavitation — low NPSH / erratic head' });
  }
  if (burnerOut && !reboilerFire) {
    alarms.push({ id: 'ALM-H101-FLAME', tag: 'TI-104', equipmentId: 'H-101', severity: 'CRIT', message: 'Reboiler H-101 burner flame-out' });
  }
  if (reboilerFire) {
    alarms.push({ id: 'ALM-FIRE', tag: 'ESD-H101', equipmentId: 'H-101', severity: 'CRIT', message: 'FIRE DETECTED AT REBOILER H-101' });
  }
  if (gasLeak) {
    alarms.push({ id: 'ALM-LEL', tag: 'GD-101', equipmentId: 'FL-101', severity: 'CRIT', message: 'Flammable gas leak detected near skid' });
  }
  if (sourH2s) {
    alarms.push({ id: 'ALM-H2S', tag: 'AT-102', equipmentId: 'V-102', severity: 'CRIT', message: 'Sour gas H2S alarm (>25 ppm)' });
  }
  if (decompositionActive) {
    alarms.push({ id: 'ALM-TI104-HH', tag: 'TI-104', equipmentId: 'H-101', severity: 'CRIT', message: `TI-104 ${effectiveReboilerT.toFixed(1)}°C > 204°C thermal cracking` });
  } else if (effectiveReboilerT < 188) {
    alarms.push({ id: 'ALM-TI104-L', tag: 'TI-104', equipmentId: 'H-101', severity: 'WARN', message: `TI-104 ${effectiveReboilerT.toFixed(1)}°C < 188°C under-regenerated` });
  }
  if (effectivePressure > 80) {
    alarms.push({ id: 'ALM-PI101-H', tag: 'PI-101', equipmentId: 'V-101', severity: 'CRIT', message: `Contactor PI-101 ${effectivePressure.toFixed(0)} bar > 80 bar` });
  }
  if (!specPass) {
    alarms.push({ id: 'ALM-MI101-H', tag: 'V-101', equipmentId: 'V-101', severity: 'WARN', message: `Dry gas ${dryWaterLbMMscf.toFixed(1)} lb/MMscf > 7.0 spec` });
  }
  if (glycolLossGalMMscf > 0.35) {
    alarms.push({ id: 'ALM-LOSS-H', tag: 'V-101', equipmentId: 'V-101', severity: 'CRIT', message: `High TEG loss (${glycolLossGalMMscf.toFixed(2)} gal/MMscf)` });
  }
  if (filterDpBar > 1.0 || activeFaultIds.includes('ctl_false_alarm')) {
    alarms.push({ id: 'ALM-PDI101', tag: 'PDI-101', equipmentId: 'F-101', severity: 'WARN', message: `Filter PDI-101 high ΔP (${Math.max(filterDpBar, 1.45).toFixed(2)} bar)` });
  }
  if (flashPressureBar > 7.0) {
    alarms.push({ id: 'ALM-PC102-H', tag: 'PC-102', equipmentId: 'V-102', severity: 'CRIT', message: `Flash tank PC-102 high (${flashPressureBar.toFixed(1)} bar)` });
  }
  if (btexLbDay > 25) {
    alarms.push({ id: 'ALM-BTEX', tag: 'V-103', equipmentId: 'V-103', severity: 'CRIT', message: `BTEX emission ${btexLbDay.toFixed(0)} lb/d exceeds limit` });
  }
  if (spillHazard) {
    alarms.push({ id: 'ALM-SPILL', tag: 'P-101', equipmentId: 'P-101', severity: 'WARN', message: 'Glycol containment spill active on skid deck' });
  }

  const plantTripped =
    reboilerFire ||
    (effectivePressure > 98) ||
    levels.reboilerLevelPct < 18 ||
    (isPumpDead && activeFaultIds.includes('ops_bad_startup') && effectiveReboilerT > 206);

  return {
    tegPurityPct,
    effectiveGlycolInTempC,
    dryWaterLbMMscf,
    dewPointC: actualDewPointC,
    dewPointDepressionC,
    glycolLossGalMMscf,
    fuelGasMscfd,
    reboilerDutyMMBtuHr,
    glycolGpm,
    waterRemovedLbHr,
    ventGasMscfd,
    flashPressureBar,
    filterDpBar,
    absorberDpBar,
    stillOverheadTempC,
    tegPh,
    h2sPpm,
    btexLbDay,
    lcv101OpenPct,
    lcv102OpenPct,
    pcv102OpenPct,
    kremserFactorA,
    effectiveStages,
    specPass,
    decompositionActive,
    plantTripped,
    trayProfile,
    alarms,
  };
}

export function stepVesselLevels(
  levels: TegDynamicLevels,
  params: TegParams,
  metrics: TegMetrics,
  dtSec: number,
  timeSec: number
): TegDynamicLevels {
  const active = getActiveFaultList(params);
  const isPumpDead = params.pumpTripped || active.some((id) => FAULT_LIBRARY[id]?.physicsEffects.pumpZero);
  let targetFlash = Math.min(88, Math.max(18, 48 + (metrics.glycolGpm - 5.5) * 1.8));
  if (active.includes('gas_wet_slug') || active.includes('flt_level_upset') || active.includes('ctl_stuck_valve') || active.includes('ctl_lt_drift')) {
    targetFlash = 87;
  } else if (active.includes('abs_lcv_closed')) {
    targetFlash = 16;
  }

  let targetReb = Math.min(82, Math.max(30, 62 - (params.reboilerTempC - 198) * 0.6));
  if (active.includes('reg_hotspot')) targetReb = 26;

  let targetSurge = isPumpDead
    ? 89
    : active.includes('flt_plugging') || active.includes('gly_low_inventory') || active.includes('reg_surge_level') || active.includes('pmp_seal_leak') || active.includes('abs_lcv_closed')
    ? 17
    : Math.min(86, Math.max(20, 58 - (params.circRateGalPerLb - 3.0) * 3.5));

  const k = 1 - Math.exp(-0.8 * dtSec);
  const ripple = Math.sin(timeSec * 1.3) * 0.12;

  return {
    flashTankLevelPct: Math.min(95, Math.max(10, levels.flashTankLevelPct + (targetFlash - levels.flashTankLevelPct) * k + ripple)),
    reboilerLevelPct: Math.min(95, Math.max(15, levels.reboilerLevelPct + (targetReb - levels.reboilerLevelPct) * k - ripple * 0.7)),
    surgeLevelPct: Math.min(95, Math.max(10, levels.surgeLevelPct + (targetSurge - levels.surgeLevelPct) * k + ripple * 0.5)),
  };
}

// ============================================================================
// CAREER RANKS (1..6), SEEDED EXAM GENERATOR & COVERAGE SCORING MODEL
// ============================================================================

export interface CareerRankDef {
  rank: number;
  title: string;
  controlTier: 'basic' | 'main' | 'full';
  hintsMode: 'always' | 'free' | 'paid' | 'none';
  allowsLearnDrawer: boolean;
  maxOverlappingFaults: number;
  failedGaugesCount: number;
}

export const CAREER_RANKS: CareerRankDef[] = [
  { rank: 1, title: 'Trainee', controlTier: 'basic', hintsMode: 'always', allowsLearnDrawer: true, maxOverlappingFaults: 1, failedGaugesCount: 0 },
  { rank: 2, title: 'Junior Operator', controlTier: 'main', hintsMode: 'free', allowsLearnDrawer: true, maxOverlappingFaults: 1, failedGaugesCount: 0 },
  { rank: 3, title: 'Operator', controlTier: 'full', hintsMode: 'paid', allowsLearnDrawer: true, maxOverlappingFaults: 1, failedGaugesCount: 0 },
  { rank: 4, title: 'Senior Operator', controlTier: 'full', hintsMode: 'paid', allowsLearnDrawer: true, maxOverlappingFaults: 2, failedGaugesCount: 1 },
  { rank: 5, title: 'Process Engineer', controlTier: 'full', hintsMode: 'paid', allowsLearnDrawer: true, maxOverlappingFaults: 2, failedGaugesCount: 1 },
  { rank: 6, title: 'TEG Expert', controlTier: 'full', hintsMode: 'none', allowsLearnDrawer: false, maxOverlappingFaults: 2, failedGaugesCount: 2 },
];

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface CoverageProgress {
  seen: string[];
  fixed: string[];
}

export type ExamTypeId = 'quick' | 'rank' | 'certification';

export function generateExamFaultSchedule(
  examType: ExamTypeId,
  seed: number,
  coverage: CoverageProgress
): { id: string; triggerOffsetSec: number; overlapped: boolean }[] {
  const rng = mulberry32(seed);
  const count = examType === 'quick' ? 3 : examType === 'rank' ? 5 : 10;
  const durationSec = examType === 'quick' ? 600 : examType === 'rank' ? 1200 : 2700;

  const fixedSet = new Set(coverage.fixed);
  const seenSet = new Set(coverage.seen);

  const unseen = ALL_FAULT_IDS.filter((id) => !seenSet.has(id));
  const seenNotFixed = ALL_FAULT_IDS.filter((id) => seenSet.has(id) && !fixedSet.has(id));
  const alreadyFixed = ALL_FAULT_IDS.filter((id) => fixedSet.has(id));

  const shuffle = (arr: string[]) => {
    const out = [...arr];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  };

  const orderedPool = [...shuffle(unseen), ...shuffle(seenNotFixed), ...shuffle(alreadyFixed)];
  const chosen = orderedPool.slice(0, count);

  const spacing = Math.floor((durationSec - 90) / Math.max(1, count));
  return chosen.map((id, idx) => {
    const overlapped = examType === 'certification' && idx > 2 && idx % 3 === 0;
    const baseTime = 35 + idx * spacing;
    const triggerOffsetSec = overlapped ? Math.max(40, baseTime - Math.floor(spacing * 0.55)) : baseTime;
    return { id, triggerOffsetSec, overlapped };
  });
}

export interface ExamScoreInput {
  totalShiftSec: number;
  onSpecSec: number;
  faultsTotal: number;
  faultsFixed: number;
  avgDetectSec: number;
  avgFixSec: number;
  diagnosisCorrect: number;
  diagnosisTotal: number;
  harmfulActionsCount: number;
  avgTegLoss: number;
  safetyViolations: number;
  hintsUsed: number;
}

export interface ExamScoreResult {
  totalScore: number;
  grade: string;
  passed: boolean;
  breakdown: {
    specPts: number;
    detectPts: number;
    fixPts: number;
    diagPts: number;
    efficiencyPts: number;
    safetyPts: number;
  };
}

export function computeExamScore(input: ExamScoreInput): ExamScoreResult {
  const specRatio = input.totalShiftSec > 0 ? Math.min(1, input.onSpecSec / input.totalShiftSec) : 1;
  const specPts = Math.round(specRatio * 25);

  const detectPts =
    input.faultsTotal === 0
      ? 0
      : Math.max(0, Math.round(15 * Math.max(0, 1 - Math.max(0, input.avgDetectSec - 8) / 70)));

  const fixRatio = input.faultsTotal > 0 ? input.faultsFixed / input.faultsTotal : 0;
  const speedBonus = Math.max(0, 1 - Math.max(0, input.avgFixSec - 20) / 140);
  const fixPts = Math.round(fixRatio * (12 + 8 * speedBonus));

  const diagRatio = input.diagnosisTotal > 0 ? input.diagnosisCorrect / input.diagnosisTotal : 0;
  const diagPts = Math.round(diagRatio * 20);

  const lossPenalty = Math.max(0, (input.avgTegLoss - 0.25) * 4);
  const efficiencyPts = Math.max(
    0,
    Math.round(10 - lossPenalty - input.harmfulActionsCount * 2 - input.hintsUsed * 2)
  );

  const safetyPts = Math.max(0, 10 - input.safetyViolations * 3);

  const totalScore = Math.min(100, Math.max(0, specPts + detectPts + fixPts + diagPts + efficiencyPts + safetyPts));
  const passed = totalScore >= 70 && input.safetyViolations <= 1;
  const grade =
    totalScore >= 92
      ? 'Distinction (A+)'
      : totalScore >= 82
      ? 'Merit (A)'
      : totalScore >= 70
      ? 'Pass (B)'
      : 'Review Required (Fail)';

  return {
    totalScore,
    grade,
    passed,
    breakdown: { specPts, detectPts, fixPts, diagPts, efficiencyPts, safetyPts },
  };
}
