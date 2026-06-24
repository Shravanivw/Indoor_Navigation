import { useState, useRef, useEffect } from "react";
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

const hasPolygonGeometry = (room) => Array.isArray(room?.polygon) && room.polygon.length >= 3;

function getPolygonLabelAnchor(points) {
  const sum = points.reduce(
    (acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }),
    { x: 0, y: 0 }
  );
  return {
    x: sum.x / points.length,
    y: sum.y / points.length,
  };
}

function getPolygonBounds(points) {
  return points.reduce(
    (bounds, point) => ({
      minX: Math.min(bounds.minX, point.x),
      maxX: Math.max(bounds.maxX, point.x),
      minY: Math.min(bounds.minY, point.y),
      maxY: Math.max(bounds.maxY, point.y),
    }),
    { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity }
  );
}

function getPolygonArea(points) {
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    area += current.x * next.y - next.x * current.y;
  }
  return Math.abs(area) / 2;
}

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
  livePosition,
  heading,
  rooms = [],
  graphNodes = [],
  graphEdges = [],
  gridCols = 80,
  gridRows = 80,
}) {
  console.log("GRAPH NODES:", graphNodes.length);
  console.log("GRAPH EDGES:", graphEdges.length);
  const nodeMap = Object.fromEntries(
    graphNodes.map(node => [node.id, node])
  );
  const [showGraph, setShowGraph] = useState(true);

  /* ─── Zoom / pan via SVG viewBox (no CSS scale = no blur) ─────────────── */
  const SVG_W = 480;
  const SVG_H = 480;
  const MIN_ZOOM = 1;
  const MAX_ZOOM = 5;
  const containerRef = useRef(null);
  // view = { vx, vy, z } — top-left corner of visible SVG window + zoom level
  const viewRef = useRef({ vx: 0, vy: 0, z: 1 });
  const [view, setView] = useState({ vx: 0, vy: 0, z: 1 });
  const pointersRef = useRef(new Map());
  const lastPinchRef = useRef(null);

  const clampZoom = (v) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, v));

  const commit = (vx, vy, z) => {
    z = clampZoom(z);
    const clamped = {
      vx: z <= 1 ? 0 : Math.max(0, Math.min(SVG_W * (1 - 1 / z), vx)),
      vy: z <= 1 ? 0 : Math.max(0, Math.min(SVG_H * (1 - 1 / z), vy)),
      z,
    };
    viewRef.current = clamped;
    setView(clamped);
  };

  /* Zoom keeping SVG point under container pixel (fx, fy) fixed */
  const zoomAt = (factor, fx, fy) => {
    const el = containerRef.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const { vx, vy, z } = viewRef.current;
    const sfx = vx + (fx / width)  * (SVG_W / z);
    const sfy = vy + (fy / height) * (SVG_H / z);
    const newZ = clampZoom(z * factor);
    commit(sfx - (fx / width) * (SVG_W / newZ), sfy - (fy / height) * (SVG_H / newZ), newZ);
  };

  /* Pinch: SVG point at old finger-center moves to new finger-center */
  const pinchAt = (factor, fromFx, fromFy, toFx, toFy) => {
    const el = containerRef.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const { vx, vy, z } = viewRef.current;
    const sfx = vx + (fromFx / width)  * (SVG_W / z);
    const sfy = vy + (fromFy / height) * (SVG_H / z);
    const newZ = clampZoom(z * factor);
    commit(sfx - (toFx / width) * (SVG_W / newZ), sfy - (toFy / height) * (SVG_H / newZ), newZ);
  };

  /* Drag pan: positive dx = finger moved right = view shifts left */
  const panBy = (dx, dy) => {
    const el = containerRef.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const { vx, vy, z } = viewRef.current;
    commit(vx - (dx / width) * (SVG_W / z), vy - (dy / height) * (SVG_H / z), z);
  };

  const zoomIn    = () => { const c = containerRef.current?.getBoundingClientRect(); zoomAt(1.25, (c?.width ?? 0) / 2, (c?.height ?? 0) / 2); };
  const zoomOut   = () => { const c = containerRef.current?.getBoundingClientRect(); zoomAt(0.8,  (c?.width ?? 0) / 2, (c?.height ?? 0) / 2); };
  const zoomReset = () => commit(0, 0, 1);

  /* Non-passive wheel: ctrlKey = trackpad pinch → zoom; else → pan */
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const fx = e.clientX - rect.left;
      const fy = e.clientY - rect.top;
      if (e.ctrlKey || e.metaKey) {
        zoomAt(Math.pow(0.998, e.deltaY), fx, fy);
      } else {
        const { vx, vy, z } = viewRef.current;
        const mult = e.deltaMode === 1 ? 20 : 1;
        const { width, height } = el.getBoundingClientRect();
        commit(vx + (e.deltaX * mult / width) * (SVG_W / z), vy + (e.deltaY * mult / height) * (SVG_H / z), z);
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePointerDown = (event) => {
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event) => {
    if (!pointersRef.current.has(event.pointerId)) return;
    const prev = pointersRef.current.get(event.pointerId);
    const curr = { x: event.clientX, y: event.clientY };
    pointersRef.current.set(event.pointerId, curr);
    const pts = Array.from(pointersRef.current.values());

    if (pts.length === 1) {
      panBy(curr.x - prev.x, curr.y - prev.y);
    } else if (pts.length === 2) {
      const [a, b] = pts;
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const rect = containerRef.current?.getBoundingClientRect();
      const fx = (a.x + b.x) / 2 - (rect?.left ?? 0);
      const fy = (a.y + b.y) / 2 - (rect?.top  ?? 0);
      if (lastPinchRef.current) {
        const { dist: prevDist, fx: prevFx, fy: prevFy } = lastPinchRef.current;
        pinchAt(dist / prevDist, prevFx, prevFy, fx, fy);
      }
      lastPinchRef.current = { dist, fx, fy };
    }
  };

  const handlePointerUp = (event) => {
    pointersRef.current.delete(event.pointerId);
    if (pointersRef.current.size < 2) lastPinchRef.current = null;
    try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* ignore */ }
  };

  /* ─── Canvas ────────────────────────────────────────────────────────────── */
  const PAD    = 16;
  const innerW = SVG_W - PAD * 2;
  const innerH = SVG_H - PAD * 2;

  /* Room coordinates come from the database grid (0–gridCols, 0–gridRows).
     Use gx/gy for rooms. */
  const sx = innerW / gridCols;
  const sy = innerH / gridRows;
  // Flip Y axis so the map reads bottom-to-top (user's position appears at
  // the bottom, destination ahead — matches how navigation apps feel on phone)
  const gx = (g) => PAD + g * sx;
  const gy = (g) => PAD + (gridRows - g) * sy;

  const px = (v) => PAD + v * sx;
  const py = (v) => PAD + (gridRows - v) * sy;

  /* ─── Path geometry ────────────────────────────────────────────────────── */
  const hasPath = pathGridCells.length > 1;
  const polylinePoints = hasPath
    ? pathGridCells.map(p => `${px(p.x)},${py(p.y)}`).join(" ")
    : null;
  const startPoint = pathGridCells[0];
  const endPoint   = pathGridCells[pathGridCells.length - 1];

  /* ─── Render ─────────────────────────────────────────────────────── */
  return (
    <div className="floormap-wrap">
      <div
        ref={containerRef}
        className="floormap-scroll"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
      <svg
        viewBox={`${view.vx} ${view.vy} ${SVG_W / view.z} ${SVG_H / view.z}`}
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
        className="floormap-svg"
        style={{ width: '100%', height: '100%', display: 'block' }}
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
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#0f766e"/>
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

            {/* GRAPH DEBUG OVERLAY */}
            <g opacity={0.8}>

              {/* Edges */}
              {graphEdges.map(edge => {
                const from = nodeMap[edge.fromNodeId];
                const to = nodeMap[edge.toNodeId];

                if (!from || !to) return null;

                return (
                  <line
                    key={edge.id || `${edge.fromNodeId}-${edge.toNodeId}`}
                    x1={gx(from.gridX)}
                    y1={gy(from.gridY)}
                    x2={gx(to.gridX)}
                    y2={gy(to.gridY)}
                    stroke="orange"
                    strokeWidth="1.5"
                  />
                );
              })}

              {/* Nodes */}
              {graphNodes.slice(0, 20).map(node => {
                console.log(node);

                return (
                  <circle
                    key={node.id}
                    cx={node.gridX}
                    cy={node.gridY}
                    r="10"
                    fill="red"
                  />
                );
              })}
            </g>

        {/* Rooms — use grid coordinates (gx/gy) */}
        {rooms.map(room => {
          const colors        = getRoomColor(room.type);
          const isDestination = destination?.id === room.id;
          const isSource      = userLocation?.id === room.id;
          const isHighlight   = isDestination || isSource;

          const polygonPoints = hasPolygonGeometry(room)
            ? room.polygon.map(point => ({ x: gx(point.x), y: gy(point.y) }))
            : null;
          const polygonLabelAnchor = polygonPoints
            ? getPolygonLabelAnchor(polygonPoints)
            : null;
          const polygonBounds = polygonPoints
            ? getPolygonBounds(polygonPoints)
            : null;
          const polygonArea = polygonPoints
            ? getPolygonArea(polygonPoints)
            : 0;

          const w = Math.max(2, (room.gridW ?? 4)) * sx;
          const h = Math.max(2, (room.gridH ?? 4)) * sy;
          const x = gx(room.gridX ?? 0);
          const y = gy(room.gridY ?? 0);
          const cx = x + w / 2;
          const cy = y + h / 2;
          const labelWidth = polygonBounds ? polygonBounds.maxX - polygonBounds.minX : w;
          const labelHeight = polygonBounds ? polygonBounds.maxY - polygonBounds.minY : h;
          const showLabel = polygonPoints
            ? polygonArea >= 700 && labelWidth >= 34 && labelHeight >= 18
            : w > 22 && h > 12;
          const textMax = polygonPoints
            ? Math.max(8, Math.floor(labelWidth / 9))
            : Math.max(7, Math.floor(w / 4));

          const stroke = isDestination
            ? "#2E7D32"
            : isSource
            ? "#1E5FB8"
            : colors.stroke;
          const strokeW = isHighlight ? 2.2 : 0.7;
          const fillOpacity = room.type === "OPEN_WORKSPACE" ? 0.78 : 0.94;

          return (
            <g key={room.id}>
              {polygonPoints ? (
                <>
                  <polygon
                    points={polygonPoints.map(point => `${point.x},${point.y}`).join(" ")}
                    fill="#FFFFFF"
                    stroke="rgba(255,255,255,0.85)"
                    strokeWidth={Math.max(1.4, strokeW + 1.4)}
                    opacity="0.96"
                    filter="url(#card-shadow)"
                  />
                  <polygon
                    points={polygonPoints.map(point => `${point.x},${point.y}`).join(" ")}
                    fill={colors.fill}
                    fillOpacity={fillOpacity}
                    stroke={stroke}
                    strokeWidth={strokeW}
                    filter={isHighlight ? "url(#card-shadow)" : undefined}
                  />
                  <polygon
                    points={polygonPoints.map(point => `${point.x},${point.y}`).join(" ")}
                    fill="none"
                    stroke="rgba(255,255,255,0.55)"
                    strokeWidth="0.8"
                    strokeLinejoin="round"
                  />
                  {(room.doors ?? []).map((door) => (
                    <circle
                      key={`${room.id}-door-${door.id}`}
                      cx={gx(door.x)}
                      cy={gy(door.y)}
                      r={isHighlight ? 3.2 : 2.4}
                      fill="#FFFFFF"
                      stroke={stroke}
                      strokeWidth="1.2"
                    />
                  ))}
                </>
              ) : (
                <rect
                  x={x} y={y}
                  width={w} height={h}
                  rx="3"
                  fill={colors.fill}
                  stroke={stroke}
                  strokeWidth={strokeW}
                  filter={isHighlight ? "url(#card-shadow)" : undefined}
                />
              )}
              {showLabel && (
                <text
                  x={polygonLabelAnchor?.x ?? cx}
                  y={(polygonLabelAnchor?.y ?? cy) + 2}
                  textAnchor="middle"
                  fontSize={polygonPoints
                    ? Math.min(10, Math.max(6, labelWidth / 8.5))
                    : Math.min(9, Math.max(5.5, w / 8))}
                  fill={colors.text}
                  fontWeight={isHighlight ? 700 : 500}
                  stroke="rgba(255,255,255,0.9)"
                  strokeWidth="2.6"
                  paintOrder="stroke fill"
                  style={{ pointerEvents: "none" }}
                >
                  {shortLabel(room.name, textMax)}
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

        {/* Debug graph overlay */}
          {showGraph && (
            <g>

              {/* Draw edges first */}
              {graphEdges.map(edge => {
                const from = graphNodes.find(n => n.id === edge.fromNodeId);
                const to = graphNodes.find(n => n.id === edge.toNodeId);

                if (!from || !to) return null;

                return (
                  <line
                    key={edge.id}
                    x1={px(from.realX)}
                    y1={py(from.realY)}
                    x2={px(to.realX)}
                    y2={py(to.realY)}
                    stroke="orange"
                    strokeWidth="1"
                    opacity="0.7"
                  />
                );
              })}

              {/* Draw nodes */}
              {graphNodes.map(node => (
                <circle
                  key={node.id}
                  cx={px(node.realX)}
                  cy={py(node.realY)}
                  r="2.5"
                  fill="blue"
                />
              ))}

            </g>
          )}

        {/* Route path — uses normalized grid coordinates (px/py) */}
        {hasPath && (
          <g>
            {/* Soft glow */}
            <polyline
              points={polylinePoints}
              fill="none"
              stroke="#0f766e"
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
              stroke="#0f766e"
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
                cx={px(p.x)}
                cy={py(p.y)}
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
            <circle cx={px(startPoint.x)} cy={py(startPoint.y)} r="16" fill="url(#pulse-grad)">
              <animate attributeName="r" values="10;20;10" dur="2s" repeatCount="indefinite"/>
              <animate attributeName="opacity" values="0.7;0;0.7" dur="2s" repeatCount="indefinite"/>
            </circle>
            <circle
              cx={px(startPoint.x)} cy={py(startPoint.y)}
              r="8"
              fill="#FFFFFF"
              stroke="#1E5FB8"
              strokeWidth="2.5"
              filter="url(#card-shadow)"
            />
            <circle
              cx={px(startPoint.x)} cy={py(startPoint.y)}
              r="3.5"
              fill="#1E5FB8"
            />
            {userLocation?.name && (
              <NameLabel
                x={px(startPoint.x)}
                y={py(startPoint.y) - 12}
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
              transform={`translate(${px(endPoint.x)}, ${py(endPoint.y)})`}
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
                x={px(endPoint.x)}
                y={py(endPoint.y) - 20}
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

      <div className="map-zoom">
        <button
          onClick={() => setShowGraph(v => !v)}
          style={{
            position: "absolute",
            top: 10,
            right: 10,
            zIndex: 1000
          }}
        >
          Graph
        </button>
        <button
          className="map-zoom-btn"
          type="button"
          title="Zoom in"
          onClick={(event) => { event.stopPropagation(); zoomIn(); }}
          disabled={view.z >= MAX_ZOOM}
        >＋</button>
        <button
          className="map-zoom-btn"
          type="button"
          title="Zoom out"
          onClick={(event) => { event.stopPropagation(); zoomOut(); }}
          disabled={view.z <= MIN_ZOOM}
        >−</button>
        {view.z !== 1 && (
          <button
            className="map-zoom-btn"
            type="button"
            title="Reset zoom"
            onClick={(event) => { event.stopPropagation(); zoomReset(); }}
            style={{ fontSize: 11 }}
          >⟳</button>
        )}
      </div>
    </div>
  );
}
