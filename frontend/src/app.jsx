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
  const [prevPage, setPrevPage]         = useState("home");
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
    setPrevPage(prev => (p === page ? prev : page));
    setPage(p);
  }

  // Used by sub-page back buttons so they always return to the screen the user
  // actually came from instead of a hard-coded default.
  function goBack(fallback = "home") {
    setPage(prevPage && prevPage !== page ? prevPage : fallback);
  }

  // Called by Search when user taps "Get directions"
  // Search sends { destination, route } — both stored separately
  async function selectDestination({ destination, route }) {
    setDestination(destination);
    setRoute(route);
    setPrevPage(page);
    setPage("map");

    // If the caller didn't compute a route (e.g. Quick Find / Recent), fetch it now
    if (destination && !route && userLocation?.id && destination.id && userLocation.id !== destination.id) {
      try {
        const res = await fetch(`${API_BASE}/route`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fromRoomId: userLocation.id,
            toRoomId:   destination.id,
          }),
        });
        const json = await res.json();
        if (json.success && json.data) setRoute(json.data);
      } catch (err) {
        console.error("Auto-route fetch failed:", err);
      }
    }
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
            onBack={() => goBack("home")}
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
            onBack={() => goBack("home")}
          />
        )}

        <BottomNav current={page} onChange={goTo} />
      </div>
    </div>
  );
}
