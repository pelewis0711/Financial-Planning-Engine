/**
 * Intake schema: the full CFP-style fact-finder, declared as data.
 *
 * The form renderer, input gathering, JSON save/load and the test fixtures
 * are all driven from this one declaration, so adding a field is a one-line
 * change.
 */
import { DEFAULT_ASSUMPTIONS } from '../engine/assumptions.js';

const F = (id,label,type,opts={}) => ({id,label,type,...opts});
const money = (id,label,h) => F(id,label,'money',{help:h});
const pct   = (id,label,h) => F(id,label,'pct',{help:h});
const num   = (id,label,h) => F(id,label,'num',{help:h});
const txt   = (id,label,h) => F(id,label,'text',{help:h});
const sel   = (id,label,options,h) => F(id,label,'select',{options,help:h});
const yn    = (id,label,h) => sel(id,label,['No','Yes'],h);

export const INTAKE_SCHEMA = [
{ id:'personal', title:'Personal & Family Profile', fields:[
  txt('c1_name','Client 1 — Name'),
  num('c1_age','Client 1 — Age'),
  num('c1_retage','Client 1 — Target Retirement Age'),
  txt('c1_occ','Client 1 — Occupation'),
  sel('marital','Marital Status',['Single','Married','Domestic Partner','Divorced','Widowed']),
  sel('filing','Tax Filing Status',['Single','Married Filing Jointly','Head of Household','Married Filing Separately']),
  txt('c2_name','Client 2 / Spouse — Name','Leave blank if none'),
  num('c2_age','Client 2 — Age'),
  num('c2_retage','Client 2 — Target Retirement Age'),
  txt('c2_occ','Client 2 — Occupation'),
  sel('state','State of Residence',['IL','Other (income-taxed state)','No-income-tax state']),
  pct('other_state_rate','Other State Income Tax Rate','Only if "Other" selected; e.g., 5 for 5%'),
  sel('c1_health','Client 1 — Health',['Excellent','Good','Fair','Poor']),
  sel('c2_health','Client 2 — Health',['Excellent','Good','Fair','Poor']),
  {id:'children', label:'Children / Dependents', type:'rows', cols:[
    {id:'name',label:'Name',type:'text'},{id:'age',label:'Age',type:'num'},
    {id:'college',label:'% of College to Fund',type:'num'},{id:'plan529',label:'529 Balance ($)',type:'num'},
    {id:'contrib529',label:'Annual 529 Contribution ($)',type:'num'},
    {id:'special',label:'Special Needs?',type:'select',options:['No','Yes']}
  ]},
]},
{ id:'income', title:'Income Sources (Annual)', fields:[
  money('c1_salary','Client 1 — W-2 Salary/Wages'),
  money('c1_bonus','Client 1 — Bonus / Variable Comp'),
  money('c2_salary','Client 2 — W-2 Salary/Wages'),
  money('c2_bonus','Client 2 — Bonus / Variable Comp'),
  money('se_income','Net Self-Employment / K-1 Income','Schedule C / pass-through income'),
  yn('se_sstb','Is the business an SSTB?','Specified service trade/business (health, law, consulting, financial services…) for §199A limits'),
  money('rental_income','Net Rental Real Estate Income'),
  money('interest_income','Taxable Interest'),
  money('div_qualified','Qualified Dividends'),
  money('div_ordinary','Non-Qualified (Ordinary) Dividends'),
  money('cap_gains_lt','Realized Long-Term Capital Gains (typical yr)'),
  money('cap_gains_st','Realized Short-Term Capital Gains (typical yr)'),
  money('pension_income','Pension / Annuity Income (current)'),
  money('other_income','Other Taxable Income'),
  money('c1_ss_fra','Client 1 — Est. Social Security @ FRA (annual)','From SSA statement; ssa.gov/myaccount'),
  num('c1_ss_claim','Client 1 — Planned SS Claiming Age','62–70'),
  money('c2_ss_fra','Client 2 — Est. Social Security @ FRA (annual)'),
  num('c2_ss_claim','Client 2 — Planned SS Claiming Age'),
  money('c1_pension_ret','Client 1 — Pension @ Retirement (annual)','Defined benefit expected at retirement'),
  money('c2_pension_ret','Client 2 — Pension @ Retirement (annual)'),
]},
{ id:'expenses', title:'Cash Flow & Budget (Monthly unless noted)', fields:[
  {id:'sh_cfnote',label:'',type:'subhead',text:'Debt service is computed automatically from the Liabilities section — do not re-enter it here'},
  money('exp_housing','Housing — rent, property tax, HOA, utilities (EXCLUDE mortgage P&I)','Mortgage P&I is pulled from Liabilities'),
  money('exp_transport','Transportation'),
  money('exp_food','Food & Household'),
  money('exp_insurance','Insurance Premiums (all policies)'),
  money('exp_health','Out-of-Pocket Healthcare'),
  money('exp_child','Childcare / Education'),
  money('exp_disc','Discretionary / Lifestyle'),
  money('exp_other','Other Fixed Expenses'),
  money('ret_spend','Desired Retirement Spending (annual, today’s $)','Leave 0 to default to 80% of current core expenses'),
  money('charitable_annual','Annual Charitable Giving'),
]},
{ id:'assets', title:'Assets & Accounts', fields:[
  {id:'sh_cash',label:'',type:'subhead',text:'Cash & Taxable'},
  money('cash_checking','Checking / Operating Cash'),
  money('cash_savings','Savings / Money Market / CDs','Includes emergency reserve'),
  money('brokerage','Taxable Brokerage — Market Value'),
  money('brokerage_basis','Taxable Brokerage — Cost Basis'),
  pct('concentration','Largest Single-Stock Position (% of investable assets)'),
  {id:'sh_ret1',label:'',type:'subhead',text:'Client 1 — Retirement Accounts'},
  money('c1_401k','Pre-Tax 401(k)/403(b)/457 Balance'),
  money('c1_401k_contrib','Annual Employee Deferral ($)'),
  sel('c1_401k_type','Deferral Type',['Traditional (pre-tax)','Roth','Split']),
  pct('c1_match','Employer Match (% of salary)','Total employer contribution as % of salary'),
  pct('c1_match_cap','Match Cap — deferral % required','e.g., 100% match up to 6% → enter 6'),
  yn('c1_aftertax','Plan Allows After-Tax + In-Plan Roth Conversion?','Mega-backdoor availability'),
  money('c1_trad_ira','Traditional IRA Balance'),
  money('c1_ira_basis','Traditional IRA — After-Tax Basis (Form 8606)'),
  money('c1_roth_ira','Roth IRA Balance'),
  money('c1_roth_contrib','Annual Roth IRA Contribution'),
  {id:'sh_ret2',label:'',type:'subhead',text:'Client 2 — Retirement Accounts'},
  money('c2_401k','Pre-Tax 401(k)/403(b)/457 Balance'),
  money('c2_401k_contrib','Annual Employee Deferral ($)'),
  sel('c2_401k_type','Deferral Type',['Traditional (pre-tax)','Roth','Split']),
  pct('c2_match','Employer Match (% of salary)'),
  pct('c2_match_cap','Match Cap — deferral % required'),
  yn('c2_aftertax','Plan Allows After-Tax + In-Plan Roth Conversion?'),
  money('c2_trad_ira','Traditional IRA Balance'),
  money('c2_ira_basis','Traditional IRA — After-Tax Basis (Form 8606)'),
  money('c2_roth_ira','Roth IRA Balance'),
  money('c2_roth_contrib','Annual Roth IRA Contribution'),
  {id:'sh_hsa',label:'',type:'subhead',text:'Health Coverage & HSA (single source — not repeated in Insurance)'},
  sel('health_plan','Health Insurance Type',['HDHP (HSA-eligible)','PPO/HMO (not HSA-eligible)','Medicare','Uninsured']),
  sel('hsa_coverage','HSA Coverage Tier',['None','Self-Only','Family']),
  money('hsa_balance','HSA Balance'),
  money('hsa_contrib','Annual HSA Contribution (employee+employer)'),
  {id:'sh_other',label:'',type:'subhead',text:'Real Estate, Business & Other Assets'},
  money('home_value','Primary Residence — Market Value'),
  money('other_re','Other Real Estate — Market Value'),
  money('business_value','Private Business Interest — Est. Value'),
  money('other_assets','Other Assets (vehicles, collectibles, crypto…)'),
  pct('alloc_equity','Current Portfolio Equity Allocation (%)','Across all investment accounts'),
]},
{ id:'liabilities', title:'Liabilities', fields:[
  money('mtg_balance','Primary Mortgage — Balance'),
  pct('mtg_rate','Primary Mortgage — Rate (%)'),
  num('mtg_years','Primary Mortgage — Years Remaining'),
  money('mtg_payment','Primary Mortgage — Monthly P&I'),
  money('heloc','HELOC / Second Mortgage Balance'),
  pct('heloc_rate','HELOC Rate (%)'),
  money('auto_loans','Auto Loans — Total Balance'),
  pct('auto_rate','Auto — Avg Rate (%)'),
  money('student_loans','Student Loans — Balance'),
  pct('student_rate','Student Loans — Avg Rate (%)'),
  sel('student_type','Student Loan Type',['None','Federal','Private','Mixed']),
  money('cc_debt','Credit Card / Revolving Balance (carried)'),
  pct('cc_rate','Credit Card — Avg APR (%)'),
  money('other_debt','Other Debt'),
  pct('other_debt_rate','Other Debt — Rate (%)'),
]},
{ id:'insurance', title:'Insurance & Risk Management', fields:[
  money('c1_life_term','Client 1 — Term Life Face Amount'),
  money('c1_life_perm','Client 1 — Permanent Life Face Amount'),
  money('c1_life_group','Client 1 — Employer Group Life'),
  money('c2_life_term','Client 2 — Term Life Face Amount'),
  money('c2_life_perm','Client 2 — Permanent Life Face Amount'),
  money('c2_life_group','Client 2 — Employer Group Life'),
  pct('c1_ltd','Client 1 — LTD Coverage (% of income)','Long-term disability benefit as % of gross income'),
  sel('c1_ltd_def','Client 1 — LTD Definition',['None','Own-Occupation','Any-Occupation','Unknown']),
  pct('c2_ltd','Client 2 — LTD Coverage (% of income)'),
  sel('c2_ltd_def','Client 2 — LTD Definition',['None','Own-Occupation','Any-Occupation','Unknown']),
  money('umbrella','Umbrella Liability Coverage'),
  yn('ltc_c1','Client 1 — LTC Coverage In Force?'),
  yn('ltc_c2','Client 2 — LTC Coverage In Force?'),
  yn('home_auto_ok','Home/Auto Reviewed in Last 2 Years?'),
  yn('life_in_estate','Life Insurance Owned Personally (in estate)?','vs. owned by an ILIT'),
]},
{ id:'estate', title:'Estate Planning', fields:[
  yn('doc_will','Will Executed & Current?'),
  yn('doc_poa_fin','Durable Financial Power of Attorney?'),
  yn('doc_poa_hc','Healthcare POA / Proxy?'),
  yn('doc_directive','Living Will / Advance Directive?'),
  yn('doc_trust','Revocable Living Trust (funded)?'),
  yn('benef_current','Beneficiary Designations Reviewed ≤ 3 yrs?'),
  yn('guardian','Guardian Named for Minor Children?'),
  yn('charitable_intent','Charitable Legacy Intent?'),
  money('legacy_goal','Specific Legacy / Bequest Goal ($)'),
  money('inheritance_expected','Expected Inheritance ($)'),
  txt('estate_notes','Estate Notes / Complexities','Blended family, non-citizen spouse, special-needs dependent, etc.'),
]},
{ id:'business', title:'Business Owner Planning (if applicable)', fields:[
  sel('biz_entity','Entity Type',['None','Sole Proprietorship','LLC (disregarded)','LLC (S-Corp election)','S-Corporation','C-Corporation','Partnership']),
  pct('biz_ownership','Ownership (%)'),
  num('biz_employees','Number of Employees'),
  yn('biz_retplan','Business Sponsors a Retirement Plan?'),
  yn('biz_buysell','Buy-Sell Agreement in Place?'),
  yn('biz_keyperson','Key-Person Insurance in Place?'),
  yn('biz_succession','Written Succession Plan?'),
  txt('biz_exit','Exit Timeline / Intent','e.g., sell in 10 yrs, family transition, none'),
]},
{ id:'qualitative', title:'Qualitative Profile — Goals, Risk & Values', fields:[
  F('risk_tol','Risk Tolerance (1 = Very Conservative … 10 = Very Aggressive)','range',{min:1,max:10}),
  sel('risk_reaction','If your portfolio fell 30% in 6 months, you would…',['Sell everything','Sell some','Hold','Buy more'],'Behavioral check against stated tolerance'),
  sel('invest_exp','Investment Experience',['None','Limited','Moderate','Extensive']),
  sel('liquidity_need','Major Liquidity Need Within 5 Years?',['No','Home purchase','Business investment','Education','Wedding/family event','Other']),
  money('liquidity_amount','Liquidity Need Amount ($)'),
  {id:'goals', label:'Ranked Goals (drag priority via order entered)', type:'rows', cols:[
    {id:'goal',label:'Goal',type:'select',options:['Retire comfortably','Retire early','Fund education','Buy home / upgrade','Start business','Charitable giving','Leave inheritance','Financial independence','Pay off debt','Travel / lifestyle','Care for parents','Other']},
    {id:'priority',label:'Priority',type:'select',options:['Essential','Important','Aspirational']},
    {id:'horizon',label:'Horizon (yrs)',type:'num'},
    {id:'cost',label:'Est. Cost ($, today)',type:'num'}
  ]},
  txt('values_notes','Values / Money Attitudes / Family Context','Qualitative color: money scripts, family obligations, career trajectory, planned relocations…'),
  txt('concerns','Top Financial Concerns (client’s own words)'),
]},
];

