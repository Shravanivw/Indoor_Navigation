import { useMemo, useRef } from "react";
import "../css/FloorMap.css";

// ─── ROOM TYPE COLOURS ────────────────────────────────────────────────────────
const ROOM_COLOURS = {
  RECEPTION:      { fill: "#d8eafb", stroke: "#378ADD", label: "#0C447C" },
  MEETING_ROOM:   { fill: "#e6f3d7", stroke: "#639922", label: "#27500A" },
  BOARDROOM:      { fill: "#e6f3d7", stroke: "#639922", label: "#27500A" },
  PANTRY:         { fill: "#faefd9", stroke: "#BA7517", label: "#633806" },
  TOILET:         { fill: "#eceff3", stroke: "#888780", label: "#444441" },
  EXIT:           { fill: "#fbe2e2", stroke: "#E24B4A", label: "#A32D2D" },
  OFFICE:         { fill: "#eeedfe", stroke: "#7F77DD", label: "#3C3489" },
  OPEN_WORKSPACE: { fill: "#f1efe8", stroke: "#888780", label: "#444441" },
  SERVER_ROOM:    { fill: "#fff3cd", stroke: "#d4a017", label: "#5a3e00" },
  STORAGE:        { fill: "#f1efe8", stroke: "#888780", label: "#444441" },
  OTHER:          { fill: "#f5f5f5", stroke: "#cccccc", label: "#666666" },
};
const DEFAULT_COLOUR = { fill: "#f5f5f5", stroke: "#cccccc", label: "#666666" };

// ─── GRID CONSTANTS ───────────────────────────────────────────────────────────
const CELL = 8;          // pixels per grid cell
const PAD  = 16;         // padding around the grid in pixels

