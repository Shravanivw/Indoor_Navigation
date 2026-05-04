import "../css/BottomNav.css";

const items = [
  { key: "home", label: "Home", icon: "home" },
  { key: "search", label: "Search", icon: "search" },
  { key: "qr", label: "", icon: "qr" },
  { key: "map", label: "Map", icon: "map" },
  //{ key: "profile", label: "Profile", icon: "profile" },
];

function Icon({ type, active }) {
  const c = active ? "#185FA5" : "#9ca3af";
  if (type === "home") return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>;
  if (type === "search") return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>;
  if (type === "map") return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/></svg>;
  //if (type === "profile") return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>;
  if (type === "qr") return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><rect x="3" y="3" width="5" height="5"/><rect x="16" y="3" width="5" height="5"/><rect x="3" y="16" width="5" height="5"/><path d="M21 16h-3v3m0-3v3m-3 0h3"/></svg>;
  return null;
}

export default function BottomNav({ current, onChange }) {
  return (
    <div className="bottom-nav">
      {items.map(item => (
        <div
          key={item.key}
          className={`nav-item ${item.key === "qr" ? "nav-item-qr" : ""}`}
          onClick={() => onChange(item.key)}
        >
          {item.key === "qr" ? (
            <div className="nav-qr-btn">
              <Icon type="qr" />
            </div>
          ) : (
            <>
              <Icon type={item.icon} active={current === item.key} />
              <span className={`nav-label ${current === item.key ? "active" : ""}`}>
                {item.label}
              </span>
            </>
          )}
        </div>
      ))}
    </div>
  );
}