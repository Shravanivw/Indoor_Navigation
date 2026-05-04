import { useState } from "react";
import Home from "./Pages/Home";
import Search from "./Pages/Search";
import ScanQR from "./Pages/ScanQR";
import MapView from "./Pages/MapView";
import BottomNav from "./components/BottomNav";
import "./app.css";

export default function App() {
  const [page, setPage] = useState("home");
  const [destination, setDestination] = useState(null);
  const [userLocation, setUserLocation] = useState("Lift 1 — Floor 5");

  function goTo(p) { setPage(p); }

  function selectDestination(loc) {
    setDestination(loc);
    setPage("map");
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