export const ASSUME_SCHEMA = [
{ id:'assumptions', title:'Capital Market & Planning Assumptions', fields:[
  pct('as_inflation','General Inflation (CPI)','Default 2.5%'),
  pct('as_salary_growth','Wage Growth','Default 3.0%'),
  pct('as_equity_ret','Equity Expected Return (nominal)','Default 8.5%'),
  pct('as_equity_vol','Equity Volatility (σ)','Default 16%'),
  pct('as_bond_ret','Fixed Income Expected Return','Default 4.3%'),
  pct('as_bond_vol','Fixed Income Volatility (σ)','Default 5.5%'),
  pct('as_cash_ret','Cash Return','Default 2.8%'),
  pct('as_college_infl','Education Cost Inflation','Default 5.0%'),
  money('as_college_cost','Annual College Cost (today’s $)','Default $28,000 in-state public all-in'),
  num('as_college_years','Years of College per Child','Default 4'),
  num('as_life_exp','Planning Life Expectancy (age)','Default 95'),
  num('as_mc_trials','Monte Carlo Trials','Default 1,000'),
  pct('as_ret_equity','Retirement-Phase Equity Allocation (%)','Glide-path landing point; default 50%'),
  pct('as_discount','Discount Rate for Insurance PV Calcs','Default 4.5%'),
]},
];

