import "../css/TopBar.css";

export default function TopBar({ title, subtitle, onBack }) {
  return (
    <div className="topbar">
      <div className="topbar-row">
        {onBack && (
          <button className="topbar-back" onClick={onBack}>‹</button>
        )}
        <div>
          <div className="topbar-title">{title}</div>
          {subtitle && <div className="topbar-sub">{subtitle}</div>}
        </div>
      </div>
    </div>
  );
}