import "../css/FloorMap.css";

export default function FloorMap({ destination }) {
  return (
    <div className="floormap-wrap">
      <svg viewBox="0 0 320 250" xmlns="http://www.w3.org/2000/svg" className="floormap-svg">
        <rect width="320" height="250" fill="#F1EFE8"/>
        <rect x="10" y="10" width="300" height="230" rx="4" fill="#fff" stroke="#D3D1C7" strokeWidth="0.5"/>
        <rect x="22" y="22" width="72" height="52" rx="2" fill="#E6F1FB" stroke="#B5D4F4" strokeWidth="0.5"/>
        <text x="58" y="51" textAnchor="middle" fontSize="8" fill="#0C447C">Reception</text>
        <rect x="104" y="22" width="62" height="52" rx="2" fill="#EAF3DE" stroke="#C0DD97" strokeWidth="0.5"/>
        <text x="135" y="46" textAnchor="middle" fontSize="8" fill="#27500A" fontWeight="500">Conf A</text>
        <rect x="176" y="22" width="62" height="52" rx="2"
          fill="#EAF3DE"
          stroke={destination?.name === "Conference Room B" ? "#3B6D11" : "#C0DD97"}
          strokeWidth={destination?.name === "Conference Room B" ? "2" : "0.5"}
        />
        <text x="207" y="44" textAnchor="middle" fontSize="8" fill="#27500A" fontWeight="500">Conf B</text>
        <text x="207" y="55" textAnchor="middle" fontSize="7" fill="#3B6D11">destination</text>
        <rect x="248" y="22" width="60" height="52" rx="2" fill="#F1EFE8" stroke="#D3D1C7" strokeWidth="0.5"/>
        <text x="278" y="51" textAnchor="middle" fontSize="8" fill="#444441">Workspace</text>
        <rect x="22" y="112" width="130" height="72" rx="2" fill="#F1EFE8" stroke="#D3D1C7" strokeWidth="0.5"/>
        <text x="87" y="151" textAnchor="middle" fontSize="8" fill="#444441">Open Office</text>
        <rect x="162" y="112" width="76" height="72" rx="2" fill="#FAEEDA" stroke="#FAC775" strokeWidth="0.5"/>
        <text x="200" y="151" textAnchor="middle" fontSize="8" fill="#633806">Cafeteria</text>
        <rect x="248" y="112" width="52" height="72" rx="2" fill="#EEEDFE" stroke="#CECBF6" strokeWidth="0.5"/>
        <text x="274" y="151" textAnchor="middle" fontSize="7" fill="#3C3489">Lift A</text>
        <rect x="22" y="200" width="44" height="28" rx="2" fill="#F1EFE8" stroke="#D3D1C7" strokeWidth="0.5"/>
        <text x="44" y="217" textAnchor="middle" fontSize="7" fill="#444441">WC</text>
        <rect x="74" y="200" width="44" height="28" rx="2" fill="#FCEBEB" stroke="#F7C1C1" strokeWidth="0.5"/>
        <text x="96" y="217" textAnchor="middle" fontSize="7" fill="#791F1F">Exit</text>
        <line x1="22" y1="104" x2="300" y2="104" stroke="#B4B2A9" strokeWidth="0.5"/>
        <line x1="22" y1="195" x2="300" y2="195" stroke="#B4B2A9" strokeWidth="0.5" strokeDasharray="3,2"/>
        <polyline points="274,112 274,104 207,104 207,74" fill="none" stroke="#185FA5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="274" cy="148" r="7" fill="#185FA5"/>
        <text x="274" y="152" textAnchor="middle" fontSize="6.5" fill="#E6F1FB" fontWeight="500">You</text>
        <circle cx="207" cy="38" r="7" fill="#3B6D11"/>
        <text x="207" y="42" textAnchor="middle" fontSize="6.5" fill="#EAF3DE" fontWeight="500">B</text>
        <circle cx="274" cy="104" r="3.5" fill="#185FA5" opacity="0.4"/>
        <circle cx="207" cy="104" r="3.5" fill="#185FA5" opacity="0.4"/>
      </svg>

      <div className="map-floor-pills">
        {["F1", "F2", "F3"].map(f => (
          <div key={f} className={`map-floor-pill ${f === "F2" ? "active" : ""}`}>{f}</div>
        ))}
      </div>

      <div className="map-zoom">
        <div className="map-zoom-btn">+</div>
        <div className="map-zoom-btn">−</div>
      </div>

      <div className="map-recalc">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>
        Recalculate route
      </div>
    </div>
  );
}