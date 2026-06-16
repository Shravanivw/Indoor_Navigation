import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import "../css/Walk3D.css";

// ─── ROOM TYPE COLOURS (mirrors FloorMap palette) ────────────────────────────
const ROOM_COLOURS = {
  RECEPTION:      0xd8eafb,
  MEETING_ROOM:   0xe6f3d7,
  BOARDROOM:      0xe6f3d7,
  PANTRY:         0xfaefd9,
  TOILET:         0xeceff3,
  EXIT:           0xfbe2e2,
  OFFICE:         0xeeedfe,
  OPEN_WORKSPACE: 0xf1efe8,
  SERVER_ROOM:    0xfff3cd,
  STORAGE:        0xf1efe8,
  OTHER:          0xf5f5f5,
};

const WALL_HEIGHT  = 2.7;     // outer boundary walls
const ROOM_WALL_H  = 2.6;     // room partition walls — below eye level so camera clears them
const EYE_HEIGHT   = 1.75;
const WALK_SPEED   = 1.4;     // metres / second auto-advance along the path

function makeLabelSprite(text, colorHex = "#0C447C", bgAlpha = 0.93) {
  const canvas = document.createElement("canvas");
  canvas.width = 640; canvas.height = 160;
  const ctx = canvas.getContext("2d");
  const r = 20; // corner radius
  // Rounded-rect background
  ctx.fillStyle = `rgba(255,255,255,${bgAlpha})`;
  ctx.beginPath();
  ctx.moveTo(r, 0); ctx.lineTo(canvas.width - r, 0);
  ctx.quadraticCurveTo(canvas.width, 0, canvas.width, r);
  ctx.lineTo(canvas.width, canvas.height - r);
  ctx.quadraticCurveTo(canvas.width, canvas.height, canvas.width - r, canvas.height);
  ctx.lineTo(r, canvas.height); ctx.quadraticCurveTo(0, canvas.height, 0, canvas.height - r);
  ctx.lineTo(0, r); ctx.quadraticCurveTo(0, 0, r, 0);
  ctx.closePath();
  ctx.fill();
  // Border
  ctx.strokeStyle = colorHex;
  ctx.lineWidth = 8;
  ctx.stroke();
  // Text — truncate if needed
  const maxChars = 18;
  const label = text.length > maxChars ? text.slice(0, maxChars - 1) + "…" : text;
  ctx.fillStyle = colorHex;
  ctx.font = "bold 72px DM Sans, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, canvas.width / 2, canvas.height / 2);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  sprite.scale.set(4, 1, 1);
  return sprite;
}