export default function FloorMap({
  floorMap,
  destination,
  pathGridCells = [],
  userRoom,
  livePosition = null,   // { gx, gy } in grid cells when dead-reckoning is on
  heading      = null,   // degrees, 0 = north, clockwise
  view3D = false,
}) {
  const svgRef = useRef(null);

  const rooms    = floorMap?.rooms   ?? [];
  const COLS     = floorMap?.gridCols ?? 80;
  const ROWS     = floorMap?.gridRows ?? 80;
  const SVG_W    = COLS * CELL + PAD * 2;
  const SVG_H    = ROWS * CELL + PAD * 2;

  // Convert grid coord to SVG pixel
  const px = (gx) => PAD + gx * CELL;
  const py = (gy) => PAD + gy * CELL;

  const hasRoute = pathGridCells.length > 1;

  // ── Auto-zoom viewport to fit the route + user + destination rooms ───────
  const viewBox = useMemo(() => {
    const pts = [...pathGridCells];

    const destRoom = rooms.find(r => r.id === destination?.id);
    if (destRoom) pts.push({ x: destRoom.gridX + destRoom.gridW / 2, y: destRoom.gridY + destRoom.gridH / 2 });
    const uRoom = rooms.find(r => r.id === userRoom?.id);
    if (uRoom)   pts.push({ x: uRoom.gridX + uRoom.gridW / 2, y: uRoom.gridY + uRoom.gridH / 2 });

    if (pts.length === 0) return `0 0 ${SVG_W} ${SVG_H}`;

    const xs = pts.map(p => px(p.x));
    const ys = pts.map(p => py(p.y));
    const minX = Math.min(...xs) - CELL * 6;
    const minY = Math.min(...ys) - CELL * 6;
    const maxX = Math.max(...xs) + CELL * 6;
    const maxY = Math.max(...ys) + CELL * 6;

    const vx = Math.max(0, minX);
    const vy = Math.max(0, minY);
    const vw = Math.min(SVG_W, maxX) - vx;
    const vh = Math.min(SVG_H, maxY) - vy;

    return `${vx} ${vy} ${vw} ${vh}`;
  }, [pathGridCells, rooms, destination, userRoom, SVG_W, SVG_H]);

  // ── Route polyline points (already cell-accurate from backend) ───────────
  const routePoints = useMemo(() => {
    if (!hasRoute) return "";
    return pathGridCells
      .map(p => `${px(p.x) + CELL / 2},${py(p.y) + CELL / 2}`)
      .join(" ");
  }, [pathGridCells, hasRoute]);

  // ── Detect "turn" waypoints (where the path changes direction) ───────────
  const turnMarkers = useMemo(() => {
    if (pathGridCells.length < 3) return [];
    const turns = [];
    for (let i = 1; i < pathGridCells.length - 1; i++) {
      const a = pathGridCells[i - 1];
      const b = pathGridCells[i];
      const c = pathGridCells[i + 1];
      const dx1 = Math.sign(b.x - a.x), dy1 = Math.sign(b.y - a.y);
      const dx2 = Math.sign(c.x - b.x), dy2 = Math.sign(c.y - b.y);
      if (dx1 !== dx2 || dy1 !== dy2) turns.push(b);
    }
    return turns;
  }, [pathGridCells]);

  // ── Identify rooms touched by the route so we can highlight them ─────────
  const routeRoomIds = useMemo(() => {
    if (!hasRoute || rooms.length === 0) return new Set();
    const ids = new Set();
    for (const cell of pathGridCells) {
      for (const r of rooms) {
        if (
          cell.x >= r.gridX && cell.x < r.gridX + r.gridW &&
          cell.y >= r.gridY && cell.y < r.gridY + r.gridH
        ) ids.add(r.id);
      }
    }
    if (destination?.id) ids.add(destination.id);
    if (userRoom?.id)    ids.add(userRoom.id);
    return ids;
  }, [pathGridCells, rooms, hasRoute, destination, userRoom]);

  const startCell = pathGridCells[0];
  const endCell   = pathGridCells[pathGridCells.length - 1];

  if (!floorMap) {
    return (
      <div className="floormap-wrap">
        <div className="map-empty">Loading floor map…</div>
      </div>
    );
  }

  return (
    <div className={`floormap-wrap ${view3D ? "is-3d" : ""}`}>
      <div className="floormap-stage">
        <svg
          ref={svgRef}
          viewBox={viewBox}
          xmlns="http://www.w3.org/2000/svg"
          className="floormap-svg"
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Background */}
          <rect x="0" y="0" width={SVG_W} height={SVG_H} fill="#f8f9fc" />

          {/* Rooms */}
          {rooms.map(room => {
            const isDestination = destination?.id === room.id;
            const isUserHere    = userRoom?.id    === room.id;
            const onRoute       = routeRoomIds.has(room.id);
            const dim           = hasRoute && !onRoute;
            const col = ROOM_COLOURS[room.type] ?? DEFAULT_COLOUR;
            const x   = px(room.gridX);
            const y   = py(room.gridY);
            const w   = Math.max(CELL, room.gridW * CELL);
            const h   = Math.max(CELL, room.gridH * CELL);

            const label = room.name.length > 14 ? room.name.slice(0, 13) + "…" : room.name;

            return (
              <g key={room.id} opacity={dim ? 0.35 : 1}>
                <rect
                  x={x} y={y} width={w} height={h}
                  fill={col.fill}
                  fillOpacity={isDestination || isUserHere ? 0.95 : 0.7}
                  stroke={isDestination ? "#1d4ed8" : isUserHere ? "#059669" : col.stroke}
                  strokeWidth={isDestination || isUserHere ? 1.8 : 0.5}
                  rx="2"
                />
                {w >= CELL * 3 && h >= CELL * 2 && (
                  <text
                    x={x + w / 2}
                    y={y + h / 2 + 1}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={Math.min(6, w / label.length * 1.4)}
                    fontWeight={isDestination || isUserHere ? "700" : "400"}
                    fill={col.label}
                    fontFamily="DM Sans, system-ui, sans-serif"
                    style={{ pointerEvents: "none", userSelect: "none" }}
                  >
                    {label}
                  </text>
                )}
              </g>
            );
          })}

          {/* Route line */}
          {routePoints && (
            <>
              {/* Soft white halo for contrast over rooms */}
              <polyline
                points={routePoints}
                fill="none"
                stroke="#ffffff"
                strokeWidth="6"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.95"
              />
              {/* Main route */}
              <polyline
                points={routePoints}
                fill="none"
                stroke="#1d4ed8"
                strokeWidth="3.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </>
          )}

          {/* Numbered turn markers */}
          {turnMarkers.map((t, i) => (
            <g key={`turn-${i}`}>
              <circle
                cx={px(t.x) + CELL / 2}
                cy={py(t.y) + CELL / 2}
                r="5"
                fill="#fff"
                stroke="#1d4ed8"
                strokeWidth="1.5"
              />
              <text
                x={px(t.x) + CELL / 2}
                y={py(t.y) + CELL / 2 + 0.5}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="5"
                fontWeight="700"
                fill="#1d4ed8"
                fontFamily="DM Sans, system-ui, sans-serif"
                style={{ pointerEvents: "none" }}
              >
                {i + 1}
              </text>
            </g>
          ))}

          {/* Start dot */}
          {startCell && (
            <g>
              <circle
                cx={px(startCell.x) + CELL / 2}
                cy={py(startCell.y) + CELL / 2}
                r="9"
                fill="#1d4ed8"
                opacity="0.18"
              />
              <circle
                cx={px(startCell.x) + CELL / 2}
                cy={py(startCell.y) + CELL / 2}
                r="4.5"
                fill="#1d4ed8"
                stroke="#fff"
                strokeWidth="1.8"
              />
            </g>
          )}

          {/* Destination pin */}
          {endCell && (
            <g>
              <circle
                cx={px(endCell.x) + CELL / 2}
                cy={py(endCell.y) + CELL / 2}
                r="6"
                fill="#059669"
                stroke="#fff"
                strokeWidth="1.8"
              />
              {destination?.name && (
                <text
                  x={px(endCell.x) + CELL / 2}
                  y={py(endCell.y) - 5}
                  textAnchor="middle"
                  fontSize="5.5"
                  fontWeight="700"
                  fill="#0a5e3e"
                  fontFamily="DM Sans, system-ui, sans-serif"
                  paintOrder="stroke"
                  stroke="#ffffff"
                  strokeWidth="1.8"
                  style={{ pointerEvents: "none" }}
                >
                  {destination.name}
                </text>
              )}
            </g>
          )}
          {/* Live tracked position (dead-reckoning) */}
          {livePosition && (
            <g>
              <circle
                cx={px(livePosition.gx) + CELL / 2}
                cy={py(livePosition.gy) + CELL / 2}
                r="12"
                fill="#2563eb"
                opacity="0.18"
              >
                <animate attributeName="r" values="8;16;8" dur="1.6s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.28;0.05;0.28" dur="1.6s" repeatCount="indefinite" />
              </circle>
              <circle
                cx={px(livePosition.gx) + CELL / 2}
                cy={py(livePosition.gy) + CELL / 2}
                r="4.5"
                fill="#2563eb"
                stroke="#fff"
                strokeWidth="1.8"
              />
              {heading != null && (
                <polygon
                  points="0,-9 4,-3 -4,-3"
                  fill="#2563eb"
                  stroke="#fff"
                  strokeWidth="0.6"
                  transform={`translate(${px(livePosition.gx) + CELL / 2}, ${py(livePosition.gy) + CELL / 2}) rotate(${heading})`}
                />
              )}
            </g>
          )}
        </svg>
      </div>

      {/* Legend */}
      <div className="map-legend">
        <span><i className="dot dot-start" /> You are here</span>
        <span><i className="dot dot-end" /> Destination</span>
      </div>
    </div>
  );
}
