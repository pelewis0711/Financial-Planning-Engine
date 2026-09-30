/** Education funding: projected cost vs. projected 529 value per child. */
import { blendedReturn } from './assumptions.js';

export function computeEducation(d, a) {
  const kids = (d.children || []).filter((c) => (c.college || 0) > 0);
  const rows = kids.map((c) => {
    const yrsTo = Math.max(0, 18 - c.age);
    const totalCost = a.as_college_cost * a.as_college_years * Math.pow(1 + a.collInfl, yrsTo) * ((c.college || 0) / 100);
    // Age-based 529 glide path: equity share falls 4 points per year of age, floor 30%.
    const g = blendedReturn(Math.max(30, 80 - 4 * c.age), a).mu;
    const fv529 = (c.plan529 || 0) * Math.pow(1 + g, yrsTo) + (c.contrib529 || 0) * (yrsTo > 0 ? (Math.pow(1 + g, yrsTo) - 1) / g : 0);
    const gap = Math.max(0, totalCost - fv529);
    const monthlyNeeded = yrsTo > 0 ? gap / ((Math.pow(1 + g / 12, yrsTo * 12) - 1) / (g / 12)) : gap / 12;
    return { name: c.name || 'Child', age: c.age, yrsTo, totalCost, fv529, gap, monthlyNeeded, bal: c.plan529 || 0, contrib: c.contrib529 || 0 };
  });
  return { rows, totalGap: rows.reduce((s, r) => s + r.gap, 0) };
}
