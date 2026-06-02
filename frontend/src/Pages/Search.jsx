import { useState, useEffect } from "react";
import TopBar from "../components/TopBar";
import BuildingChips from "../components/BuildingChips";
import "../css/Search.css";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3001/api/v1";
const CATEGORIES = [
  { id: "MEETING",    label: "Meeting",    types: ["MEETING_ROOM"], color: "#185FA5" },
  { id: "WORK",       label: "Work",       types: ["OFFICE"],      color: "#3B6D11" },
  { id: "FACILITIES", label: "Facilities", types: ["TOILET", "PANTRY", "STORAGE"], color: "#854F0B" },
  { id: "SUPPORT",    label: "Support",    types: ["RECEPTION", "SERVER_ROOM"], color: "#534AB7" },
  { id: "EXIT",       label: "Exit",       types: ["EXIT"], color: "#A32D2D" },
];

export default function Search({ userLocation, floorId, buildings, buildingId, onSelectBuilding, onBack, onSelectDestination }) {
  const [query,    setQuery]    = useState("");
  const [category, setCategory] = useState(null);
  const [results,  setResults]  = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading,  setLoading]  = useState(false);

  // Prefer explicit floorId prop; fall back to the user's current floor.
  const activeFloorId = floorId ?? userLocation?.floor?.id ?? userLocation?.floorId ?? null;

  useEffect(() => {
    const timeout = setTimeout(async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        // ✅ always send q — even if empty string
        params.set("q", query.trim());

        if (category) {
          const categoryItem = CATEGORIES.find(c => c.id === category);
          if (categoryItem) params.set("type", categoryItem.types.join(','));
        }

        if (activeFloorId) params.set("floorId", activeFloorId);

        const res  = await fetch(`${API_BASE}/rooms/search?${params}`);
        const json = await res.json();
        if (json.success) setResults(json.data);
      } catch (err) {
        console.error("Search failed:", err);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [query, category, activeFloorId]);

  async function handleGetDirections(selectedRoom) {
    if (!selectedRoom || !userLocation) return;
    try {
      const res  = await fetch(`${API_BASE}/route`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromRoomId: userLocation.id,
          toRoomId:   selectedRoom.id,
        }),
      });
      const json = await res.json();
      onSelectDestination({
        destination: selectedRoom,
        route: json.success ? json.data : null,
      });
    } catch {
      onSelectDestination({ destination: selectedRoom, route: null });
    }
  }

  return (
    <div className="search-page">
      <TopBar title="Search" onBack={onBack} />
      <BuildingChips
        buildings={buildings}
        buildingId={buildingId}
        onSelectBuilding={onSelectBuilding}
      />

      <div className="search-body">
        <div className="search-bar">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="#9ca3af" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            className="search-input"
            placeholder="Search rooms, desks, amenities…"
            value={query}
            onChange={e => { setQuery(e.target.value); setCategory(null); setSelected(null); }}
            autoFocus
          />
          {query && (
            <div onClick={() => { setQuery(""); setCategory(null); setSelected(null); }}
              style={{ cursor: "pointer" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="#9ca3af" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </div>
          )}
        </div>

        <div className="category-row">
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              type="button"
              className={`category-card ${category === cat.id ? "active" : ""}`}
              onClick={() => {
                setCategory(prev => prev === cat.id ? null : cat.id);
                setQuery("");
                setSelected(null);
              }}
            >
              <span className="category-dot" style={{ background: cat.color }} />
              <span>{cat.label}</span>
            </button>
          ))}
        </div>


        <div className="search-section-title">
          {loading ? "Searching…" : `${results.length} result${results.length !== 1 ? "s" : ""}`}
        </div>

        <div className="search-results">
          {!loading && results.length === 0 && (
            <div style={{ color: "#9ca3af", fontSize: 13, padding: "16px 0" }}>
              No rooms found.
            </div>
          )}
          {results.map(room => (
            <div
              key={room.id}
              className={`result-item ${selected?.id === room.id ? "selected" : ""}`}
              onClick={() => setSelected(room)}
            >
              <div className="result-dot" style={{ background: getColor(room.type) }} />
              <div className="result-info">
                <div className="result-name">{room.name}</div>
                <div className="result-sub">
                  {room.type?.replace(/_/g, " ")}
                  {room.capacity ? ` · ${room.capacity} seats` : ""}
                  {room.floor?.name ? ` · ${room.floor.name}` : ""}
                </div>
              </div>
              <div className="result-meta">
                <div className="result-floor">F{room.floor?.level ?? "G"}</div>
                {selected?.id === room.id && (
                  <button
                    type="button"
                    className="result-go-btn"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleGetDirections(room);
                    }}
                  >
                    Get directions →
                  </button>
                )}
                <div className="result-arr">›</div>
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}

function getColor(type) {
  const map = {
    MEETING_ROOM: "#185FA5",
    PANTRY:       "#854F0B",
    RECEPTION:    "#534AB7",
    EXIT:         "#A32D2D",
    LIFT:         "#185FA5",
    RESTROOM:     "#5F5E5A",
    CABIN:        "#3B6D11",
    STORAGE:      "#5F5E5A",
    GENERAL:      "#5F5E5A",
  };
  return map[type] ?? "#5F5E5A";
}