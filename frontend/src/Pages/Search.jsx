import { useState, useEffect } from "react";
import StatusBar from "../components/StatusBar";
import TopBar from "../components/TopBar";
import "../css/Search.css";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3001/api/v1";
const FILTERS = ["All", "MEETING_ROOM", "OFFICE", "PANTRY", "RECEPTION", "TOILET", "STORAGE", "SERVER_ROOM", "OTHER"];

export default function Search({ userLocation, onBack, onSelectDestination }) {
  const [query,    setQuery]    = useState("");
  const [filter,   setFilter]   = useState("All");
  const [results,  setResults]  = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading,  setLoading]  = useState(false);

  useEffect(() => {
    const timeout = setTimeout(async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        // ✅ always send q — even if empty string
        params.set("q", query.trim());
        if (filter !== "All") params.set("type", filter);

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
  }, [query, filter]);

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
      <StatusBar />
      <TopBar title="Search" onBack={onBack} />

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
            onChange={e => { setQuery(e.target.value); setSelected(null); }}
            autoFocus
          />
          {query && (
            <div onClick={() => { setQuery(""); setSelected(null); }}
              style={{ cursor: "pointer" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="#9ca3af" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </div>
          )}
        </div>

        <div className="filter-row">
          {FILTERS.map(f => (
            <div
              key={f}
              className={`filter-pill ${filter === f ? "active" : ""}`}
              onClick={() => { setFilter(f); setSelected(null); }}
            >
              {f === "All" ? "All" : f.replace(/_/g, " ")}
            </div>
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
              <div className="result-floor">F{room.floor?.level ?? "G"}</div>
              <div className="result-arr">›</div>
            </div>
          ))}
        </div>

        {selected && (
          <div className="search-confirm-bar">
            <div className="search-confirm-info">
              <div className="scb-name">{selected.name}</div>
              <div className="scb-sub">Floor {selected.floor?.level ?? "G"}</div>
            </div>
            <button
              className="search-go-btn"
              onClick={() => handleGetDirections(selected)}
            >
              Get directions →
            </button>
          </div>
        )}
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