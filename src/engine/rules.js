/**
 * Recommendation rules engine.
 *
 * Each domain function inspects the computed model and calls `add()` for
 * every planning exception it detects. A recommendation is
 *   { domain, priority: 'high'|'med'|'low', title, body, impact, score }
 * and the final list is ranked by `score` (severity-weighted leverage).
 *
 * Rule text is HTML; any free-text client input is escaped with esc().
 */
import { T26 } from './params/ty2026.js';
import { fmt$, fmtPct, esc } from './format.js';

/* ---- Cash Flow / Budget ---- */
function cashFlowRules({ d, tax, cf, ret, ins, est, edu, debt, inv, a, ladder }, add) {
  if(cf.efMonths<3) add('cashflow','high','Emergency reserve critically underfunded',
    `Liquid reserves cover ${cf.efMonths.toFixed(1)} months of expenses vs. a 3–6 month target (6 given ${d.se_income>0?'self-employment income variability':'household income structure'}). Redirect surplus cash flow to a HYMM/T-bill ladder until reserves reach ${fmt$(cf.expM*6)}. Sequence this ahead of unmatched retirement deferrals but never ahead of full employer match capture.`,
    `Target: ${fmt$(cf.expM*6)} (${fmt$(Math.max(0,cf.expM*6-d.cash_savings))} shortfall)`,95);
  else if(cf.efMonths<6) add('cashflow','med','Emergency reserve below 6-month target',
    `Reserves cover ${cf.efMonths.toFixed(1)} months. Build toward ${fmt$(cf.expM*6)} in tiered liquidity: 1 month operating checking, remainder in 4-week/13-week T-bill ladder or HYMM (state-tax-exempt Treasury interest is worth ~${fmtPct(tax.stateIncTaxRate)} in ${d.state==='IL'?'Illinois':'your state'}).`,
    `Shortfall: ${fmt$(Math.max(0,cf.expM*6-d.cash_savings))}`,55);
  if(cf.efMonths>12) add('cashflow','low','Excess cash drag',
    `${cf.efMonths.toFixed(0)} months of expenses in cash exceeds any defensible reserve target. Excess ${fmt$(d.cash_savings-cf.expM*6)} carries a real-return drag of ~${fmtPct(inv.targetEq/100*a.eqRet+((100-inv.targetEq)/100)*a.bdRet-a.cashRet)} annually vs. policy allocation. Deploy via 3–6 tranche dollar-cost average into the taxable account.`,
    `Opportunity cost ≈ ${fmt$( (d.cash_savings-cf.expM*6)*.03 )}/yr`,40);
  if(cf.savingsRate<.15&&ret.successRate<.85) add('cashflow','high','Savings rate insufficient for goal set',
    `Gross savings rate is ${fmtPct(cf.savingsRate)}; the plan requires ≥15–20% given a ${fmtPct(ret.successRate,0)} Monte Carlo success rate. Current annual surplus of ${fmt$(cf.surplus)} should be systematically captured — automate an increase of deferrals/contributions before lifestyle absorbs it.`,
    `Each +1% of gross income saved ≈ ${fmt$(tax.grossIncome*.01)}/yr`,90);
  if(cf.surplus<0) add('cashflow','high','Negative free cash flow',
    `Projected outflows exceed inflows by ${fmt$(-cf.surplus)}/yr. This is structurally unsustainable and will surface as revolving debt. Conduct a fixed-vs-discretionary decomposition: essential expenses are ${fmt$(cf.essentialM)}/mo (${fmtPct(cf.essentialM*12/tax.grossIncome)} of gross). Target discretionary compression before touching protection premiums or match-qualifying deferrals.`,
    `Deficit: ${fmt$(-cf.surplus)}/yr`,100);
  if(cf.dtiBack>.36) add('cashflow','med','Back-end DTI above conventional ceiling',
    `Housing + debt service is ${fmtPct(cf.dtiBack)} of gross vs. the 36% guideline. This constrains refinancing optionality and amplifies sequence risk in a job-loss scenario.`,'',50);
}

