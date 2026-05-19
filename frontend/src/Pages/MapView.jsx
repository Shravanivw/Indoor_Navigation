import StatusBar from "../components/StatusBar";
import TopBar from "../components/TopBar";
import FloorMap from "../components/FloorMap";
import { routeSteps } from "../data/locations";
import "../css/MapView.css";

export default function MapView({ destination, userLocation, onBack }) {
  const userLocationText =
    typeof userLocation === "string"
      ? userLocation
      : userLocation
      ? `${userLocation.name}${userLocation.floor ? ` — Floor ${userLocation.floor}` : ""}`
      : "Unknown";

  return (
    <div className="map-page">
      <StatusBar />
      <TopBar
        title={destination ? `Route to ${destination.name}` : "Map"}
        subtitle={`From ${userLocationText}`}
        onBack={onBack}
      />
      <div className="map-canvas">
        <FloorMap destination={destination} />
      </div>
      <div className="route-sheet">
        <div className="route-sheet-handle" />
        <div className="route-sheet-inner">
          <div className="route-dest-row">
            <div className="route-dest-info">
              <div className="route-dest-label">Navigating to</div>
              <div className="route-dest-name">{destination?.name || "Destination"}</div>
              <div className="route-dest-sub">
                Floor {destination?.floor}{destination?.seats ? ` · ${destination.seats} seats` : ""}
              </div>
            </div>
            {destination?.status && (
              <div className={`route-dest-badge ${destination.status === "Available" ? "green" : "gray"}`}>
                {destination.status}
              </div>
            )}
          </div>

          <div className="route-stats">
            <div className="route-stat"><div className="rs-val">3 min</div><div className="rs-lbl">Est. time</div></div>
            <div className="route-stat"><div className="rs-val">180 m</div><div className="rs-lbl">Distance</div></div>
            <div className="route-stat"><div className="rs-val">0</div><div className="rs-lbl">Floor changes</div></div>
          </div>

          <div className="route-steps">
            {routeSteps.map(s => (
              <div key={s.step} className="route-step">
                <div className="step-num">{s.step}</div>
                <div>
                  <div className="step-text">{s.text}</div>
                  <div className="step-dist">{s.dist}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}