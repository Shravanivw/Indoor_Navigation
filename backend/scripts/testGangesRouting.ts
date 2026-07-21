import { PrismaClient } from '@prisma/client';
import { getRoute } from '../src/services/routingService';

const prisma = new PrismaClient();

async function main() {
  console.log('=== GANGES 9TH FLOOR ROUTING AND GRAPH INTEGRITY AUDIT ===');
  const floorId = 'floor-ganges-f9';

  // 1. Fetch floor details
  const floor = await prisma.floor.findUnique({
    where: { id: floorId },
    include: { rooms: true, nodes: true },
  });

  if (!floor) {
    console.error(`ERROR: Floor ${floorId} not found in database.`);
    process.exit(1);
  }

  console.log(`Floor: ${floor.name} (${floor.id})`);
  console.log(`Grid Size: ${floor.gridCols} x ${floor.gridRows}`);
  console.log(`Rooms count: ${floor.rooms.length}`);
  console.log(`Nodes count: ${floor.nodes.length}`);

  // 2. Fetch edges
  const edges = await prisma.edge.findMany({
    where: {
      OR: [
        { fromNode: { floorId } },
        { toNode: { floorId } },
      ],
    },
  });
  console.log(`Edges count: ${edges.length}`);

  // 3. Find duplicate IDs
  const roomIds = floor.rooms.map(r => r.id);
  const nodeIds = floor.nodes.map(n => n.id);
  const edgeIds = edges.map(e => e.id);

  const duplicateRooms = roomIds.filter((item, index) => roomIds.indexOf(item) !== index);
  const duplicateNodes = nodeIds.filter((item, index) => nodeIds.indexOf(item) !== index);
  const duplicateEdges = edgeIds.filter((item, index) => edgeIds.indexOf(item) !== index);

  console.log(`Duplicate Room IDs: ${duplicateRooms.length} (${duplicateRooms})`);
  console.log(`Duplicate Node IDs: ${duplicateNodes.length} (${duplicateNodes})`);
  console.log(`Duplicate Edge IDs: ${duplicateEdges.length} (${duplicateEdges})`);

  // 4. Find orphan nodes (nodes with 0 connected edges)
  const connectedNodeIds = new Set<string>();
  for (const e of edges) {
    connectedNodeIds.add(e.fromNodeId);
    connectedNodeIds.add(e.toNodeId);
  }

  const orphanNodes = floor.nodes.filter(n => !connectedNodeIds.has(n.id));
  console.log(`Orphan Nodes count: ${orphanNodes.length}`);
  if (orphanNodes.length > 0) {
    console.log('Orphan Nodes list:');
    orphanNodes.forEach(on => console.log(`  - ${on.id} at (${on.gridX}, ${on.gridY}) type=${on.type}`));
  }

  // 5. Test Routing between representative locations
  const targetRoomNames = [
    { key: 'CEO Cabin', pattern: /ceo|director|ds.head/i },
    { key: 'CFO Cabin', pattern: /cfo|dp.head/i },
    { key: 'Cafeteria', pattern: /cafeteria/i },
    { key: 'Linear Workstation', pattern: /workspace.1/i },
    { key: 'ODC - 1 (14 Pax)', pattern: /urus|kodiaq/i },
    { key: 'ODC - 1 (15 Pax)', pattern: /kodiaq/i }
  ];

  const testRooms: any[] = [];
  for (const target of targetRoomNames) {
    const matched = floor.rooms.find(r => target.pattern.test(r.name));
    if (matched) {
      testRooms.push({ label: target.key, dbRoom: matched });
      console.log(`Matched '${target.key}' to database room: '${matched.name}' (${matched.id})`);
    } else {
      console.warn(`WARNING: Could not find match for '${target.key}' in database rooms.`);
    }
  }

  console.log('\n--- TESTING ROUTES BETWEEN REPRESENTATIVE LOCATIONS ---');
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < testRooms.length; i++) {
    for (let j = 0; j < testRooms.length; j++) {
      if (i === j) continue;
      const from = testRooms[i];
      const to = testRooms[j];

      try {
        const result = await getRoute(prisma, {
          fromRoomId: from.dbRoom.id,
          toRoomId: to.dbRoom.id,
        });

        if (result.found) {
          successCount++;
          console.log(`  ✓ Route [${from.label} -> ${to.label}]: FOUND. Distance = ${result.totalDistanceM.toFixed(1)}m, Steps = ${result.steps.length}`);
        } else {
          failCount++;
          console.error(`  ✗ Route [${from.label} -> ${to.label}]: NOT FOUND!`);
        }
      } catch (err: any) {
        failCount++;
        console.error(`  ✗ Route [${from.label} -> ${to.label}]: FAILED with error: ${err.message}`);
      }
    }
  }

  // 6. Test Connectivity (Connected Components Analysis)
  console.log('\n--- CONNECTIVITY SURVEY (ALL ROOMS) ---');
  const allRooms = floor.rooms;
  let unreachableRooms: string[] = [];

  // Let's pick Reception or CEO Cabin as the reference anchor point (root)
  const rootRoom = allRooms.find(r => /reception/i.test(r.name)) ?? allRooms[0];
  console.log(`Using root anchor room: '${rootRoom.name}' (${rootRoom.id})`);

  let reachableCount = 0;
  for (const r of allRooms) {
    if (r.id === rootRoom.id) {
      reachableCount++;
      continue;
    }
    try {
      const res = await getRoute(prisma, {
        fromRoomId: rootRoom.id,
        toRoomId: r.id,
      });
      if (res.found) {
        reachableCount++;
      } else {
        unreachableRooms.push(r.name);
      }
    } catch {
      unreachableRooms.push(r.name);
    }
  }

  console.log(`Reachable rooms: ${reachableCount} / ${allRooms.length}`);
  console.log(`Unreachable rooms: ${unreachableRooms.length} (${unreachableRooms})`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
