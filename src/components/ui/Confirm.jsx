import useFocusTrap from '../../hooks/useFocusTrap';

export default function Confirm({ title, msg, onConfirm, onCancel }) {
  const trapRef = useFocusTrap(true, onCancel);

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.82)", zIndex:300, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }} onClick={e=>e.target===e.currentTarget&&onCancel()}>
      <div ref={trapRef} role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-msg" tabIndex={-1} style={{ background:"var(--sf)", border:"1px solid var(--rd)", borderTop:"3px solid var(--rd)", padding:28, width:"100%", maxWidth:380, textAlign:"center" }}>
        <div id="confirm-title" style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:26, letterSpacing:2, color:"var(--rd)", marginBottom:10 }}>{title}</div>
        <div id="confirm-msg" style={{ fontSize:11, color:"var(--mu)", letterSpacing:"1.5px", lineHeight:1.8, marginBottom:22 }}>{msg}</div>
        <div style={{ display:"flex", gap:10, justifyContent:"center" }}>
          <button onClick={onCancel} className="smbtn" style={{ flex:1, padding:12 }}>Cancel</button>
          <button onClick={()=>{ onConfirm(); }} style={{ background:"none", border:"1px solid var(--rd)", color:"var(--rd)", fontFamily:"'DM Mono',monospace", fontSize:11, letterSpacing:2, textTransform:"uppercase", padding:"12px 16px", cursor:"pointer" }}>Confirm</button>
        </div>
      </div>
    </div>
  );
}
