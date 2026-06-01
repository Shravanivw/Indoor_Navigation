import "../css/Home.css";

export default function BuildingChips({ buildings = [], buildingId, onSelectBuilding }) {
  if (!buildings || buildings.length < 2) return null;
  return (
    <div className="home-building-chips" style={{ padding: "8px 16px" }}>
      {buildings.map(b => (
        <button
          key={b.id}
          className={`home-building-chip${b.id === buildingId ? " is-active" : ""}`}
          onClick={() => onSelectBuilding?.(b.id)}
          type="button"
        >
          {b.name}
        </button>
      ))}
    </div>
  );
}
