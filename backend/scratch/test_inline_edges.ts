import { PrismaClient } from '@prisma/client';
import { buildGraph } from '../src/engine/graphBuilder';

const prisma = new PrismaClient();

async function testInlineEdges() {
  console.log("=================================================");
  console.log("      TESTING SPLIT INLINE EDGES THRESHOLD       ");
  console.log("=================================================\n");

  const nodes = await prisma.node.findMany();
  const edges = await prisma.edge.findMany();

  console.log(`Total database nodes: ${nodes.length}`);
  console.log(`Total database edges: ${edges.length}`);

  const graphNodes = nodes.map(n => ({
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

  const graphEdges = edges.map(e => ({
    fromNodeId: e.fromNodeId,
    toNodeId: e.toNodeId,
    weight: e.weight,
    isAccessible: e.isAccessible,
  }));

  const graphOriginal = buildGraph(graphNodes, graphEdges);

  console.log(`Original graph total nodes: ${graphOriginal.nodesById.size}`);
  console.log(`LCC nodes: ${graphOriginal.lccNodes?.size ?? 0} / ${nodes.length}`);

  await prisma.$disconnect();
}

testInlineEdges().catch(console.error);
