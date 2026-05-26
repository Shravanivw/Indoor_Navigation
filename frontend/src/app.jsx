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
  const [page, setPage]                   = useState("home");
  const [prevPage, setPrevPage]           = useState("home");
  const [destination, setDestination]     = useState(null);
  const [route, setRoute]                 = useState(null);
  const [routeLoading, setRouteLoading]   = useState(false);
  const [userLocation, setUserLocation]   = useState(null);

  // Load the default user location from the API on startup
  useEffect(() => {
    async function loadDefaultLocation() {
      try {
        const res  = await fetch(`${API_BASE}/rooms/${DEFAULT_LOCATION_ID}`);
        const json = await res.json();
        if (json.success && json.data) {
          setUserLocation(json.data);
        }
      } catch {
        // Fallback so the app still renders if the backend is unreachable
        setUserLocation({ id: DEFAULT_LOCATION_ID, name: "Reception", floor: { level: "G" } });
      }
    }
    loadDefaultLocation();
  }, []);

  // QR code handler — reads ?qr=LOC-GF-BOARDROOM (or ?location=…) from the URL.
  // Fires when a user scans a physical QR sticker placed in the office.
  // Resolves the room (including "Reception") and sets it as the start location.
  useEffect(() => {
    async function handleQRParam() {
      const params = new URLSearchParams(window.location.search);
      const qrCode = params.get("qr") || params.get("location");
      if (!qrCode) return;

      try {
        const res  = await fetch(`${API_BASE}/rooms/qr/${encodeURIComponent(qrCode)}`);
        const json = await res.json();
        if (json.success && json.data) {
          setUserLocation(json.data);   // set scanned room as start location
          setPage("search");            // take them straight to Search to pick a destination
        }
      } catch (err) {
        console.error("QR lookup failed:", err);
      }

      // Clean the URL so a refresh does not re-trigger
      window.history.replaceState({}, "", "/");
    }
    handleQRParam();
  }, []);

  // Navigate to a page, tracking where the user came from for back-button support
  function goTo(p) {
    setPrevPage(prev => (p === page ? prev : page));
    setPage(p);
  }

  // Used by sub-page back buttons so they always return to the screen the user
  // actually came from instead of a hard-coded default.
  function goBack(fallback = "home") {
    setPage(prevPage && prevPage !== page ? prevPage : fallback);
  }

  // ✅ Fetch route from backend, with loading state
  async function fetchRoute(fromRoom, toRoom) {
    if (!fromRoom?.id || !toRoom?.id || fromRoom.id === toRoom.id) return null;
    try {
      setRouteLoading(true);
      const res  = await fetch(`${API_BASE}/route`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromRoomId: fromRoom.id,
          toRoomId:   toRoom.id,
        }),
      });
      const json = await res.json();
      return json.success ? json.data : null;
    } catch (err) {
      console.error("Route fetch failed:", err);
      return null;
    } finally {
      setRouteLoading(false);
    }
  }

  // Called by Search when user taps "Get directions".
  // Search may pass a pre-computed route; if not, fetch it here.
  async function selectDestination({ destination, route }) {
    setDestination(destination);
    setRoute(route ?? null);
    setPrevPage(page);
    setPage("map");

    if (!route && destination?.id && userLocation?.id && userLocation.id !== destination.id) {
      const fetchedRoute = await fetchRoute(userLocation, destination);
      setRoute(fetchedRoute);
    }
  }

  // Called by Quick Find / Recent — always fetches the route automatically
  async function selectDestinationWithRoute(dest) {
    setDestination(dest);
    setRoute(null);
    setPrevPage(page);
    setPage("map");
    const fetchedRoute = await fetchRoute(userLocation, dest);
    setRoute(fetchedRoute);
  }

  // Called by QR scanner page when user confirms their location
  function confirmLocation(loc) {
    setUserLocation(loc);
    goTo("home");
  }

  return (
    <div className="app-shell">
      <div className="app-screen">

        {page === "home" && (
          <Home
            userLocation={userLocation}
            onSearch={() => goTo("search")}
            onSelectQuick={selectDestinationWithRoute}
            onSelectRecent={selectDestinationWithRoute}
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
            routeLoading={routeLoading}
            onBack={() => goBack("search")}
          />
        )}

        <BottomNav current={page} onChange={goTo} />
      </div>
    </div>
  );
}