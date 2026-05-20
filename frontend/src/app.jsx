import { useState, useEffect } from "react";
import Home from "./Pages/Home";
import Search from "./Pages/Search";
import MapView from "./Pages/MapView";
import BottomNav from "./components/BottomNav";
import "./app.css";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3001/api/v1";

// Default starting location — replaced the moment a QR code is scanned
const DEFAULT_LOCATION_ID = "room-gf-reception";

export default function App() {
  const [page, setPage]                 = useState("home");
  const [destination, setDestination]   = useState(null);
  const [route, setRoute]               = useState(null);
  const [userLocation, setUserLocation] = useState(null);

  // Load the default user location from the API on startup
  useEffect(() => {
    async function loadDefaultLocation() {
      try {
        const res  = await fetch(`${API_BASE}/rooms/${DEFAULT_LOCATION_ID}`);
        const json = await res.json();
        if (json.success && json.data) {
          setUserLocation(json.data);
        }
      } catch (err) {
        console.error("Could not load default location:", err);
        // Fallback so the app still renders if the backend is unreachable
        setUserLocation({ id: DEFAULT_LOCATION_ID, name: "Reception", floor: { level: "G" } });
      }
    }
    loadDefaultLocation();
  }, []);

  // QR code handler — reads ?qr=LOC-GF-BOARDROOM from the URL
  // Fires when a user scans a physical QR sticker placed in the office
  useEffect(() => {
    async function handleQRParam() {
      const params = new URLSearchParams(window.location.search);
      const qrCode = params.get("qr");
      if (!qrCode) return;

      try {
        const res  = await fetch(`${API_BASE}/rooms/qr/${encodeURIComponent(qrCode)}`);
        const json = await res.json();
        if (json.success && json.data) {
          setUserLocation(json.data);
          setPage("search"); // take them straight to Search to pick a destination
        }
      } catch (err) {
        console.error("QR lookup failed:", err);
      }

      // Clean the URL so a refresh does not re-trigger
      window.history.replaceState({}, "", "/");
    }
    handleQRParam();
  }, []);

  function goTo(p) {
    setPage(p);
  }

  // Called by Search when user taps "Get directions"
  // Search sends { destination, route } — both stored separately
  function selectDestination({ destination, route }) {
    setDestination(destination);
    setRoute(route);
    setPage("map");
  }

  // Called by QR scanner page when user confirms their location
  function confirmLocation(loc) {
    setUserLocation(loc);
    setPage("home");
  }

  return (
    <div className="app-shell">
      <div className="app-screen">

        {page === "home" && (
          <Home
            userLocation={userLocation}
            onSearch={() => goTo("search")}
            onSelectQuick={(loc) => selectDestination({ destination: loc, route: null })}
            onSelectRecent={(loc) => selectDestination({ destination: loc, route: null })}
          />
        )}

        {page === "search" && (
          <Search
            userLocation={userLocation}
            onBack={() => goTo("home")}
            onSelectDestination={selectDestination}
          />
        )}

        {page === "qr" && (
          // Uncomment the ScanQR import and component when the QR page is ready
          <div style={{ padding: 24, color: "#9ca3af", fontSize: 13 }}>
            QR scanner coming soon.
          </div>
        )}

        {page === "map" && (
          <MapView
            destination={destination}
            userLocation={userLocation}
            route={route}
            onBack={() => goTo("search")}
          />
        )}

        <BottomNav current={page} onChange={goTo} />
      </div>
    </div>
  );
}
