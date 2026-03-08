import { score } from './gameLogic';

export function dn(p) {
  if (p.nickname && p.nickname.trim()) return p.nickname.trim();
  const n = [p.firstName, p.lastName].filter(Boolean).join(" ").trim();
  return n || "Unnamed";
}

export function PlayerLabel({ p, color }) {
  const nick = p.nickname && p.nickname.trim();
  const real = [p.firstName, p.lastName].filter(Boolean).join(" ").trim();
  const style = color ? { color } : {};
  if (nick) return (<span style={{ display:"flex", flexDirection:"column", gap:1 }}><span style={{ ...style, fontFamily:"'DM Mono',monospace", fontWeight:500 }}>"{nick}"</span>{real && <span style={{ fontSize:10, color:"var(--mu)", fontStyle:"italic" }}>{real}</span>}</span>);
  return <span style={{ ...style, fontWeight:500 }}>{real || "Unnamed"}</span>;
}

export function overallScore(p) {
  const cs = score(p.cw||0, p.cl||0, p.ct||0);
  const us = score(p.sw||0, p.sl||0, p.st||0);
  const ms = score(p.mw||0, p.ml||0, p.mt||0);
  const hc = (p.cw||0)+(p.cl||0)+(p.ct||0)>0, hu = (p.sw||0)+(p.sl||0)+(p.st||0)>0, hm = (p.mw||0)+(p.ml||0)+(p.mt||0)>0;
  const tot = (hc?1:0)+(hu?3:0)+(hm?5:0);
  if (!tot) return 0;
  return ((hc?cs:0) + (hu?us*3:0) + (hm?ms*5:0)) / tot;
}

export function totalGP(p) { return (p.cw||0)+(p.cl||0)+(p.ct||0)+(p.sw||0)+(p.sl||0)+(p.st||0)+(p.mw||0)+(p.ml||0)+(p.mt||0); }
export function h2hKey(a, b) { return [a,b].sort().join("__"); }
