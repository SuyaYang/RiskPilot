export default function ProductArt({ id }: { id: string }) {
  const earbuds = id === "quiet-buds";
  return <div className={`product-art ${earbuds ? "accessory" : id === "aero-13" ? "alt" : ""}`} aria-hidden="true">
    {earbuds ? <svg viewBox="0 0 120 100" fill="none"><rect x="24" y="40" width="72" height="45" rx="20" fill="var(--card)" stroke="var(--art-detail)" /><path d="M25 57h70" stroke="var(--line)" /><rect x="38" y="13" width="15" height="40" rx="7.5" fill="var(--card)" stroke="var(--art-detail)" /><rect x="68" y="13" width="15" height="40" rx="7.5" fill="var(--card)" stroke="var(--art-detail)" /><path d="M43 20h5m25 0h5" stroke="var(--navy)" strokeWidth="3" strokeLinecap="round" /><circle cx="60" cy="70" r="2" fill="var(--accent)" /></svg> :
    <svg viewBox="0 0 120 100" fill="none"><rect x="17" y="15" width="86" height="61" rx="5" fill="var(--art-shell)" /><rect x="21" y="19" width="78" height="52" rx="2" fill={id === "aero-13" ? "var(--art-screen-alt)" : "var(--art-screen)"} /><path d="M21 60 66 19h33v52H21V60Z" fill="var(--accent)" opacity=".4" /><path d="m48 71 51-35v35H48Z" fill="var(--navy)" opacity=".5" /><path d="M8 76h104l-8 8H16l-8-8Z" fill="var(--art-detail)" /><path d="M48 76h24l-3 3H51l-3-3Z" fill="var(--art-shell)" /></svg>}
  </div>;
}
