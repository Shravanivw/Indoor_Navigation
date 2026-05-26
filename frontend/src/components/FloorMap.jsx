import { useState } from "react";
import "../css/FloorMap.css";

/* ─── Colour palette by room type ────────────────────────────────────────── */
const ROOM_COLORS = {
  MEETING_ROOM:   { fill: "#E8F5E0", stroke: "#A8CC85", text: "#27500A" },
  BOARDROOM:      { fill: "#E8F5E0", stroke: "#A8CC85", text: "#27500A" },
  RECEPTION:      { fill: "#E0EEFB", stroke: "#86B6E6", text: "#0C447C" },
  PANTRY:         { fill: "#FBEDD4", stroke: "#E8B772", text: "#7A4413" },
  LIFT:           { fill: "#ECEAFE", stroke: "#B5B1F0", text: "#3C3489" },
  EXIT:           { fill: "#FBE3E3", stroke: "#E89898", text: "#7A1A1A" },
  TOILET:         { fill: "#EFEDE5", stroke: "#C9C6BB", text: "#444441" },
  RESTROOM:       { fill: "#EFEDE5", stroke: "#C9C6BB", text: "#444441" },
  OFFICE:         { fill: "#E8F5E0", stroke: "#A8CC85", text: "#27500A" },
  CABIN:          { fill: "#E8F5E0", stroke: "#A8CC85", text: "#27500A" },
  STORAGE:        { fill: "#EFEDE5", stroke: "#C9C6BB", text: "#444441" },
  SERVER_ROOM:    { fill: "#EFEDE5", stroke: "#C9C6BB", text: "#444441" },
  OPEN_WORKSPACE: { fill: "#EFEDE5", stroke: "#C9C6BB", text: "#444441" },
  OTHER:          { fill: "#EFEDE5", stroke: "#C9C6BB", text: "#444441" },
  GENERAL:        { fill: "#EFEDE5", stroke: "#C9C6BB", text: "#444441" },
};
const FALLBACK = { fill: "#EFEDE5", stroke: "#C9C6BB", text: "#444441" };
const getRoomColor = (type) => ROOM_COLORS[type] ?? FALLBACK;

const shortLabel = (name, max = 14) => {
  if (!name) return "";
  return name.length <= max ? name : name.substring(0, max - 1) + "…";
};

/* Rounded pill label rendered in SVG coords. Anchor = "bottom" places the
   tip of the label just above (x, y); "top" places it just below. */
function NameLabel({ x, y, text, bg, fg, anchor = "bottom" }) {
  const fontSize  = 10;
  const padX      = 6;
  const padY      = 3.5;
  const approxW   = text.length * (fontSize * 0.55) + padX * 2;
  const h         = fontSize + padY * 2;
  const w         = Math.min(approxW, 140);
  const rectX     = x - w / 2;
  const rectY     = anchor === "bottom" ? y - h - 5 : y + 5;
  const tipY      = anchor === "bottom" ? rectY + h : rectY;
  const tipDir    = anchor === "bottom" ? 4 : -4;
  return (
    <g style={{ pointerEvents: "none" }}>
      <rect
        x={rectX} y={rectY}
        width={w} height={h}
        rx={h / 2}
        fill={bg}
        opacity="0.97"
        filter="url(#card-shadow)"
      />
      <path
        d={`M ${x - 3.5} ${tipY} L ${x + 3.5} ${tipY} L ${x} ${tipY + tipDir} Z`}
        fill={bg}
        opacity="0.97"
      />
      <text
        x={x}
        y={rectY + h / 2 + fontSize * 0.36}
        textAnchor="middle"
        fontSize={fontSize}
        fontWeight={600}
        fill={fg}
      >
        {shortLabel(text, 20)}
      </text>
    </g>
  );
}

