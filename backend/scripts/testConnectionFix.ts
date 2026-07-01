import { PrismaClient } from '@prisma/client';
import { getRoute } from '../src/services/routingService';

const prisma = new PrismaClient();

async function run() {
  const fromRoomId = 'editor-floor-hudson-f6-room-reception';
  const toRoomId = 'editor-floor-hudson-f6-room-10-pax-byod-room';

  console.log("=== SIMULATING GRAPH CONNECTION FIX ===");

  // Apply the fix directly in the SQLite database temporarily so we can test routing service
  console.log("Applying edge modifications in SQLite database...");
  
  // 1. Delete the direct edge between N4 and N34 on Floor 6
  const del1 = await prisma.edge.deleteMany({
    where: {
      OR: [
        { fromNodeId: 'editor-floor-hudson-f6-node-n4', toNodeId: 'editor-floor-hudson-f6-node-n34' },
        { fromNodeId: 'editor-floor-hudson-f6-node-n34', toNodeId: 'editor-floor-hudson-f6-node-n4' }
      ]
    }
  });
  console.log(`Deleted N4-N34 edge:`, del1.count);

  // 2. Create the two split edges
  const edge1 = await prisma.edge.upsert({
    where: { fromNodeId_toNodeId: { fromNodeId: 'editor-floor-hudson-f6-node-n4', toNodeId: 'editor-floor-hudson-f6-node-n37' } },
    update: {},
    create: {
      id: 'editor-floor-hudson-f6-edge-n4-n37',
      fromNodeId: 'editor-floor-hudson-f6-node-n4',
      toNodeId: 'editor-floor-hudson-f6-node-n37',
      weight: 120.0
    }
  });
  console.log("Created edge N4-N37:", edge1.id);

  const edge2 = await prisma.edge.upsert({
    where: { fromNodeId_toNodeId: { fromNodeId: 'editor-floor-hudson-f6-node-n37', toNodeId: 'editor-floor-hudson-f6-node-n34' } },
    update: {},
    create: {
      id: 'editor-floor-hudson-f6-edge-n37-n34',
      fromNodeId: 'editor-floor-hudson-f6-node-n37',
      toNodeId: 'editor-floor-hudson-f6-node-n34',
      weight: 287.0
    }
  });
  console.log("Created edge N37-N34:", edge2.id);

  // Test routing again
  console.log("\nRe-testing routing Reception -> 10 Pax BYOD Room...");
  try {
    const route = await getRoute(prisma, { fromRoomId, toRoomId });
    console.log(`* found: ${route.found}`);
    console.log(`* pathNodeIds:`, route.pathNodeIds);
    console.log(`* pathGridCells length:`, route.pathGridCells.length);
    console.log(`* totalDistanceM: ${route.totalDistanceM} m`);
  } catch (err: any) {
    console.error("Routing failed:", err.message);
  }

  await prisma.$disconnect();
}

run().catch(console.error);