/* ---- Tax ---- */
function taxRules({ d, tax, cf, ret, ins, est, edu, debt, inv, a, ladder }, add) {
  const r = T26.retirement;
  if(tax.room24>1000 && (d.c1_401k_type==='Traditional (pre-tax)'||d.c2_401k_type==='Traditional (pre-tax)') && tax.marginalFed<=.24 && ret.pretaxAtRMD>2000000)
    add('tax','med','Roth-shift deferrals while brackets are compressed',
    `Ordinary TI of ${fmt$(tax.ordTI)} leaves ${fmt$(tax.room24)} of headroom in the ≤24% band, while the pre-tax bucket compounds to a projected ${fmt$(ret.pretaxAtRMD)} at RMD age — implying first-year RMDs of ~${fmt$(ret.firstRMD)} taxed at future ordinary rates plus IRMAA exposure. Shift a portion of deferrals to Roth 401(k) and/or execute annual partial Roth conversions filling the 22/24% brackets.`,
    `Bracket arbitrage on ${fmt$(tax.room24)}/yr of conversion capacity`,60);
  if(tax.marginalFed>=.32 && (d.c1_401k_type!=='Traditional (pre-tax)'&&d.c1_401k_contrib>0))
    add('tax','med','Prioritize pre-tax deferrals at a 32%+ marginal rate',
    `At a ${fmtPct(tax.marginalFed,0)} federal marginal rate (plus ${fmtPct(tax.stateIncTaxRate)} state), Roth deferrals surrender substantial current-year alpha. Unless you project equal-or-higher retirement brackets, traditional deferrals dominate; diversify tax buckets via backdoor Roth instead.`,
    `≈ ${fmt$( (d.c1_401k_contrib+d.c2_401k_contrib)*(tax.marginalFed+tax.stateIncTaxRate) )} current-year tax reduction if fully pre-tax`,55);
  if(tax.ltcg0room>5000 && d.brokerage>50000) add('tax','low','0% LTCG bracket harvesting',
    `${fmt$(tax.ltcg0room)} of the 0% LTCG bracket (breakpoint ${fmt$(T26.ltcg[tax.fs][1][0])} taxable income) is unused. Harvest embedded gains up to the breakpoint annually — a costless basis step-up. Coordinate with loss harvesting (do not waste losses offsetting 0%-rate gains).`,
    `Basis step-up of up to ${fmt$(tax.ltcg0room)}/yr at 0%`,35);
  if(tax.niit>0) add('tax','med','NIIT exposure — asset location review',
    `MAGI of ${fmt$(tax.magi)} exceeds the ${fmt$(T26.niit.thresh[tax.fs])} §1411 threshold; ${fmt$(tax.niit)} of NIIT applies. Mitigate by relocating income-generating assets (taxable bonds, REITs, high-turnover funds) into qualified accounts, munis in taxable, and managing realization timing.`,
    `Current NIIT: ${fmt$(tax.niit)}/yr`,45);
  if(tax.qbiNote) add('tax','med','§199A SSTB phase-out management',
    tax.qbiNote+` Levers: increase pre-tax deferrals (solo 401(k)/cash balance plan) to pull taxable income below the ${fmt$(T26.qbi.thresh[tax.fs])} threshold and restore the deduction — a stacked marginal benefit that can exceed 40%.`,'',58);
  if(d.se_income>50000 && d.biz_retplan!=='Yes') add('tax','high','Establish an owner-side qualified plan',
    `${fmt$(d.se_income)} of self-employment income with no sponsored plan leaves the largest above-the-line deduction unused. A solo 401(k) permits ${fmt$(r.d401k)} employee deferral plus ~20% of net SE earnings employer-side (aggregate cap ${fmt$(r.dcTotal)}). At higher income, layer a cash balance plan for six-figure deductions.`,
    `Up to ${fmt$(Math.min(r.dcTotal, r.d401k + d.se_income*.20))} deductible capacity`,80);
  if(d.charitable_annual>5000 && !tax.usingItemized) add('tax','med','Charitable bunching / DAF',
    `${fmt$(d.charitable_annual)}/yr of giving is absorbed by the ${fmt$(tax.stdDed)} standard deduction — zero marginal tax benefit. Bunch 3 years of gifts (${fmt$(d.charitable_annual*3)}) into a donor-advised fund funded with low-basis appreciated shares: full FMV deduction, embedded gain permanently avoided, grant timing unchanged.`,
    `≈ ${fmt$(d.charitable_annual*2*tax.marginalFed)} incremental deduction value per cycle`,48);
  if(d.charitable_annual>0 && d.c1_age>=70.5) add('tax','med','Qualified Charitable Distributions',
    `Route giving through QCDs (limit ${fmt$(r.qcdMax)}/person/yr): excludes the distribution from AGI entirely — superior to itemizing — and offsets RMDs once required. AGI reduction also protects IRMAA tiers and the OBBBA senior deduction phase-out.`,'',50);
  if(tax.saltAllowed<tax.stateIncTax+.0001 && tax.magi>T26.salt.magiPhaseStart) add('tax','low','SALT cap phase-down applies',
    `MAGI ${fmt$(tax.magi)} exceeds the ${fmt$(T26.salt.magiPhaseStart)} OBBBA phase-down trigger; the ${fmt$(T26.salt.cap)} SALT ceiling is compressing toward the ${fmt$(T26.salt.floor)} floor. If pass-through income exists, evaluate the state PTET election to move state tax above the line.`,'',30);
}

