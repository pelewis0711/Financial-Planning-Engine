# Methodology

This document explains how Plan Architect computes each part of the plan, the assumptions behind it, and the simplifications it makes. The engine aims for **projection fidelity** (defensible estimates for planning decisions), not **preparation fidelity** (a filed return).

All 2026 parameters are in [`src/engine/params/ty2026.js`](../src/engine/params/ty2026.js).

## Sources

| Parameter set | Source |
|---|---|
| Brackets, standard deduction, LTCG thresholds, AMT, estate exclusion, gift exclusion | IRS Rev. Proc. 2025-32 (IR-2025-103) |
| 401(k)/IRA limits, catch-ups, IRA and Roth phase-outs | IRS Notice 2025-67 (IR-2025-111) |
| HSA limits | IRS Rev. Proc. 2025-19 |
| Social Security wage base | SSA 2026 COLA fact sheet |
| Part B premium and IRMAA tiers | CMS, *2026 Medicare Parts A & B Premiums and Deductibles* |
| SALT cap and phase-down, senior deduction, child tax credit | One Big Beautiful Bill Act (P.L. 119-21) |
| QCD limit ($111,000, indexed) | IRS / custodian 2026 guidance |
| Illinois | 4.95% flat income tax with retirement-income subtraction; $4M estate exemption, not portable |

## Tax projection (`tax.js`)