export default function Walk3D({ floorMap, pathGridCells = [], destination, userRoom, livePosition = null }) {
  const mountRef = useRef(null);
  const livePosRef = useRef(livePosition);
  useEffect(() => { livePosRef.current = livePosition; }, [livePosition]);
  const stateRef = useRef({
    raf: 0,
    progress: 0,         // 0..1 along the path (auto-advanced)
    pathLengthM: 1,
    cumDist: [0],
    pathPoints: [],
    lastT: 0,
    yaw: null,           // current (smoothed) camera yaw in radians
    cleanup: null,
  });
  const [arrived, setArrived]   = useState(false);
  const [progressPct, setProgressPct] = useState(0);
  const [speedMul, setSpeedMul] = useState(1);
  const [paused, setPaused] = useState(false);
  const speedMulRef = useRef(1);
  const pausedRef   = useRef(false);
  useEffect(() => { speedMulRef.current = speedMul; }, [speedMul]);
  useEffect(() => { pausedRef.current   = paused;   }, [paused]);
  const SPEED_STEPS = [1, 2, 4];
  const cycleSpeed   = () => setSpeedMul(prev => SPEED_STEPS[(SPEED_STEPS.indexOf(prev) + 1) % SPEED_STEPS.length]);
  const togglePaused = () => setPaused(prev => !prev);

  useEffect(() => {
    if (!floorMap || !mountRef.current) return;

    const mount  = mountRef.current;
    const width  = mount.clientWidth;
    const height = mount.clientHeight;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(width, height);
    renderer.setClearColor(0xeef1f4);
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0xeef1f4, 16, 50);

    const camera = new THREE.PerspectiveCamera(72, width / height, 0.05, 200);

    scene.add(new THREE.AmbientLight(0xffffff, 0.65));
    const sun = new THREE.DirectionalLight(0xffffff, 0.7);
    sun.position.set(20, 40, 15);
    scene.add(sun);
    // A second fill light from the opposite side so interiors aren't too dim
    const fill = new THREE.DirectionalLight(0xffffff, 0.35);
    fill.position.set(-15, 25, -10);
    scene.add(fill);
    // Soft hemisphere light gives an indoor "ceiling-lit" feel
    scene.add(new THREE.HemisphereLight(0xffffff, 0xc8ccd1, 0.45));

    // Coordinate helpers
    const scaleX = floorMap.scaleX ?? 1;
    const scaleY = floorMap.scaleY ?? 1;
    const cols   = floorMap.gridCols ?? floorMap.grid?.[0]?.length ?? 80;
    const rows   = floorMap.gridRows ?? floorMap.grid?.length ?? 80;
    const widthM  = cols * scaleX;
    const heightM = rows * scaleY;
    const cxOffset = widthM / 2;
    const czOffset = heightM / 2;
    const toWorld = (gx, gy) => ({
      x: gx * scaleX - cxOffset,
      z: gy * scaleY - czOffset,
    });

    // Hudson's manual graph stores pixel coords (0-800, 0-500) while the scene
    // uses grid coords (0-cols, 0-rows). Normalise once so path aligns with rooms.
    const FLOOR_PX_W = 800;
    const FLOOR_PX_H = 500;
    const pathIsPixelSpace = pathGridCells.some(c => c.x > cols || c.y > rows);
    const normPath = pathIsPixelSpace
      ? pathGridCells.map(c => ({ x: (c.x / FLOOR_PX_W) * cols, y: (c.y / FLOOR_PX_H) * rows }))
      : pathGridCells;

    // Pre-calculate destination world position from last path node so rooms
    // can use it before pathPoints array is built further down.
    const destWorldPos = normPath.length > 0
      ? toWorld(normPath[normPath.length - 1].x + 0.5, normPath[normPath.length - 1].y + 0.5)
      : null;

    // Floor + subtle grid lines for orientation
    const floorMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(widthM, heightM),
      new THREE.MeshStandardMaterial({ color: 0xd9dce1, roughness: 1.5 }),
    );
    floorMesh.rotation.x = -Math.PI / 2;
    scene.add(floorMesh);

    // No ceiling — open top view lets room labels and layout stay visible
    const ceiling = new THREE.Mesh(
      new THREE.PlaneGeometry(widthM, heightM),
      new THREE.MeshStandardMaterial({
        color: 0xf8f8f8,
        side: THREE.DoubleSide,
      })
    );

    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = WALL_HEIGHT;
    scene.add(ceiling);

    //const gridHelper = new THREE.GridHelper(Math.max(widthM, heightM), Math.max(cols, rows), 0xdadfe5, 0xe9ecf0);
    //gridHelper.position.y = 0.01;
    //scene.add(gridHelper);

    // ── Rooms: coloured floor slab + label (no walls — walls come from grid) ─
    const rooms = floorMap.rooms ?? [];
    for (const r of rooms) {
      const colour = ROOM_COLOURS[r.type] ?? 0xf5f5f5;
      const wM = r.gridW * scaleX;
      const hM = r.gridH * scaleY;
      const isDest = destination?.id === r.id;
      const isUser = userRoom?.id === r.id;
      // For the destination room use the actual path end point so walls/label
      // appear exactly where the camera stops (fixes pixel vs grid coord mismatch)
      const rawPos = toWorld(r.gridX + r.gridW / 2, r.gridY + r.gridH / 2);
      const { x, z } = (isDest && destWorldPos) ? destWorldPos : rawPos;

      const slabColour = isDest ? 0xb7ecd0 : isUser ? 0xbcd6f7 : colour;
      const slab = new THREE.Mesh(
        new THREE.BoxGeometry(wM, 0.05, hM),
        new THREE.MeshStandardMaterial({
          color: slabColour, roughness: 0.85, transparent: true, opacity: 0.92,
        }),
      );
      slab.position.set(x, 0.03, z);
      scene.add(slab);

      const labelColor = isDest ? "#059669" : isUser ? "#1d4ed8" : "#374151";
      const label = makeLabelSprite(r.name, labelColor, isDest ? 0.97 : 0.88);
      // Float labels well above the low partition walls so they're always visible
      label.position.set(x, ROOM_WALL_H + 0.85, z);
      label.scale.set(Math.min(10, Math.max(4, wM * 0.9)), 2.2, 1);
      scene.add(label);

      // ── Simple furniture / props per room type so cabins, reception,
      //    cafeteria etc. feel distinct ────────────────────────────────────
      const isSmall = wM < 2 || hM < 2;
      if (!isSmall) {
        if (r.type === "OFFICE" || r.type === "BOARDROOM" || r.type === "MEETING_ROOM") {
          // A desk/table in the middle
          const tableW = Math.max(0.8, Math.min(wM * 0.55, 3.5));
          const tableD = Math.max(0.6, Math.min(hM * 0.4, 1.6));
          const table = new THREE.Mesh(
            new THREE.BoxGeometry(tableW, 0.06, tableD),
            new THREE.MeshStandardMaterial({ color: 0x8b6b4a, roughness: 0.7 }),
          );
          table.position.set(x, 0.75, z);
          scene.add(table);
          // Four short legs
          const legGeom = new THREE.BoxGeometry(0.08, 0.72, 0.08);
          const legMat  = new THREE.MeshStandardMaterial({ color: 0x5c4530 });
          for (const [lx, lz] of [
            [tableW / 2 - 0.1,  tableD / 2 - 0.1],
            [-tableW / 2 + 0.1, tableD / 2 - 0.1],
            [tableW / 2 - 0.1, -tableD / 2 + 0.1],
            [-tableW / 2 + 0.1,-tableD / 2 + 0.1],
          ]) {
            const leg = new THREE.Mesh(legGeom, legMat);
            leg.position.set(x + lx, 0.36, z + lz);
            scene.add(leg);
          }
        } else if (r.type === "RECEPTION") {
          // Reception desk: a long curved-ish counter
          const dW = Math.min(wM * 0.7, 4.5);
          const dD = 0.7;
          const desk = new THREE.Mesh(
            new THREE.BoxGeometry(dW, 1.1, dD),
            new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.5 }),
          );
          desk.position.set(x, 0.55, z);
          scene.add(desk);
        } else if (r.type === "PANTRY") {
          // Counter along one wall + small fridge box
          const counterW = Math.min(wM * 0.8, 4);
          const counter = new THREE.Mesh(
            new THREE.BoxGeometry(counterW, 0.9, 0.6),
            new THREE.MeshStandardMaterial({ color: 0xd4b483, roughness: 0.6 }),
          );
          counter.position.set(x, 0.45, z - hM / 2 + 0.35);
          scene.add(counter);
          const fridge = new THREE.Mesh(
            new THREE.BoxGeometry(0.7, 1.7, 0.7),
            new THREE.MeshStandardMaterial({ color: 0xe5e7eb, roughness: 0.4 }),
          );
          fridge.position.set(x + counterW / 2 + 0.4, 0.85, z - hM / 2 + 0.4);
          scene.add(fridge);
        } else if (r.type === "OPEN_WORKSPACE") {
          // Cluster of small desks in a 2×N grid
          const deskW = 1.2, deskD = 0.6, gap = 0.4;
          const cols2 = Math.max(1, Math.floor((wM - gap) / (deskW + gap)));
          const rows2 = Math.max(1, Math.floor((hM - gap) / (deskD + gap)));
          const startX = x - ((cols2 - 1) * (deskW + gap)) / 2;
          const startZ = z - ((rows2 - 1) * (deskD + gap)) / 2;
          const dMat = new THREE.MeshStandardMaterial({ color: 0x8b6b4a, roughness: 0.7 });
          for (let cc = 0; cc < cols2; cc++) {
            for (let rr = 0; rr < rows2; rr++) {
              const d = new THREE.Mesh(new THREE.BoxGeometry(deskW, 0.05, deskD), dMat);
              d.position.set(startX + cc * (deskW + gap), 0.75, startZ + rr * (deskD + gap));
              scene.add(d);
            }
          }
        } else if (r.type === "TOILET") {
          // Just a small box to suggest stalls
          const box = new THREE.Mesh(
            new THREE.BoxGeometry(Math.min(wM * 0.5, 1.5), 1.2, Math.min(hM * 0.4, 0.8)),
            new THREE.MeshStandardMaterial({ color: 0xeceff3, roughness: 0.7 }),
          );
          box.position.set(x, 0.6, z);
          scene.add(box);
        } else if (r.type === "EXIT") {
          // Bright EXIT marker pole
          const pole = new THREE.Mesh(
            new THREE.BoxGeometry(0.3, 2.2, 0.3),
            new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 0.4 }),
          );
          pole.position.set(x, 1.1, z);
          scene.add(pole);
        } else if (r.type === "SERVER_ROOM") {
          // A rack
          const rack = new THREE.Mesh(
            new THREE.BoxGeometry(Math.min(wM * 0.4, 0.8), 1.8, Math.min(hM * 0.3, 0.6)),
            new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.5 }),
          );
          rack.position.set(x, 0.9, z);
          scene.add(rack);
        }
      }
    }

    // ── Room-outline walls: low partitions (below eye level) around each room ─
    // ROOM_WALL_H < EYE_HEIGHT means the camera always clears the walls —
    // no more "walking through blocks". Labels float above so they're always
    // visible. Destination room walls are tinted green for easy recognition.
    const wallMatNormal = new THREE.MeshStandardMaterial({ color: 0xcbd2da, roughness: 0.85 });
    const wallMatDest   = new THREE.MeshStandardMaterial({
      color: 0x34d399, roughness: 0.6, emissive: 0x059669, emissiveIntensity: 0.18,
    });
    const wt = 0.15;
    for (const r of rooms) {
      const wM = r.gridW * scaleX;
      const hM = r.gridH * scaleY;
      const isDest = destination?.id === r.id;
      const rawWallPos = toWorld(r.gridX + r.gridW / 2, r.gridY + r.gridH / 2);
      const { x: cx, z: cz } = (isDest && destWorldPos) ? destWorldPos : rawWallPos;
      const mat = isDest ? wallMatDest : wallMatNormal;
      const h   = ROOM_WALL_H;
      const panels = [
        { pw: wM + wt * 2, pd: wt, ox: 0,       oz: -hM / 2 },
        { pw: wM + wt * 2, pd: wt, ox: 0,       oz:  hM / 2 },
        { pw: wt,          pd: hM, ox: -wM / 2, oz: 0        },
        { pw: wt,          pd: hM, ox:  wM / 2, oz: 0        },
      ];
      for (const p of panels) {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(p.pw, h, p.pd), mat);
        mesh.position.set(cx + p.ox, h / 2, cz + p.oz);
        scene.add(mesh);
      }
    }

    // Outer boundary walls (visual cap; movement is rail-bound so collision
    // isn't strictly needed but they make the scene feel enclosed).
    const boundaryMat = new THREE.MeshStandardMaterial({
      color: 0x8a939e, roughness: 0.92,
    });
    const t = 0.4;
    const boundaries = [
      { x: 0,            z: -heightM / 2, w: widthM, d: t },
      { x: 0,            z:  heightM / 2, w: widthM, d: t },
      { x: -widthM / 2,  z: 0,            w: t,      d: heightM },
      { x:  widthM / 2,  z: 0,            w: t,      d: heightM },
    ];
    for (const b of boundaries) {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(b.w, WALL_HEIGHT, b.d),
        boundaryMat,
      );
      mesh.position.set(b.x, WALL_HEIGHT / 2, b.z);
      scene.add(mesh);
    }

    // ── Path: world-space points + cumulative arc length ────────────────────
    const pathPoints = normPath.map(c => {
      const { x, z } = toWorld(c.x + 0.5, c.y + 0.5);
      return new THREE.Vector3(x, 0.08, z);
    });

    stateRef.current.pathPoints = pathPoints;

    const cumDist = [0];
    for (let i = 1; i < pathPoints.length; i++) {
      cumDist.push(cumDist[i - 1] + pathPoints[i].distanceTo(pathPoints[i - 1]));
    }
    const pathLengthM = cumDist[cumDist.length - 1] || 1;
    stateRef.current.cumDist     = cumDist;
    stateRef.current.pathLengthM = pathLengthM;

    if (pathPoints.length >= 2) {
      // Visible path: blue tube on the floor + start sphere + destination cone
      const curve = new THREE.CurvePath();
      for (let i = 1; i < pathPoints.length; i++) {
        curve.add(new THREE.LineCurve3(pathPoints[i - 1], pathPoints[i]));
      }
      const tube = new THREE.Mesh(
        new THREE.TubeGeometry(curve, Math.max(20, pathPoints.length * 2), 0.18, 8, false),
        new THREE.MeshStandardMaterial({
          color: 0x1d4ed8, emissive: 0x1d4ed8, emissiveIntensity: 0.32, roughness: 0.4,
        }),
      );
      scene.add(tube);

      const startDot = new THREE.Mesh(
        new THREE.SphereGeometry(0.32, 24, 24),
        new THREE.MeshStandardMaterial({ color: 0x1d4ed8, emissive: 0x1d4ed8, emissiveIntensity: 0.4 }),
      );
      startDot.position.copy(pathPoints[0]);
      startDot.position.y = 0.35;
      scene.add(startDot);

      const pin = new THREE.Mesh(
        new THREE.ConeGeometry(0.4, 1.2, 24),
        new THREE.MeshStandardMaterial({ color: 0x059669, emissive: 0x059669, emissiveIntensity: 0.35 }),
      );
      const end = pathPoints[pathPoints.length - 1];
      pin.position.set(end.x, 1.0, end.z);
      scene.add(pin);
    }

    // ── Resolve a (progress 0..1) to a world point + path tangent yaw ───────
    function sampleAt(progress) {
      const target = Math.max(0, Math.min(1, progress)) * pathLengthM;
      for (let i = 1; i < cumDist.length; i++) {
        if (cumDist[i] >= target) {
          const segLen = cumDist[i] - cumDist[i - 1] || 1;
          const t = (target - cumDist[i - 1]) / segLen;
          const p = pathPoints[i - 1].clone().lerp(pathPoints[i], t);
          const dir = pathPoints[i].clone().sub(pathPoints[i - 1]);
          const yaw = Math.atan2(dir.x, dir.z);
          return { pos: p, yaw };
        }
      }
      const last = pathPoints[pathPoints.length - 1] || new THREE.Vector3();
      return { pos: last, yaw: 0 };
    }

    // Project a live (gx, gy) grid position onto the polyline path and
    // return the progress (0..1) of the closest point. Used when the
    // dead-reckoning hook is active so the 3D camera follows the user
    // instead of auto-walking.
    function progressFromLive(gx, gy) {
      if (pathPoints.length < 2) return 0;
      const { x: wx, z: wz } = toWorld(gx, gy);
      let bestDist = Infinity;
      let bestArc  = 0;
      for (let i = 1; i < pathPoints.length; i++) {
        const a = pathPoints[i - 1], b = pathPoints[i];
        const dx = b.x - a.x, dz = b.z - a.z;
        const segLen2 = dx * dx + dz * dz;
        if (segLen2 < 1e-9) continue;
        let t = ((wx - a.x) * dx + (wz - a.z) * dz) / segLen2;
        t = Math.max(0, Math.min(1, t));
        const px = a.x + t * dx, pz = a.z + t * dz;
        const d2 = (wx - px) ** 2 + (wz - pz) ** 2;
        if (d2 < bestDist) {
          bestDist = d2;
          bestArc  = cumDist[i - 1] + t * Math.sqrt(segLen2);
        }
      }
      return bestArc / pathLengthM;
    }

    stateRef.current.progress = 0;
    stateRef.current.yaw = null;
    setArrived(false);
    setProgressPct(0);

    /* Shortest-angle interpolation toward target (handles ±π wrap). */
    const lerpAngle = (from, to, t) => {
      let diff = ((to - from + Math.PI) % (Math.PI * 2)) - Math.PI;
      if (diff < -Math.PI) diff += Math.PI * 2;
      return from + diff * t;
    };

    function tick(t) {
      const s = stateRef.current;
      const dt = Math.min(0.05, (t - (s.lastT || t)) / 1000);
      s.lastT = t;

      // If the dead-reckoning hook is feeding us a live position, drive the
      // camera from that (projected onto the route). Otherwise fall back to
      // the constant-speed auto-walk so the demo still moves on a desktop.
      if (pathPoints.length >= 2 && pathLengthM > 0) {
        if (!pausedRef.current) {
          const live = livePosRef.current;
          if (live && typeof live.gx === "number" && typeof live.gy === "number") {
            s.progress = progressFromLive(live.gx, live.gy);
          } else if (s.progress < 1) {
            const dp = (WALK_SPEED * speedMulRef.current * dt) / pathLengthM;
            s.progress = Math.min(1, s.progress + dp);
          }
          setProgressPct(Math.round(s.progress * 100));
        }

        // Look ~1.5 m ahead along the path so the camera begins rotating
        // *before* reaching the corner (much more natural than snapping
        // heading at the exact moment we cross into the next segment).
        const lookAheadM = 1.5;
        const aheadProgress = Math.min(
          1,
          s.progress + lookAheadM / pathLengthM,
        );
        const { pos } = sampleAt(s.progress);
        const { yaw: targetYaw } = sampleAt(aheadProgress);

        // Smoothly turn toward the target yaw (exponential damping ≈ 6 rad/s).
        if (s.yaw === null) s.yaw = targetYaw;
        else {
          const k = 1 - Math.exp(-6 * dt);
          s.yaw = lerpAngle(s.yaw, targetYaw, k);
        }

        camera.position.set(pos.x, EYE_HEIGHT, pos.z);
        camera.lookAt(
          pos.x + Math.sin(s.yaw),
          EYE_HEIGHT,
          pos.z + Math.cos(s.yaw),
        );
        const here = s.progress >= 0.995;
        setArrived(prev => (prev === here ? prev : here));
      }

      renderer.render(scene, camera);
      s.raf = requestAnimationFrame(tick);
    }
    stateRef.current.raf = requestAnimationFrame(tick);

    function handleResize() {
      const w = mount.clientWidth, h = mount.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    window.addEventListener("resize", handleResize);

    stateRef.current.cleanup = () => {
      cancelAnimationFrame(stateRef.current.raf);
      window.removeEventListener("resize",  handleResize);
      renderer.dispose();
      scene.traverse(obj => {
        if (obj.geometry) obj.geometry.dispose?.();
        if (obj.material) {
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          mats.forEach(m => { m.map?.dispose?.(); m.dispose?.(); });
        }
      });
      if (renderer.domElement && renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
    return () => {
      if (typeof stateRef.current.cleanup === 'function') {
        stateRef.current.cleanup();
      }
    };
  }, [floorMap, pathGridCells, destination, userRoom]);

  const hasPath = pathGridCells.length >= 2;

  return (
    <div className="walk3d-wrap" onClick={togglePaused}>
      <div ref={mountRef} className="walk3d-mount" />

      {!hasPath && (
        <div className="walk3d-hint">Pick a destination to walk through it in 3D.</div>
      )}

      {arrived && (
        <div className="walk3d-arrived">You've arrived at {destination?.name || "your destination"} </div>
      )}

      {hasPath && (
        <div className="walk3d-progress" aria-label="Progress along route">
          <div className="walk3d-progress-fill" style={{ width: `${progressPct}%` }} />
          <div className="walk3d-progress-label">{progressPct}%</div>
        </div>
      )}

      {hasPath && (
        <button
          type="button"
          className="walk3d-speed"
          onClick={e => { e.stopPropagation(); cycleSpeed(); }}
          aria-label={`Walk speed ${speedMul}x. Click to change.`}
          title="Change walk speed"
        >
          {speedMul}× Speed
        </button>
      )}
    </div>
  );
}
