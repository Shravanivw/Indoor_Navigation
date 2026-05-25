import { useState, useEffect } from "react";
import Home from "./Pages/Home";
import Search from "./Pages/Search";
import MapView from "./Pages/MapView";
import BottomNav from "./components/BottomNav";
import "./app.css";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3001/api/v1";
const DEFAULT_LOCATION_ID = "room-gf-reception";

export default function App() {
  const [page, setPage]               = useState("home");
  const [destination, setDestination] = useState(null);
  const [route, setRoute]             = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);

  // Load default location on startup
  useEffect(() => {
    async function loadDefaultLocation() {
      try {
        const res  = await fetch(`${API_BASE}/rooms/${DEFAULT_LOCATION_ID}`);
        const json = await res.json();
        if (json.success && json.data) setUserLocation(json.data);
      } catch {
        setUserLocation({ id: DEFAULT_LOCATION_ID, name: "Reception", floor: { level: "G" } });
      }
    }
    loadDefaultLocation();
  }, []);

  // Handle QR code scan from URL
  useEffect(() => {
    async function handleQRParam() {
      const params = new URLSearchParams(window.location.search);
      const qrCode = params.get("qr") || params.get("location");
      if (!qrCode) return;

      try {
        // Try QR endpoint first, then by code
        const res  = await fetch(`${API_BASE}/rooms/qr/${encodeURIComponent(qrCode)}`);
        const json = await res.json();
        if (json.success && json.data) {
          setUserLocation(json.data);
          setPage("search");
        }
      } catch (err) {
        console.error("QR lookup failed:", err);
      }
      window.history.replaceState({}, "", "/");
    }
    handleQRParam();
  }, []);

  // ✅ Fetch route from backend
  async function fetchRoute(fromRoom, toRoom) {
    if (!fromRoom || !toRoom) return null;
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

  // Called by Search when user taps "Get directions"
  function selectDestination({ destination, route }) {
    setDestination(destination);
    setRoute(route);
    setPage("map");
  }

  // Called by Quick Find and Recent — fetch route automatically
  async function selectDestinationWithRoute(dest) {
    setDestination(dest);
    setPage("map");
    const fetchedRoute = await fetchRoute(userLocation, dest);
    setRoute(fetchedRoute);
  }

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
            onSearch={() => setPage("search")}
            onSelectQuick={selectDestinationWithRoute}
            onSelectRecent={selectDestinationWithRoute}
          />
        )}

        {page === "search" && (
          <Search
            userLocation={userLocation}
            onBack={() => setPage("home")}
            onSelectDestination={selectDestination}
          />
        )}

        {page === "map" && (
          <MapView
            destination={destination}
            userLocation={userLocation}
            route={route}
            routeLoading={routeLoading}
            onBack={() => setPage("search")}
          />
        )}

        <BottomNav current={page} onChange={setPage} />
      </div>
    </div>
  );
}