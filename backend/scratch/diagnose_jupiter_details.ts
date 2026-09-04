import { PrismaClient } from '@prisma/client';
import { getFloorMap } from '../src/services/mapService';
import { getRoute } from '../src/services/routingService';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function analyzeJupiter() {
  console.log("=================================================");
  console.log("      BANGALORE / JUPITER F1 AUDIT & DIAGNOSIS   ");
  console.log("=================================================\n");

  const floorMap = await getFloorMap(prisma, 'floor-jupiter-f1');
  if (!floorMap) {
    console.error("Jupiter floor not found!");
    return;
  }

  const navPath = path.join(__dirname, '../src/data/nav_jupiter_f1.json');
  let navData: any = null;
  if (fs.existsSync(navPath)) {
    navData = JSON.parse(fs.readFileSync(navPath, 'utf8'));
  }

  console.log(`Building: Jupiter, Level: ${floorMap.level}`);
  console.log(`Rooms count: ${floorMap.rooms.length}`);
  console.log(`Nav nodes count: ${navData?.nodes?.length ?? 0}`);
  console.log(`Nav edges count: ${navData?.edges?.length ?? 0}`);
  console.log(`Grid dimensions: ${navData?.gridCols ?? 80} x ${navData?.gridRows ?? 80}`);

  console.log("\n--- JUPITER ROOMS ---");
  for (const r of floorMap.rooms) {
    if (r.name.toLowerCase().includes("workspace") || r.name.toLowerCase().includes("reception") || r.name.toLowerCase().includes("meeting") || r.name.toLowerCase().includes("cafeteria")) {
      console.log(`Room: "${r.name}" (${r.id}) - Type: ${r.type}`);
      if (r.polygon && r.polygon.length >= 3) {
        const xs = r.polygon.map((p: any) => p.x);
        const ys = r.polygon.map((p: any) => p.y);
        console.log(`  Polygon (${r.polygon.length} pts): X[${Math.min(...xs).toFixed(1)}..${Math.max(...xs).toFixed(1)}], Y[${Math.min(...ys).toFixed(1)}..${Math.max(...ys).toFixed(1)}]`);
      } else {
        console.log(`  Grid: [${r.gridX}, ${r.gridY}], W:${r.gridW}, H:${r.gridH}`);
      }
      if (r.doors && r.doors.length > 0) {
        console.log(`  Doors (${r.doors.length}):`, JSON.stringify(r.doors));
      }
    }
  }

  if (navData && Array.isArray(navData.nodes)) {
    console.log("\n--- JUPITER NAVIGATION NODES IN WORKSPACE ROOMS ---");
    for (const n of navData.nodes) {
      if (n.id.includes("workspace") || n.id.includes("room") || n.id.includes("door")) {
        console.log(`Node ${n.id}: grid(${n.gridX}, ${n.gridY}), pos(${n.x?.toFixed(1)}, ${n.y?.toFixed(1)})`);
      }
    }
  }

  // Check routes across all room pairs in Jupiter F1
  console.log("\n--- AUDITING ALL JUPITER ROUTES FOR WALL & WORKSPACE COLLISIONS ---");

  let totalCollisions = 0;
  let problematicRoutesCount = 0;
  const collisionReport: any[] = [];

  for (let i = 0; i < floorMap.rooms.length; i++) {
    for (let j = i + 1; j < floorMap.rooms.length; j++) {
      const r1 = floorMap.rooms[i];
      const r2 = floorMap.rooms[j];

      const route = await getRoute(prisma, { fromRoomId: r1.id, toRoomId: r2.id });
      if (!route || !route.found || !route.pathGridCells || route.pathGridCells.length < 2) continue;

      // Check route path cells against room polygons
      for (const room of floorMap.rooms) {
        if (room.id === r1.id || room.id === r2.id) continue;
        if (!Array.isArray(room.polygon) || room.polygon.length < 3) continue;

        const poly = room.polygon;

        for (let step = 1; step < route.pathGridCells.length; step++) {
          const p1 = route.pathGridCells[step - 1];
          const p2 = route.pathGridCells[step];

          for (let k = 0; k < poly.length; k++) {
            const w1 = poly[k];
            const w2 = poly[(k + 1) % poly.length];

            const ccw = (a: any, b: any, c: any) => (c.y - a.y) * (b.x - a.x) > (b.y - a.y) * (c.x - a.x);
            const intersects = (ccw(p1, w1, w2) !== ccw(p2, w1, w2)) && (ccw(p1, p2, w1) !== ccw(p1, p2, w2));

            if (intersects) {
              const hasDoor = (room.doors || []).some((door: any) => {
                const dist1 = Math.hypot(door.x - p1.x, door.y - p1.y);
                const dist2 = Math.hypot(door.x - p2.x, door.y - p2.y);
                return dist1 <= 3.5 || dist2 <= 3.5;
              });

              if (!hasDoor) {
                totalCollisions++;
                problematicRoutesCount++;
                collisionReport.push({
                  from: r1.name,
                  to: r2.name,
                  collidedWithRoom: room.name,
                  segment: [p1, p2]
                });
                break;
              }
            }
          }
        }
      }
    }
  }

  console.log(`\n=================================================`);
  console.log(`JUPITER AUDIT RESULTS:`);
  console.log(`  Total problematic route collisions: ${totalCollisions}`);
  console.log(`  Unique problematic route pairs: ${problematicRoutesCount}`);
  if (collisionReport.length > 0) {
    console.log(`  Sample collisions:`, JSON.stringify(collisionReport.slice(0, 10), null, 2));
  }
  console.log(`=================================================`);

  await prisma.$disconnect();
}

analyzeJupiter().catch(console.error);
