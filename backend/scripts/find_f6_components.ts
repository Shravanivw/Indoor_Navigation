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

  // Build Adjacency List for corridor nodes only
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

  // Find components
  const visited = new Set<string>();
  const components: string[][] = [];

  for (const node of nodes) {
    if (visited.has(node.id)) continue;
    
    // BFS
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

  console.log(`Found ${components.length} connected components on Floor 6.`);
  components.sort((a, b) => b.length - a.length);

  components.forEach((comp, idx) => {
    console.log(`\nComponent #${idx + 1} (Size: ${comp.length} nodes)`);
    // Sample some nodes
    const samples = comp.slice(0, 10).map(id => {
      const node = nodes.find(n => n.id === id);
      return `${node?.label || id} (Type: ${node?.type}, RoomId: ${node?.roomId})`;
    });
    console.log(`Samples:`, samples);
  });

  await prisma.$disconnect();
}

run().catch(console.error);
