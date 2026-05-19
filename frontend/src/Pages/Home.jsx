import { useState, useEffect } from "react";
import StatusBar from "../components/StatusBar";
import "../css/Home.css";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3001/api/v1";
const FLOOR_ID = "floor-gf";

const QUICK_FIND_TYPES = [
  { label: "Meeting rooms", type: "MEETING_ROOM", icon: "grid",  color: "#EAF3DE", iconColor: "#639922" },
  { label: "Cafeteria",     type: "PANTRY",        icon: "coffee",color: "#FAEEDA", iconColor: "#BA7517" },
  { label: "Reception",     type: "RECEPTION",     icon: "home",  color: "#E6F1FB", iconColor: "#378ADD" },
  { label: "Emergency exit",type: "EXIT",           icon: "alert", color: "#FCEBEB", iconColor: "#E24B4A" },
];

export default function Home({ userLocation, onSearch, onSelectQuick, onSelectRecent }) {
  const [rooms, setRooms] = useState([]);
  const [recentRooms, setRecentRooms] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadRooms() {
      try {
        const res  = await fetch(`${API_BASE}/floors/${FLOOR_ID}/map`);
        const json = await res.json();
        if (json.success && json.data?.rooms) {
          setRooms(json.data.rooms);
          setRecentRooms(json.data.rooms.slice(0, 3));
        }
      } catch (err) {
        console.error("Failed to load floor map:", err);
      } finally {
        setLoading(false);
      }
    }
    loadRooms();
  }, []);

  const getFloorLabel = (floor) => {
    if (floor == null) return "";
    return typeof floor === "object" ? floor.level : floor;
  };

  const userLocationText =
    typeof userLocation === "string"
      ? userLocation
      : userLocation
      ? `${userLocation.name}${userLocation.floor ? ` — Floor ${getFloorLabel(userLocation.floor)}` : ""}`
      : "Unknown location";

  return (
    <div className="home-page">
      <StatusBar />
      <div className="home-hero">
        <div className="home-hero-label">Your location</div>
        <div className="home-hero-loc">{userLocationText}</div>
        <div className="home-hero-search" onClick={onSearch}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <span>Where do you want to go?</span>
        </div>
      </div>

      <div className="home-scroll">
        <div className="home-section-title">Quick find</div>
        <div className="home-quick-grid">
          {QUICK_FIND_TYPES.map((q, i) => {
            const match = rooms.find(r => r.type === q.type);
            return (
              <div key={i} className="home-quick-card" onClick={() => match && onSelectQuick(match)}>
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
                  {match ? `Floor ${match.floor?.level ?? "G"}` : loading ? "…" : "—"}
                </div>
              </div>
            );
          })}
        </div>

        <div className="home-section-title">Recent destinations</div>
        {loading ? (
          <div style={{ color: "#9ca3af", fontSize: 13, padding: "12px 0" }}>Loading…</div>
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
