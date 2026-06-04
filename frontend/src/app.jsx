import { useState, useEffect } from "react";
import Home from "./Pages/Home";
import Search from "./Pages/Search";
import MapView from "./Pages/MapView";
import BottomNav from "./components/BottomNav";
import "./app.css";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3001/api/v1";

const BUILDING_STORAGE_KEY = "indoorNav.buildingId";
const RECENTS_KEY          = "indoorNav.recentDestinations";
const MAX_RECENTS          = 5;

function saveRecentDestination(dest) {
  if (!dest?.id) return;
  try {
    const stored  = JSON.parse(localStorage.getItem(RECENTS_KEY) || "[]");
    const updated = [dest, ...stored.filter(r => r.id !== dest.id)].slice(0, MAX_RECENTS);
    localStorage.setItem(RECENTS_KEY, JSON.stringify(updated));
  } catch {}
}

export default function App() {
  const [page, setPage]                   = useState("home");
  const [prevPage, setPrevPage]           = useState("home");
  const [destination, setDestination]     = useState(null);
  const [route, setRoute]                 = useState(null);
  const [routeLoading, setRouteLoading]   = useState(false);
  const [userLocation, setUserLocation]   = useState(null);

  // Multi-building state
  const [buildings, setBuildings]   = useState([]);
  const [buildingId, setBuildingId] = useState(() => localStorage.getItem(BUILDING_STORAGE_KEY) || null);
  const [floorId, setFloorId]       = useState(null);

  // Load buildings list once
  useEffect(() => {
    (async () => {
      try {
        const res  = await fetch(`${API_BASE}/buildings`);
        const json = await res.json();
        if (json.success && Array.isArray(json.data) && json.data.length) {
          setBuildings(json.data);
          if (!buildingId || !json.data.some(b => b.id === buildingId)) {
            setBuildingId(json.data[0].id);
          }
        }
      } catch (err) {
        console.error("Failed to load buildings:", err);
      }
    })();
  }, []);

  // When building changes: persist, fetch its first floor, then default the
  // user location to that floor's Reception (or first room) so routing stays
  // within the active building.
  useEffect(() => {
    if (!buildingId) return;
    localStorage.setItem(BUILDING_STORAGE_KEY, buildingId);
    let cancelled = false;
    (async () => {
      try {
        const floorsRes = await fetch(`${API_BASE}/buildings/${buildingId}/floors`);
        const floorsJson = await floorsRes.json();
        if (!floorsJson.success || !floorsJson.data?.length) return;
        const firstFloorId = floorsJson.data[0].id;
        if (cancelled) return;
        setFloorId(firstFloorId);

        const mapRes = await fetch(`${API_BASE}/floors/${firstFloorId}/map`);
        const mapJson = await mapRes.json();
        if (cancelled || !mapJson.success || !mapJson.data?.rooms?.length) return;
        const rooms = mapJson.data.rooms;
        const reception = rooms.find(r => r.type === "RECEPTION") ?? rooms[0];
        setUserLocation(reception);
        setDestination(null);
        setRoute(null);
      } catch (err) {
        console.error("Failed to load default location for building:", err);
      }
    })();
    return () => { cancelled = true; };
  }, [buildingId]);

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
          // Switch active building to wherever the QR-scanned room lives
          if (json.data.floor?.buildingId && json.data.floor.buildingId !== buildingId) {
            setBuildingId(json.data.floor.buildingId);
          }
          if (json.data.floor?.id) setFloorId(json.data.floor.id);
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
    saveRecentDestination(destination);
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
    if (!dest) return;
    saveRecentDestination(dest);
    const destFloorId = dest.floor?.id ?? dest.floorId;
    const userFloorId = userLocation?.floor?.id ?? userLocation?.floorId;
    if (destFloorId && userFloorId && destFloorId !== userFloorId) {
      console.warn('Cross-floor destination ignored:', dest.name);
      return;
    }
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
            buildings={buildings}
            buildingId={buildingId}
            onSelectBuilding={setBuildingId}
            floorId={floorId}
            onSearch={() => goTo("search")}
            onSelectQuick={selectDestinationWithRoute}
            onSelectRecent={selectDestinationWithRoute}
          />
        )}

        {page === "search" && (
          <Search
            userLocation={userLocation}
            floorId={floorId}
            buildings={buildings}
            buildingId={buildingId}
            onSelectBuilding={setBuildingId}
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
            buildings={buildings}
            buildingId={buildingId}
            onSelectBuilding={setBuildingId}
            onBack={() => goBack("search")}
          />
        )}

        <BottomNav current={page} onChange={goTo} />
      </div>
    </div>
  );
}