import { useState, useEffect, useMemo } from "react";
import TopBar from "../components/TopBar";
import FloorMap from "../components/FloorMap";
import Walk3D from "../components/Walk3D";
import BuildingChips from "../components/BuildingChips";
import "../css/MapView.css";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3001/api/v1";
const DEFAULT_FLOOR_ID = "floor-gf";

function formatDist(metres) {
  if (!metres) return "—";
  return `${Math.round(metres)} m`;
}

export default function MapView({ destination, userLocation, route, routeLoading, buildings, buildingId, onSelectBuilding, onBack }) {
  const [mapData, setMapData]   = useState(null);
  const [view3D, setView3D]     = useState(false);

  const floorId = destination?.floor?.id ?? userLocation?.floor?.id ?? DEFAULT_FLOOR_ID;

  // Fetch real floor map from backend
  useEffect(() => {
    async function loadMap() {
      try {
        const res  = await fetch(`${API_BASE}/floors/${encodeURIComponent(floorId)}/map`);
        const json = await res.json();
        if (json.success) setMapData(json.data);
      } catch (err) {
        console.error("Failed to load map:", err);
      }
    }
    loadMap();
  }, [floorId]);

  const userLocationText =
    typeof userLocation === "string"
      ? userLocation
      : userLocation
      ? `${userLocation.name}${userLocation.floor ? ` — Floor ${userLocation.floor?.level ?? userLocation.floor}` : ""}`
      : "Unknown";

  const totalDist     = route ? formatDist(route.totalDistanceM)   : "—";
  const floorChanges  = route ? route.floorChanges                 : 0;
  const steps         = route?.steps        ?? [];
  const pathGridCells = route?.pathGridCells ?? [];

  return (
    <div className="map-page">
      <TopBar
        title={destination ? `Route to ${destination.name}` : "Map"}
        subtitle={`From ${userLocationText}`}
        onBack={onBack}
      />
      <BuildingChips
        buildings={buildings}
        buildingId={buildingId}
        onSelectBuilding={onSelectBuilding}
      />

      <div className="map-canvas">
        {/* Bird's eye / 3D walkthrough render branch */}
        {view3D ? (
          <Walk3D
            floorMap={mapData}
            destination={destination}
            pathGridCells={pathGridCells}
            userRoom={userLocation}
            livePosition={null}
          />
        ) : (
          <FloorMap
            destination={destination}
            userLocation={userLocation}
            pathGridCells={pathGridCells}
            livePosition={null}
            heading={null}
            rooms={mapData?.rooms ?? []}
            gridCols={mapData?.gridCols ?? 80}
            gridRows={mapData?.gridRows ?? 80}
            graphNodes={mapData?.nodes ?? []}
            graphEdges={mapData?.edges ?? []}
          />
        )}

        {/* View toggle: bird's eye ↔ first-person 3D walkthrough */}
        <button
          type="button"
          className="map-view-toggle"
          onClick={() => setView3D(v => !v)}
          aria-pressed={view3D}
          title={view3D ? "Switch to bird's eye view" : "Switch to 3D walkthrough"}
        >
          {view3D ? "Bird's eye" : "3D walk"}
        </button>

        {/* Live tracking toggle (dead-reckoning via phone sensors) */}
      </div>

      <div className="route-sheet">
        <div className="route-sheet-handle" />
        <div className="route-sheet-inner">

          {routeLoading && (
            <div style={{ textAlign: "center", padding: "20px 0", color: "#6b7280", fontSize: 13 }}>
              Calculating route…
            </div>
          )}

          {!routeLoading && (
            <>
              <div className="route-dest-row">
                <div className="route-dest-info">
                  <div className="route-dest-label">Navigating to</div>
                  <div className="route-dest-name">{destination?.name || "Destination"}</div>
                  <div className="route-dest-sub">
                    Floor {destination?.floor?.level ?? destination?.floor ?? "G"}
                    {destination?.capacity ? ` · ${destination.capacity} seats` : ""}
                  </div>
                </div>
                {destination?.isAccessible === false && (
                  <div className="route-dest-badge gray">Not accessible</div>
                )}
              </div>

              <div className="route-stats">
                <div className="route-stat">
                  <div className="rs-val">{totalDist}</div>
                  <div className="rs-lbl">Distance</div>
                </div>
                <div className="route-stat">
                  <div className="rs-val">{floorChanges}</div>
                  <div className="rs-lbl">Floor changes</div>
                </div>
              </div>

              <div className="route-steps">
                {steps.length === 0 && (
                  <div style={{ color: "#9ca3af", fontSize: 12, padding: "8px 0" }}>
                    {route ? "No steps available." : "No route computed."}
                  </div>
                )}
                {steps.map((s, i) => (
                  <div key={i} className="route-step">
                    <div className="step-num">{i + 1}</div>
                    <div>
                      <div className="step-text">{s.instruction}</div>
                      {s.distanceM > 0 && (
                        <div className="step-dist">{formatDist(s.distanceM)}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}