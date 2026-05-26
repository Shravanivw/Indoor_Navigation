import { useState, useEffect, useMemo } from "react";
import StatusBar from "../components/StatusBar";
import TopBar from "../components/TopBar";
import FloorMap from "../components/FloorMap";
import Walk3D from "../components/Walk3D";
import useDeadReckoning from "../hooks/useDeadReckoning";
import "../css/MapView.css";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3001/api/v1";
const FLOOR_ID = "floor-gf";

function formatTime(seconds) {
  if (!seconds) return "—";
  const mins = Math.round(seconds / 60);
  return mins < 1 ? "< 1 min" : `${mins} min`;
}

function formatDist(metres) {
  if (!metres) return "—";
  return `${Math.round(metres)} m`;
}

export default function MapView({ destination, userLocation, route, routeLoading, onBack }) {
  const [mapData, setMapData]   = useState(null);
  const [view3D, setView3D]     = useState(false);
  const [tracking, setTracking] = useState(false);

  // ✅ Fetch real floor map from backend
  useEffect(() => {
    async function loadMap() {
      try {
        const res  = await fetch(`${API_BASE}/floors/${FLOOR_ID}/map`);
        const json = await res.json();
        if (json.success) setMapData(json.data);
      } catch (err) {
        console.error("Failed to load map:", err);
      }
    }
    loadMap();
  }, []);

  const userLocationText =
    typeof userLocation === "string"
      ? userLocation
      : userLocation
      ? `${userLocation.name}${userLocation.floor ? ` — Floor ${userLocation.floor?.level ?? userLocation.floor}` : ""}`
      : "Unknown";

  const estimatedTime = route ? formatTime(route.estimatedSeconds) : "—";
  const totalDist     = route ? formatDist(route.totalDistanceM)   : "—";
  const floorChanges  = route ? route.floorChanges                 : 0;
  const steps         = route?.steps        ?? [];
  const pathGridCells = route?.pathGridCells ?? [];

  // ── Dead-reckoning live tracking ─────────────────────────────────────────
  // Compute the user's known grid cell from their current room (if any).
  const userCell = useMemo(() => {
    if (!userLocation) return null;
    if (typeof userLocation.gridX === "number" && typeof userLocation.gridY === "number") {
      return {
        gx: userLocation.gridX + (userLocation.gridW ?? 1) / 2,
        gy: userLocation.gridY + (userLocation.gridH ?? 1) / 2,
      };
    }
    return null;
  }, [userLocation]);

  const dr = useDeadReckoning({
    initialGridX: userCell?.gx ?? 0,
    initialGridY: userCell?.gy ?? 0,
    scaleX: mapData?.scaleX ?? 1,
    scaleY: mapData?.scaleY ?? 1,
    enabled: tracking,
  });

  // Snap dead-reckoning origin whenever a QR scan changes userLocation,
  // cancelling accumulated drift every time the user passes a QR sticker.
  useEffect(() => {
    if (userCell) dr.recalibrate(userCell.gx, userCell.gy);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userCell?.gx, userCell?.gy]);

  async function toggleTracking() {
    if (tracking) { setTracking(false); return; }
    const ok = await dr.requestPermission();
    if (ok) setTracking(true);
  }

  return (
    <div className="map-page">
      <StatusBar />
      <TopBar
        title={destination ? `Route to ${destination.name}` : "Map"}
        subtitle={`From ${userLocationText}`}
        onBack={onBack}
      />

      <div className="map-canvas">
        {/* Bird's eye / 3D walkthrough render branch */}
        {view3D ? (
          <Walk3D
            floorMap={mapData}
            destination={destination}
            pathGridCells={pathGridCells}
            userRoom={userLocation}
            livePosition={tracking ? dr.position : null}
          />
        ) : (
          <FloorMap
            destination={destination}
            userLocation={userLocation}
            pathGridCells={pathGridCells}
            livePosition={tracking ? dr.position : null}
            heading={tracking ? dr.heading : null}
            rooms={
              route && (userLocation || destination)
                ? (mapData?.rooms ?? []).filter(
                    r => r.id === destination?.id || r.id === userLocation?.id
                  )
                : (mapData?.rooms ?? [])
            }
            gridCols={mapData?.gridCols ?? 80}
            gridRows={mapData?.gridRows ?? 80}
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
        <button
          type="button"
          className={`map-track-toggle ${tracking ? "on" : ""}`}
          onClick={toggleTracking}
          aria-pressed={tracking}
          title={tracking ? "Stop live tracking" : "Start live tracking using phone sensors"}
        >
          {tracking ? `● Live · ${dr.steps} steps` : "Track me"}
        </button>

        {tracking && dr.status === "denied" && (
          <div className="map-track-warn">
            Sensor permission denied — tap "Track me" again to retry.
          </div>
        )}
        {tracking && dr.status === "unsupported" && (
          <div className="map-track-warn">
            This device doesn't expose motion sensors.
          </div>
        )}
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