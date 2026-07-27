import React from "react";
import "../css/Search.css";

/**
 * Gets the location string for a given building.
 * Defaults to building.location, or infers from name/ID.
 */
export function getBuildingLocation(building) {
  if (!building) return "Pune";
  if (building.location) return building.location;
  const lower = (building.name || building.id || "").toLowerCase();
  if (lower.includes("jupiter") || lower.includes("bangalore")) return "Bangalore";
  return "Pune";
}

/**
 * LocationPicker Component
 * Renders hierarchical Location -> Building -> Floor selectors.
 *
 * Desired order:
 *   [ Location ▼ ]
 *   [ Building ▼ ]
 *   [ Floor ▼ ]
 */
export default function LocationPicker({
  selectedLocation,
  onSelectLocation,
  buildings = [],
  buildingId,
  onSelectBuilding,
  floors = [],
  floorId,
  onSelectFloor,
  variant = "inline", // "inline" | "block"
}) {
  // Derive list of unique locations dynamically
  const locations = Array.from(
    new Set(buildings.map(getBuildingLocation))
  );
  if (!locations.includes("Pune")) locations.unshift("Pune");
  if (!locations.includes("Bangalore") && buildings.some(b => getBuildingLocation(b) === "Bangalore")) {
    locations.push("Bangalore");
  }
  const uniqueLocations = Array.from(new Set(locations));

  // Current active location
  const currentLoc = selectedLocation || (
    buildingId ? getBuildingLocation(buildings.find(b => b.id === buildingId)) : uniqueLocations[0]
  );

  // Filter buildings for the selected location
  const filteredBuildings = buildings.filter(b => getBuildingLocation(b) === currentLoc);

  const handleLocationChange = (e) => {
    const newLoc = e.target.value;
    onSelectLocation?.(newLoc);
  };

  const handleBuildingChange = (e) => {
    const newBId = e.target.value;
    onSelectBuilding?.(newBId);
  };

  const handleFloorChange = (e) => {
    const newFId = e.target.value;
    onSelectFloor?.(newFId);
  };

  return (
    <div className={`location-picker-container location-picker-${variant}`}>
      {/* 1. LOCATION PICKER */}
      <div className="search-select-wrapper">
        <select
          className="search-inline-select location-select"
          value={currentLoc || ""}
          onChange={handleLocationChange}
          aria-label="Select Location"
        >
          {uniqueLocations.map((loc) => (
            <option key={loc} value={loc}>
              {loc}
            </option>
          ))}
        </select>
        <svg className="search-select-arrow" width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 1l4 4 4-4" />
        </svg>
      </div>

      <span className="search-location-separator">·</span>

      {/* 2. BUILDING PICKER */}
      <div className="search-select-wrapper">
        <select
          className="search-inline-select building-select"
          value={buildingId || ""}
          onChange={handleBuildingChange}
          aria-label="Select Building"
        >
          {filteredBuildings.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <svg className="search-select-arrow" width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 1l4 4 4-4" />
        </svg>
      </div>

      <span className="search-location-separator">·</span>

      {/* 3. FLOOR PICKER */}
      <div className="search-select-wrapper">
        <select
          className="search-inline-select floor-select"
          value={floorId || ""}
          onChange={handleFloorChange}
          aria-label="Select Floor"
        >
          <option value="">Select Floor</option>
          {floors.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
        <svg className="search-select-arrow" width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 1l4 4 4-4" />
        </svg>
      </div>
    </div>
  );
}