/* ---- Retirement ---- */
function retirementRules({ d, tax, cf, ret, ins, est, edu, debt, inv, a, ladder }, add) {
  const r = T26.retirement;
  const matchShort1=d.c1_salary>0 && d.c1_match>0 && d.c1_401k_contrib < d.c1_salary*(d.c1_match_cap/100);
  const matchShort2=d.c2_salary>0 && d.c2_match>0 && d.c2_401k_contrib < d.c2_salary*(d.c2_match_cap/100);
  if(matchShort1||matchShort2) add('retirement','high','Unclaimed employer match',
    `Deferrals are below the match-qualifying threshold${matchShort1&&matchShort2?' for both clients':''}. This is a guaranteed, immediate 50–100% return being forfeited. Raise deferrals to at least the match cap before any other savings allocation.`,
    `Forfeited match ≈ ${fmt$((matchShort1?d.c1_salary*(d.c1_match/100)-Math.min(d.c1_401k_contrib,d.c1_salary*(d.c1_match/100)):0)+(matchShort2?d.c2_salary*(d.c2_match/100)-Math.min(d.c2_401k_contrib,d.c2_salary*(d.c2_match/100)):0))}/yr`,98);
  if(ret.successRate<.75) add('retirement','high','Retirement plan success rate below confidence floor',
    `Monte Carlo success is ${fmtPct(ret.successRate,0)} (${a.as_mc_trials.toLocaleString()} trials, retirement at ${ret.retAge}, plan-to-age ${ret.lifeExp}). Levers in order of efficiency: (1) increase savings ${fmt$(Math.max(0, (0.85-ret.successRate)*ret.spendAtRet*.4))}/yr, (2) defer retirement 2–3 years (each year adds contribution, compounding, and shortens decumulation), (3) SS claiming optimization, (4) reduce the real spending target.`,
    `Success rate ${fmtPct(ret.successRate,0)} vs. ≥85% target`,92);
  else if(ret.successRate<.85) add('retirement','med','Success rate marginal — tighten funding',
    `${fmtPct(ret.successRate,0)} success is workable but leaves little margin for sequence risk in the first decade of decumulation. A ${fmt$(5000)}/yr contribution increase or a one-year retirement deferral typically moves this above 85%.`,'',60);
  if(ret.successRate>.97 && ret.median>ret.spendAtRet*25) add('retirement','low','Plan is overfunded — surplus optimization',
    `Success rate ${fmtPct(ret.successRate,0)} with median terminal wealth of ${fmt$(ret.median)}. The constraint is no longer accumulation; shift focus to tax-efficient decumulation sequencing, Roth conversion laddering in the pre-RMD window, legacy design, and lifetime gifting.`,'',30);
  if(ret.unused1>0 && cf.surplus>ret.unused1*.5) add('retirement','med',`Unused deferral capacity — ${esc(d.c1_name||'Client 1')}`,
    `${fmt$(ret.unused1)} of 2026 elective deferral capacity is unused (limit ${fmt$(ret.cap1)}${d.c1_age>=r.superAgeLo&&d.c1_age<=r.superAgeHi?' including the §603 SECURE 2.0 super catch-up of '+fmt$(r.superCatch)+' for ages 60–63':d.c1_age>=50?' including the '+fmt$(r.catch50)+' age-50 catch-up':''}). Surplus cash flow supports capturing it.`,
    `Tax deferral value ≈ ${fmt$(ret.unused1*(tax.marginalFed+tax.stateIncTaxRate))}/yr`,65);
  if(ret.unused2>0 && (d.c2_salary+d.c2_bonus)>0 && cf.surplus>ret.unused2*.5) add('retirement','med',`Unused deferral capacity — ${esc(d.c2_name||'Client 2')}`,
    `${fmt$(ret.unused2)} of 2026 elective deferral capacity is unused (limit ${fmt$(ret.cap2)}${d.c2_age>=r.superAgeLo&&d.c2_age<=r.superAgeHi?' including the '+fmt$(r.superCatch)+' super catch-up for ages 60–63':d.c2_age>=50?' including the '+fmt$(r.catch50)+' age-50 catch-up':''}). Surplus cash flow supports capturing it before taxable-account saving.`,
    `Tax deferral value ≈ ${fmt$(ret.unused2*(tax.marginalFed+tax.stateIncTaxRate))}/yr`,65);
  if(ret.bridgeYears>0 && ret.successRate<.95) add('retirement','med','Retirement-to-SS bridge period unfunded income',
    `Retirement at ${ret.retAge} precedes Social Security claiming at ${d.c1_ss_claim} — a ${ret.bridgeYears}-year bridge in which the full ${fmt$(ret.spendAtRet)} spending load falls on the portfolio. Pre-position ${ret.bridgeYears} years of net need in a duration-matched bond/CD ladder to immunize sequence risk; these are also the prime Roth-conversion years (income floor is low before SS and RMDs begin).`,'',53);
  if(ret.rothCatchupMandate1||ret.rothCatchupMandate2) add('retirement','med','Mandatory Roth catch-up applies (SECURE 2.0 §603)',
    `Prior-year FICA wages exceed ${fmt$(r.rothCatchupWage)}, so 2026 catch-up contributions must be designated Roth. Confirm the plan has a Roth source and update payroll elections — plans without Roth provisions bar catch-ups entirely for affected participants.`,'',55);
  if(ret.rothBlocked && (d.c1_roth_contrib>0||d.c2_roth_contrib>0)) add('retirement','high','Direct Roth IRA contributions are impermissible — excess contribution exposure',
    `MAGI ${fmt$(tax.magi)} exceeds the ${fmt$(ret.rothPhase[1])} ceiling. Current direct contributions trigger the 6% §4973 excise per year until corrected. Recharacterize/remove promptly and convert to the backdoor funnel.`,
    `Excise exposure: ${fmt$((d.c1_roth_contrib+d.c2_roth_contrib)*.06)}/yr until cured`,88);
  if(ret.rothBlocked || ret.rothPartial){
    const clean=ret.proRataExposure<1000;
    add('retirement', clean?'med':'med','Backdoor Roth IRA channel',
    `MAGI ${fmt$(tax.magi)} ${ret.rothBlocked?'bars':'partially phases out'} direct Roth contributions (phase-out ${fmt$(ret.rothPhase[0])}–${fmt$(ret.rothPhase[1])}). Execute non-deductible traditional contributions (${fmt$(ret.iraCap1)}${ins.life2?' + '+fmt$(ret.iraCap2)+' spousal':''}) with prompt conversion. ${clean?'Pro-rata position is clean — no pre-tax IRA balances to aggregate under §408(d)(2).':'CAUTION: '+fmt$(ret.proRataExposure)+' of pre-tax IRA money contaminates the §408(d)(2) pro-rata calculation. First roll pre-tax IRA balances into the employer plan (if it accepts roll-ins) to isolate basis, then convert.'} File Form 8606 both legs.`,
    `${fmt$(ret.iraCap1+(ins.life2?ret.iraCap2:0))}/yr of permanent Roth capacity`,62);
  }
  if((d.c1_aftertax==='Yes'||d.c2_aftertax==='Yes') && cf.surplus>10000) add('retirement','med','Mega-backdoor Roth available',
    `The plan permits after-tax contributions with in-plan Roth conversion. Total DC additions cap is ${fmt$(r.dcTotal)} (§415(c)); after employee deferrals and employer money, the residual after-tax space can be systematically converted — the largest Roth accumulation channel available. Convert immediately upon contribution to zero out earnings pickup.`,
    `Potential Roth capacity beyond deferral limits`,58);
  if(ladder && ladder.irmWithout.tier>0) add('retirement','med','Projected IRMAA surcharge at RMD onset',
    `Unconverted, projected MAGI at age ${ret.rmdAge1} (first RMD ${fmt$(ladder.rmdWithout)} + 85% SS + pensions) lands in IRMAA Tier ${ladder.irmWithout.tier} — Part B of ${fmt$(ladder.irmWithout.prem*12)}/person/yr vs. the ${fmt$(T26.irmaa.stdB*12)} standard (${fmt$(ladder.irmWithout.surchargeAnnual*ladder.persons)}/yr household surcharge, before Part D IRMAA). IRMAA is a cliff — $1 of MAGI over a threshold triggers the full tier, and the determination uses a 2-year MAGI lookback, so conversion sequencing must end cleanly 2 years before Medicare enrollment or manage tiers deliberately. The conversion ladder below reduces the projected tier to ${ladder.irmWith.tier}.`,
    `IRMAA reduction ≈ ${fmt$(ladder.irmSavings)}/yr household`,51);
  if(ret.pretaxAtRMD>1500000) add('retirement','med','Pre-RMD Roth conversion window',
    `Pre-tax balances project to ${fmt$(ret.pretaxAtRMD)} by RMD age ${ret.rmdAge1} (first RMD ≈ ${fmt$(ret.firstRMD)}). The years between retirement (${ret.retAge}) and RMD onset are low-bracket conversion years — model annual conversions filling through the 24% bracket, watching IRMAA lookback (2-year) and the OBBBA senior deduction phase-out at ${fmt$(T26.seniorDeduction.phaseStart[tax.fs])} MAGI.`,'',52);
  const claimDelta = d.c1_ss_claim && d.c1_ss_claim<70 && ret.successRate<.9 && d.c1_health!=='Poor';
  if(claimDelta) add('retirement','low','Social Security claiming optimization',
    `Claiming at ${d.c1_ss_claim} forgoes 8%/yr delayed retirement credits to 70 — an actuarially favorable, inflation-indexed, longevity-hedged annuity for a ${d.c1_health} health profile. For the higher earner in a married couple, delay also maximizes the survivor benefit. Bridge the gap with portfolio withdrawals (which simultaneously enables Roth conversions).`,'',40);
  if(d.hsa_coverage!=='None' && d.hsa_contrib < (d.hsa_coverage==='Family'?r.hsaFam:r.hsaSelf)) add('retirement','med','HSA underfunded — triple-tax-advantaged space unused',
    `Contributing ${fmt$(d.hsa_contrib)} vs. the ${fmt$(d.hsa_coverage==='Family'?r.hsaFam:r.hsaSelf)} 2026 limit${d.c1_age>=55?' (+'+fmt$(r.hsaCatch)+' catch-up)':''}. The HSA is the only account with deductible-in, tax-free growth, tax-free-out (qualified) treatment — fund it fully, invest the balance, pay current medical costs out-of-pocket, and archive receipts for future tax-free reimbursement.`,
    `Unused: ${fmt$((d.hsa_coverage==='Family'?r.hsaFam:r.hsaSelf)-d.hsa_contrib)}/yr`,57);
}

