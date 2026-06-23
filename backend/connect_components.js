const fs = require('fs');
const data = JSON.parse(fs.readFileSync('src/data/Hudson_5th.json', 'utf-8'));
const nodes = data.graph.nodes;
const edges = data.graph.edges;

// Build adjacency from edges (directional)
const adj = new Map();
nodes.forEach(n => adj.set(n.id, []));
edges.forEach(e => {
  adj.get(e.from)?.push(e.to);
  // Also add reverse for undirected traversal in component finding
  if (!adj.get(e.to)?.includes(e.from)) {
    adj.get(e.to)?.push(e.from);
  }
});

// Find components (undirected)
const visited = new Set();
const components = [];
const componentMap = new Map(); // nodeId -> componentIndex

for (const startNode of nodes) {
  if (visited.has(startNode.id)) continue;
  const component = [];
  const queue = [startNode.id];
  
  while (queue.length > 0) {
    const current = queue.shift();
    if (visited.has(current)) continue;
    visited.add(current);
    component.push(current);
    componentMap.set(current, components.length);
    
    for (const neighbor of adj.get(current) || []) {
      if (!visited.has(neighbor)) queue.push(neighbor);
    }
  }
  components.push(component);
}

console.log(`Found ${components.length} components\n`);

// For each component, find its bounding box and closest node to other components
const componentInfo = components.map((comp, idx) => {
  const compNodes = comp.map(id => nodes.find(n => n.id === id));
  const xs = compNodes.map(n => n.x);
  const ys = compNodes.map(n => n.y);
  const bounds = {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
    centerX: (Math.min(...xs) + Math.max(...xs)) / 2,
    centerY: (Math.min(...ys) + Math.max(...ys)) / 2,
  };
  
  return {
    index: idx,
    size: comp.length,
    bounds,
    nodeIds: comp,
  };
});

componentInfo.sort((a, b) => b.size - a.size);

// Display components
componentInfo.forEach((info, i) => {
  console.log(`Component ${i + 1}: ${info.size} nodes at (${info.bounds.centerX.toFixed(0)}, ${info.bounds.centerY.toFixed(0)})`);
});

// Connect components by adding edges between nearest nodes
const newEdges = [];
const connectedPairs = new Set();

// Sort components by size to connect largest ones first
const sortedComps = [...componentInfo].sort((a, b) => b.size - a.size);

for (let i = 0; i < sortedComps.length; i++) {
  for (let j = i + 1; j < sortedComps.length; j++) {
    const comp1 = sortedComps[i];
    const comp2 = sortedComps[j];
    const pairKey = `${comp1.index}-${comp2.index}`;
    
    if (connectedPairs.has(pairKey)) continue;
    
    // Find closest pair of nodes between components
    let minDist = Infinity;
    let bestPair = null;
    
    for (const nodeId1 of comp1.nodeIds) {
      const node1 = nodes.find(n => n.id === nodeId1);
      for (const nodeId2 of comp2.nodeIds) {
        const node2 = nodes.find(n => n.id === nodeId2);
        const dist = Math.hypot(node2.x - node1.x, node2.y - node1.y);
        if (dist < minDist) {
          minDist = dist;
          bestPair = [nodeId1, nodeId2];
        }
      }
    }
    
    if (bestPair && minDist < 500) { // Only connect if reasonably close
      newEdges.push({
        from: bestPair[0],
        to: bestPair[1],
        distance: minDist,
      });
      newEdges.push({
        from: bestPair[1],
        to: bestPair[0],
        distance: minDist,
      });
      connectedPairs.add(pairKey);
      console.log(`  Connected comp ${comp1.index} to comp ${comp2.index} (distance: ${minDist.toFixed(0)}m)`);
    }
  }
}

console.log(`\nAdding ${newEdges.length} edges to connect components\n`);

// Add new edges
data.graph.edges = data.graph.edges.concat(newEdges);

// Write back
fs.writeFileSync('src/data/Hudson_5th.json', JSON.stringify(data, null, 2));

console.log('Updated Hudson_5th.json with bridging edges');
console.log(`Total edges now: ${data.graph.edges.length}`);
