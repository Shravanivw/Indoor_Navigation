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

  // Build adjacency list from edges
  for (const edge of edges) {
    const fromList = adjacency.get(edge.fromNodeId) ?? [];
    fromList.push({
      nodeId: edge.toNodeId,
      weight: edge.weight,
      isAccessible: edge.isAccessible,
    });
    adjacency.set(edge.fromNodeId, fromList);

    // Bidirectional: also add reverse
    if (true) { // all edges are bidirectional in our schema
      const toList = adjacency.get(edge.toNodeId) ?? [];
      toList.push({
        nodeId: edge.fromNodeId,
        weight: edge.weight,
        isAccessible: edge.isAccessible,
      });
      adjacency.set(edge.toNodeId, toList);
    }
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
