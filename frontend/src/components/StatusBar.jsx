import "../css/StatusBar.css";

export default function StatusBar() {
  const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return (
    <div className="statusbar">
      <span className="statusbar-time">{time}</span>
      <div className="statusbar-icons">
        <svg width="15" height="11" viewBox="0 0 15 11" fill="#111">
          <rect x="0" y="4" width="3" height="7" rx="1"/>
          <rect x="4" y="2.5" width="3" height="8.5" rx="1"/>
          <rect x="8" y="1" width="3" height="10" rx="1"/>
          <rect x="12" y="0" width="3" height="11" rx="1" opacity=".3"/>
        </svg>
        <svg width="22" height="11" viewBox="0 0 22 11" fill="none">
          <rect x="0.5" y="0.5" width="18" height="10" rx="2.5" stroke="#111" strokeOpacity=".35"/>
          <rect x="2" y="2" width="13" height="7" rx="1.5" fill="#111"/>
          <path d="M20 3.5v4a2 2 0 000-4z" fill="#111" opacity=".4"/>
        </svg>
      </div>
    </div>
  );
}