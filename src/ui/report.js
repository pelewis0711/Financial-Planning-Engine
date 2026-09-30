/**
 * Plan report renderer: turns a computed model into the client-facing plan
 * (KPIs, charts, domain sections, recommendations, Roth ladder, scenario
 * comparison). Returns HTML strings; the only DOM work is drawCharts().
 */
import { T26 } from '../engine/params/ty2026.js';
import { fmt$, fmtPct, esc } from '../engine/format.js';
import { PALETTE, chLine, chDonut, chBarH, chStack } from './charts.js';

/** Key metrics captured when the user pins a baseline scenario. */
export function snapshot(M) {
  return {
    success: M.ret.successRate, tax: M.tax.totalTax, nw: M.ins.netWorth, atRet: M.ret.atRetirement,
    median: M.ret.median, save: M.cf.savingsRate, retage: M.d.c1_retage,
    label: `ret @ ${M.d.c1_retage}, +${fmt$(M.d._extraSave || 0)} save, ${M.d.alloc_equity}% eq`,
  };
}

export function recHTML(r){
  return `<div class="rec ${r.priority}"><div class="rtitle">${r.title}<span class="prio">${r.priority}</span></div>
    <div class="rbody">${r.body}</div>${r.impact?`<div class="impact">▸ ${r.impact}</div>`:''}</div>`;
}
function domainRecs(R,dom){const list=R.filter(r=>r.domain===dom);return list.length?list.map(recHTML).join(''):'<p><i>No exceptions triggered — this domain is within policy tolerances.</i></p>';}
function deltaRow(name,base,cur,fmt,higherBetter=true){
  const diff=cur-base; const cls=diff===0?'':((diff>0)===higherBetter?'up':'down');
  const arrow=diff===0?'—':(diff>0?'▲ ':'▼ ');
  return `<tr><td>${name}</td><td>${fmt(base)}</td><td>${fmt(cur)}</td><td class="${cls}">${arrow}${fmt(Math.abs(diff))}</td></tr>`;
}

