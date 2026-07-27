import { useState, useEffect, useMemo } from "react";
import LocationPicker from "../components/LocationPicker";
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
  selectedLocation,
  onSelectLocation,
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
  const [fromQuery, setFromQuery] = useState(userLocation?.name || "");
  const [showFromSuggestions, setShowFromSuggestions] = useState(false);
  const [activeFromSuggestionIndex, setActiveFromSuggestionIndex] = useState(-1);

  // Sync starting location when user location props update
  useEffect(() => {
    setLocalUserLocation(userLocation);
    setFromQuery(userLocation?.name || "");
  }, [userLocation]);

  // Keep the input text in sync when source location changes via selection/props.
  useEffect(() => {
    setFromQuery(localUserLocation?.name || "");
  }, [localUserLocation]);

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

  const normalizedFromQuery = fromQuery.trim().toLowerCase();
  const filteredSourceRooms = useMemo(() => {
    if (!normalizedFromQuery) return rooms.slice(0, 8);
    return rooms
      .filter((r) => r.name?.toLowerCase().includes(normalizedFromQuery))
      .slice(0, 8);
  }, [rooms, normalizedFromQuery]);

  const hasExactFromMatch = useMemo(() => {
    return rooms.some((r) => r.name?.toLowerCase() === normalizedFromQuery);
  }, [rooms, normalizedFromQuery]);

  const handleFromInputChange = (value) => {
    setFromQuery(value);
    setShowFromSuggestions(true);
    setActiveFromSuggestionIndex(-1);

    const exactMatch = rooms.find(
      (r) => r.name?.toLowerCase() === value.trim().toLowerCase()
    );
    setLocalUserLocation(exactMatch || null);
  };

  const handleFromSelect = (room) => {
    setLocalUserLocation(room);
    setFromQuery(room.name);
    setShowFromSuggestions(false);
    setActiveFromSuggestionIndex(-1);
  };

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
      <div className="search-hero">
        <div className="search-hero-top">
          <button
            type="button"
            className="search-back-btn"
            onClick={onBack}
            aria-label="Go back"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
          </button>
          <span className="search-hero-title">Search Destinations</span>
        </div>

        <div className="search-location-card">
          <span className="search-location-subtitle">Searching in</span>
          <div className="search-location-selectors">
            <LocationPicker
              selectedLocation={selectedLocation}
              onSelectLocation={onSelectLocation}
              buildings={buildings}
              buildingId={buildingId}
              onSelectBuilding={onSelectBuilding}
              floors={floors}
              floorId={floorId}
              onSelectFloor={onSelectFloor}
            />
          </div>
        </div>

        <div className="search-bar">
          <svg className="search-bar-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.5">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            className="search-input"
            placeholder="Search rooms, desks, amenities…"
            value={query}
            onChange={e => { setQuery(e.target.value); setCategory(null); setSelected(null); }}
            autoFocus
          />
          {query && (
            <button
              type="button"
              className="search-clear-btn"
              onClick={() => { setQuery(""); setCategory(null); setSelected(null); }}
              aria-label="Clear search"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
      </div>
      <div className="search-body">
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
              <div className="route-confirm-field route-confirm-field-from">
                <label className="route-confirm-label">From</label>
                <div className="route-confirm-autocomplete">
                  <input
                    type="text"
                    className="route-confirm-input"
                    placeholder="Type to search starting room"
                    value={fromQuery}
                    onFocus={() => setShowFromSuggestions(true)}
                    onBlur={() => {
                      setShowFromSuggestions(false);
                      setActiveFromSuggestionIndex(-1);
                    }}
                    onChange={(e) => handleFromInputChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "ArrowDown") {
                        e.preventDefault();
                        if (!showFromSuggestions) setShowFromSuggestions(true);
                        if (filteredSourceRooms.length > 0) {
                          setActiveFromSuggestionIndex((prev) =>
                            prev < filteredSourceRooms.length - 1 ? prev + 1 : 0
                          );
                        }
                        return;
                      }

                      if (e.key === "ArrowUp") {
                        e.preventDefault();
                        if (!showFromSuggestions) setShowFromSuggestions(true);
                        if (filteredSourceRooms.length > 0) {
                          setActiveFromSuggestionIndex((prev) =>
                            prev > 0 ? prev - 1 : filteredSourceRooms.length - 1
                          );
                        }
                        return;
                      }

                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (showFromSuggestions && activeFromSuggestionIndex >= 0 && filteredSourceRooms[activeFromSuggestionIndex]) {
                          handleFromSelect(filteredSourceRooms[activeFromSuggestionIndex]);
                          return;
                        }
                        if (hasExactFromMatch && localUserLocation) {
                          setShowFromSuggestions(false);
                          return;
                        }
                        if (filteredSourceRooms.length > 0) {
                          handleFromSelect(filteredSourceRooms[0]);
                          return;
                        }
                        setShowFromSuggestions(false);
                      }
                      if (e.key === "Escape") {
                        setShowFromSuggestions(false);
                        setActiveFromSuggestionIndex(-1);
                      }
                    }}
                    role="combobox"
                    aria-expanded={showFromSuggestions}
                    aria-controls="from-location-suggestions"
                    aria-autocomplete="list"
                  />

                  {showFromSuggestions && (
                    <div
                      id="from-location-suggestions"
                      className="route-confirm-suggestions"
                      role="listbox"
                      aria-label="Starting room suggestions"
                    >
                      {filteredSourceRooms.length === 0 && (
                        <div className="route-confirm-suggestion-empty">No matching locations</div>
                      )}
                      {filteredSourceRooms.map((r, idx) => (
                        <button
                          key={r.id}
                          type="button"
                          className={`route-confirm-suggestion ${(localUserLocation?.id === r.id || activeFromSuggestionIndex === idx) ? "active" : ""}`}
                          onMouseDown={(e) => e.preventDefault()}
                          onPointerDown={(e) => e.preventDefault()}
                          onClick={() => handleFromSelect(r)}
                          role="option"
                          aria-selected={localUserLocation?.id === r.id || activeFromSuggestionIndex === idx}
                        >
                          {r.name}
                        </button>
                      ))}
                    </div>
                  )}

                </div>
                {fromQuery && !localUserLocation && (
                  <div className="route-confirm-field-hint">Please select a valid location from suggestions.</div>
                )}
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