/* ---- Insurance / Risk ---- */
function insuranceRules({ d, tax, cf, ret, ins, est, edu, debt, inv, a, ladder }, add) {
  const lifeRules = (life, name, score) => {
    if (!life) return;
    const who = esc(name);
    if (life.gap > 100000) add('insurance', 'high', `Life insurance gap — ${who}`,
      `Needs analysis: if ${who} died today, survivor spending of ${fmt$(life.survivorSpend)}/yr (household spending less debt service and ${fmtPct(a.consumption, 0)} personal consumption) against survivor take-home of ${fmt$(life.survivorNet)}/yr and Social Security survivor benefits of ${fmt$(life.ssYear1)}/yr leaves an income gap worth ${fmt$(life.pvGap)} over ${life.horizon} years. Adding debt payoff, unfunded education and final expenses (${fmt$(life.lumpSums)}) and subtracting liquid assets (${fmt$(ins.liquid)}) gives a need of ${fmt$(life.need)} vs. ${fmt$(life.existing)} in force. Close with laddered level term (staggered 10/20-yr policies matching the declining need); group coverage is not portable and should not be counted on long term.`,
      `Gap: ${fmt$(life.gap)}`, score);
    else if (life.existing > 2 * life.need && life.existing - life.need > 500000) add('insurance', 'low', `Life coverage exceeds needs-based estimate — ${who}`,
      `${fmt$(life.existing)} in force vs. a ${fmt$(life.need)} needs-based estimate (survivor income and Social Security survivor benefits cover most ongoing spending). Before reducing coverage, confirm how much is employer group life (not portable), whether the estate needs liquidity, and whether the family wants a margin for a longer horizon or a higher standard of living; income replacement would support up to ${fmt$(life.hlv)}.`,
      '', 30);
  };
  lifeRules(ins.life1, d.c1_name || 'Client 1', 94);
  lifeRules(ins.life2, d.c2_name || 'Client 2', 90);
  if(ins.di1.gap>10000) add('insurance','high',`Disability income gap — ${esc(d.c1_name||'Client 1')}`,
    `LTD replaces ${fmtPct(ins.di1.covered/Math.max(1,ins.di1.target/.6))} of income vs. a 60% target — gap of ${fmt$(ins.di1.gap)}/yr. ${ins.di1.def==='Any-Occupation'?'Existing coverage is any-occupation, which is materially weaker; supplement with an own-occupation individual policy.':ins.di1.def==='None'?'No LTD in force — morbidity risk pre-65 exceeds mortality risk and this is the plan’s largest unfunded exposure.':'Verify the own-occupation definition, residual rider, and COLA rider.'} Note: employer-paid premiums make benefits taxable; individually-paid (after-tax) benefits are tax-free, so the effective gap is larger than nominal.`,
    `Uninsured income stream: ${fmt$(ins.di1.gap)}/yr`,93);
  if(ins.di2&&ins.di2.gap>10000) add('insurance','med',`Disability income gap — ${esc(d.c2_name||'Client 2')}`,
    `LTD gap of ${fmt$(ins.di2.gap)}/yr against the 60% benchmark. Same own-occupation and tax-character considerations apply.`,'',70);
  if(ins.umbrellaGap>0) add('insurance','med','Personal liability limits below net worth',
    `Creditor-exposed net worth of ${fmt$(ins.exposedNetWorth)} (total net worth ${fmt$(ins.netWorth)} less retirement accounts and 529 plans, which are generally protected) vs. ${fmt$(d.umbrella)} umbrella coverage. Judgment creditors can reach non-exempt assets and future wages. Increase to ${fmt$(ins.umbrellaTarget)} (≈$200–400/yr per $1M) and confirm underlying auto/home liability meets the umbrella attachment point.`,
    `Coverage gap: ${fmt$(ins.umbrellaGap)}`,66);
  if(ins.ltcFlag1||ins.ltcFlag2) add('insurance','med','Long-term care exposure unaddressed',
    `Client age(s) ${d.c1_age}${d.c2_age?'/'+d.c2_age:''} with no LTC coverage. The underwriting sweet spot is 50–60; premiums and declinature risk rise steeply after. Evaluate: traditional LTCi, asset-based hybrid (life/LTC linked — return-of-premium optionality), or a designated self-funding bucket if investable assets exceed ~$2.5M. Median private-room SNF cost exceeds $110k/yr and compounds faster than CPI.`,'',56);
  if(d.health_plan==='HDHP (HSA-eligible)' && d.hsa_coverage==='None') add('insurance','med','HDHP enrolled but HSA tier not set',
    `HSA-eligible coverage with no HSA established — free tax alpha being forfeited. Open and fund per the retirement section.`,'',50);
  if(d.home_auto_ok!=='Yes') add('insurance','low','P&C review stale',
    `Home/auto policies unreviewed for 2+ years. Verify replacement-cost (not ACV) dwelling coverage against current construction costs, water-backup and service-line endorsements, and liability alignment with the umbrella attachment.`,'',35);
}

