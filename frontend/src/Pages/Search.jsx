import { useState, useEffect } from "react";
import StatusBar from "../components/StatusBar";
import TopBar from "../components/TopBar";
import "../css/Search.css";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3001/api/v1";
const filters = ["All", "Meeting room", "Food", "Amenity", "Desk", "Exit"];

// Map API room types to filter pills
const TYPE_TO_FILTER = {
  MEETING_ROOM:   "Meeting room",
  BOARDROOM:      "Meeting room",
  PANTRY:         "Food",
  TOILET:         "Amenity",
  OTHER:          "Amenity",
  STORAGE:        "Amenity",
  SERVER_ROOM:    "Amenity",
  OFFICE:         "Desk",
  OPEN_WORKSPACE: "Desk",
  RECEPTION:      "Amenity",
  EXIT:           "Exit",
};

export default function Search({ onBack, onSelectDestination, userLocation }) {
  const [query, setQuery]     = useState("");
  const [filter, setFilter]   = useState("All");
  const [selected, setSelected] = useState(null);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [routeLoading, setRouteLoading] = useState(false);
  const [error, setError]     = useState(null);

  // Search rooms via API with 250ms debounce
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (query.trim()) {
        searchRooms(query.trim());
      } else {
        setResults([]);
      }
    }, 250);
    return () => clearTimeout(timeout);
  }, [query]);

  async function searchRooms(q) {
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch(`${API_BASE}/rooms/search?q=${encodeURIComponent(q)}`);
      const json = await res.json();
      setResults(json.success ? json.data : []);
    } catch (err) {
      setError("Search failed. Is the backend running?");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  // Filter results by selected pill
  const filtered = filter === "All"
    ? results
    : results.filter(r => TYPE_TO_FILTER[r.type] === filter);

  // Called when user taps "Get directions →"
  async function handleGetDirections() {
    if (!selected) return;

    // If we don't know where the user is, just pass the destination
    // and let the parent handle asking for a start location
    if (!userLocation?.id) {
      onSelectDestination({ destination: selected, route: null });
      return;
    }

    setRouteLoading(true);
    setError(null);

    try {
      const res  = await fetch(`${API_BASE}/route`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromRoomId: userLocation.id,
          toRoomId:   selected.id,
        }),
      });
      const json = await res.json();

      if (!json.success) {
        setError(json.error || "Could not compute route.");
        return;
      }

      // Pass both destination and full route data up to the parent
      onSelectDestination({ destination: selected, route: json.data });

    } catch (err) {
      setError("Failed to get route. Is the backend running?");
    } finally {
      setRouteLoading(false);
    }
  }

  return (
    <div className="search-page">
      <StatusBar />
      <TopBar title="Search" onBack={onBack} />
      <div className="search-body">

        <div className="search-bar">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            className="search-input"
            placeholder="Search rooms, desks, amenities…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            autoFocus
          />
          {query && (
            <div onClick={() => { setQuery(""); setResults([]); }} style={{ cursor: "pointer" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </div>
          )}
        </div>

        <div className="filter-row">
          {filters.map(f => (
            <div
              key={f}
              className={`filter-pill ${filter === f ? "active" : ""}`}
              onClick={() => setFilter(f)}
            >
              {f}
            </div>
          ))}
        </div>

        {error && (
          <div style={{ color: "#E24B4A", fontSize: 12, padding: "8px 0" }}>{error}</div>
        )}

        <div className="search-section-title">
          {loading ? "Searching…" : `${filtered.length} result${filtered.length !== 1 ? "s" : ""}`}
        </div>

        <div className="search-results">
          {filtered.map((loc) => (
            <div
              key={loc.id}
              className={`result-item ${selected?.id === loc.id ? "selected" : ""}`}
              onClick={() => setSelected(loc)}
            >
              <div className="result-dot" style={{ background: "#5F5E5A" }} />
              <div className="result-info">
                <div className="result-name">{loc.name}</div>
                <div className="result-sub">
                  {loc.type?.replace(/_/g, " ")}
                  {loc.capacity ? ` · ${loc.capacity} seats` : ""}
                  {loc.isAccessible === false ? " · Not accessible" : ""}
                </div>
              </div>
              <div className="result-floor">
                Floor {loc.floor?.level ?? "G"}
              </div>
              <div className="result-arr">›</div>
            </div>
          ))}
        </div>

        {selected && (
          <div className="search-confirm-bar">
            <div className="search-confirm-info">
              <div className="scb-name">{selected.name}</div>
              <div className="scb-sub">
                Floor {selected.floor?.level ?? "G"}
                {selected.capacity ? ` · ${selected.capacity} seats` : ""}
              </div>
            </div>
            <button
              className="search-go-btn"
              onClick={handleGetDirections}
              disabled={routeLoading}
            >
              {routeLoading ? "Finding route…" : "Get directions →"}
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