export default function FloorMap({
  destination,
  userLocation,
  pathGridCells = [],
  rooms = [],
  gridCols = 80,
  gridRows = 80,
}) {
  /* ─── Zoom / pan state ─────────────────────────────────────────────────── */
  const [zoom, setZoom] = useState(1);
  const MIN_ZOOM = 1;
  const MAX_ZOOM = 4;
  const ZOOM_STEP = 0.4;
  const zoomIn  = () => setZoom(z => Math.min(MAX_ZOOM, +(z + ZOOM_STEP).toFixed(2)));
  const zoomOut = () => setZoom(z => Math.max(MIN_ZOOM, +(z - ZOOM_STEP).toFixed(2)));
  const zoomReset = () => setZoom(1);

  /* ─── Canvas (square viewBox — floor grid is ~square) ──────────────────── */
  const SVG_W  = 480;
  const SVG_H  = 480;
  const PAD    = 16;
  const innerW = SVG_W - PAD * 2;
  const innerH = SVG_H - PAD * 2;
  const sx     = innerW / gridCols;
  const sy     = innerH / gridRows;
  const gx     = (g) => PAD + g * sx;
  const gy     = (g) => PAD + g * sy;

  /* ─── Path geometry ────────────────────────────────────────────────────── */
  const hasPath = pathGridCells.length > 1;
  const polylinePoints = hasPath
    ? pathGridCells.map(p => `${gx(p.x)},${gy(p.y)}`).join(" ")
    : null;
  const startPoint = pathGridCells[0];
  const endPoint   = pathGridCells[pathGridCells.length - 1];

  /* Calculate total polyline length for the animated dash effect */
  let totalLen = 0;
  for (let i = 1; i < pathGridCells.length; i++) {
    const dx = (pathGridCells[i].x - pathGridCells[i - 1].x) * sx;
    const dy = (pathGridCells[i].y - pathGridCells[i - 1].y) * sy;
    totalLen += Math.sqrt(dx * dx + dy * dy);
  }

  /* ─── Render ───────────────────────────────────────────────────────────── */
  return (
    <div className="floormap-wrap">
      <div className="floormap-scroll">
      <svg
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid meet"
        className="floormap-svg"
        style={{ width: `${zoom * 100}%`, height: `${zoom * 100}%` }}
      >
        <defs>
          {/* Subtle paper grid */}
          <pattern id="grid-pattern" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#E4E1D6" strokeWidth="0.4"/>
          </pattern>

          {/* Soft drop shadow for cards */}
          <filter id="card-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="1" stdDeviation="1.2" floodColor="#000" floodOpacity="0.08"/>
          </filter>

          {/* Glow for the route */}
          <filter id="route-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.4" result="blur"/>
            <feMerge>
              <feMergeNode in="blur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>

          {/* Arrow marker for direction along path */}
          <marker
            id="route-arrow"
            viewBox="0 0 10 10"
            refX="6"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#1E5FB8"/>
          </marker>

          {/* Pulse animation for the You marker */}
          <radialGradient id="pulse-grad" cx="50%" cy="50%" r="50%">
            <stop offset="0%"  stopColor="#1E5FB8" stopOpacity="0.5"/>
            <stop offset="100%" stopColor="#1E5FB8" stopOpacity="0"/>
          </radialGradient>

          {/* Clip path so zoomed content stays inside the map card */}
          <clipPath id="map-clip">
            <rect x={PAD} y={PAD} width={innerW} height={innerH} rx="8"/>
          </clipPath>
        </defs>

        {/* Background */}
        <rect width={SVG_W} height={SVG_H} fill="#FAFAF6"/>
        <rect
          x={PAD - 4} y={PAD - 4}
          width={innerW + 8} height={innerH + 8}
          rx="10"
          fill="#FFFFFF"
          stroke="#E4E1D6"
          strokeWidth="1"
          filter="url(#card-shadow)"
        />
        <rect
          x={PAD} y={PAD}
          width={innerW} height={innerH}
          rx="8"
          fill="url(#grid-pattern)"
        />

        {/* All zoomable content lives inside this clipped group */}
        <g clipPath="url(#map-clip)">
          <g>

        {/* Rooms */}
        {rooms.map(room => {
          const colors        = getRoomColor(room.type);
          const isDestination = destination?.id === room.id;
          const isSource      = userLocation?.id === room.id;
          const isHighlight   = isDestination || isSource;

          const w = Math.max(2, (room.gridW ?? 4)) * sx;
          const h = Math.max(2, (room.gridH ?? 4)) * sy;
          const x = gx(room.gridX ?? 0);
          const y = gy(room.gridY ?? 0);
          const cx = x + w / 2;
          const cy = y + h / 2;

          const stroke = isDestination
            ? "#2E7D32"
            : isSource
            ? "#1E5FB8"
            : colors.stroke;
          const strokeW = isHighlight ? 2.2 : 0.7;

          return (
            <g key={room.id}>
              <rect
                x={x} y={y}
                width={w} height={h}
                rx="3"
                fill={colors.fill}
                stroke={stroke}
                strokeWidth={strokeW}
                filter={isHighlight ? "url(#card-shadow)" : undefined}
              />
              {w > 22 && h > 12 && (
                <text
                  x={cx}
                  y={cy + 2}
                  textAnchor="middle"
                  fontSize={Math.min(9, Math.max(5.5, w / 8))}
                  fill={colors.text}
                  fontWeight={isHighlight ? 700 : 500}
                  style={{ pointerEvents: "none" }}
                >
                  {shortLabel(room.name, Math.max(7, Math.floor(w / 4)))}
                </text>
              )}
            </g>
          );
        })}

        {/* Loading placeholder */}
        {rooms.length === 0 && (
          <text
            x={SVG_W / 2} y={SVG_H / 2}
            textAnchor="middle"
            fontSize="13"
            fill="#9CA3AF"
            fontWeight={500}
          >
            Loading map…
          </text>
        )}

        {/* Route path ── 3 stacked polylines for a polished look */}
        {hasPath && (
          <g>
            {/* Soft glow */}
            <polyline
              points={polylinePoints}
              fill="none"
              stroke="#1E5FB8"
              strokeOpacity="0.18"
              strokeWidth="9"
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="url(#route-glow)"
            />
            {/* White halo for contrast */}
            <polyline
              points={polylinePoints}
              fill="none"
              stroke="#FFFFFF"
              strokeWidth="6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Main animated line */}
            <polyline
              points={polylinePoints}
              fill="none"
              stroke="#1E5FB8"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="9 6"
              markerMid="url(#route-arrow)"
            >
              <animate
                attributeName="stroke-dashoffset"
                from="0"
                to={-30}
                dur="1.4s"
                repeatCount="indefinite"
              />
            </polyline>

            {/* Intermediate waypoint dots (skip start & end) */}
            {pathGridCells.slice(1, -1).map((p, i) => (
              <circle
                key={`wp-${i}`}
                cx={gx(p.x)}
                cy={gy(p.y)}
                r="2.2"
                fill="#FFFFFF"
                stroke="#1E5FB8"
                strokeWidth="1.4"
              />
            ))}
          </g>
        )}

        {/* Source marker — "You" with pulse */}
        {startPoint && (
          <g>
            <circle cx={gx(startPoint.x)} cy={gy(startPoint.y)} r="16" fill="url(#pulse-grad)">
              <animate attributeName="r" values="10;20;10" dur="2s" repeatCount="indefinite"/>
              <animate attributeName="opacity" values="0.7;0;0.7" dur="2s" repeatCount="indefinite"/>
            </circle>
            <circle
              cx={gx(startPoint.x)} cy={gy(startPoint.y)}
              r="8"
              fill="#FFFFFF"
              stroke="#1E5FB8"
              strokeWidth="2.5"
              filter="url(#card-shadow)"
            />
            <circle
              cx={gx(startPoint.x)} cy={gy(startPoint.y)}
              r="3.5"
              fill="#1E5FB8"
            />
            {userLocation?.name && (
              <NameLabel
                x={gx(startPoint.x)}
                y={gy(startPoint.y) - 12}
                text={userLocation.name}
                bg="#1E5FB8"
                fg="#FFFFFF"
                anchor="bottom"
              />
            )}
          </g>
        )}

        {/* Destination marker — pin */}
        {endPoint && endPoint !== startPoint && (
          <g>
            <g
              transform={`translate(${gx(endPoint.x)}, ${gy(endPoint.y)})`}
              filter="url(#card-shadow)"
            >
              <path
                d="M 0 -16 C -7 -16 -10 -10 -10 -6 C -10 -1 -5 4 0 12 C 5 4 10 -1 10 -6 C 10 -10 7 -16 0 -16 Z"
                fill="#2E7D32"
                stroke="#FFFFFF"
                strokeWidth="1.5"
              />
              <circle cx="0" cy="-6" r="3.5" fill="#FFFFFF"/>
            </g>
            {destination?.name && (
              <NameLabel
                x={gx(endPoint.x)}
                y={gy(endPoint.y) - 20}
                text={destination.name}
                bg="#2E7D32"
                fg="#FFFFFF"
                anchor="bottom"
              />
            )}
          </g>
        )}
          </g>
        </g>
      </svg>
      </div>

      {/* Legend (top-left) */}
      {hasPath && (
        <div className="map-legend">
          <div className="map-legend-row">
            <span className="map-legend-dot src"/>
            <span>You are here</span>
          </div>
          <div className="map-legend-row">
            <span className="map-legend-dot dest"/>
            <span>Destination</span>
          </div>
        </div>
      )}

      {/* Floor pills */}
      <div className="map-floor-pills">
        <div className="map-floor-pill active">G</div>
      </div>

      {/* Zoom */}
      <div className="map-zoom">
        <button className="map-zoom-btn" title="Zoom in"  onClick={zoomIn}  disabled={zoom >= MAX_ZOOM}>＋</button>
        <button className="map-zoom-btn" title="Zoom out" onClick={zoomOut} disabled={zoom <= MIN_ZOOM}>−</button>
        {zoom !== 1 && (
          <button className="map-zoom-btn" title="Reset zoom" onClick={zoomReset} style={{ fontSize: 11 }}>⟳</button>
        )}
      </div>
    </div>
  );
}