/* ---- Estate ---- */
function estateRules({ d, tax, cf, ret, ins, est, edu, debt, inv, a, ladder }, add) {
  if(est.missing.length>0) add('estate','high','Core estate documents missing',
    `Missing: ${est.missing.join(', ')}. Intestacy places distribution under statutory formula and guardianship/asset decisions with the court. ${est.missing.includes('Revocable Trust (funded)')&&ins.netWorth>1000000?'Given net worth of '+fmt$(ins.netWorth)+', a funded revocable trust also delivers probate avoidance, privacy, and incapacity continuity — retitle accounts and record a pour-over will.':''} Engage estate counsel; this precedes all transfer-tax optimization.`,'',96);
  if(est.guardianGap) add('estate','high','No guardian designated for minor children',
    `Minor children with no nominated guardian leaves the appointment wholly to judicial discretion. Execute nominations in the will plus standalone short-term guardianship authorizations.`,'',97);
  if(est.benefStale) add('estate','med','Beneficiary designations unverified',
    `Retirement accounts, life insurance, and TOD registrations pass outside the will — stale designations override current intent (Egelhoff). Audit every contract: primary + contingent, per stirpes elections, no estate-as-beneficiary defaults (which forfeits spousal rollover and triggers 5-year rule), and coordinate with SECURE Act 10-year rule for non-EDB heirs.`,'',72);
  if(d.state==='IL' && est.grossEstateAtLE>T26.estate.ilExemption) add('estate','med','Illinois estate tax exposure — no portability',
    `Projected gross estate of ${fmt$(est.grossEstateAtLE)} exceeds the ${fmt$(T26.estate.ilExemption)} Illinois exemption, which is NOT portable between spouses. Without planning, the first decedent's exemption is wasted. Implement formula credit-shelter (bypass) funding at the state threshold or a marital/QTIP structure with an Illinois-only QTIP election to capture both exemptions. Illinois graduated rates reach 16% and the cliff structure makes marginal exposure severe.`,
    `Unplanned exposure engages a 0.8–16% graduated schedule`,74);
  if(est.fedExposed>0) add('estate','med','Federal estate tax exposure',
    `Projected estate ${fmt$(est.grossEstateAtLE)} vs. combined federal exemption ${fmt$(est.fedExp)} (now inflation-indexed, permanent under OBBBA). Exposure of ${fmt$(est.fedExposed)} at 40%. Toolkit: annual exclusion program (${fmt$(est.giftCapacity)}/yr capacity), SLATs to lock exemption while retaining indirect access, valuation-discounted transfers of the business interest, GRATs for appreciating assets, and ILIT ownership of life insurance.`,
    `Potential tax: ${fmt$(est.fedExposed*.4)}`,68);
  if(d.life_in_estate==='Yes' && est.lifeFace>1000000 && (est.fedExposed>0||(d.state==='IL'&&est.grossEstateAtLE>T26.estate.ilExemption)))
    add('estate','med','Life insurance includible in gross estate',
    `${fmt$(est.lifeFace)} of personally-owned death benefit is includible under §2042 and inflates the taxable estate. An ILIT (new policies) or transfer of existing policies (3-year §2035 lookback) removes proceeds while providing estate liquidity via Crummey-power gifts.`,'',54);
  if(d.charitable_intent==='Yes' && (est.fedExposed>0||inv.unrealized>250000)) add('estate','low','Charitable structuring',
    `Charitable intent + ${inv.unrealized>250000?fmt$(inv.unrealized)+' of embedded gain':'estate exposure'} argues for: testamentary IRA-to-charity designation (IRD avoidance — charity takes pre-tax dollars tax-free, heirs take step-up assets), CRT for diversifying the concentrated/low-basis position with deferral, or DAF endowment during life.`,'',38);
  if((d.children||[]).some(c=>c.special==='Yes')) add('estate','high','Special needs planning required',
    `A dependent with special needs requires a third-party special needs trust to preserve means-tested benefit eligibility (SSI/Medicaid). Direct bequests or UTMA titling are disqualifying. Coordinate all family beneficiary designations (including grandparents) toward the SNT and evaluate ABLE account layering.`,'',95);
}

