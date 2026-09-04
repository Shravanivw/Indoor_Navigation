import { PrismaClient } from '@prisma/client';
import { getFloorMap } from '../src/services/mapService';
import { getRoute } from '../src/services/routingService';
import { buildGraph, validateGraph } from '../src/engine/graphBuilder';

const prisma = new PrismaClient();

function lineIntersectsLine(p1: {x: number, y: number}, p2: {x: number, y: number}, p3: {x: number, y: number}, p4: {x: number, y: number}): boolean {
  const ccw = (a: {x: number, y: number}, b: {x: number, y: number}, c: {x: number, y: number}) => {
    return (c.y - a.y) * (b.x - a.x) > (b.y - a.y) * (c.x - a.x);
  };
  return ccw(p1, p3, p4) !== ccw(p2, p3, p4) && ccw(p1, p2, p3) !== ccw(p1, p2, p4);
}

async function runAudit() {
  console.log("=================================================");
  console.log("    MULTI-FLOOR OBSTACLE & CONNECTIVITY AUDIT    ");
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

  const dbNodes = await prisma.node.findMany();
  const dbEdges = await prisma.edge.findMany();

  const graphNodes = dbNodes.map(n => ({
    id: n.id,
    floorId: n.floorId,
    roomId: n.roomId,
    gridX: n.gridX,
    gridY: n.gridY,
    realX: n.realX,
    realY: n.realY,
    type: n.type,
    label: n.label,
  }));

  const graphEdges = dbEdges.map(e => ({
    fromNodeId: e.fromNodeId,
    toNodeId: e.toNodeId,
    weight: e.weight,
    isAccessible: e.isAccessible,
  }));

  const graph = buildGraph(graphNodes, graphEdges);
  const stats = validateGraph(graph);

  console.log(`Global Graph Statistics:`);
  console.log(`  Total Nodes: ${stats.totalNodes}`);
  console.log(`  Total Edges: ${stats.totalEdges}`);
  console.log(`  Isolated Nodes: ${stats.isolatedNodes.length}`);
  console.log(`  LCC Nodes: ${graph.lccNodes?.size ?? 0}`);

  for (const floorId of floorIds) {
    console.log(`\n-------------------------------------------------`);
    console.log(`FLOOR: ${floorId}`);
    console.log(`-------------------------------------------------`);

    const floorMap = await getFloorMap(prisma, floorId);
    if (!floorMap) continue;

    const rooms = floorMap.rooms;
    const origin = rooms.find(r => r.type === "RECEPTION" || r.name.toLowerCase().includes("reception")) || rooms[0];

    let totalTested = 0;
    let reachable = 0;
    let unreachable = 0;
    let wallCollisions = 0;

    for (const dest of rooms) {
      if (dest.id === origin.id) continue;
      totalTested++;

      const route = await getRoute(prisma, { fromRoomId: origin.id, toRoomId: dest.id });
      if (route && route.found && route.pathGridCells && route.pathGridCells.length > 0) {
        reachable++;

        // Collision check
        for (let i = 1; i < route.pathGridCells.length; i++) {
          const p1 = route.pathGridCells[i - 1];
          const p2 = route.pathGridCells[i];

          for (const polyRoom of rooms) {
            if (polyRoom.id === origin.id || polyRoom.id === dest.id) continue;
            if (!Array.isArray(polyRoom.polygon) || polyRoom.polygon.length < 3) continue;

            const poly = polyRoom.polygon;
            for (let k = 0; k < poly.length; k++) {
              const w1 = poly[k];
              const w2 = poly[(k + 1) % poly.length];

              if (lineIntersectsLine(p1, p2, w1, w2)) {
                const hasDoor = (polyRoom.doors || []).some((door: any) => {
                  const d1 = Math.hypot(door.x - p1.x, door.y - p1.y);
                  const d2 = Math.hypot(door.x - p2.x, door.y - p2.y);
                  return d1 <= 4.0 || d2 <= 4.0;
                });
                if (!hasDoor) {
                  wallCollisions++;
                }
              }
            }
          }
        }
      } else {
        unreachable++;
        console.log(`  ❌ Unreachable room: "${dest.name}" (${dest.id})`);
      }
    }

    console.log(`  Origin Room: "${origin.name}"`);
    console.log(`  Total Target Rooms: ${totalTested}`);
    console.log(`  Reachable:   ${reachable} (${((reachable/totalTested)*100).toFixed(1)}%)`);
    console.log(`  Unreachable: ${unreachable}`);
    console.log(`  Illegal Wall/Workspace Collisions: ${wallCollisions}`);
  }

  await prisma.$disconnect();
}

runAudit().catch(console.error);
