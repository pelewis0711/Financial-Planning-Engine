/** Estate: exposure to federal and Illinois transfer tax, documents, gifting capacity. */
import { T26 } from './params/ty2026.js';

const ESTATE_DOCS = [
  ['Will', 'doc_will'],
  ['Financial POA', 'doc_poa_fin'],
  ['Healthcare POA', 'doc_poa_hc'],
  ['Advance Directive', 'doc_directive'],
  ['Revocable Trust (funded)', 'doc_trust'],
];

export function computeEstate(d, ins, ret, a) {
  const lifeFace = d.c1_life_term + d.c1_life_perm + d.c1_life_group + d.c2_life_term + d.c2_life_perm + d.c2_life_group;
  const grossEstate = ins.netWorth + (d.life_in_estate === 'Yes' ? lifeFace : 0) + (d.inheritance_expected || 0);
  // Modest 4% growth applied over half the remaining horizon.
  const grossEstateAtLE = grossEstate * Math.pow(1.04, Math.max(0, a.as_life_exp - d.c1_age) * 0.5);
  const married = d.filing === 'Married Filing Jointly';
  const fedExp = T26.estate.fedExemption * (married ? 2 : 1);
  const ilExp = T26.estate.ilExemption; // per decedent; not portable between spouses
  const fedExposed = Math.max(0, grossEstateAtLE - fedExp);
  const ilExposed = d.state === 'IL' ? Math.max(0, grossEstateAtLE - ilExp) : 0;
  const missing = ESTATE_DOCS.filter(([, k]) => d[k] !== 'Yes').map(([n]) => n);
  const minorKids = (d.children || []).some((c) => c.age < 18);
  const guardianGap = minorKids && d.guardian !== 'Yes';
  const benefStale = d.benef_current !== 'Yes';
  const giftCapacity = T26.estate.annualGift * (married ? 2 : 1) * Math.max(1, (d.children || []).length || 1);
  return { grossEstate, grossEstateAtLE, fedExp, ilExp, fedExposed, ilExposed, missing, minorKids, guardianGap, benefStale, giftCapacity, lifeFace, married };
}
