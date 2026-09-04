import { PrismaClient } from '@prisma/client';
import { getFloorMap } from '../src/services/mapService';
import { getRoute } from '../src/services/routingService';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function inspectGurugramWings() {
  console.log("=================================================");
  console.log("      GURUGRAM FLOOR 3 WINGS & CORRIDOR AUDIT    ");
  console.log("=================================================\n");

  const floorId = 'floor-gurugram-f3';
  const floorMap = await getFloorMap(prisma, floorId);
  if (!floorMap) {
    console.error("Gurugram Floor 3 map not found!");
    return;
  }

  // Load raw Gurugram geometry data
  const geomPath = path.join(__dirname, '../src/data/Gurugram_3rd.json');
  let geomData: any = null;
  if (fs.existsSync(geomPath)) {
    geomData = JSON.parse(fs.readFileSync(geomPath, 'utf8'));
  }

  const navPath = path.join(__dirname, '../src/data/nav_gurugram_f3.json');
  let navData: any = null;
  if (fs.existsSync(navPath)) {
    navData = JSON.parse(fs.readFileSync(navPath, 'utf8'));
  }

  console.log(`Floor ID: ${floorMap.id}`);
  console.log(`Rooms count: ${floorMap.rooms.length}`);
  console.log(`Nav nodes count: ${navData?.nodes?.length ?? 0}`);
  console.log(`Nav edges count: ${navData?.edges?.length ?? 0}`);

  if (geomData) {
    console.log("\n--- CAD/DXF LAYERS IN GURUGRAM_3RD.JSON ---");
    const layers = new Set<string>();
    if (Array.isArray(geomData.walls)) {
      for (const w of geomData.walls) {
        if (w.layer) layers.add(w.layer);
      }
    }
    console.log("Layers found:", Array.from(layers));
  }

  console.log("\n--- ROOMS BY WING/LOCATION ---");
  const wing1Rooms: string[] = [];
  const wing2Rooms: string[] = [];
  const corridorRooms: string[] = [];
  const otherRooms: string[] = [];

  for (const r of floorMap.rooms) {
    const name = r.name ?? "";
    const nameLower = name.toLowerCase();
    const x = r.gridX ?? 0;
    const y = r.gridY ?? 0;

    console.log(`Room: "${name}" (${r.id}) - Type: ${r.type}, Center: [${x.toFixed(1)}, ${y.toFixed(1)}]`);
    if (r.polygon && r.polygon.length >= 3) {
      const xs = r.polygon.map((p: any) => p.x);
      const ys = r.polygon.map((p: any) => p.y);
      console.log(`  Polygon (${r.polygon.length} pts): X[${Math.min(...xs).toFixed(1)}..${Math.max(...xs).toFixed(1)}], Y[${Math.min(...ys).toFixed(1)}..${Math.max(...ys).toFixed(1)}]`);
    }

    if (x < 35) {
      wing1Rooms.push(name);
    } else if (x > 45) {
      wing2Rooms.push(name);
    } else {
      corridorRooms.push(name);
    }
  }

  console.log(`\nWing 1 Rooms (X < 35): ${wing1Rooms.length}`);
  console.log(`Wing 2 Rooms (X > 45): ${wing2Rooms.length}`);
  console.log(`Middle/Connecting Corridor Rooms (35 <= X <= 45): ${corridorRooms.length}`);

  // Test inter-wing navigation routes
  console.log("\n--- TESTING INTER-WING NAVIGATION ROUTES ---");
  const testPairs = [
    { from: "Reception 1", to: "Reception 2" },
    { from: "Reception 1", to: "HUB Room" },
    { from: "Reception 1", to: "Design Thinking Room" },
    { from: "Reception 2", to: "HUB Room" },
    { from: "Design Thinking Room", to: "UPS Room" },
    { from: "Cabin 1", to: "Meeting Room 5" },
  ];

  for (const pair of testPairs) {
    const r1 = floorMap.rooms.find(r => r.name.toLowerCase().includes(pair.from.toLowerCase()));
    const r2 = floorMap.rooms.find(r => r.name.toLowerCase().includes(pair.to.toLowerCase()));
    if (!r1 || !r2) continue;

    const route = await getRoute(prisma, { fromRoomId: r1.id, toRoomId: r2.id });
    if (!route || !route.found) {
      console.log(`  ❌ Route [${pair.from}] -> [${pair.to}]: FAILED`);
      continue;
    }

    console.log(`\n  Route [${r1.name}] -> [${r2.name}]:`);
    console.log(`    Distance: ${route.totalDistanceM}m, Nodes: ${route.pathNodeIds?.length}, Cells: ${route.pathGridCells?.length}`);
    console.log(`    Start cell:`, JSON.stringify(route.pathGridCells?.[0]));
    console.log(`    Mid cell:`, JSON.stringify(route.pathGridCells?.[Math.floor((route.pathGridCells?.length || 0)/2)]));
    console.log(`    End cell:`, JSON.stringify(route.pathGridCells?.[route.pathGridCells?.length - 1]));
  }

  await prisma.$disconnect();
}

inspectGurugramWings().catch(console.error);
