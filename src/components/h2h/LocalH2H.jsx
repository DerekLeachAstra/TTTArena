import { useState } from 'react';
import { dn, h2hKey } from '../../lib/playerUtils';

export default function LocalH2H({ players, h2hData, onDel, onAdd }) {
  const [pAid, setPAid] = useState(""); const [pBid, setPBid] = useState("");
  const [res, setRes] = useState("W"); const [note, setNote] = useState(""); const [date, setDate] = useState(""); const [filter, setFilter] = useState("all");
  const sorted = [...players].sort((a,b) => dn(a).localeCompare(dn(b)));
  const pA = players.find(p => p.id === +pAid), pB = players.find(p => p.id === +pBid);
  const key = pA && pB ? h2hKey(pA.id, pB.id) : null;
  const all = key ? (h2hData[key] || []) : [];
  const shown = filter === "all" ? all : all.filter(e => e.mode === filter);
  const aW = shown.filter(e => !e.tie && e.winner===pA?.id).length;
  const bW = shown.filter(e => !e.tie && e.winner===pB?.id).length;
  const ties = shown.filter(e => e.tie).length;
  const logMode = filter === "all" ? "ultimate" : filter;
  function doAdd() {
    if (!pA || !pB || pA.id === pB.id) return;
    const d = date || new Date().toLocaleDateString();
    const w = res === "T" ? null : res === "W" ? pA.id : pB.id;
    onAdd(h2hKey(pA.id,pB.id), { id:Date.now(), winner:w, tie:res==="T", note:note.trim()||logMode+" match", date:d, mode:logMode });
    setNote(""); setDate("");
  }
  const sel = { background:"var(--sf)", border:"1px solid var(--bd)", color:"var(--tx)", fontFamily:"'DM Mono',monospace", fontSize:13, padding:"10px 14px", outline:"none", cursor:"pointer", minWidth:150, appearance:"none" };

  if (players.length === 0) {
    return (
      <div style={{ textAlign:"center", color:"var(--mu)", fontSize:11, letterSpacing:2, padding:40, border:"1px dashed var(--bd)" }}>
        No local players. Add players from the Manage tab to use local H2H tracking.
      </div>
    );
  }

  return (
    <div>
      <div style={{ display:"flex", gap:14, alignItems:"center", flexWrap:"wrap", marginBottom:26 }}>
        <select value={pAid} onChange={e=>setPAid(e.target.value)} style={sel}><option value="">Player A</option>{sorted.map(p => <option key={p.id} value={p.id}>{dn(p)}</option>)}</select>
        <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:26, color:"var(--a2)", letterSpacing:2 }}>VS</div>
        <select value={pBid} onChange={e=>setPBid(e.target.value)} style={sel}><option value="">Player B</option>{sorted.map(p => <option key={p.id} value={p.id}>{dn(p)}</option>)}</select>
      </div>
      {pA && pB && pA.id !== pB.id ? (
        <div style={{ background:"var(--sf)", border:"1px solid var(--bd)", padding:26 }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:22, gap:12, flexWrap:"wrap" }}>
            <div style={{ textAlign:"center", flex:1 }}><div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:24, letterSpacing:2 }}>{dn(pA)}</div></div>
            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:36, color:"var(--a2)" }}>VS</div>
            <div style={{ textAlign:"center", flex:1 }}><div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:24, letterSpacing:2 }}>{dn(pB)}</div></div>
          </div>
          <div style={{ display:"flex", border:"1px solid var(--bd)", marginBottom:18 }}>
            {[{v:aW,l:dn(pA).split(" ")[0]+" Wins",hi:aW>bW},{v:ties,l:"Ties",hi:false},{v:bW,l:dn(pB).split(" ")[0]+" Wins",hi:bW>aW}].map((item,i) => (
              <div key={i} style={{ flex:1, textAlign:"center", padding:"13px 6px", borderRight:i<2?"1px solid var(--bd)":"none" }}>
                <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:32, color: item.hi?"var(--gn)":i===1?"var(--a3)":"var(--tx)" }}>{item.v}</div>
                <div style={{ fontSize:9, letterSpacing:3, textTransform:"uppercase", color:"var(--mu)", marginTop:3 }}>{item.l}</div>
              </div>
            ))}
          </div>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:14, alignItems:"center" }}>
            <span style={{ fontSize:9, letterSpacing:2, color:"var(--mu)", textTransform:"uppercase" }}>Filter:</span>
            <select value={filter} onChange={e=>setFilter(e.target.value)} style={{ background:"var(--s2)", border:"1px solid var(--bd)", color:"var(--tx)", fontFamily:"'DM Mono',monospace", fontSize:11, padding:"5px 9px", outline:"none" }}>
              <option value="all">All ({all.length})</option><option value="classic">Classic</option><option value="ultimate">Ultimate</option><option value="mega">MEGA</option>
            </select>
          </div>
          <div style={{ fontSize:10, letterSpacing:3, textTransform:"uppercase", color:"var(--mu)", marginBottom:10 }}>Match History ({shown.length})</div>
          {shown.length === 0
            ? <div style={{ color:"var(--mu)", fontSize:11, letterSpacing:2, textAlign:"center", padding:22, border:"1px dashed var(--bd)" }}>No matches recorded</div>
            : shown.map(e => (
              <div key={e.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 0", borderBottom:"1px solid var(--bd)", fontSize:12 }}>
                <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:13, padding:"3px 10px", background:e.tie?"rgba(71,200,255,0.12)":e.winner===pA.id?"rgba(71,255,154,0.12)":"rgba(255,71,87,0.12)", color:e.tie?"var(--a3)":e.winner===pA.id?"var(--gn)":"var(--rd)" }}>
                  {e.tie ? "TIE" : e.winner===pA.id ? dn(pA).split(" ")[0]+" W" : dn(pB).split(" ")[0]+" W"}
                </span>
                <span style={{ flex:1, color:"var(--mu)", fontSize:11 }}>{e.note||"\u2014"}</span>
                <span style={{ fontSize:11, color:"var(--mu)" }}>{e.date}</span>
                <button onClick={() => onDel(key,e.id)} style={{ background:"none", border:"none", color:"var(--bd)", cursor:"pointer", fontSize:13 }}>x</button>
              </div>
            ))}
          <div style={{ display:"flex", gap:10, marginTop:14, flexWrap:"wrap", alignItems:"flex-end" }}>
            <select value={res} onChange={e=>setRes(e.target.value)} style={{ background:"var(--s2)", border:"1px solid var(--bd)", color:"var(--tx)", fontFamily:"'DM Mono',monospace", fontSize:12, padding:"9px 12px", outline:"none" }}>
              <option value="W">{dn(pA)} Wins</option><option value="L">{dn(pB)} Wins</option><option value="T">Tie</option>
            </select>
            <input value={note} onChange={e=>setNote(e.target.value)} placeholder="Note" onKeyDown={e=>e.key==="Enter"&&doAdd()} style={{ flex:1, minWidth:110, background:"var(--s2)", border:"1px solid var(--bd)", color:"var(--tx)", fontFamily:"'DM Mono',monospace", fontSize:12, padding:"9px 12px", outline:"none" }}/>
            <button className="savebtn" onClick={doAdd}>+ Log</button>
          </div>
        </div>
      ) : <div style={{ color:"var(--mu)", fontSize:12, letterSpacing:2, textAlign:"center", padding:40 }}>Select two different players to view head-to-head</div>}
    </div>
  );
}
