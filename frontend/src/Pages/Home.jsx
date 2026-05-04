import StatusBar from "../components/StatusBar";
import TopBar from "../components/TopBar";
import { quickFind, recentLocations, locations } from "../data/locations";
import "../css/Home.css";

export default function Home({ userLocation, onSearch, onSelectQuick, onSelectRecent }) {
  return (
    <div className="home-page">
      <StatusBar />
      <div className="home-hero">
        <div className="home-hero-label">Your location</div>
        <div className="home-hero-loc">{userLocation}</div>
        <div className="home-hero-search" onClick={onSearch}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <span>Where do you want to go?</span>
        </div>
      </div>

      <div className="home-scroll">
        <div className="home-section-title">Quick find</div>
        <div className="home-quick-grid">
          {quickFind.map((q, i) => {
            const match = locations.find(l => l.type === q.type);
            return (
              <div key={i} className="home-quick-card" onClick={() => match && onSelectQuick(match)}>
                <div className="home-quick-icon" style={{ background: q.color }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={q.iconColor} strokeWidth="2">
                    {q.icon === "grid" && <><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></>}
                    {q.icon === "coffee" && <><path d="M18 8h1a4 4 0 010 8h-1"/><path d="M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></>}
                    {q.icon === "home" && <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>}
                    {q.icon === "alert" && <><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></>}
                  </svg>
                </div>
                <div className="home-quick-name">{q.label}</div>
                <div className="home-quick-dist">{match ? `Floor ${match.floor}` : ""}</div>
              </div>
            );
          })}
        </div>

        <div className="home-section-title">Recent destinations</div>
        {recentLocations.map((r, i) => {
          const loc = locations.find(l => l.id === r.id);
          return (
            <div key={i} className="home-recent-item" onClick={() => loc && onSelectRecent(loc)}>
              <div className="home-recent-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#185FA5" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
              </div>
              <div className="home-recent-info">
                <div className="home-recent-name">{r.name}</div>
                <div className="home-recent-sub">{r.sub}</div>
              </div>
              <div className="home-recent-arr">›</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}