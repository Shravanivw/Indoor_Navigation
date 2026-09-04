import { PrismaClient } from '@prisma/client';
import { getFloorMap } from '../src/services/mapService';
import { getRoute } from '../src/services/routingService';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

// Helper: Line segment intersection test
function lineIntersectsLine(p1: {x: number, y: number}, p2: {x: number, y: number}, p3: {x: number, y: number}, p4: {x: number, y: number}): boolean {
  const ccw = (a: {x: number, y: number}, b: {x: number, y: number}, c: {x: number, y: number}) => {
    return (c.y - a.y) * (b.x - a.x) > (b.y - a.y) * (c.x - a.x);
  };
  return ccw(p1, p3, p4) !== ccw(p2, p3, p4) && ccw(p1, p2, p3) !== ccw(p1, p2, p4);
}

async function runAudit() {
  console.log("=================================================");
  console.log("   FULL MULTI-FLOOR ROUTE & OBSTACLE AUDIT SUITE ");
  console.log("=================================================\n");

  const floorIds = [
    'floor-hudson-f5',
    'floor-hudson-f6',
    'floor-hudson-f7',
    'floor-ganges-f9',
    'floor-jupiter-f1',
    'floor-gravity-f1',
    'floor-gurugram-f3',
  ];

  for (const floorId of floorIds) {
    console.log(`\n=================================================`);
    console.log(` AUDITING FLOOR: ${floorId}`);
    console.log(`=================================================`);

    const floorMap = await getFloorMap(prisma, floorId);
    if (!floorMap) {
      console.error(`Floor ${floorId} not found!`);
      continue;
    }

    const navFileName = `nav_${floorId.replace('floor-', '').replace('-', '_')}.json`;
    const navDataPath = path.join(__dirname, `../src/data/${navFileName}`);
    let rawNav: any = null;
    if (fs.existsSync(navDataPath)) {
      rawNav = JSON.parse(fs.readFileSync(navDataPath, 'utf8'));
    }

    const rooms = floorMap.rooms;
    const gridCols = Number(floorMap.gridCols) || 80;
    const gridRows = Number(floorMap.gridRows) || 80;

    console.log(`Rooms count: ${rooms.length}`);
    console.log(`Nav nodes count: ${rawNav?.nodes?.length ?? 0}`);
    console.log(`Nav edges count: ${rawNav?.edges?.length ?? 0}`);
    console.log(`Grid dimensions: ${gridCols} x ${gridRows}`);

    const polygonRooms = rooms.filter(r => Array.isArray(r.polygon) && r.polygon.length >= 3);
    console.log(`Polygon rooms count: ${polygonRooms.length}`);

    // Check Jupiter specific workspace rooms & navigation node placement
    if (floorId === 'floor-jupiter-f1') {
      console.log(`\n--- JUPITER F1 DETAILED NAVIGATION & WORKSPACE ANALYSIS ---`);
      
      for (const r of rooms) {
        if (r.name.toLowerCase().includes("workspace") || r.name.toLowerCase().includes("reception") || r.name.toLowerCase().includes("meeting") || r.name.toLowerCase().includes("cafeteria")) {
          console.log(`  Room: "${r.name}" (${r.id}) - Type: ${r.type}, PolyPts: ${r.polygon?.length || 0}`);
        }
      }

      const jupiterTestPairs = [
        { from: "Reception", to: "Workspace 1" },
        { from: "Reception", to: "Workspace 2" },
        { from: "Workspace 1", to: "Workspace 2" },
        { from: "Workspace 1", to: "Meeting Room 1" },
        { from: "Workspace 2", to: "Cafeteria" },
        { from: "Reception", to: "Cafeteria" }
      ];

      for (const pair of jupiterTestPairs) {
        const fromRoom = rooms.find(r => r.name.toLowerCase().includes(pair.from.toLowerCase()));
        const toRoom = rooms.find(r => r.name.toLowerCase().includes(pair.to.toLowerCase()));
        if (!fromRoom || !toRoom) continue;

        const route = await getRoute(prisma, { fromRoomId: fromRoom.id, toRoomId: toRoom.id });
        if (!route || !route.found) {
          console.log(`  ❌ Route [${pair.from}] -> [${pair.to}]: FAILED / NULL`);
          continue;
        }

        console.log(`\n  Route [${fromRoom.name}] -> [${toRoom.name}]:`);
        console.log(`    Distance: ${route.totalDistanceM}m, PathCells: ${route.pathGridCells?.length ?? 0}`);
        console.log(`    First 3 cells:`, JSON.stringify(route.pathGridCells?.slice(0, 3)));
        console.log(`    Last 3 cells:`, JSON.stringify(route.pathGridCells?.slice(-3)));

        // Check if path cells pass through any room polygons illegally (not through doors)
        if (route.pathGridCells && route.pathGridCells.length > 0) {
          let wallCollisionsInRoute = 0;
          for (let i = 1; i < route.pathGridCells.length; i++) {
            const p1 = route.pathGridCells[i-1];
            const p2 = route.pathGridCells[i];

            for (const polyRoom of polygonRooms) {
              if (polyRoom.id === fromRoom.id || polyRoom.id === toRoom.id) continue;
              const poly = polyRoom.polygon;

              for (let k = 0; k < poly.length; k++) {
                const wallP1 = poly[k];
                const wallP2 = poly[(k + 1) % poly.length];

                if (lineIntersectsLine(p1, p2, wallP1, wallP2)) {
                  const hasDoorNearby = (polyRoom.doors || []).some((door: any) => {
                    const dist1 = Math.hypot(door.x - p1.x, door.y - p1.y);
                    const dist2 = Math.hypot(door.x - p2.x, door.y - p2.y);
                    return dist1 <= 4.0 || dist2 <= 4.0;
                  });

                  if (!hasDoorNearby) {
                    wallCollisionsInRoute++;
                    console.log(`    ⚠️ COLLISION: Route segment (${p1.x.toFixed(1)}, ${p1.y.toFixed(1)}) -> (${p2.x.toFixed(1)}, ${p2.y.toFixed(1)}) crosses wall of room "${polyRoom.name}"!`);
                  }
                }
              }
            }
          }
          console.log(`    Wall collisions detected: ${wallCollisionsInRoute}`);
        }
      }
    }

    let totalPairs = 0;
    let reachableCount = 0;
    let unreachableCount = 0;

    const sampleOrigin = rooms.find(r => r.type === "RECEPTION" || r.name.toLowerCase().includes("reception")) || rooms[0];
    for (const destRoom of rooms) {
      if (destRoom.id === sampleOrigin.id) continue;
      totalPairs++;
      const res = await getRoute(prisma, { fromRoomId: sampleOrigin.id, toRoomId: destRoom.id });
      if (res && res.found && res.pathGridCells && res.pathGridCells.length > 0) {
        reachableCount++;
      } else {
        unreachableCount++;
        console.log(`  ❌ UNREACHABLE ROOM: "${destRoom.name}" (${destRoom.id}) from "${sampleOrigin.name}"`);
      }
    }

    console.log(`\n  Connectivity summary for ${floorId}:`);
    console.log(`    Origin room: "${sampleOrigin.name}"`);
    console.log(`    Total target rooms: ${totalPairs}`);
    console.log(`    Reachable:   ${reachableCount}`);
    console.log(`    Unreachable: ${unreachableCount}`);
  }

  await prisma.$disconnect();
}

runAudit().catch(console.error);
