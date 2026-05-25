import { useEffect, useMemo, useState } from "react";
import StatusBar from "../components/StatusBar";
import TopBar from "../components/TopBar";
import FloorMap from "../components/FloorMap";
import Walk3D from "../components/Walk3D";
import "../css/MapView.css";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3001/api/v1";
const DEFAULT_FLOOR_ID = "floor-gf";

function formatTime(seconds) {
  if (!seconds) return "—";
  const mins = Math.round(seconds / 60);
  return mins < 1 ? "< 1 min" : `${mins} min`;
}

function formatDist(metres) {
  if (!metres) return "—";
  return `${Math.round(metres)} m`;
}

export default function MapView({ destination, userLocation, route: routeProp, onBack }) {
  const [floorMap, setFloorMap] = useState(null);
  const [mapError, setMapError] = useState(null);
  const [route,    setRoute]    = useState(routeProp || null);
  const [view3D,   setView3D]   = useState(false);
  const [stepsOpen, setStepsOpen] = useState(false);
  // Keep local route in sync when the parent passes a new one
  useEffect(() => { setRoute(routeProp || null); }, [routeProp]);

  const floorId = useMemo(() => {
    if (destination?.floor?.id) return destination.floor.id;
    if (userLocation?.floor?.id) return userLocation.floor.id;
    return DEFAULT_FLOOR_ID;
  }, [destination, userLocation]);

  // Fetch floor map (grid + rooms) from backend
  useEffect(() => {
    let cancelled = false;
    setMapError(null);

    async function loadFloorMap() {
      try {
        const res  = await fetch(`${API_BASE}/floors/${encodeURIComponent(floorId)}/map`);
        const json = await res.json();
        if (!cancelled) {
          if (json.success && json.data) {
            setFloorMap(json.data);
          } else {
            setMapError(json.error || "Failed to load floor map.");
          }
        }
      } catch {
        if (!cancelled) setMapError("Cannot reach backend. Is it running?");
      }
    }

    loadFloorMap();
    return () => { cancelled = true; };
  }, [floorId]);

  // Auto-fetch route if we have a destination and user location but no route yet
  useEffect(() => {
    let cancelled = false;
    if (!destination?.id || !userLocation?.id) return;
    if (route?.pathGridCells?.length) return;
    if (userLocation.id === destination.id) return;

    (async () => {
      try {
        const res  = await fetch(`${API_BASE}/route`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fromRoomId: userLocation.id,
            toRoomId:   destination.id,
          }),
        });
        const json = await res.json();
        if (!cancelled && json.success && json.data) setRoute(json.data);
      } catch {
        /* silent: user already sees mapError if backend is down */
      }
    })();
    return () => { cancelled = true; };
  }, [destination, userLocation, route]);

  const userLocationText =
    typeof userLocation === "string"
      ? userLocation
      : userLocation
      ? `${userLocation.name}${userLocation.floor ? ` — Floor ${userLocation.floor?.level ?? userLocation.floor}` : ""}`
      : "Unknown";

  const estimatedTime = route ? formatTime(route.estimatedSeconds) : "—";
  const totalDist     = route ? formatDist(route.totalDistanceM)   : "—";
  const floorChanges  = route ? route.floorChanges                 : 0;
  const steps         = route?.steps         ?? [];
  const pathGridCells = route?.pathGridCells ?? [];

  return (
    <div className="map-page">
      <StatusBar />
      <TopBar
        title={destination ? `Route to ${destination.name}` : "Map"}
        subtitle={`From ${userLocationText}`}
        onBack={onBack}
      />

      <div className="map-canvas">
        {mapError && (
          <div style={{ color: "#b42318", fontSize: 12, padding: "8px 12px" }}>
            {mapError}
          </div>
        )}
        {view3D ? (
          <Walk3D
            floorMap={floorMap}
            destination={destination}
            pathGridCells={pathGridCells}
            userRoom={userLocation}
          />
        ) : (
          <FloorMap
            floorMap={floorMap}
            destination={destination}
            pathGridCells={pathGridCells}
            userRoom={userLocation}
          />
        )}

        {/* View toggle: bird's eye <-> first-person 3D walkthrough */}
        <button
          type="button"
          className="map-view-toggle"
          onClick={() => setView3D(v => !v)}
          aria-pressed={view3D}
          title={view3D ? "Switch to bird's eye view" : "Switch to 3D walkthrough"}
        >
          {view3D ? "Bird’s eye" : "3D walk"}
        </button>
      </div>

      <div className="route-sheet">
        <div className="route-sheet-handle" />
        <div className="route-sheet-inner">

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
              <div className="rs-val">{estimatedTime}</div>
              <div className="rs-lbl">Est. time</div>
            </div>
            <div className="route-stat">
              <div className="rs-val">{totalDist}</div>
              <div className="rs-lbl">Distance</div>
            </div>
            <div className="route-stat">
              <div className="rs-val">{floorChanges}</div>
              <div className="rs-lbl">Floor changes</div>
            </div>
          </div>

          <div className={`route-steps-section ${stepsOpen ? "open" : ""}`}>
            <button
              type="button"
              className="route-steps-toggle"
              onClick={() => setStepsOpen(o => !o)}
              aria-expanded={stepsOpen}
            >
              <span>Directions {steps.length > 0 && `(${steps.length} step${steps.length === 1 ? "" : "s"})`}</span>
              <span className="route-steps-chevron" aria-hidden="true">{stepsOpen ? "▾" : "▸"}</span>
            </button>

            {stepsOpen && (
              <div className="route-steps">
                {steps.length === 0 && (
                  <div style={{ color: "#9ca3af", fontSize: 12, padding: "8px 0" }}>
                    {destination ? "Finding route…" : "Pick a destination to see directions."}
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
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