/* ---- Education ---- */
function educationRules({ d, tax, cf, ret, ins, est, edu, debt, inv, a, ladder }, add) {
  const r = T26.retirement;
  edu.rows.forEach(row=>{
    if(row.gap>10000) add('education','med',`Education funding gap — ${esc(row.name)}`,
      `Projected cost ${fmt$(row.totalCost)} (${row.yrsTo} yrs out, ${fmtPct(a.collInfl)} education inflation) vs. projected 529 value ${fmt$(row.fv529)}. Gap of ${fmt$(row.gap)} requires ~${fmt$(row.monthlyNeeded)}/mo. ${d.state==='IL'?'Illinois allows a state deduction up to $10,000/$20,000 (single/MFJ) for Bright Start contributions — worth ~'+fmt$(Math.min(20000,row.monthlyNeeded*12)*T26.il.rate)+'/yr at 4.95%.':''} Age-based glide path; de-risk to ≤30% equity within 5 years of matriculation.`,
      `Fund ${fmt$(row.monthlyNeeded)}/mo`,60);
  });
  if(edu.rows.length>0 && cf.surplus>50000 && est.fedExposed>0) add('education','low','529 superfunding',
    `Front-load five years of annual exclusions (${fmt$(T26.estate.superfund529)}/donor/beneficiary; ${fmt$(T26.estate.superfund529*2)} per couple) via the §529(c)(2)(B) election — removes assets plus growth from the estate immediately. File 709 to memorialize the election. Excess 529 assets have a §529-to-Roth relief valve (${fmt$(r.r529ToRoth)} lifetime, 15-yr seasoning).`,'',36);
}

