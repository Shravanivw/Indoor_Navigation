import { PrismaClient } from '@prisma/client';
import { getFloorMap } from '../src/services/mapService';
import { getRoute } from '../src/services/routingService';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function analyzeGurugram() {
  console.log("=================================================");
  console.log("   GURUGRAM FLOOR 3 CORRIDORS & RAILINGS AUDIT   ");
  console.log("=================================================\n");

  const floorId = 'floor-gurugram-f3';
  const floorMap = await getFloorMap(prisma, floorId);
  if (!floorMap) {
    console.error("Gurugram Floor 3 not found!");
    return;
  }

  const rawCadPath = path.join(__dirname, '../src/data/Gurugram_3rd.json');
  const rawCad = JSON.parse(fs.readFileSync(rawCadPath, 'utf8'));

  console.log(`Floor: ${floorMap.building?.name || 'Gurugram'}, Level: ${floorMap.level}`);
  console.log(`Total Rooms: ${floorMap.rooms.length}`);

  console.log("\n--- CORRIDOR & MALL CONNECTIVITY ANALYSIS ---");
  
  // Categorize rooms
  const leftWing: any[] = [];
  const rightWing: any[] = [];
  const connectingBridge: any[] = [];

  for (const r of floorMap.rooms) {
    const gx = r.gridX ?? 0;
    if (gx < 32) leftWing.push(r);
    else if (gx > 46) rightWing.push(r);
    else connectingBridge.push(r);
  }

  console.log(`Left Wing Rooms (gridX < 32): ${leftWing.length}`);
  console.log(`Right Wing Rooms (gridX > 46): ${rightWing.length}`);
  console.log(`Connecting Bridge Rooms (32 <= gridX <= 46): ${connectingBridge.length}`);
  for (const r of connectingBridge) {
    console.log(`  Bridge/Connecting Room: "${r.name}" (${r.id}) @ grid [${r.gridX}, ${r.gridY}]`);
  }

  // Audit sample inter-wing routes
  const testRoutes = [
    { from: "Reception 1", to: "Reception 2", note: "Left Wing internal to Left Wing external" },
    { from: "Reception 1", to: "HUB Room", note: "Left Wing to Central Connecting Bridge" },
    { from: "Reception 1", to: "Design Thinking Room", note: "Left Wing across Bridge to Right Wing" },
    { from: "PD Head Cabin 1", to: "Meeting Room 5", note: "Left Wing deep office to Right Wing office" },
    { from: "Reception 2", to: "HUB Room", note: "Left Wing secondary entrance to Bridge" },
    { from: "Design Thinking Room", to: "UPS Room", note: "Right Wing to Central Bridge" }
  ];

  for (const t of testRoutes) {
    const rFrom = floorMap.rooms.find(r => r.name.toLowerCase().includes(t.from.toLowerCase()));
    const rTo = floorMap.rooms.find(r => r.name.toLowerCase().includes(t.to.toLowerCase()));
    if (!rFrom || !rTo) continue;

    const route = await getRoute(prisma, { fromRoomId: rFrom.id, toRoomId: rTo.id });
    if (!route || !route.found) {
      console.log(`  ❌ FAIL: ${t.from} -> ${t.to}`);
      continue;
    }

    console.log(`\n  Route [${rFrom.name}] -> [${rTo.name}] (${t.note}):`);
    console.log(`    Distance: ${route.totalDistanceM}m, Path Node Count: ${route.pathNodeIds?.length}`);
    console.log(`    Start: (${route.pathGridCells?.[0]?.x.toFixed(1)}, ${route.pathGridCells?.[0]?.y.toFixed(1)})`);
    console.log(`    Mid:   (${route.pathGridCells?.[Math.floor(route.pathGridCells.length/2)]?.x.toFixed(1)}, ${route.pathGridCells?.[Math.floor(route.pathGridCells.length/2)]?.y.toFixed(1)})`);
    console.log(`    End:   (${route.pathGridCells?.[route.pathGridCells.length-1]?.x.toFixed(1)}, ${route.pathGridCells?.[route.pathGridCells.length-1]?.y.toFixed(1)})`);

    let validSteps = 0;
    for (let i = 1; i < route.pathGridCells.length; i++) {
      const p1 = route.pathGridCells[i-1];
      const p2 = route.pathGridCells[i];
      const stepDist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      if (stepDist < 20) validSteps++;
    }
    console.log(`    Valid contiguous steps: ${validSteps} / ${route.pathGridCells.length - 1}`);
  }

  await prisma.$disconnect();
}

analyzeGurugram().catch(console.error);
