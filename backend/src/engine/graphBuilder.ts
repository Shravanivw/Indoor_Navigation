// src/engine/graphBuilder.ts
// Builds in-memory navigation graph from database records.
// Called at startup and whenever the map is updated.

import type { AdjacencyList, GraphNode, GraphEdge } from '../types';

export interface NavigationGraph {
  adjacency: AdjacencyList;
  nodesById: Map<string, GraphNode>;
  // Room ID → entry node IDs for that room
  roomEntryNodes: Map<string, string[]>;
  // Store room data for fallback node lookup
  roomsData?: Map<string, { centreX: number; centreY: number; floorId: string }>;
  lccNodes?: Set<string>;
}

/**
 * Build the full navigation graph from flat node/edge arrays.
 * This is intentionally kept pure (no DB calls) for easy testing.
 */
export function buildGraph(
  nodes: GraphNode[],
  edges: GraphEdge[]
): NavigationGraph {
  const adjacency: AdjacencyList = new Map();
  const nodesById = new Map<string, GraphNode>();
  const roomEntryNodes = new Map<string, string[]>();

  // Index all nodes
  for (const node of nodes) {
    nodesById.set(node.id, node);
    adjacency.set(node.id, []);

    if (node.roomId) {
      const existing = roomEntryNodes.get(node.roomId) ?? [];
      existing.push(node.id);
      roomEntryNodes.set(node.roomId, existing);
    }
  }

  // Automatically split edges that skip intermediate inline nodes along corridors
  const refinedEdges = splitInlineEdges(nodesById, edges);

  // Build adjacency list from refined edges
  for (const edge of refinedEdges) {
    addAdjacencyEdge(adjacency, edge.fromNodeId, edge.toNodeId, edge.weight, edge.isAccessible);
    addAdjacencyEdge(adjacency, edge.toNodeId, edge.fromNodeId, edge.weight, edge.isAccessible);
  }

  // Compute connected components to find the largest connected component (LCC)
  const lccNodes = new Set<string>();
  const visited = new Set<string>();
  let maxComponent: string[] = [];

  for (const nodeId of nodesById.keys()) {
    if (visited.has(nodeId)) continue;
    const queue = [nodeId];
    const component: string[] = [];
    visited.add(nodeId);

    while (queue.length > 0) {
      const current = queue.shift()!;
      component.push(current);
      const neighbors = adjacency.get(current) ?? [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor.nodeId)) {
          visited.add(neighbor.nodeId);
          queue.push(neighbor.nodeId);
        }
      }
    }

    if (component.length > maxComponent.length) {
      maxComponent = component;
    }
  }

  for (const nodeId of maxComponent) {
    lccNodes.add(nodeId);
  }

  return { adjacency, nodesById, roomEntryNodes, lccNodes };
}

/**
 * Get the best entry node for a room.
 * Returns the node closest to the room's centre.
 */
export function getRoomEntryNode(
  roomId: string,
  graph: NavigationGraph
): string | null {
  const entries = graph.roomEntryNodes.get(roomId);
  if (!entries || entries.length === 0) return null;
  
  // Prefer candidates with adjacency > 0
  for (const entry of entries) {
    const adj = graph.adjacency.get(entry);
    if (adj && adj.length > 0) {
      return entry;
    }
  }
  return entries[0];
}

/**
 * Validate graph connectivity — useful during development.
 * Logs any isolated nodes (nodes with no edges).
 */
export function validateGraph(graph: NavigationGraph): {
  totalNodes: number;
  isolatedNodes: string[];
  totalEdges: number;
} {
  const isolatedNodes: string[] = [];
  let totalEdges = 0;

  for (const [nodeId, edges] of graph.adjacency) {
    totalEdges += edges.length;
    if (edges.length === 0) isolatedNodes.push(nodeId);
  }

  return {
    totalNodes: graph.nodesById.size,
    isolatedNodes,
    totalEdges: totalEdges / 2, // bidirectional counted twice
  };
}

function addAdjacencyEdge(
  adjacency: AdjacencyList,
  fromId: string,
  toId: string,
  weight: number,
  isAccessible: boolean
) {
  const list = adjacency.get(fromId) ?? [];
  if (!list.some(e => e.nodeId === toId)) {
    list.push({ nodeId: toId, weight, isAccessible });
  }
  adjacency.set(fromId, list);
}

function splitInlineEdges(
  nodesById: Map<string, GraphNode>,
  edges: GraphEdge[]
): GraphEdge[] {
  const nodeArray = Array.from(nodesById.values());
  const newEdges: GraphEdge[] = [];

  for (const edge of edges) {
    const nA = nodesById.get(edge.fromNodeId);
    const nB = nodesById.get(edge.toNodeId);
    if (!nA || !nB || nA.floorId !== nB.floorId) {
      newEdges.push(edge);
      continue;
    }

    const inlineNodes: { node: GraphNode; t: number }[] = [];
    const dx = nB.gridX - nA.gridX;
    const dy = nB.gridY - nA.gridY;
    const lenSq = dx * dx + dy * dy;

    if (lenSq > 100) { // Only check edges longer than 10 grid units
      for (const nN of nodeArray) {
        if (nN.floorId !== nA.floorId || nN.id === nA.id || nN.id === nB.id) continue;

        const t = ((nN.gridX - nA.gridX) * dx + (nN.gridY - nA.gridY) * dy) / lenSq;
        if (t > 0.04 && t < 0.96) {
          const projX = nA.gridX + t * dx;
          const projY = nA.gridY + t * dy;
          const dist = Math.hypot(nN.gridX - projX, nN.gridY - projY);

          if (dist <= 1.5) { // Node lies within 1.5 grid units (~1m) of segment AB
            inlineNodes.push({ node: nN, t });
          }
        }
      }
    }

    if (inlineNodes.length === 0) {
      newEdges.push(edge);
    } else {
      // Sort inline nodes along segment AB
      inlineNodes.sort((a, b) => a.t - b.t);

      let prevNode = nA;
      for (const item of inlineNodes) {
        const segDist = Math.hypot(item.node.gridX - prevNode.gridX, item.node.gridY - prevNode.gridY);
        newEdges.push({
          fromNodeId: prevNode.id,
          toNodeId: item.node.id,
          weight: Math.max(1, segDist),
          isAccessible: edge.isAccessible,
        });
        prevNode = item.node;
      }
      const lastDist = Math.hypot(nB.gridX - prevNode.gridX, nB.gridY - prevNode.gridY);
      newEdges.push({
        fromNodeId: prevNode.id,
        toNodeId: nB.id,
        weight: Math.max(1, lastDist),
        isAccessible: edge.isAccessible,
      });
    }
  }

  return newEdges;
}
