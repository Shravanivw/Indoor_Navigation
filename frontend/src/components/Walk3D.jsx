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

    scene.add(new THREE.AmbientLight(0xffffff, 0.88));
    const sun = new THREE.DirectionalLight(0xffffff, 0.5);
    sun.position.set(20, 40, 15);
    scene.add(sun);

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
      new THREE.MeshStandardMaterial({ color: 0xeaecef, roughness: 1, side: THREE.DoubleSide }),
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
          color: slabColour, roughness: 0.9, transparent: true, opacity: 0.55,
        }),
      );
      slab.position.set(x, 0.03, z);
      scene.add(slab);

      const label = makeLabelSprite(r.name, isDest ? "#059669" : isUser ? "#1d4ed8" : "#374151");
      label.position.set(x, WALL_HEIGHT - 0.25, z);
      label.scale.set(Math.min(8, Math.max(3, wM * 0.7)), 1.4, 1);
      scene.add(label);
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
        color: 0xb4bcc6, roughness: 0.92, transparent: true, opacity: 0.55,
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
      color: 0xb0b8c2, roughness: 0.9, transparent: true, opacity: 0.45,
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
        const live = livePosRef.current;
        if (live && typeof live.gx === "number" && typeof live.gy === "number") {
          s.progress = progressFromLive(live.gx, live.gy);
        } else if (s.progress < 1) {
          const dp = (WALK_SPEED * dt) / pathLengthM;
          s.progress = Math.min(1, s.progress + dp);
        }
        setProgressPct(Math.round(s.progress * 100));

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
      } else {
        camera.position.set(0, EYE_HEIGHT, 0);
        camera.lookAt(0, EYE_HEIGHT, 1);
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
    return () => stateRef.current.cleanup?.();
  }, [floorMap, pathGridCells, destination, userRoom]);

  const hasPath = pathGridCells.length >= 2;

  return (
    <div className="walk3d-wrap">
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
    </div>
  );
}
