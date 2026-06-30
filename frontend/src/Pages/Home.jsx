import { useState, useEffect } from "react";
import BuildingChips from "../components/BuildingChips";
import "../css/Home.css";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3001/api/v1";

const QUICK_FIND_TYPES = [
  { label: "Meeting rooms", type: "MEETING_ROOM", icon: "grid",  color: "#EAF3DE", iconColor: "#639922" },
  { label: "Cafeteria",     type: "PANTRY",        icon: "coffee",color: "#FAEEDA", iconColor: "#BA7517" },
  { label: "Reception",     type: "RECEPTION",     icon: "home",  color: "#E6F1FB", iconColor: "#378ADD" },
  { label: "Emergency exit",type: "EXIT",           icon: "alert", color: "#FCEBEB", iconColor: "#E24B4A" },
];

export default function Home({
  userLocation,
  onChangeUserLocation,
  destination,
  onChangeDestination,
  route,
  onSelectRoute,
  buildings = [],
  selectedBuildingId,
  onSelectBuilding,
  floors = [],
  selectedFloorId,
  onSelectFloor,
  rooms = [],
  onSelectQuick,
  onSelectRecent,
  fetchRoute,
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

  const handleNavigate = async () => {
    if (!userLocation?.id || !destination?.id) return;
    const fetchedRoute = await fetchRoute(userLocation, destination);
    onSelectRoute(fetchedRoute);
    goTo("map");
  };

  return (
    <div className="home-page">
      <div className="home-hero">
        <h1 className="home-title">Indoor Navigation</h1>

        <div className="home-form">
          <div className="home-form-field">
            <label className="home-dropdown-label">Building</label>
            <select
              className="home-dropdown"
              value={selectedBuildingId || ""}
              onChange={(e) => onSelectBuilding(e.target.value)}
            >
              {buildings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div className="home-form-field">
            <label className="home-dropdown-label">Floor</label>
            <select
              className="home-dropdown"
              value={selectedFloorId || ""}
              onChange={(e) => onSelectFloor(e.target.value)}
            >
              <option value="">Select Floor</option>
              {floors.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>

          <div className="home-form-field">
            <label className="home-dropdown-label">From</label>
            <select
              className="home-dropdown"
              disabled={!selectedFloorId}
              value={userLocation?.id || ""}
              onChange={(e) => {
                const r = rooms.find((room) => room.id === e.target.value);
                onChangeUserLocation(r || null);
              }}
            >
              {!selectedFloorId ? (
                <option value="">Select Floor first</option>
              ) : (
                <>
                  <option value="">Select Source Room</option>
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </>
              )}
            </select>
          </div>

          <div className="home-form-field">
            <label className="home-dropdown-label">To</label>
            <select
              className="home-dropdown"
              disabled={!selectedFloorId}
              value={destination?.id || ""}
              onChange={(e) => {
                const r = rooms.find((room) => room.id === e.target.value);
                onChangeDestination(r || null);
              }}
            >
              {!selectedFloorId ? (
                <option value="">Select Floor first</option>
              ) : (
                <>
                  <option value="">Select Destination Room</option>
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </>
              )}
            </select>
          </div>

          <button
            type="button"
            className="home-go-btn"
            disabled={!userLocation || !destination || userLocation.id === destination.id}
            onClick={handleNavigate}
          >
            Let's Go →
          </button>
        </div>
      </div>

      <div className="home-scroll">
        <div className="home-section-title">Quick find</div>
        <div className="home-quick-grid">
          {QUICK_FIND_TYPES.map((q, i) => {
            const match = rooms.find(r => r.type === q.type);
            const disabled = !match;
            return (
              <div
                key={i}
                className={`home-quick-card${disabled ? " is-disabled" : ""}`}
                onClick={() => match && onSelectQuick(match)}
              >
                <div className="home-quick-icon" style={{ background: q.color }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={q.iconColor} strokeWidth="2">
                    {q.icon === "grid"   && <><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></>}
                    {q.icon === "coffee" && <><path d="M18 8h1a4 4 0 010 8h-1"/><path d="M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></>}
                    {q.icon === "home"   && <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>}
                    {q.icon === "alert"  && <><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></>}
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

        <div className="home-section-title">Recent destinations</div>
        {recentRooms.length === 0 ? (
          <div style={{ color: "#9ca3af", fontSize: 13, padding: "12px 0" }}>No recent destinations yet.</div>
        ) : (
          recentRooms.map((room, i) => (
            <div key={room.id || i} className="home-recent-item" onClick={() => onSelectRecent(room)}>
              <div className="home-recent-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#185FA5" strokeWidth="2">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>
                  <circle cx="12" cy="10" r="3"/>
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
