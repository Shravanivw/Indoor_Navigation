import { useState } from "react";
import StatusBar from "../components/StatusBar";
import TopBar from "../components/TopBar";
import { locations } from "../data/locations";
import "../css/Search.css";

const filters = ["All", "Meeting room", "Food", "Amenity", "Desk", "Exit"];

export default function Search({ onBack, onSelectDestination }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const [selected, setSelected] = useState(null);

  const filtered = locations.filter(l => {
    const matchQuery = l.name.toLowerCase().includes(query.toLowerCase());
    const matchFilter = filter === "All" || l.type === filter;
    return matchQuery && matchFilter;
  });

  function handleSelect(loc) {
    setSelected(loc);
  }

  return (
    <div className="search-page">
      <StatusBar />
      <TopBar title="Search" onBack={onBack} />
      <div className="search-body">
        <div className="search-bar">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input
            className="search-input"
            placeholder="Search rooms, desks, amenities…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            autoFocus
          />
          {query && (
            <div onClick={() => setQuery("")} style={{ cursor: "pointer" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
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

        <div className="search-section-title">
          {filtered.length} result{filtered.length !== 1 ? "s" : ""}
        </div>

        <div className="search-results">
          {filtered.map(loc => (
            <div
              key={loc.id}
              className={`result-item ${selected?.id === loc.id ? "selected" : ""}`}
              onClick={() => handleSelect(loc)}
            >
              <div className="result-dot" style={{ background: loc.color }} />
              <div className="result-info">
                <div className="result-name">{loc.name}</div>
                <div className="result-sub">
                  {loc.type}{loc.seats ? ` · ${loc.seats} seats` : ""}{loc.status ? ` · ${loc.status}` : ""}{loc.detail ? ` · ${loc.detail}` : ""}
                </div>
              </div>
              <div className="result-floor">F{loc.floor}</div>
              <div className="result-arr">›</div>
            </div>
          ))}
        </div>

        {selected && (
          <div className="search-confirm-bar">
            <div className="search-confirm-info">
              <div className="scb-name">{selected.name}</div>
              <div className="scb-sub">Floor {selected.floor}</div>
            </div>
            <button className="search-go-btn" onClick={() => onSelectDestination(selected)}>
              Get directions →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}