import { useState, useEffect, useMemo, useCallback } from "react";
import TopBar from "../components/TopBar";
import FloorMap from "../components/FloorMap";
import Walk3D from "../components/Walk3D";
import Compass from "../components/Compass";
import useDeviceOrientation from "../hooks/useDeviceOrientation";
import { enrichStepsWithOrientation } from "../utils/orientationUtils";
import "../css/MapView.css";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3001/api/v1";
const DEFAULT_FLOOR_ID = "floor-hudson-f5";

function formatDist(metres) {
  if (!metres) return "—";
  return `${Math.round(metres)} m`;
}

export default function MapView({ destination, userLocation, route, routeLoading, buildings, buildingId, selectedFloorId, onSelectBuilding, onSelectRoom, onBack }) {
  const [mapData, setMapData]             = useState(null);
  const [view3D, setView3D]               = useState(false);
  const [cameraHeading, setCameraHeading] = useState(0);

  const floorId = selectedFloorId ?? destination?.floor?.id ?? userLocation?.floor?.id ?? DEFAULT_FLOOR_ID;

  // Track mobile device physical orientation sensors with desktop fallback
  const {
    heading: sensorHeading,
    isSensorActive,
    isPermissionRequired,
    permissionGranted,
    requestPermission,
  } = useDeviceOrientation({
    enabled: true,
    fallbackHeading: view3D ? cameraHeading : 0,
  });

  // Effective compass heading: uses physical phone sensor when active, or falls back to desktop map/camera heading
  const activeHeading = isSensorActive ? sensorHeading : (view3D ? cameraHeading : 0);

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
  const rawSteps      = route?.steps ?? [];

  // Enrich steps with cardinal orientation headings (North, East, South, West)
  const steps = useMemo(() => {
    return enrichStepsWithOrientation(rawSteps, {
      userHeading: isSensorActive ? sensorHeading : null,
    });
  }, [rawSteps, isSensorActive, sensorHeading]);

  const pathGridCells = useMemo(() => route?.pathGridCells ?? [], [route?.pathGridCells]);

  const handleCameraHeading = useCallback((deg) => {
    setCameraHeading(deg);
  }, []);

  return (
    <div className="map-page">
      <TopBar
        title={destination ? `Route to ${destination.name}` : "Map"}
        subtitle={`From ${userLocationText}`}
        onBack={onBack}
      />
      <div className="map-canvas">
        {/* Top-Right Google Maps Style Orientation Indicator Overlay (positioned below Zoom controls in 2D & Speed button in 3D) */}
        <div style={{ position: "absolute", top: view3D ? 50 : 108, right: 12, zIndex: 30, transition: "top 0.2s ease" }}>
          <Compass
            heading={activeHeading}
            isSensorActive={isSensorActive}
            isPermissionRequired={isPermissionRequired}
            permissionGranted={permissionGranted}
            onRequestPermission={requestPermission}
            onResetOrientation={() => setCameraHeading(0)}
            size="md"
          />
        </div>

        {/* Bird's eye / 3D walkthrough render branch */}
        {view3D ? (
          <Walk3D
            floorMap={mapData}
            destination={destination}
            pathGridCells={pathGridCells}
            userRoom={userLocation}
            livePosition={null}
            onCameraHeadingChange={handleCameraHeading}
          />
        ) : (
          <FloorMap
            destination={destination}
            userLocation={userLocation}
            pathGridCells={pathGridCells}
            pathNodeIds={route?.pathNodeIds ?? []}
            livePosition={null}
            heading={activeHeading}
            rooms={mapData?.rooms ?? []}
            gridCols={mapData?.gridCols ?? 80}
            gridRows={mapData?.gridRows ?? 80}
            graphNodes={mapData?.nodes ?? []}
            graphEdges={mapData?.edges ?? []}
            onSelectRoom={onSelectRoom}
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
                      <div className="step-text">{s.orientationInstruction || s.instruction}</div>
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