/* ---- Debt ---- */
function debtRules({ d, tax, cf, ret, ins, est, edu, debt, inv, a, ladder }, add) {
  debt.items.forEach(it=>{
    if(it.rate>debt.hurdle && it.bal>1000 && it.name!=='Mortgage')
      add('debt', it.rate>15?'high':'med', `Retire ${it.name.toLowerCase()} — rate exceeds hurdle`,
      `${fmt$(it.bal)} at ${it.rate.toFixed(1)}% exceeds the after-tax investment hurdle of ${debt.hurdle.toFixed(1)}%. Paying this down is a risk-free, guaranteed return superior to incremental taxable investing. Sequence by avalanche (rate-descending) after minimums.${it.name==='Credit Cards'?' Carried revolving balances also compress credit utilization scoring and should be structurally eliminated via the surplus, not balance-transferred indefinitely.':''}`,
      `Guaranteed ${it.rate.toFixed(1)}% pre-tax-equivalent return on ${fmt$(it.bal)}`, it.rate>15?91:63);
  });
  if(d.mtg_rate>6.5 && d.mtg_balance>100000) add('debt','low','Mortgage refinance watch',
    `${fmt$(d.mtg_balance)} at ${d.mtg_rate}% — set a refinance trigger at ~75–100bp below coupon net of closing costs (breakeven analysis against expected tenure). Recasting after lump-sum principal is a lower-cost alternative if rate markets don't cooperate.`,'',28);
  if(d.student_loans>0 && (d.student_type==='Federal'||d.student_type==='Mixed')) add('debt','low','Federal student loan strategy',
    `Before any private refinance of federal balances, confirm forgiveness-track ineligibility (PSLF for nonprofit/government employment) — refinancing irrevocably forfeits income-driven plans, deferment, and discharge provisions.`,'',26);
}

