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

const WALL_HEIGHT  = 2.7;     // metres
const EYE_HEIGHT   = 1.65;
const WALK_SPEED   = 1.4;     // metres / second auto-advance along the path

function makeLabelSprite(text, colorHex = "#0C447C") {
  const canvas = document.createElement("canvas");
  canvas.width = 512; canvas.height = 128;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = colorHex;
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, canvas.width - 6, canvas.height - 6);
  ctx.fillStyle = colorHex;
  ctx.font = "bold 64px DM Sans, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
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
  const pausedRef = useRef(false);
  useEffect(() => { speedMulRef.current = speedMul; }, [speedMul]);
  useEffect(() => { pausedRef.current = paused; }, [paused]);
  const SPEED_STEPS = [1, 2, 4];
  const cycleSpeed = () => {
    setSpeedMul(prev => {
      const i = SPEED_STEPS.indexOf(prev);
      return SPEED_STEPS[(i + 1) % SPEED_STEPS.length];
    });
  };
  const togglePaused = () => setPaused((prev) => !prev);

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

    // Floor + subtle grid lines for orientation
    const floorMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(widthM, heightM),
      new THREE.MeshStandardMaterial({ color: 0xf2f3f5, roughness: 1 }),
    );
    floorMesh.rotation.x = -Math.PI / 2;
    scene.add(floorMesh);

    // Ceiling — gives an enclosed indoor feel
    const ceiling = new THREE.Mesh(
      new THREE.PlaneGeometry(widthM, heightM),
      new THREE.MeshStandardMaterial({ color: 0xf4f5f7, roughness: 1, side: THREE.DoubleSide, transparent: true, opacity: 0.55 }),
    );
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = WALL_HEIGHT;
    scene.add(ceiling);

    const gridHelper = new THREE.GridHelper(Math.max(widthM, heightM), Math.max(cols, rows), 0xdadfe5, 0xe9ecf0);
    gridHelper.position.y = 0.01;
    scene.add(gridHelper);

    // ── Rooms: coloured floor slab + label (no walls — walls come from grid) ─
    const rooms = floorMap.rooms ?? [];
    for (const r of rooms) {
      const colour = ROOM_COLOURS[r.type] ?? 0xf5f5f5;
      const wM = r.gridW * scaleX;
      const hM = r.gridH * scaleY;
      const { x, z } = toWorld(r.gridX + r.gridW / 2, r.gridY + r.gridH / 2);
      const isDest = destination?.id === r.id;
      const isUser = userRoom?.id === r.id;

      const slabColour = isDest ? 0xb7ecd0 : isUser ? 0xbcd6f7 : colour;
      const slab = new THREE.Mesh(
        new THREE.BoxGeometry(wM, 0.05, hM),
        new THREE.MeshStandardMaterial({
          color: slabColour, roughness: 0.85, transparent: true, opacity: 0.92,
        }),
      );
      slab.position.set(x, 0.03, z);
      scene.add(slab);

      const label = makeLabelSprite(r.name, isDest ? "#059669" : isUser ? "#1d4ed8" : "#374151");
      label.position.set(x, WALL_HEIGHT - 0.35, z);
      label.scale.set(Math.min(8, Math.max(3.5, wM * 0.75)), 1.6, 1);
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

    // ── REAL WALLS from the walkability grid ────────────────────────────────
    // Every cell flagged 1 in floorMap.grid is a wall. We draw one wall cube
    // per cell using an InstancedMesh so 1500+ walls render in a single draw
    // call. We skip cells that fall along the route (a 1-cell-wide doorway)
    // so the player can travel down the path unobstructed.
    const grid = floorMap.grid ?? [];
    const pathCellSet = new Set(pathGridCells.map(c => `${c.x},${c.y}`));

    const wallCells = [];
    for (let y = 0; y < grid.length; y++) {
      const row = grid[y];
      if (!row) continue;
      for (let x = 0; x < row.length; x++) {
        if (row[x] !== 1) continue;
        if (pathCellSet.has(`${x},${y}`)) continue; // carve doorway along the path
        wallCells.push({ x, y });
      }
    }

    if (wallCells.length) {
      const wallGeom = new THREE.BoxGeometry(scaleX, WALL_HEIGHT, scaleY);
      const wallMat = new THREE.MeshStandardMaterial({
        color: 0x9aa3ad, roughness: 0.95,
      });
      const inst = new THREE.InstancedMesh(wallGeom, wallMat, wallCells.length);
      const m = new THREE.Matrix4();
      for (let i = 0; i < wallCells.length; i++) {
        const { x: gx, y: gy } = wallCells[i];
        const { x, z } = toWorld(gx + 0.5, gy + 0.5);
        m.makeTranslation(x, WALL_HEIGHT / 2, z);
        inst.setMatrixAt(i, m);
      }
      inst.instanceMatrix.needsUpdate = true;
      scene.add(inst);
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
    const pathPoints = pathGridCells.map(c => {
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
          onClick={(event) => {
            event.stopPropagation();
            cycleSpeed();
          }}
          aria-label={`Walk speed ${speedMul}x. Click to change.`}
          title="Change walk speed"
        >
          {speedMul}× Speed
        </button>
      )}

      {hasPath && (
        <div className="walk3d-help">
          Tap anywhere to {paused ? "resume" : "pause"} the walkthrough.
        </div>
      )}
    </div>
  );
}
