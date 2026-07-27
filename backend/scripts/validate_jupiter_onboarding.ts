import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { buildGraph } from '../src/engine/graphBuilder';
import { getRoute } from '../src/services/routingService';

const prisma = new PrismaClient();

async function validateJupiterOnboarding() {
  console.log('====================================================');
  console.log('JUPITER (BANGALORE) ONBOARDING VALIDATION REPORT');
  console.log('====================================================\n');

  const floorId = 'floor-jupiter-f1';

  // 1. Fetch DB Floor & Building
  const building = await prisma.building.findUnique({ where: { id: 'building-jupiter' } });
  const floor = await prisma.floor.findUnique({ where: { id: floorId } });

  console.log(`✓ Building: ${building?.name ?? 'NOT FOUND'} (${building?.id})`);
  console.log(`✓ Floor:    ${floor?.name ?? 'NOT FOUND'} (Level: ${floor?.level}, ID: ${floor?.id})`);
  console.log(`  Grid:     ${floor?.gridCols} x ${floor?.gridRows}`);
  console.log(`  Real Dim: ${floor?.realWidthM}m x ${floor?.realHeightM}m\n`);

  // 2. Fetch Rooms, Nodes, Edges
  const rooms = await prisma.room.findMany({ where: { floorId } });
  const nodes = await prisma.node.findMany({ where: { floorId } });
  const edges = await prisma.edge.findMany({
    where: {
      OR: [
        { fromNode: { floorId } },
        { toNode: { floorId } }
      ]
    }
  });

  // 3. Wall count from cleaned DXF JSON
  const cleanJsonPath = path.resolve(__dirname, '..', 'src', 'data', 'floor_jupiter_clean.json');
  let wallCount = 0;
  if (fs.existsSync(cleanJsonPath)) {
    const cleanData = JSON.parse(fs.readFileSync(cleanJsonPath, 'utf-8'));
    wallCount = cleanData.walls?.length ?? 0;
  }

  // 4. Door count
  const doorNodes = nodes.filter(n => n.type === 'ROOM_ENTRY');

  console.log('--- STATISTICAL SUMMARY ---');
  console.log(`• Room Count:             ${rooms.length}`);
  console.log(`• Wall Segment Count:     ${wallCount}`);
  console.log(`• Door Node Count:        ${doorNodes.length}`);
  console.log(`• Navigation Node Count:  ${nodes.length}`);
  console.log(`• Navigation Edge Count:  ${edges.length}\n`);

  // 5. Duplicate Checks
  const roomIds = rooms.map(r => r.id);
  const roomCodes = rooms.map(r => r.code);
  const nodeIds = nodes.map(n => n.id);

  const duplicateRoomIds = roomIds.filter((id, index) => roomIds.indexOf(id) !== index);
  const duplicateRoomCodes = roomCodes.filter((code, index) => roomCodes.indexOf(code) !== index);
  const duplicateNodeIds = nodeIds.filter((id, index) => nodeIds.indexOf(id) !== index);

  // Check duplicate node coordinates
  const nodeCoordMap = new Map<string, string[]>();
  nodes.forEach(n => {
    const key = `${n.realX},${n.realY}`;
    if (!nodeCoordMap.has(key)) nodeCoordMap.set(key, []);
    nodeCoordMap.get(key)!.push(n.id);
  });
  const duplicateNodeCoords = Array.from(nodeCoordMap.entries()).filter(([_, ids]) => ids.length > 1);

  console.log('--- DUPLICATE CHECKS ---');
  console.log(`• Duplicate Room IDs:     ${duplicateRoomIds.length} ${duplicateRoomIds.length ? JSON.stringify(duplicateRoomIds) : '✓ (None)'}`);
  console.log(`• Duplicate Room Codes:   ${duplicateRoomCodes.length} ${duplicateRoomCodes.length ? JSON.stringify(duplicateRoomCodes) : '✓ (None)'}`);
  console.log(`• Duplicate Node IDs:     ${duplicateNodeIds.length} ${duplicateNodeIds.length ? JSON.stringify(duplicateNodeIds) : '✓ (None)'}`);
  console.log(`• Duplicate Node Coords:  ${duplicateNodeCoords.length} ${duplicateNodeCoords.length ? JSON.stringify(duplicateNodeCoords) : '✓ (None)'}\n`);

  // 6. Connected Components & Reachability
  const graphNodes = nodes.map(n => ({
    id: n.id,
    floorId: n.floorId,
    roomId: n.roomId,
    gridX: n.gridX,
    gridY: n.gridY,
    realX: n.realX,
    realY: n.realY,
    type: n.type,
    label: n.label
  }));

  const graphEdges = edges.map(e => ({
    fromNodeId: e.fromNodeId,
    toNodeId: e.toNodeId,
    weight: e.weight,
    isAccessible: e.isAccessible,
  }));

  const graph = buildGraph(graphNodes, graphEdges);

  // Find connected components using BFS
  const visited = new Set<string>();
  const components: string[][] = [];

  for (const node of nodes) {
    if (!visited.has(node.id)) {
      const comp: string[] = [];
      const queue = [node.id];
      visited.add(node.id);
      while (queue.length > 0) {
        const curr = queue.shift()!;
        comp.push(curr);
        const neighbors = graph.adjacency.get(curr) ?? [];
        for (const edge of neighbors) {
          if (!visited.has(edge.nodeId)) {
            visited.add(edge.nodeId);
            queue.push(edge.nodeId);
          }
        }
      }
      components.push(comp);
    }
  }

  console.log('--- TOPOLOGY & CONNECTIVITY ---');
  console.log(`• Connected Components:   ${components.length}`);
  components.forEach((comp, idx) => {
    console.log(`  Component ${idx + 1}: ${comp.length} nodes`);
  });

  // Check unreachable rooms
  const mainCompSet = new Set(components.sort((a, b) => b.length - a.length)[0]);
  const unreachableRooms: typeof rooms = [];
  const reachableRooms: typeof rooms = [];

  for (const room of rooms) {
    const rNodes = nodes.filter(n => n.roomId === room.id);
    const isReachable = rNodes.some(n => mainCompSet.has(n.id));
    if (isReachable) {
      reachableRooms.push(room);
    } else {
      unreachableRooms.push(room);
    }
  }

  console.log(`• Total Rooms:            ${rooms.length}`);
  console.log(`• Reachable Rooms:        ${reachableRooms.length} (${((reachableRooms.length / rooms.length) * 100).toFixed(1)}%)`);
  console.log(`• Unreachable Rooms:      ${unreachableRooms.length} ${unreachableRooms.length === 0 ? '✓ (None)' : ''}`);
  if (unreachableRooms.length > 0) {
    unreachableRooms.forEach(r => console.log(`  - Unreachable: ${r.name} (${r.id})`));
  }
  console.log('');

  // 7. Representative Route Tests
  console.log('--- REPRESENTATIVE ROUTE TESTS ---');
  const receptionRoom = rooms.find(r => r.name.toLowerCase().includes('reception'));
  const testTargets = [
    'AI Training Room',
    'Cafeteria',
    'IT Room',
    'SAP Delivery Head Cabin',
    'Server Area',
    'Meeting Room',
    'Mail Room',
    'BMS Room'
  ];

  if (receptionRoom) {
    console.log(`Origin: ${receptionRoom.name} (${receptionRoom.id})\n`);
    for (const targetName of testTargets) {
      const targetRoom = rooms.find(r => r.name.toLowerCase().includes(targetName.toLowerCase()));
      if (!targetRoom) {
        console.log(`  x Target "${targetName}" not found`);
        continue;
      }

      try {
        const routeResult = await getRoute(prisma, {
          fromRoomId: receptionRoom.id,
          toRoomId: targetRoom.id
        });

        if (routeResult.found) {
          console.log(`  ✓ Route to ${targetRoom.name}: ${routeResult.totalDistanceM}m, ${routeResult.steps.length} steps, ${routeResult.estimatedSeconds}s`);
        } else {
          console.log(`  x NO ROUTE to ${targetRoom.name}`);
        }
      } catch (err: any) {
        console.log(`  x Route computation error to ${targetRoom.name}: ${err.message}`);
      }
    }
  } else {
    console.log('Reception room not found for test routes.');
  }

  console.log('\n====================================================');
  console.log('VALIDATION COMPLETE');
  console.log('====================================================');

  await prisma.$disconnect();
}

validateJupiterOnboarding().catch(err => {
  console.error(err);
  process.exit(1);
});