const NUMERIC_TYPES = new Set(['money', 'num', 'pct', 'range']);

/** Every input field (excluding subheads), across intake and assumptions. */
export const ALL_FIELDS = [...INTAKE_SCHEMA, ...ASSUME_SCHEMA].flatMap((s) => s.fields).filter((f) => f.type !== 'subhead');

export const isNumericField = (f) => NUMERIC_TYPES.has(f.type);

/** Column definitions for repeating-row fields (children, goals), keyed by field id. */
export const ROW_SCHEMAS = Object.fromEntries(ALL_FIELDS.filter((f) => f.type === 'rows').map((f) => [f.id, f.cols]));

/**
 * The inputs object an untouched form produces: numbers 0, selects their
 * first option, text empty, range sliders 5, row lists empty — with default
 * assumptions filled in. `overrides` are merged on top.
 */
export function blankInputs(overrides = {}) {
  const d = {};
  for (const f of ALL_FIELDS) {
    if (f.type === 'rows') d[f.id] = [];
    else if (f.type === 'range') d[f.id] = 5;
    else if (isNumericField(f)) d[f.id] = 0;
    else if (f.type === 'select') d[f.id] = f.options[0];
    else d[f.id] = '';
  }
  return { ...d, ...DEFAULT_ASSUMPTIONS, ...overrides };
}
