import StatusBar from "../components/StatusBar";
import TopBar from "../components/TopBar";
import FloorMap from "../components/FloorMap";
import "../css/MapView.css";

// Format seconds into "X min" or "< 1 min"
function formatTime(seconds) {
  if (!seconds) return "—";
  const mins = Math.round(seconds / 60);
  return mins < 1 ? "< 1 min" : `${mins} min`;
}

// Format metres into "Xm" or "X.Xm"
function formatDist(metres) {
  if (!metres) return "—";
  return `${Math.round(metres)} m`;
}

export default function MapView({ destination, userLocation, route, onBack }) {
  const userLocationText =
    typeof userLocation === "string"
      ? userLocation
      : userLocation
      ? `${userLocation.name}${userLocation.floor ? ` — Floor ${userLocation.floor?.level ?? userLocation.floor}` : ""}`
      : "Unknown";

  // Use real route data if available, fall back to placeholders
  const estimatedTime  = route ? formatTime(route.estimatedSeconds) : "—";
  const totalDist      = route ? formatDist(route.totalDistanceM)   : "—";
  const floorChanges   = route ? route.floorChanges                 : 0;
  const steps          = route?.steps ?? [];
  const pathGridCells  = route?.pathGridCells ?? [];

  return (
    <div className="map-page">
      <StatusBar />
      <TopBar
        title={destination ? `Route to ${destination.name}` : "Map"}
        subtitle={`From ${userLocationText}`}
        onBack={onBack}
      />

      <div className="map-canvas">
        {/* Pass real path coordinates to FloorMap so it draws the blue line */}
        <FloorMap
          destination={destination}
          pathGridCells={pathGridCells}
        />
      </div>

      <div className="route-sheet">
        <div className="route-sheet-handle" />
        <div className="route-sheet-inner">

          {/* Destination info */}
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

          {/* Route stats — real data from API */}
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

          {/* Turn-by-turn steps — real data from API */}
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

        </div>
      </div>
    </div>
  );
}