1. **Wages** minus pre-tax deferrals (Traditional 401(k) counts in full, Split counts half, Roth is excluded), minus the HSA deduction (capped at the coverage-tier limit) and half of SE tax, gives **AGI**. MAGI is approximated as AGI for phase-out tests.
2. **Deduction:** the larger of the standard deduction (plus the 65+ add-on) or itemized deductions. Itemized = SALT (state tax plus an estimated property-tax share of housing costs, capped at $40,400 and phased toward $10,000 above $505,000 MAGI) + mortgage interest on up to $750,000 + charitable giving.
3. **OBBBA senior deduction:** $6,000 per person 65+, phased out at 6% of MAGI above $75,000/$150,000.
4. **§199A:** 20% of qualified business income. SSTBs phase out linearly across the threshold band.
5. **Taxable income** splits into preferential (LTCG + qualified dividends) and ordinary. Preferential income is **stacked on top of** ordinary income for the 0/15/20% brackets.
6. The model also computes **NIIT** (3.8% on the lesser of NII or MAGI over the threshold), **Additional Medicare** (0.9%), **SE tax** (15.3% on 92.35% of net SE income, with the SS portion sharing the wage base with client 1's W-2 wages), a simplified **AMT**, and the **child tax credit** ($2,200 per child under 17, reduced $50 per $1,000 over the threshold).
7. **Employee FICA** and **state tax** are added to get the total tax burden.

Outputs used downstream include the marginal rate, **headroom to the top of the 24% bracket** (the Roth-conversion budget), and **unused 0% LTCG room** (the gain-harvesting budget).

## Retirement (`retirement.js`)

**Capital:** all 401(k), IRA, Roth, HSA and taxable brokerage balances. **Annual additions:** employee deferrals, Roth IRA and HSA contributions, the employer match, and any what-if extra savings. Contributions grow with wages.

**Spending need:** the stated retirement spending, or 80% of current core expenses excluding childcare, inflated to the retirement date.

**Social Security:** the benefit at claiming age relative to the full-retirement-age (67) benefit:
- Claiming early reduces the benefit by 5/9 of 1% per month for the first 36 months and 5/12 of 1% per month after that, so claiming at 62 pays 70%.
- Claiming late adds delayed credits of 8% per year, up to age 70.

Benefits start at each spouse's claiming age and are inflation-indexed.

**Monte Carlo:**
- Annual returns are lognormal: `r = exp(ln(1+μ) − σ²/2 + σ·Z) − 1`, where Z is standard normal.
- μ and σ come from a two-asset mix: equity 8.5%/16% and fixed income 4.3%/5.5% by default, with correlation 0.15.
- Accumulation uses the current allocation; decumulation uses the retirement-phase allocation (a two-phase glide path).
- Each retirement year withdraws spending minus Social Security and pensions.
- A trial **fails** the first year the portfolio is exhausted. The success rate is the share of trials that never fail.
- The report shows 10th, 50th and 90th percentile balance paths.

### Reproducible Monte Carlo
The simulation uses a seeded 32-bit PRNG (Mulberry32) and Box–Muller normal draws. This gives two benefits:
1. **Tests can assert exact behavior.**
2. **Common random numbers.** Every what-if scenario runs on the *same* simulated market paths, so a change in success rate reflects the decision being tested. With independent random draws, two runs of the *same* plan can differ by a percentage point or more from sampling noise alone.

**RMDs:** SECURE 2.0 start ages are 73 for those born 1951–1959 and 75 for 1960 or later. The first-year RMD uses the Uniform Lifetime Table divisor for that age (26.5 at 73, 24.6 at 75).

**Contribution capacity:** 2026 limits:
- $24,500 elective deferral, plus an $8,000 catch-up at 50+ or $11,250 at ages 60–63.
- $72,000 §415(c) total additions.
- $7,500 IRA, plus a $1,100 catch-up.
- Mandatory Roth catch-ups when prior-year FICA wages exceed $150,000.
- Roth IRA phase-outs and pro-rata exposure from pre-tax IRA balances.

## Roth conversion ladder and IRMAA (`roth-ladder.js`)

For each year from retirement until the year before RMDs begin:

1. **Base ordinary income** = pensions + 85% of Social Security − standard deduction. All three are indexed to that year.
2. **Conversion** = the amount that fills ordinary income to the top of the 24% bracket, limited to the remaining pre-tax balance.
3. **Conversion tax** = tax(base + conversion) − tax(base), computed on that year's brackets.
4. The **IRMAA tier** is checked against conversion-year MAGI. The premium is determined from MAGI two years earlier, so conversions show up in Medicare premiums two years later.

Because balances are projected in **nominal** dollars, brackets, the standard deduction, and IRMAA thresholds are **indexed forward at the inflation assumption**. Otherwise the model would apply 2026 brackets to conversions a decade or more away and understate each year's room.

The ladder is compared to doing nothing on three outcomes: the remaining pre-tax balance at RMD age, the first-year RMD, and the resulting IRMAA tier and household surcharge.

**IRMAA** is a cliff. $1 of MAGI over a threshold triggers the full higher premium for the year. The top tier applies at MAGI **greater than or equal to** its threshold, per CMS. Married filing separately uses its own, much steeper schedule. Surcharges are shown in 2026 premium dollars.

## Insurance, estate, education, debt, investments

- **Life insurance (capital-needs):**
  - Need = present value of 75% of income until retirement (a growing annuity at the wage-growth rate, discounted at 4.5%) + all debts + unfunded college costs + $25,000 final expenses − liquid assets.
  - Gap = need − coverage in force.
- **Disability:** target is 60% income replacement. The gap is compared against current LTD coverage, and the coverage definition (own- vs. any-occupation) is flagged.
- **Liability:** umbrella target is net worth rounded up to the next $1M.
- **Estate:** projected gross estate (net worth + personally owned life insurance + expected inheritance, grown modestly) vs. the federal exclusion ($15M per person, portable) and the Illinois $4M exemption (**not** portable). The model also checks for missing core documents, guardianship, and stale beneficiaries.
- **Education:**
  - Cost = today's cost × years of college × education inflation to age 18 × share funded.
  - 529 growth follows an age-based glide path.
  - Output is the gap and the monthly contribution required to close it.
- **Debt:** avalanche order (highest rate first). Any non-mortgage debt whose rate exceeds the after-tax equity return (the hurdle) is flagged for payoff.
- **Investments:**
  - Target equity = 110 − age, adjusted ±4 per point of stated risk tolerance and capped by the stated reaction to a 30% drawdown.
  - The model also flags drift over 15 points, a single position over 10%, and conflicts between stated tolerance and behavior.

## Rules engine (`rules.js`)

Each domain has a rule function that inspects the model and emits findings in the form `{ domain, priority, title, body, impact, score }`. The score is a hand-calibrated 0–100 **severity × leverage** weight. For example:
- A negative cash flow scores 100.
- An unclaimed employer match scores 98.
- A missing guardian scores 97.
- A P&C policy review scores 35.

Findings are sorted by score. The top ten become the executive summary's implementation agenda.

## Known simplifications

- MAGI ≈ AGI. AMT is simplified (SALT add-back only). The AMT 28% breakpoint uses the unmarried figure for all filers.
- Property tax is estimated from the housing budget. Mortgage interest is an interest-only approximation.
- Monte Carlo draws annual returns independently (no serial correlation or regime changes). Taxes on withdrawals are not modeled inside the simulation.
- The Roth ladder does not model the 5-year rule, state tax outside Illinois, or conversion-funded tax payments.
- The first RMD uses a single divisor. Spouses' RMDs are not modeled separately.
- Education costs assume enrollment at 18 for four years.

These are deliberate scope choices for a planning-level tool. Several are good candidates for future work.
