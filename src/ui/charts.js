/**
 * Self-contained SVG chart engine — no charting library.
 * Line (with percentile band + hover crosshair), donut, horizontal bar and
 * stacked-column charts, all sharing one tooltip element.
 */
import { fmt$, fmtK } from '../engine/format.js';

export const PALETTE={navy:'#0f2a43',gold:'#c9a227',blue:'#2563a8',green:'#1e7d4f',red:'#b03a2e',amber:'#b7791f',purple:'#7a5195',teal:'#3a9188',gray:'#94a7bd',slate:'#5d6b7a'};
function tipEl(){let t=document.getElementById('svgtip');if(!t){t=document.createElement('div');t.id='svgtip';document.body.appendChild(t);}return t;}
function showTip(html,ev){const t=tipEl();t.innerHTML=html;t.style.display='block';
  const x=Math.min(ev.clientX+14,window.innerWidth-280),y=Math.max(8,ev.clientY-14);
  t.style.left=x+'px';t.style.top=y+'px';}
function hideTip(){tipEl().style.display='none';}

/* multi-series line chart with area bands + hover crosshair */
export function chLine(elId,cfg){
  const el=document.getElementById(elId); if(!el)return;
  const W=640,H=280,padL=58,padR=14,padT=12,padB=34;
  const n=cfg.labels.length;
  let maxY=0; cfg.series.forEach(s=>s.data.forEach(v=>{if(v>maxY)maxY=v;})); maxY*=1.06; if(maxY<=0)maxY=1;
  const X=i=>padL+(W-padL-padR)*(n<=1?0:i/(n-1));
  const Y=v=>padT+(H-padT-padB)*(1-v/maxY);
  let g='';
  // gridlines
  for(let k=0;k<=4;k++){const v=maxY*k/4,y=Y(v);
    g+=`<line x1="${padL}" y1="${y}" x2="${W-padR}" y2="${y}" stroke="#e3e9f0" stroke-width="1"/>`;
    g+=`<text x="${padL-6}" y="${y+4}" text-anchor="end" font-size="10.5" fill="#7b8896">${fmtK(v)}</text>`;}
  const step=Math.max(1,Math.ceil(n/10));
  for(let i=0;i<n;i+=step)g+=`<text x="${X(i)}" y="${H-10}" text-anchor="middle" font-size="10.5" fill="#7b8896">${cfg.labels[i]}</text>`;
  if(cfg.xTitle)g+=`<text x="${(padL+W-padR)/2}" y="${H-0.5}" text-anchor="middle" font-size="10" fill="#a4afbb">${cfg.xTitle}</text>`;
  // band fill between first and last series if requested
  if(cfg.band){const a=cfg.series[cfg.band[0]].data,b=cfg.series[cfg.band[1]].data;
    let p='M'+X(0)+','+Y(a[0]); for(let i=1;i<n;i++)p+=' L'+X(i)+','+Y(a[i]);
    for(let i=n-1;i>=0;i--)p+=' L'+X(i)+','+Y(b[i]);
    g+=`<path d="${p} Z" fill="rgba(37,99,168,.10)" stroke="none"/>`;}
  cfg.series.forEach(s=>{
    let p='M'+X(0)+','+Y(s.data[0]); for(let i=1;i<n;i++)p+=' L'+X(i)+','+Y(s.data[i]);
    g+=`<path d="${p}" fill="none" stroke="${s.color}" stroke-width="${s.width||2}" ${s.dash?`stroke-dasharray="${s.dash}"`:''}/>`;});
  // legend
  let lx=padL+4;
  cfg.series.forEach(s=>{g+=`<rect x="${lx}" y="${padT}" width="12" height="4" fill="${s.color}"/><text x="${lx+16}" y="${padT+6}" font-size="10.5" fill="#4a5866">${s.name}</text>`;lx+=16+s.name.length*6+18;});
  g+=`<line id="${elId}_ch" x1="0" y1="${padT}" x2="0" y2="${H-padB}" stroke="${PALETTE.gold}" stroke-width="1" opacity="0"/>`;
  el.innerHTML=`<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">${g}</svg>`;
  const svg=el.querySelector('svg');
  svg.addEventListener('mousemove',ev=>{
    const r=svg.getBoundingClientRect();
    const mx=(ev.clientX-r.left)*(W/r.width);
    const i=Math.round((mx-padL)/((W-padL-padR)/(n-1)));
    if(i<0||i>=n){hideTip();return;}
    const ch=document.getElementById(elId+'_ch');ch.setAttribute('x1',X(i));ch.setAttribute('x2',X(i));ch.setAttribute('opacity','.8');
    let html=`<b>${cfg.xTitle||''} ${cfg.labels[i]}</b><br>`;
    cfg.series.forEach(s=>html+=`<span style="color:${s.color==='#0f2a43'?'#9fc2e8':s.color}">■</span> ${s.name}: <b>${fmt$(s.data[i])}</b><br>`);
    showTip(html,ev);
  });
  svg.addEventListener('mouseleave',()=>{hideTip();const ch=document.getElementById(elId+'_ch');if(ch)ch.setAttribute('opacity','0');});
}
/* donut */
export function chDonut(elId,items){
  const el=document.getElementById(elId); if(!el)return;
  items=items.filter(it=>it.value>0.5);
  const W=640,H=280,cx=210,cy=140,R=105,r=62;
  const tot=items.reduce((s,it)=>s+it.value,0)||1;
  let ang=-Math.PI/2,g='';
  items.forEach((it,idx)=>{
    const a2=ang+2*Math.PI*it.value/tot;
    const large=(a2-ang)>Math.PI?1:0;
    const x1=cx+R*Math.cos(ang),y1=cy+R*Math.sin(ang),x2=cx+R*Math.cos(a2),y2=cy+R*Math.sin(a2);
    const x3=cx+r*Math.cos(a2),y3=cy+r*Math.sin(a2),x4=cx+r*Math.cos(ang),y4=cy+r*Math.sin(ang);
    g+=`<path d="M${x1},${y1} A${R},${R} 0 ${large} 1 ${x2},${y2} L${x3},${y3} A${r},${r} 0 ${large} 0 ${x4},${y4} Z" fill="${it.color}" stroke="#fff" stroke-width="1.5" data-i="${idx}" class="seg" style="cursor:pointer"/>`;
    ang=a2;});
  g+=`<text x="${cx}" y="${cy-4}" text-anchor="middle" font-size="13" font-weight="700" fill="#0f2a43">${fmt$(tot)}</text><text x="${cx}" y="${cy+14}" text-anchor="middle" font-size="10" fill="#7b8896">total</text>`;
  let ly=42;
  items.forEach(it=>{g+=`<rect x="392" y="${ly-9}" width="11" height="11" rx="2" fill="${it.color}"/><text x="409" y="${ly}" font-size="11.5" fill="#3a4653">${it.label} — ${fmt$(it.value)} (${(100*it.value/tot).toFixed(0)}%)</text>`;ly+=21;});
  el.innerHTML=`<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">${g}</svg>`;
  const svg=el.querySelector('svg');
  svg.querySelectorAll('.seg').forEach(p=>{
    p.addEventListener('mousemove',ev=>{const it=items[+p.dataset.i];showTip(`<b>${it.label}</b><br>${fmt$(it.value)} — ${(100*it.value/tot).toFixed(1)}%`,ev);});
    p.addEventListener('mouseleave',hideTip);});
}
/* horizontal bars (supports negatives) */
export function chBarH(elId,items){
  const el=document.getElementById(elId); if(!el)return;
  const W=640,H=Math.max(190,items.length*30+40),padL=150,padR=70;
  const maxV=Math.max(...items.map(it=>Math.abs(it.value)),1);
  const zero=padL+(W-padL-padR)*(Math.min(0,...items.map(it=>it.value))<0?.28:0);
  const scale=(W-padL-padR-(zero-padL))/maxV;
  let g='',y=26;
  items.forEach((it,idx)=>{
    const w=Math.abs(it.value)*scale, x=it.value>=0?zero:zero-w;
    g+=`<text x="${padL-8}" y="${y+11}" text-anchor="end" font-size="11" fill="#3a4653">${it.label}</text>`;
    g+=`<rect x="${x}" y="${y}" width="${Math.max(w,1)}" height="17" rx="3" fill="${it.color}" data-i="${idx}" class="bar" style="cursor:pointer"/>`;
    g+=`<text x="${it.value>=0?x+w+5:x-5}" y="${y+12}" text-anchor="${it.value>=0?'start':'end'}" font-size="10.5" fill="#5d6b7a">${fmtK(it.value)}</text>`;
    y+=27;});
  g+=`<line x1="${zero}" y1="18" x2="${zero}" y2="${y}" stroke="#c6d0da" stroke-width="1"/>`;
  el.innerHTML=`<svg viewBox="0 0 ${W} ${Math.max(H,y+10)}" preserveAspectRatio="xMidYMid meet">${g}</svg>`;
  el.querySelectorAll('.bar').forEach(b=>{
    b.addEventListener('mousemove',ev=>{const it=items[+b.dataset.i];showTip(`<b>${it.label}</b><br>${fmt$(it.value)}`,ev);});
    b.addEventListener('mouseleave',hideTip);});
}
/* two-column stacked comparison */
export function chStack(elId,cfg){
  const el=document.getElementById(elId); if(!el)return;
  const W=640,H=280,padB=36,padT=16;
  const totals=cfg.cols.map(c=>c.parts.reduce((s,p)=>s+p.value,0));
  const maxV=Math.max(...totals,1)*1.08;
  const bw=120,gap=150,x0=140;
  let g='';
  for(let k=0;k<=4;k++){const v=maxV*k/4,y=padT+(H-padT-padB)*(1-v/maxV);
    g+=`<line x1="70" y1="${y}" x2="${W-20}" y2="${y}" stroke="#e3e9f0"/><text x="64" y="${y+4}" text-anchor="end" font-size="10.5" fill="#7b8896">${fmtK(v)}</text>`;}
  cfg.cols.forEach((c,ci)=>{
    const x=x0+ci*(bw+gap); let acc=0;
    c.parts.forEach((p,pi)=>{ if(p.value<=0)return;
      const h=(H-padT-padB)*p.value/maxV, y=padT+(H-padT-padB)*(1-(acc+p.value)/maxV);
      g+=`<rect x="${x}" y="${y}" width="${bw}" height="${h}" fill="${p.color}" stroke="#fff" stroke-width="1" class="st" data-c="${ci}" data-p="${pi}" style="cursor:pointer"/>`;
      if(h>18)g+=`<text x="${x+bw/2}" y="${y+h/2+4}" text-anchor="middle" font-size="10.5" fill="#fff">${fmtK(p.value)}</text>`;
      acc+=p.value;});
    g+=`<text x="${x+bw/2}" y="${H-14}" text-anchor="middle" font-size="12" font-weight="700" fill="#0f2a43">${c.label}</text>`;
    g+=`<text x="${x+bw/2}" y="${H-2}" text-anchor="middle" font-size="10.5" fill="#7b8896">${fmt$(totals[ci])}</text>`;});
  let ly=30;
  const legend=[...new Map(cfg.cols.flatMap(c=>c.parts).map(p=>[p.label,p])).values()];
  legend.forEach(p=>{g+=`<rect x="480" y="${ly-9}" width="11" height="11" rx="2" fill="${p.color}"/><text x="497" y="${ly}" font-size="11" fill="#3a4653">${p.label}</text>`;ly+=20;});
  el.innerHTML=`<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">${g}</svg>`;
  el.querySelectorAll('.st').forEach(rc=>{
    rc.addEventListener('mousemove',ev=>{const p=cfg.cols[+rc.dataset.c].parts[+rc.dataset.p];showTip(`<b>${p.label}</b><br>${fmt$(p.value)}`,ev);});
    rc.addEventListener('mouseleave',hideTip);});
}
