import { useState, useEffect } from "react";
import LocationPicker, { getBuildingLocation } from "../components/LocationPicker";
import "../css/Home.css";

const QUICK_FIND_TYPES = [
  {
    label: "Cafeteria",
    icon: "coffee",
    color: "#FAEEDA",
    iconColor: "#BA7517",
    match: (r) => r.type === "PANTRY" || /cafeteria/i.test(r.name),
  },
  {
    label: "Restrooms",
    icon: "toilet",
    color: "#F3E8FF",
    iconColor: "#8B5CF6",
    match: (r) => r.type === "TOILET" || r.type === "RESTROOM" || /restroom|toilet/i.test(r.name),
  },
  {
    label: "Reception",
    icon: "home",
    color: "#E6F1FB",
    iconColor: "#378ADD",
    match: (r) => r.type === "RECEPTION",
  },
  {
    label: "Emergency exit",
    icon: "alert",
    color: "#FCEBEB",
    iconColor: "#E24B4A",
    match: (r) => r.type === "EXIT" || /staircase|emergency.exit/i.test(r.name),
  },
];

export default function Home({
  userLocation,
  selectedLocation,
  onSelectLocation,
  buildings = [],
  selectedBuildingId,
  onSelectBuilding,
  floors = [],
  selectedFloorId,
  onSelectFloor,
  rooms = [],
  onSelectQuick,
  onSelectRecent,
  goTo,
}) {
  const RECENTS_KEY = "indoorNav.recentDestinations";
  const [recentRooms, setRecentRooms] = useState([]);

  // Read recent destinations from localStorage — updated whenever the user navigates
  useEffect(() => {
    function loadRecents() {
      try {
        const stored = JSON.parse(localStorage.getItem(RECENTS_KEY) || "[]");
        setRecentRooms(stored);
      } catch {
        setRecentRooms([]);
      }
    }
    loadRecents();
    // Refresh whenever the Home page becomes visible (user navigated back)
    window.addEventListener("focus", loadRecents);
    return () => window.removeEventListener("focus", loadRecents);
  }, []);

  const activeBuilding = buildings.find((b) => b.id === selectedBuildingId);
  const activeBuildingName = activeBuilding ? activeBuilding.name : "Hudson";
  const activeLocation = selectedLocation || (activeBuilding ? getBuildingLocation(activeBuilding) : "Pune");
  const activeFloor = floors.find((f) => f.id === selectedFloorId);
  const activeFloorLevel = activeFloor ? activeFloor.name : "5th Floor";
  const locationName = userLocation ? userLocation.name : "Reception";

  return (
    <div className="home-page">
      <div className="home-hero">
        <div className="home-location-card">
          <span className="home-location-subtitle">You are at</span>
          <span className="home-location-title">{locationName}</span>
          <div className="home-location-meta-selectors" style={{ marginTop: 6 }}>
            <LocationPicker
              selectedLocation={activeLocation}
              onSelectLocation={onSelectLocation}
              buildings={buildings}
              buildingId={selectedBuildingId}
              onSelectBuilding={onSelectBuilding}
              floors={floors}
              floorId={selectedFloorId}
              onSelectFloor={onSelectFloor}
            />
          </div>
        </div>

        <div className="home-search-bar" onClick={() => goTo("search")}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.5">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <span className="home-search-placeholder">Where would you like to go?</span>
        </div>
      </div>

      <div className="home-scroll">
        <div className="home-section-title">Quick Actions</div>
        <div className="home-quick-grid">
          {QUICK_FIND_TYPES.map((q, i) => {
            const match = rooms.find((r) => q.match(r));
            const disabled = !match;
            return (
              <div
                key={i}
                className={`home-quick-card${disabled ? " is-disabled" : ""}`}
                onClick={() => match && onSelectQuick(match)}
              >
                <div className="home-quick-icon" style={{ background: q.color }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={q.iconColor} strokeWidth="2">
                    {q.icon === "coffee" && <><path d="M18 8h1a4 4 0 010 8h-1" /><path d="M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z" /><line x1="6" y1="1" x2="6" y2="4" /><line x1="10" y1="1" x2="10" y2="4" /><line x1="14" y1="1" x2="14" y2="4" /></>}
                    {q.icon === "home"   && <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />}
                    {q.icon === "alert"  && <><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></>}
                    {q.icon === "toilet" && <><circle cx="6" cy="5" r="2" /><path d="M4 8h4v8H6v5H4v-5H2V8z" /><circle cx="18" cy="5" r="2" /><path d="M16 8h4v6h-1v7h-2v-7h-1V8z" /></>}
                  </svg>
                </div>
                <div className="home-quick-name">{q.label}</div>
                <div className="home-quick-dist">
                  {match ? `Floor ${match.floor?.level ?? "G"}` : "—"}
                </div>
              </div>
            );
          })}
        </div>

        <div className="home-section-title">Recent Destinations</div>
        {recentRooms.length === 0 ? (
          <div style={{ color: "#9ca3af", fontSize: 13, padding: "12px 0" }}>No recent destinations yet.</div>
        ) : (
          recentRooms.map((room, i) => (
            <div key={room.id || i} className="home-recent-item" onClick={() => onSelectRecent(room)}>
              <div className="home-recent-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#185FA5" strokeWidth="2">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
              </div>
              <div className="home-recent-info">
                <div className="home-recent-name">{room.name}</div>
                <div className="home-recent-sub">{room.type?.replace(/_/g, " ")}</div>
              </div>
              <div className="home-recent-arr">›</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