export function renderPlanHTML(M, { whatIf, baseline } = {}){
  const R=M.R;
  const {d,tax,cf,ret,ins,est,edu,debt,inv,a,ladder}=M;
  const names=esc(d.c2_name?`${d.c1_name} & ${d.c2_name}`:d.c1_name);
  const today=new Date().toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'});
  const sr=ret.successRate;
  const srClass=sr>=.85?'good':sr>=.75?'warn':'bad';
  const goalRows=(d.goals||[]).map((g,i)=>`<tr><td>${i+1}. ${esc(g.goal)}</td><td>${esc(g.priority)}</td><td>${g.horizon} yrs</td><td>${fmt$(g.cost||0)}</td></tr>`).join('');
  const topActions=R.slice(0,10).map((r,i)=>`<tr><td class="num">${i+1}</td><td><b>${r.title}</b><br><span style="font-size:12px;color:var(--muted)">${r.domain.toUpperCase()}</span></td><td><span class="pill ${r.priority==='high'?'r':r.priority==='med'?'a':'g'}">${r.priority}</span></td><td style="text-align:left">${r.impact||'—'}</td></tr>`).join('');
  const spendBase=Math.round((d.ret_spend>0?d.ret_spend:cf.expAnnual*.8)/1000)*1000;

  const whatifHTML=`
  <div class="whatif"><h3>WHAT-IF LABORATORY <span>— drag, release to re-run the ${a.as_mc_trials.toLocaleString()}-trial Monte Carlo and full rules engine live</span></h3>
    <div class="wgrid">
      <div class="wctl"><label>Retirement Age (C1): <span class="wval" id="wf_ret_v">${whatIf.retage}</span></label>
        <input type="range" id="wf_ret" min="50" max="75" step="1" value="${whatIf.retage}" data-whatif></div>
      <div class="wctl"><label>Additional Annual Savings: <span class="wval" id="wf_extra_v">${fmt$(whatIf.extra)}</span></label>
        <input type="range" id="wf_extra" min="0" max="100000" step="2500" value="${whatIf.extra}" data-whatif></div>
      <div class="wctl"><label>Retirement Spending (today's $): <span class="wval" id="wf_spend_v">${whatIf.spend>0?fmt$(whatIf.spend):'per intake'}</span></label>
        <input type="range" id="wf_spend" min="0" max="${Math.max(400000,spendBase*2)}" step="5000" value="${whatIf.spend}" data-whatif></div>
      <div class="wctl"><label>Equity Allocation: <span class="wval" id="wf_eq_v">${whatIf.eq}%</span></label>
        <input type="range" id="wf_eq" min="20" max="100" step="5" value="${whatIf.eq}" data-whatif></div>
    </div>
  </div>`;

  const scenHTML=`
  <div class="scen-bar">
    <button class="btn btn-navy" data-action="set-baseline">Pin Current as Baseline</button>
    ${baseline?`<button class="btn btn-ghost" style="color:var(--navy);border-color:var(--navy)" data-action="clear-baseline">Clear Baseline</button><span class="note">Baseline: ${esc(baseline.label)}</span>`:`<span class="note">Pin a baseline, adjust the what-if sliders (or intake), and compare scenarios side-by-side.</span>`}
  </div>
  ${baseline?`<div class="domain"><h3>Scenario Comparison <small>baseline vs. current</small></h3><div class="dbody">
    <table class="data deltatbl"><tr><th style="text-align:left">Metric</th><th>Baseline</th><th>Current</th><th>Δ</th></tr>
    ${deltaRow('Monte Carlo success',baseline.success,ret.successRate,v=>fmtPct(v,1),true)}
    ${deltaRow('Capital at retirement',baseline.atRet,ret.atRetirement,fmt$,true)}
    ${deltaRow('Median terminal wealth',baseline.median,ret.median,fmt$,true)}
    ${deltaRow('Total current-year tax',baseline.tax,tax.totalTax,fmt$,false)}
    ${deltaRow('Savings rate',baseline.save,cf.savingsRate,v=>fmtPct(v,1),true)}
    </table></div></div>`:''}`;

  const ladderHTML=ladder?`
    <h4>Roth Conversion Ladder — Retirement (${ret.retAge}) to RMD Onset (${ret.rmdAge1})</h4>
    <p>Strategy: fill ordinary income to the top of the 24% bracket (${fmt$(ladder.top24)} of taxable income in 2026 dollars, indexed at ${fmtPct(a.infl)} inflation) each pre-RMD year. Conversions are federally taxable but <b>exempt from Illinois income tax</b> under the retirement-income subtraction — a structural ${fmtPct(T26.il.rate)} discount for IL residents. IRMAA tier shown uses the conversion-year MAGI (2-year premium lookback applies).</p>
    <table class="data"><tr><th style="text-align:left">Year</th><th>Age</th><th>Pre-Tax Balance</th><th>Conversion</th><th>Federal Tax</th><th>Eff. Rate</th><th>IRMAA Tier</th></tr>
    ${ladder.rows.map(rw=>`<tr><td>${rw.yr}</td><td>${rw.age}</td><td>${fmt$(rw.bal)}</td><td>${fmt$(rw.conv)}</td><td>${fmt$(rw.taxCost)}</td><td>${fmtPct(rw.effRate)}</td><td>${rw.irmTier===0?'—':rw.irmTier}</td></tr>`).join('')}
    </table>
    <table class="data"><tr><th style="text-align:left">Outcome at Age ${ret.rmdAge1}</th><th>No Conversions</th><th>With Ladder</th></tr>
    <tr><td>Remaining pre-tax balance</td><td>${fmt$(ladder.balNo)}</td><td>${fmt$(ladder.balConv)}</td></tr>
    <tr><td>First-year RMD (÷${ladder.factor})</td><td>${fmt$(ladder.rmdWithout)}</td><td>${fmt$(ladder.rmdWith)}</td></tr>
    <tr><td>Projected IRMAA tier / household surcharge</td><td>Tier ${ladder.irmWithout.tier} — ${fmt$(ladder.irmWithout.surchargeAnnual*ladder.persons)}/yr</td><td>Tier ${ladder.irmWith.tier} — ${fmt$(ladder.irmWith.surchargeAnnual*ladder.persons)}/yr</td></tr>
    <tr><td>Cumulative conversion / tax cost</td><td>—</td><td>${fmt$(ladder.totConv)} / ${fmt$(ladder.totTax)} (${fmtPct(ladder.totConv>0?ladder.totTax/ladder.totConv:0)} blended)</td></tr></table>
    <p>Sequencing constraints: end conversions ≥2 years before Medicare enrollment or accept transition-year IRMAA; coordinate with 0% LTCG harvesting (conversions consume the same bracket space); each conversion carries its own 5-year recapture clock for pre-59½ access.</p>`:'';

  const html=`
  <div class="plan-head">
    <h2>Comprehensive Financial Plan — ${names}</h2>
    <div class="meta">Prepared ${today} &middot; Tax Year 2026 (post-OBBBA parameters) &middot; Filing: ${tax.fs} &middot; State: ${d.state}
    &middot; Monte Carlo: ${a.as_mc_trials.toLocaleString()} trials &middot; Plan horizon to age ${a.as_life_exp}</div>
  </div>
  ${whatifHTML}
  ${scenHTML}
  <div class="kpi-grid">
    <div class="kpi ${srClass}"><div class="lbl">Retirement Success Rate</div><div class="val">${fmtPct(sr,0)}</div><div class="sub2">Target ≥ 85%</div></div>
    <div class="kpi"><div class="lbl">Net Worth</div><div class="val">${fmt$(ins.netWorth)}</div><div class="sub2">Assets − liabilities</div></div>
    <div class="kpi ${cf.savingsRate>=.15?'good':'warn'}"><div class="lbl">Savings Rate</div><div class="val">${fmtPct(cf.savingsRate,0)}</div><div class="sub2">${fmt$(cf.savings)}/yr of gross</div></div>
    <div class="kpi ${cf.efMonths>=6?'good':cf.efMonths>=3?'warn':'bad'}"><div class="lbl">Emergency Reserve</div><div class="val">${cf.efMonths>24?'24+':cf.efMonths.toFixed(1)} mo</div><div class="sub2">Target 6 months</div></div>
    <div class="kpi"><div class="lbl">Effective / Marginal Fed</div><div class="val">${fmtPct(tax.effectiveFed,0)} / ${fmtPct(tax.marginalFed,0)}</div><div class="sub2">Total tax ${fmt$(tax.totalTax)}</div></div>
    <div class="kpi ${ins.life1.gap>100000||ins.di1.gap>10000?'bad':'good'}"><div class="lbl">Protection Gaps</div><div class="val">${R.filter(r=>r.domain==='insurance'&&r.priority==='high').length} critical</div><div class="sub2">Life / DI / liability</div></div>
  </div>

  <div class="charts">
    <div class="chartcard"><h3>Portfolio Projection — Monte Carlo Percentile Bands (age ${d.c1_age} → ${a.as_life_exp})</h3><div class="cwrap" id="ch_mc"></div></div>
    <div class="chartcard"><h3>Tax Composition — TY2026 Projection</h3><div class="cwrap" id="ch_tax"></div></div>
    <div class="chartcard"><h3>Balance Sheet Composition</h3><div class="cwrap" id="ch_bs"></div></div>
    <div class="chartcard"><h3>Retirement Income: Need vs. Sources @ Age ${ret.retAge} (nominal)</h3><div class="cwrap" id="ch_inc"></div></div>
  </div>

  <div class="domain"><h3>Executive Summary <small>prioritized implementation agenda</small></h3><div class="dbody">
    <p><b>${names}</b> — ${d.marital}, age${d.c2_age?'s':''} ${d.c1_age}${d.c2_age?'/'+d.c2_age:''}, household gross income ${fmt$(tax.grossIncome)}, net worth ${fmt$(ins.netWorth)}.
    Primary stated concerns: <i>${esc(d.concerns)||'not documented'}</i>. The engine evaluated the fact pattern and triggered ${R.length} planning exceptions across cash flow, tax, retirement, protection, estate, education, debt, investment, and business domains. The ten highest-leverage actions, ranked by severity-weighted score:</p>
    <table class="data actiontbl"><tr><th style="width:36px">#</th><th style="text-align:left">Action</th><th>Priority</th><th style="text-align:left">Quantified Impact</th></tr>${topActions||'<tr><td colspan=4>No exceptions triggered.</td></tr>'}</table>
    ${goalRows?`<h4>Client Goal Hierarchy (as ranked in discovery)</h4><table class="data"><tr><th style="text-align:left">Goal</th><th>Priority</th><th>Horizon</th><th>Est. Cost</th></tr>${goalRows}</table>`:''}
    ${d.values_notes?`<p><b>Qualitative context integrated into recommendations:</b> ${esc(d.values_notes)}</p>`:''}
  </div></div>

  <div class="domain"><h3>Cash Flow & Budgeting <small>net worth engine</small></h3><div class="dbody">
    <h4>Current State</h4>
    <table class="data">
      <tr><th style="text-align:left">Line</th><th>Annual</th><th>% of Gross</th></tr>
      <tr><td>Gross household income</td><td>${fmt$(tax.grossIncome)}</td><td>100%</td></tr>
      <tr><td>Total tax burden (fed + state + FICA)</td><td>${fmt$(tax.totalTax)}</td><td>${fmtPct(tax.effectiveTotal)}</td></tr>
      <tr><td>Living expenses incl. computed debt service & giving</td><td>${fmt$(cf.expAnnual)}</td><td>${fmtPct(cf.expAnnual/Math.max(1,tax.grossIncome))}</td></tr>
      <tr><td style="padding-left:26px">↳ debt service (derived from Liabilities): mortgage ${fmt$(cf.ds.mtg*12)} + other ${fmt$(cf.nonMtgDebtM*12)}</td><td>${fmt$((cf.ds.mtg+cf.nonMtgDebtM)*12)}</td><td>${fmtPct((cf.ds.mtg+cf.nonMtgDebtM)*12/Math.max(1,tax.grossIncome))}</td></tr>
      <tr><td>Systematic savings (all vehicles + match)</td><td>${fmt$(cf.savings)}</td><td>${fmtPct(cf.savingsRate)}</td></tr>
      <tr><td><b>Unallocated surplus / (deficit)</b></td><td><b>${fmt$(cf.surplus)}</b></td><td>${fmtPct(cf.surplus/Math.max(1,tax.grossIncome))}</td></tr>
    </table>
    <p>Housing ratio ${fmtPct(cf.dtiFront)} (guideline ≤28%); total obligations ${fmtPct(cf.dtiBack)} (guideline ≤36%). Essential-expense floor is ${fmt$(cf.essentialM)}/mo — this is the number the emergency reserve and disability analysis must defease, not gross budget.</p>
    <h4>Findings & Recommendations</h4>${domainRecs(R,'cashflow')}
  </div></div>

  <div class="domain"><h3>Tax Planning <small>TY2026 projection & multi-year strategy</small></h3><div class="dbody">
    <h4>Current-Year Projection</h4>
    <table class="data">
      <tr><th style="text-align:left">Item</th><th>Amount</th></tr>
      <tr><td>AGI</td><td>${fmt$(tax.agi)}</td></tr>
      <tr><td>Deduction (${tax.usingItemized?'itemized — SALT allowed '+fmt$(tax.saltAllowed):'standard'})</td><td>${fmt$(tax.deduction)}</td></tr>
      ${tax.seniorDed>0?`<tr><td>OBBBA senior deduction (through 2028)</td><td>${fmt$(tax.seniorDed)}</td></tr>`:''}
      ${tax.qbiDed>0?`<tr><td>§199A QBI deduction</td><td>${fmt$(tax.qbiDed)}</td></tr>`:''}
      <tr><td>Taxable income (ordinary / preferential)</td><td>${fmt$(tax.ordTI)} / ${fmt$(tax.prefIncome)}</td></tr>
      <tr><td>Federal ordinary + LTCG/QDI tax</td><td>${fmt$(tax.ordTax)} + ${fmt$(tax.capTax)}</td></tr>
      ${tax.amtOwed>0?`<tr><td>AMT incremental liability</td><td>${fmt$(tax.amtOwed)}</td></tr>`:''}
      ${tax.niit>0?`<tr><td>Net investment income tax (§1411)</td><td>${fmt$(tax.niit)}</td></tr>`:''}
      ${tax.addlMed>0?`<tr><td>Additional Medicare (0.9%)</td><td>${fmt$(tax.addlMed)}</td></tr>`:''}
      ${tax.seTax>0?`<tr><td>Self-employment tax</td><td>${fmt$(tax.seTax)}</td></tr>`:''}
      ${tax.ctc>0?`<tr><td>Child tax credit</td><td>(${fmt$(tax.ctc)})</td></tr>`:''}
      <tr><td>State income tax ${d.state==='IL'?'(IL 4.95% flat; retirement income exempt)':''}</td><td>${fmt$(tax.stateIncTax)}</td></tr>
      <tr><td>Employee FICA</td><td>${fmt$(tax.fica)}</td></tr>
      <tr><td><b>Total burden / effective rate</b></td><td><b>${fmt$(tax.totalTax)} · ${fmtPct(tax.effectiveTotal)}</b></td></tr>
    </table>
    <p>Marginal federal rate ${fmtPct(tax.marginalFed,0)}; headroom to the top of the 24% band: ${fmt$(tax.room24)} — this is the Roth-conversion / income-acceleration budget. Unused 0% LTCG capacity: ${fmt$(tax.ltcg0room)}.</p>
    <h4>Findings & Recommendations</h4>${domainRecs(R,'tax')}
  </div></div>

  <div class="domain"><h3>Retirement Planning <small>capital sufficiency, account architecture, decumulation</small></h3><div class="dbody">
    <h4>Capital Sufficiency Analysis</h4>
    <table class="data">
      <tr><th style="text-align:left">Metric</th><th>Value</th></tr>
      <tr><td>Investable retirement capital (today)</td><td>${fmt$(ret.balances)}</td></tr>
      <tr><td>Annual additions (deferrals + Roth + HSA + employer${d._extraSave?' + what-if '+fmt$(d._extraSave):''})</td><td>${fmt$(ret.annualContrib)}</td></tr>
      <tr><td>Expected return / volatility (${d.alloc_equity||70}% equity)</td><td>${fmtPct(ret.mu)} / ${fmtPct(ret.sigma)}</td></tr>
      <tr><td>Projected capital at retirement (age ${ret.retAge}, deterministic)</td><td>${fmt$(ret.atRetirement)}</td></tr>
      <tr><td>Retirement spending target (today's $ / at-retirement $)</td><td>${fmt$(ret.coreSpend)} / ${fmt$(ret.spendAtRet)}</td></tr>
      <tr><td>Guaranteed income — year 1 of retirement${ret.bridgeYears>0?' (SS begins '+ret.bridgeYears+' yrs later — bridge period)':''}</td><td>${fmt$(ret.guaranteed)}</td></tr>
      <tr><td>Guaranteed income — all sources online (SS + pensions)</td><td>${fmt$(ret.guaranteedFull)}</td></tr>
      <tr><td>Net portfolio withdrawal need (yr 1) / implied rate</td><td>${fmt$(ret.netNeed)} / ${fmtPct(ret.wdRate)}</td></tr>
      <tr><td><b>Monte Carlo success rate (${a.as_mc_trials.toLocaleString()} trials)</b></td><td><b>${fmtPct(ret.successRate,1)}</b></td></tr>
      <tr><td>Terminal wealth p10 / median / p90 (age ${a.as_life_exp})</td><td>${fmt$(ret.p10)} / ${fmt$(ret.median)} / ${fmt$(ret.p90)}</td></tr>
      <tr><td>RMD onset (SECURE 2.0: born ≥1960 → 75)</td><td>Age ${ret.rmdAge1}${d.c2_age?' / '+ret.rmdAge2:''}</td></tr>
      <tr><td>Projected pre-tax balance at RMD age / first RMD (no conversions)</td><td>${fmt$(ret.pretaxAtRMD)} / ≈${fmt$(ret.firstRMD)}</td></tr>
    </table>
    <p>2026 contribution architecture: elective deferral limit ${fmt$(T26.retirement.d401k)}; age-50 catch-up ${fmt$(T26.retirement.catch50)}; ages 60–63 super catch-up ${fmt$(T26.retirement.superCatch)}; §415(c) total additions ${fmt$(T26.retirement.dcTotal)}; IRA ${fmt$(T26.retirement.ira)} + ${fmt$(T26.retirement.iraCatch)} catch-up; HSA ${fmt$(T26.retirement.hsaSelf)}/${fmt$(T26.retirement.hsaFam)}. Roth IRA phase-out ${fmt$(ret.rothPhase[0])}–${fmt$(ret.rothPhase[1])} (MAGI ${fmt$(tax.magi)} → ${ret.rothBlocked?'<b>direct contributions barred</b>':ret.rothPartial?'partial':'full eligibility'}).</p>
    ${ladderHTML}
    <h4>Findings & Recommendations</h4>${domainRecs(R,'retirement')}
  </div></div>

  <div class="domain"><h3>Insurance & Risk Management <small>mortality, morbidity, liability, longevity</small></h3><div class="dbody">
    <h4>Coverage vs. Exposure</h4>
    <table class="data">
      <tr><th style="text-align:left">Exposure</th><th>Need</th><th>In Force</th><th>Gap</th></tr>
      <tr><td>Life — ${esc(d.c1_name||'Client 1')} (capital needs method)</td><td>${fmt$(ins.life1.need)}</td><td>${fmt$(ins.life1.existing)}</td><td>${fmt$(ins.life1.gap)}</td></tr>
      ${ins.life2?`<tr><td>Life — ${esc(d.c2_name)}</td><td>${fmt$(ins.life2.need)}</td><td>${fmt$(ins.life2.existing)}</td><td>${fmt$(ins.life2.gap)}</td></tr>`:''}
      <tr><td>Disability — ${esc(d.c1_name||'Client 1')} (60% replacement)</td><td>${fmt$(ins.di1.target)}/yr</td><td>${fmt$(ins.di1.covered)}/yr</td><td>${fmt$(ins.di1.gap)}/yr</td></tr>
      ${ins.di2?`<tr><td>Disability — ${esc(d.c2_name)}</td><td>${fmt$(ins.di2.target)}/yr</td><td>${fmt$(ins.di2.covered)}/yr</td><td>${fmt$(ins.di2.gap)}/yr</td></tr>`:''}
      <tr><td>Personal liability (umbrella vs. net worth)</td><td>${fmt$(ins.umbrellaTarget)}</td><td>${fmt$(d.umbrella)}</td><td>${fmt$(ins.umbrellaGap)}</td></tr>
    </table>
    <h4>Findings & Recommendations</h4>${domainRecs(R,'insurance')}
  </div></div>

  <div class="domain"><h3>Estate Planning <small>transfer, incapacity, and liquidity design</small></h3><div class="dbody">
    <h4>Current State</h4>
    <table class="data">
      <tr><th style="text-align:left">Item</th><th>Status / Value</th></tr>
      <tr><td>Gross estate (incl. ${d.life_in_estate==='Yes'?'personally-owned insurance':'net worth'} + expected inheritance)</td><td>${fmt$(est.grossEstate)}</td></tr>
      <tr><td>Projected gross estate (modeled growth)</td><td>${fmt$(est.grossEstateAtLE)}</td></tr>
      <tr><td>Federal exemption (2026, per person / couple)</td><td>${fmt$(T26.estate.fedExemption)} / ${fmt$(T26.estate.fedExemption*2)}</td></tr>
      ${d.state==='IL'?`<tr><td>Illinois exemption (per decedent, <b>no portability</b>)</td><td>${fmt$(T26.estate.ilExemption)}</td></tr>`:''}
      <tr><td>Federal exposure / ${d.state==='IL'?'Illinois exposure':'state exposure'}</td><td>${fmt$(est.fedExposed)} / ${fmt$(est.ilExposed)}</td></tr>
      <tr><td>Document deficiencies</td><td>${est.missing.length?est.missing.join(', '):'None — core suite in place'}</td></tr>
      <tr><td>Annual exclusion gifting capacity (family-wide)</td><td>${fmt$(est.giftCapacity)}/yr</td></tr>
    </table>
    <h4>Findings & Recommendations</h4>${domainRecs(R,'estate')}
  </div></div>

  ${edu.rows.length?`<div class="domain"><h3>Education Funding <small>§529 architecture</small></h3><div class="dbody">
    <table class="data"><tr><th style="text-align:left">Child</th><th>Age</th><th>Yrs to Enrollment</th><th>Projected Cost</th><th>Projected 529</th><th>Gap</th><th>Required $/mo</th></tr>
    ${edu.rows.map(r=>`<tr><td>${r.name}</td><td>${r.age}</td><td>${r.yrsTo}</td><td>${fmt$(r.totalCost)}</td><td>${fmt$(r.fv529)}</td><td>${fmt$(r.gap)}</td><td>${fmt$(r.monthlyNeeded)}</td></tr>`).join('')}</table>
    <h4>Findings & Recommendations</h4>${domainRecs(R,'education')}
  </div></div>`:''}

  ${debt.items.length?`<div class="domain"><h3>Debt Management <small>avalanche sequencing vs. investment hurdle</small></h3><div class="dbody">
    <table class="data"><tr><th style="text-align:left">Liability</th><th>Balance</th><th>Rate</th><th>Est. Service/mo</th><th>vs. ${debt.hurdle.toFixed(1)}% After-Tax Hurdle</th></tr>
    ${debt.items.map(it=>{const key={'Credit Cards':'cc','Other Debt':'other','HELOC':'heloc','Auto Loans':'auto','Student Loans':'student','Mortgage':'mtg'}[it.name];
      return `<tr><td>${it.name}</td><td>${fmt$(it.bal)}</td><td>${it.rate.toFixed(2)}%</td><td>${fmt$(cf.ds[key]||0)}</td><td>${it.rate>debt.hurdle?'<span class="pill r">Retire first</span>':'<span class="pill g">Carry / invest</span>'}</td></tr>`;}).join('')}</table>
    <h4>Findings & Recommendations</h4>${domainRecs(R,'debt')}
  </div></div>`:''}

  <div class="domain"><h3>Investment Policy <small>allocation, location, concentration, behavior</small></h3><div class="dbody">
    <h4>Current State</h4>
    <p>Investable assets ${fmt$(inv.investable)}. Current equity ${inv.currentEq}% vs. policy target ${inv.targetEq}% (derived from ${ret.yrsToRet}-yr horizon, ${inv.rt}/10 stated tolerance, "${esc(d.risk_reaction)}" behavioral response, ${d.invest_exp||'n/a'} experience). Taxable embedded gain ${fmt$(inv.unrealized)}. ${d.concentration>0?`Largest single position ${d.concentration}% of investable assets.`:''}</p>
    <h4>Findings & Recommendations</h4>${domainRecs(R,'invest')}
  </div></div>

  ${d.biz_entity&&d.biz_entity!=='None'?`<div class="domain"><h3>Business Owner Planning <small>entity, continuity, exit</small></h3><div class="dbody">
    <p>${d.biz_entity}, ${d.biz_ownership}% ownership, est. value ${fmt$(d.business_value)}, ${d.biz_employees} employees. Exit intent: ${esc(d.biz_exit)||'undocumented'}.</p>
    <h4>Findings & Recommendations</h4>${domainRecs(R,'business')}
  </div></div>`:''}

  <div class="disclaim"><b>Methodology & limitations.</b> Federal parameters per Rev. Proc. 2025-32 and IRS Notice 2025-67 (TY2026, post-OBBBA); 2026 IRMAA tiers per CMS ($202.90 standard Part B, 2-year MAGI lookback, cliff thresholds). Illinois: 4.95% flat with retirement-income exclusion; estate exemption $4.0M, no portability. Debt service derived from Liabilities (mortgage per stated P&I or amortized; auto 60-mo, student 120-mo, revolving 3% minimum, HELOC interest-only). Monte Carlo: lognormal annual returns, two-phase glide (${d.alloc_equity||70}% → ${a.as_ret_equity}% equity), 0.15 equity/fixed correlation; SS begins at claiming age. Roth ladder fills the 24% bracket; conversion taxes computed on bracket arithmetic, not full-return simulation. AMT, SALT phase-down, §199A, NIIT, CTC, and senior-deduction interactions are modeled at projection fidelity, not preparation fidelity. Output is decision-support for a qualifying professional; not tax, legal, or investment advice.</div>
  `;
  return html;
}

