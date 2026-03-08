import { useState } from 'react';
import useFocusTrap from '../../hooks/useFocusTrap';

export default function EditModal({ p, onSave, onDel, onClose }) {
  const [ep, setEp] = useState(p);
  const trapRef = useFocusTrap(true, onClose);
  const inp = { width:"100%", background:"var(--s2)", border:"1px solid var(--bd)", color:"var(--tx)", fontFamily:"'DM Mono',monospace", fontSize:14, padding:"10px 12px", outline:"none" };
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.82)", zIndex:300, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div ref={trapRef} role="dialog" aria-modal="true" aria-labelledby="edit-title" tabIndex={-1} style={{ background:"var(--sf)", border:"1px solid var(--bd)", borderTop:"3px solid var(--ac)", padding:30, width:"100%", maxWidth:500, maxHeight:"90vh", overflowY:"auto" }}>
        <div id="edit-title" style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:30, letterSpacing:2, color:"var(--ac)", marginBottom:22 }}>Edit Player</div>
        <div style={{ display:"flex", gap:10, marginBottom:14 }}>
          <div style={{ flex:1 }}><label style={{ display:"block", fontSize:10, letterSpacing:3, textTransform:"uppercase", color:"var(--mu)", marginBottom:6 }}>First</label><input style={inp} value={ep.firstName||""} onChange={e=>setEp(x=>({...x,firstName:e.target.value}))}/></div>
          <div style={{ flex:1 }}><label style={{ display:"block", fontSize:10, letterSpacing:3, textTransform:"uppercase", color:"var(--mu)", marginBottom:6 }}>Last</label><input style={inp} value={ep.lastName||""} onChange={e=>setEp(x=>({...x,lastName:e.target.value}))}/></div>
        </div>
        <div style={{ marginBottom:14 }}><label style={{ display:"block", fontSize:10, letterSpacing:3, textTransform:"uppercase", color:"var(--mu)", marginBottom:6 }}>Nickname</label><input style={inp} value={ep.nickname||""} placeholder="e.g. The Champ" onChange={e=>setEp(x=>({...x,nickname:e.target.value}))}/></div>
        {[{label:"Classic",color:"var(--X)",wf:"cw",lf:"cl",tf:"ct"},{label:"Ultimate",color:"var(--O)",wf:"sw",lf:"sl",tf:"st"},{label:"MEGA",color:"var(--mega)",wf:"mw",lf:"ml",tf:"mt"}].map(sec => (
          <div key={sec.wf}>
            <div style={{ fontSize:10, letterSpacing:3, color:sec.color, textTransform:"uppercase", margin:"18px 0 8px", borderTop:"1px solid var(--bd)", paddingTop:14 }}>{sec.label}</div>
            <div style={{ display:"flex", gap:10 }}>
              {['W','L','T'].map((x,i) => { const f = [sec.wf,sec.lf,sec.tf][i]; return (
                <div key={x} style={{ flex:1 }}><label style={{ display:"block", fontSize:10, letterSpacing:3, textTransform:"uppercase", color:"var(--mu)", marginBottom:6 }}>{x}</label><input style={inp} type="number" min="0" value={ep[f]||0} onChange={e=>setEp(x2=>({...x2,[f]:parseInt(e.target.value,10)||0}))}/></div>
              );})}
            </div>
          </div>
        ))}
        <div style={{ display:"flex", gap:10, marginTop:22 }}>
          <button onClick={onClose} className="smbtn" style={{ flex:1, padding:12 }}>Cancel</button>
          <button onClick={()=>onDel(ep.id)} style={{ background:"none", border:"1px solid var(--rd)", color:"var(--rd)", fontFamily:"'DM Mono',monospace", fontSize:11, letterSpacing:2, textTransform:"uppercase", padding:"12px 16px", cursor:"pointer" }}>Delete</button>
          <button onClick={()=>onSave(ep)} className="savebtn" style={{ flex:1, padding:12 }}>Save</button>
        </div>
      </div>
    </div>
  );
}