/* ---- Investments ---- */
function investmentRules({ d, tax, cf, ret, ins, est, edu, debt, inv, a, ladder }, add) {
  if(Math.abs(inv.drift)>15) add('invest','med','Portfolio misaligned with policy allocation',
    `Current equity ${inv.currentEq}% vs. a ${inv.targetEq}% policy target derived from capacity (horizon ${ret.yrsToRet} yrs), tolerance (${inv.rt}/10), and behavioral response. ${inv.drift>0?'Overweight equity amplifies sequence-of-returns risk approaching the retirement date; de-risk inside qualified accounts first (no tax friction).':'Underweight equity creates shortfall risk the Monte Carlo already reflects; re-risk methodically.'} Rebalance with 5%-band triggers rather than calendar-only.`,'',59);
  if(inv.concFlag) add('invest','high','Concentrated position exceeds prudence threshold',
    `${d.concentration}% single-position weight breaches the 10% concentration ceiling. Idiosyncratic risk is uncompensated. Diversification paths by tax efficiency: (1) sell within 0% LTCG headroom of ${fmt$(tax.ltcg0room)}, (2) staged 10b5-1-style systematic sale program, (3) exchange fund (7-yr seasoning), (4) CRT if charitably inclined, (5) collar/prepaid variable forward for hedging without immediate realization. Never hold for taxes alone — the risk-adjusted math rarely supports it.`,'',85);
  if(inv.behaviorMismatch) add('invest','med','Stated tolerance conflicts with behavioral response',
    `Risk tolerance ${inv.rt}/10 vs. a stated drawdown response of "${esc(d.risk_reaction)}". Behavioral capacity governs — anchor the IPS to the more conservative reading and document it. An IPS-committed rebalancing discipline is the primary defense against realized behavior gaps (DALBAR-style return destruction).`,'',47);
  if(d.brokerage>100000 && (d.interest_income+d.div_ordinary)>3000) add('invest','low','Asset location inefficiency',
    `${fmt$(d.interest_income+d.div_ordinary)} of ordinary-rate investment income in taxable at a ${fmtPct(tax.marginalFed+tax.stateIncTaxRate,0)} combined marginal rate. Relocate taxable bonds/REITs to tax-deferred, hold broad equity index + munis in taxable, highest-growth assets in Roth. Location alpha ≈ 20–50bp/yr at no risk cost.`,'',33);
  if(d.liquidity_need!=='No' && d.liquidity_amount>0) add('invest','med',`Near-term liquidity goal: ${esc(d.liquidity_need)}`,
    `${fmt$(d.liquidity_amount)} needed within 5 years must be immunized — no equity beta. Segment into a defeasance bucket: T-bill/CD ladder or defined-maturity bond ETFs maturing at the need date. Do not let the retirement Monte Carlo absorb this claim.`,'',64);
}

/* ---- Business ---- */
function businessRules({ d, tax, cf, ret, ins, est, edu, debt, inv, a, ladder }, add) {
  if(d.biz_entity!=='None'&&d.biz_entity){
    if(d.business_value>250000 && d.biz_buysell!=='Yes') add('business','high','No buy-sell agreement',
      `A ${fmt$(d.business_value)} business interest with no buy-sell leaves valuation, funding, and transfer mechanics unresolved at death/disability/departure — and post-Connelly, entity-purchase structures funded with corporate-owned life insurance can inflate the taxable estate valuation. Prefer cross-purchase (or insurance-LLC hybrid) with current appraisal-based pricing.`,'',82);
    if(d.business_value>250000 && d.biz_keyperson!=='Yes') add('business','med','Key-person coverage absent',
      `Enterprise value is concentrated in principals; key-person coverage funds continuity, credit covenants, and recruitment costs at a principal's death or disability.`,'',52);
    if(d.biz_succession!=='Yes' && d.business_value>500000) add('business','med','No written succession plan',
      `${fmt$(d.business_value)} of net worth (${fmtPct(d.business_value/Math.max(1,ins.netWorth),0)} of the balance sheet) has no documented exit path. Succession design drives entity structure, QSBS eligibility review (§1202 — post-OBBBA tiered exclusion), installment vs. asset sale tax posture, and estate liquidity. Begin 5–10 years ahead of intended exit.`,'',54);
    if((d.biz_entity==='Sole Proprietorship'||d.biz_entity==='LLC (disregarded)') && d.se_income>80000) add('business','med','Entity election review — S-corp analysis',
      `At ${fmt$(d.se_income)} of net SE income, an S election with reasonable-compensation salary can strip the excess distributions from the 15.3% SE tax base. Model against: payroll costs, reduced solo-401(k) employer base, §199A W-2 limitation interactions, and state franchise treatment.`,
      `Indicative SE tax savings ≈ ${fmt$(Math.max(0,(d.se_income-Math.min(d.se_income*.6,120000)))*.153*.9)}/yr`,49);
  }
}

const DOMAIN_RULES = [
  cashFlowRules,
  taxRules,
  retirementRules,
  insuranceRules,
  estateRules,
  educationRules,
  debtRules,
  investmentRules,
  businessRules,
];

/** Run every domain's rules against model M and return recommendations ranked by score. */
export function runRules(M) {
  const R = [];
  const add = (domain, priority, title, body, impact, score) => R.push({ domain, priority, title, body, impact, score });
  for (const rules of DOMAIN_RULES) rules(M, add);
  R.sort((x, y) => y.score - x.score);
  return R;
}