export function drawCharts(M){
  const {d,tax,cf,ret,ins,a}=M;
  const yrs=ret.totalYears;
  const labels=[];for(let y=0;y<=yrs;y++)labels.push(d.c1_age+y);
  function pctAt(q){const out=[];for(let y=0;y<=yrs;y++){const vals=ret.allPaths.map(p=>p[Math.min(y,p.length-1)]??0).sort((x,z)=>x-z);out.push(vals[Math.floor(q*(vals.length-1))]);}return out;}
  chLine('ch_mc',{labels,xTitle:'Age',band:[0,2],series:[
    {name:'90th percentile',color:'rgba(37,99,168,.55)',data:pctAt(.9),width:1.5},
    {name:'Median',color:PALETTE.navy,data:pctAt(.5),width:2.6},
    {name:'10th percentile',color:PALETTE.red,data:pctAt(.1),width:1.5,dash:'5,4'},
  ]});
  chDonut('ch_tax',[
    {label:'Federal ordinary',value:Math.max(0,tax.ordTax+tax.amtOwed-tax.ctc),color:PALETTE.navy},
    {label:'LTCG / QDI',value:tax.capTax,color:PALETTE.blue},
    {label:'NIIT + Add’l Medicare',value:tax.niit+tax.addlMed,color:PALETTE.amber},
    {label:'SE tax',value:tax.seTax,color:PALETTE.purple},
    {label:'State',value:tax.stateIncTax,color:PALETTE.gold},
    {label:'FICA',value:tax.fica,color:PALETTE.gray},
  ]);
  const kids529=(d.children||[]).reduce((s,c)=>s+(c.plan529||0),0);
  chBarH('ch_bs',[
    {label:'Cash',value:d.cash_checking+d.cash_savings,color:PALETTE.gold},
    {label:'Taxable brokerage',value:d.brokerage,color:PALETTE.blue},
    {label:'Pre-tax retirement',value:d.c1_401k+d.c2_401k+d.c1_trad_ira+d.c2_trad_ira,color:PALETTE.navy},
    {label:'Roth',value:d.c1_roth_ira+d.c2_roth_ira,color:PALETTE.green},
    {label:'HSA',value:d.hsa_balance,color:PALETTE.teal},
    {label:'529 plans',value:kids529,color:PALETTE.purple},
    {label:'Real estate',value:d.home_value+d.other_re,color:PALETTE.gray},
    {label:'Business / other',value:d.business_value+d.other_assets,color:PALETTE.slate},
    {label:'Liabilities',value:-(d.mtg_balance+d.heloc+d.auto_loans+d.student_loans+d.cc_debt+d.other_debt),color:PALETTE.red},
  ]);
  chStack('ch_inc',{cols:[
    {label:'Need (yr 1)',parts:[{label:'Spending need',value:ret.spendAtRet,color:PALETTE.red}]},
    {label:'Sources (yr 1)',parts:[
      {label:'Social Security',value:Math.max(0,ret.guaranteed-(d.c1_pension_ret+d.c2_pension_ret)),color:PALETTE.navy},
      {label:'Pensions',value:d.c1_pension_ret+d.c2_pension_ret,color:PALETTE.blue},
      {label:'Portfolio withdrawal',value:ret.netNeed,color:PALETTE.gold}]},
  ]});
}
