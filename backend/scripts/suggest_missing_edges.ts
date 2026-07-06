import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
  const floorId = 'floor-hudson-f6';
  const nodes = await prisma.node.findMany({ where: { floorId } });
  const edges = await prisma.edge.findMany({
    where: {
      OR: [
        { fromNode: { floorId } },
        { toNode: { floorId } }
      ]
    }
  });

  const adj: Record<string, string[]> = {};
  for (const node of nodes) {
    adj[node.id] = [];
  }
  for (const edge of edges) {
    if (adj[edge.fromNodeId] && adj[edge.toNodeId]) {
      adj[edge.fromNodeId].push(edge.toNodeId);
      adj[edge.toNodeId].push(edge.fromNodeId);
    }
  }

  // BFS to identify components
  const visited = new Set<string>();
  const components: string[][] = [];

  for (const node of nodes) {
    if (visited.has(node.id)) continue;
    const comp: string[] = [];
    const q = [node.id];
    while (q.length) {
      const curr = q.shift()!;
      if (visited.has(curr)) continue;
      visited.add(curr);
      comp.push(curr);
      for (const neighbor of (adj[curr] ?? [])) {
        if (!visited.has(neighbor)) {
          q.push(neighbor);
        }
      }
    }
    components.push(comp);
  }

  components.sort((a, b) => b.length - a.length);
  const mainComp = components[0]; // Component #1

  console.log(`Main component has ${mainComp.length} nodes.`);

  // For each other component, find the closest node in mainComp
  for (let i = 1; i < components.length; i++) {
    const comp = components[i];
    let minD = Infinity;
    let bestMain: any = null;
    let bestOther: any = null;

    for (const otherId of comp) {
      const otherNode = nodes.find(n => n.id === otherId)!;
      for (const mainId of mainComp) {
        const mainNode = nodes.find(n => n.id === mainId)!;
        
        // Euclidean distance in layout space
        const dx = mainNode.realX - otherNode.realX;
        const dy = mainNode.realY - otherNode.realY;
        const d = Math.sqrt(dx * dx + dy * dy);
        
        if (d < minD) {
          minD = d;
          bestMain = mainNode;
          bestOther = otherNode;
        }
      }
    }

    console.log(`\nComponent #${i + 1} (Size: ${comp.length} nodes)`);
    console.log(`Closest node in Main Component: ${bestMain.id} (${bestMain.label}) at (${bestMain.realX.toFixed(1)}, ${bestMain.realY.toFixed(1)})`);
    console.log(`Closest node in Component #${i + 1}: ${bestOther.id} (${bestOther.label}) at (${bestOther.realX.toFixed(1)}, ${bestOther.realY.toFixed(1)})`);
    console.log(`Distance between them: ${minD.toFixed(1)} units`);
    console.log(`Suggested Edge to add: from: "${bestMain.label}", to: "${bestOther.label}" (${bestMain.id.split('-').pop()} -> ${bestOther.id.split('-').pop()})`);
  }

  await prisma.$disconnect();
}

run().catch(console.error);
