import { useState, useEffect } from "react";
import Home from "./Pages/Home";
import Search from "./Pages/Search";
// import ScanQR from "./Pages/ScanQR"; // Uncomment if needed
import MapView from "./Pages/MapView";
import BottomNav from "./components/BottomNav";
import "./app.css";

// ✅ Make sure you have this defined or imported
// Example structure:
// const locations = [
//   { code: "L1F5", name: "Lift 1 — Floor 5" },
// ];

import { locations } from "./data/locations"; // adjust path if needed

// Default starting location (used until a QR is scanned)
const DEFAULT_LOCATION_CODE = "FF5";

export default function App() {
  const [page, setPage] = useState("home");
  const [destination, setDestination] = useState(null);
  const [userLocation, setUserLocation] = useState(
    () => locations.find((l) => l.code === DEFAULT_LOCATION_CODE) || null
  );

  function goTo(p) {
    setPage(p);
  }

  function selectDestination(loc) {
    setDestination(loc);
    setPage("map");
  }

  function confirmLocation(loc) {
    setUserLocation(loc);
    setPage("home");
  }

  // ✅ QR Code / URL Param handler
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("location");

    if (code && locations) {
      const found = locations.find((l) => l.code === code);

      if (found) {
        setUserLocation(found);
        setPage("search");
      }

      // Clean URL after reading param
      window.history.replaceState({}, "", "/");
    }
  }, []);

  return (
    <div className="app-shell">
      <div className="app-screen">
        {page === "home" && (
          <Home
            userLocation={userLocation}
            onSearch={() => goTo("search")}
            onSelectQuick={(loc) => selectDestination(loc)}
            onSelectRecent={(loc) => selectDestination(loc)}
          />
        )}

        {page === "search" && (
          <Search
            onBack={() => goTo("home")}
            onSelectDestination={selectDestination}
          />
        )}

        {page === "qr" && (
          <ScanQR
            onBack={() => goTo("home")}
            onConfirm={confirmLocation}
          />
        )}

        {page === "map" && (
          <MapView
            destination={destination}
            userLocation={userLocation}
            onBack={() => goTo("search")}
          />
        )}

        <BottomNav current={page} onChange={goTo} />
      </div>
    </div>
  );
}