import { useState, useEffect } from "react";
import TopBar from "../components/TopBar";
import "../css/Search.css";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3001/api/v1";

const CATEGORIES = [
  { id: "MEETING",    label: "Meeting",    types: ["MEETING_ROOM"], color: "#185FA5" },
  { id: "WORKSPACE",  label: "Workspace",  types: ["OFFICE"],      color: "#3B6D11" },
  { id: "FACILITIES", label: "Facilities", types: ["TOILET", "STORAGE"], color: "#854F0B" },
  { id: "FOOD",       label: "Food",       types: ["PANTRY"],      color: "#D97706" },
  { id: "SERVICES",   label: "Services",   types: ["RECEPTION", "SERVER_ROOM"], color: "#534AB7" },
];

export default function Search({
  userLocation,
  onChangeUserLocation,
  buildings,
  buildingId,
  onSelectBuilding,
  floors,
  floorId,
  onSelectFloor,
  rooms = [],
  onBack,
  onSelectDestination,
  fetchRoute,
}) {
  const [query,    setQuery]    = useState("");
  const [category, setCategory] = useState(null);
  const [results,  setResults]  = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [localUserLocation, setLocalUserLocation] = useState(userLocation);

  // Sync starting location when user location props update
  useEffect(() => {
    setLocalUserLocation(userLocation);
  }, [userLocation]);

  // Scope search to the active floor
  const activeFloorId = floorId ?? userLocation?.floor?.id ?? userLocation?.floorId ?? null;

  useEffect(() => {
    const timeout = setTimeout(async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams();
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

  const handleStartNavigation = async () => {
    if (!localUserLocation || !selected) return;

    // Persist new start location in app.jsx
    onChangeUserLocation(localUserLocation);

    // Calculate path route
    const calculatedRoute = await fetchRoute(localUserLocation, selected);

    // Trigger map load and transitions
    onSelectDestination({
      destination: selected,
      route: calculatedRoute
    });

    setSelected(null);
  };

  const activeBuilding = buildings.find(b => b.id === buildingId);
  const activeBuildingName = activeBuilding ? activeBuilding.name : "";
  const activeFloor = floors.find(f => f.id === floorId);
  const activeFloorLevel = activeFloor ? activeFloor.name : "";

  return (
    <div className="search-page">
      <TopBar title="Search" onBack={onBack} />

      <div className="search-selectors-row">
        <div className="search-select-field">
          <label className="search-select-label">Building</label>
          <select
            className="search-dropdown"
            value={buildingId || ""}
            onChange={(e) => onSelectBuilding(e.target.value)}
          >
            {buildings.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        <div className="search-select-field">
          <label className="search-select-label">Floor</label>
          <select
            className="search-dropdown"
            value={floorId || ""}
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
      </div>

      <div className="search-body">
        <div className="search-bar">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
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
            <div onClick={() => { setQuery(""); setCategory(null); setSelected(null); }} style={{ cursor: "pointer" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
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
                <div className="result-arr">›</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Route Confirmation Bottom Sheet */}
      {selected && (
        <div className="route-confirm-sheet-backdrop" onClick={() => setSelected(null)}>
          <div className="route-confirm-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="route-confirm-handle" />
            
            <div className="route-confirm-title">Confirm Route</div>
            
            <div className="route-confirm-fields">
              <div className="route-confirm-field">
                <label className="route-confirm-label">From</label>
                <select
                  className="route-confirm-select"
                  value={localUserLocation?.id || ""}
                  onChange={(e) => {
                    const r = rooms.find(room => room.id === e.target.value);
                    setLocalUserLocation(r || null);
                  }}
                >
                  <option value="">Select starting room</option>
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="route-confirm-field">
                <label className="route-confirm-label">To</label>
                <div className="route-confirm-dest-value">{selected.name}</div>
              </div>
            </div>

            <div className="route-confirm-meta">
              <div className="route-confirm-meta-item">
                <span className="rc-meta-lbl">Building</span>
                <span className="rc-meta-val">{activeBuildingName}</span>
              </div>
              <div className="route-confirm-meta-item">
                <span className="rc-meta-lbl">Floor</span>
                <span className="rc-meta-val">{activeFloorLevel}</span>
              </div>
            </div>

            <button
              type="button"
              className="route-confirm-go-btn"
              disabled={!localUserLocation || localUserLocation.id === selected.id}
              onClick={handleStartNavigation}
            >
              Start Navigation
            </button>
          </div>
        </div>
      )}
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