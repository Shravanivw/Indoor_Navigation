// src/services/routingService.ts
// Orchestrates route requests: looks up rooms, runs A*, formats the response.

import { PrismaClient } from '@prisma/client';
import { findRoute, buildRouteSteps, estimateSeconds } from '../engine/astar';
import { buildGraph, getRoomEntryNode, validateGraph } from '../engine/graphBuilder';
import { getHudsonProjectionBounds, projectHudsonCoordinate } from '../utils/projection';
import type {
  RouteResult,
  PathfindingOptions,
  GraphNode,
  GraphEdge,
  AdjacencyList,
  WalkabilityGrid,
  GridCell,
} from '../types';
import type { NavigationGraph } from '../engine/graphBuilder';

// ─── GRAPH CACHE ──────────────────────────────────────────────────────────────
let graphCache: Map<string, NavigationGraph> = new Map();
let globalGraph: NavigationGraph | null = null;

const HUDSON_DISPLAY_GRID = {
  cols: 80,
  rows: 80,
};

const HUDSON_DISPLAY_SCALE = {
  x: 0.9197,
  y: 0.5951,
};

function getFloorScale(floorId: string, scaleX?: number | null, scaleY?: number | null) {
  if (isHudsonFloor(floorId)) {
    return HUDSON_DISPLAY_SCALE;
  }
  return {
    x: scaleX ?? 1,
    y: scaleY ?? 1,
  };
}

import { requiresHudsonProjection } from './mapService';

/**
 * Returns true when the floor is a Hudson Floor — these nodes need normalisation
 * because they are stored in raw DWG pixel space (0–5465), not grid space.
 */
function isHudsonFloor(floorId: string): boolean {
  return requiresHudsonProjection(floorId);
}

export async function buildGraphCache(prisma: PrismaClient): Promise<void> {
  console.log('[RoutingService] Building navigation graph cache...');

  const nodes = await prisma.node.findMany();
  const edges = await prisma.edge.findMany();
  console.log(
    "ALL NODE IDS:",
    nodes.map(n => n.id)
  );

  const graphNodes: GraphNode[] = nodes.map(n => ({
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

  const graphEdges: GraphEdge[] = edges.map(e => ({
    fromNodeId: e.fromNodeId,
    toNodeId: e.toNodeId,
    weight: e.weight,
    isAccessible: e.isAccessible,
  }));

  globalGraph = buildGraph(graphNodes, graphEdges);

  const stats = validateGraph(globalGraph);
  console.log(`[RoutingService] Graph built: ${stats.totalNodes} nodes, ${stats.totalEdges} edges`);
  if (stats.isolatedNodes.length > 0) {
    console.warn(`[RoutingService] WARNING: ${stats.isolatedNodes.length} isolated nodes found`);
  }
}


function getRoomCandidates(
  roomId: string,
  room: { gridX: number; gridY: number; floorId: string },
  gridCols: number,
  gridRows: number,
  graph: NavigationGraph
): string[] {
  const entries = graph.roomEntryNodes.get(roomId) ?? [];
  
  // 1. Collect ALL candidate entry nodes.
  // 2. Ignore nodes with zero adjacency.
  const connectedEntries = entries.filter(id => (graph.adjacency.get(id)?.length ?? 0) > 0);
  
  // 3. Ignore disconnected nodes & Prefer nodes belonging to the largest connected component.
  const lccEntries = connectedEntries.filter(id => graph.lccNodes?.has(id));
  if (lccEntries.length > 0) {
    return lccEntries;
  }
  
  return connectedEntries;
}

function getPathCost(path: string[], graph: NavigationGraph): number {
  let cost = 0;
  for (let i = 1; i < path.length; i++) {
    const prev = path[i - 1];
    const curr = path[i];
    const edge = graph.adjacency.get(prev)?.find(e => e.nodeId === curr);
    if (edge) {
      cost += edge.weight;
    }
  }
  return cost;
}

// ─── ROUTE BETWEEN ROOMS ──────────────────────────────────────────────────────

export interface RouteRequest {
  fromRoomId: string;
  toRoomId: string;
  options?: PathfindingOptions;
}

export async function getRoute(
  prisma: PrismaClient,
  request: RouteRequest
): Promise<RouteResult> {
  const { fromRoomId, toRoomId, options = {} } = request;

  if (!globalGraph) {
    await buildGraphCache(prisma);
  }

  const graph = globalGraph!;

  // Validate rooms exist
  const [fromRoom, toRoom] = await Promise.all([
    prisma.room.findUnique({ where: { id: fromRoomId }, include: { floor: true } }),
    prisma.room.findUnique({ where: { id: toRoomId  }, include: { floor: true } }),
  ]);

  if (!fromRoom) throw new Error(`Room not found: ${fromRoomId}`);
  if (!toRoom)   throw new Error(`Room not found: ${toRoomId}`);

  // Same room
  if (fromRoomId === toRoomId) {
    return {
      found: true,
      fromRoomId,
      toRoomId,
      pathNodeIds: [],
      pathGridCells: [],
      steps: [{ instruction: 'You are already here', distanceM: 0, nodeId: '', gridCell: { x: fromRoom.gridX, y: fromRoom.gridY } }],
      totalDistanceM: 0,
      estimatedSeconds: 0,
      floorChanges: 0,
      accessible: true,
    };
  }

  const fromGridCols = fromRoom.floor?.gridCols ?? 80;
  const fromGridRows = fromRoom.floor?.gridRows ?? 80;
  const toGridCols   = toRoom.floor?.gridCols   ?? 80;
  const toGridRows   = toRoom.floor?.gridRows   ?? 80;

  const startCandidatesAll = getRoomCandidates(fromRoomId, fromRoom, fromGridCols, fromGridRows, graph);
  const endCandidatesAll = getRoomCandidates(toRoomId, toRoom, toGridCols, toGridRows, graph);

  if (startCandidatesAll.length === 0 || endCandidatesAll.length === 0) {
    console.warn('[RoutingService] No candidate nodes found for room', {
      fromRoomId, toRoomId, startCandidatesCount: startCandidatesAll.length, endCandidatesCount: endCandidatesAll.length
    });
    return {
      found: false,
      fromRoomId,
      toRoomId,
      pathNodeIds: [],
      pathGridCells: [],
      steps: [],
      totalDistanceM: 0,
      estimatedSeconds: 0,
      floorChanges: 0,
      accessible: false,
    };
  }

  // Filter out candidates with zero adjacency
  const startCandidatesConnected = startCandidatesAll.filter(id => (graph.adjacency.get(id)?.length ?? 0) > 0);
  const endCandidatesConnected = endCandidatesAll.filter(id => (graph.adjacency.get(id)?.length ?? 0) > 0);

  // Filter out candidates that cannot reach the target room's graph component (respecting accessibility options)
  const startCandidatesValid = startCandidatesConnected.filter(startId => {
    return endCandidatesConnected.some(endId => canReach(startId, endId, graph.adjacency, options));
  });
  const endCandidatesValid = endCandidatesConnected.filter(endId => {
    return startCandidatesConnected.some(startId => canReach(startId, endId, graph.adjacency, options));
  });

  // Safe fallback selection: Prefer connected candidates over disconnected candidates
  const startNodeIdFallback = startCandidatesConnected[0] ?? startCandidatesAll[0] ?? null;
  const endNodeIdFallback = endCandidatesConnected[0] ?? endCandidatesAll[0] ?? null;

  let bestPathNodeIds: string[] | null = null;
  let bestPathCost = Infinity;
  let bestStartNodeId: string | null = null;
  let bestEndNodeId: string | null = null;

  for (const startId of startCandidatesValid) {
    for (const endId of endCandidatesValid) {
      const path = findRoute(
        graph.adjacency,
        graph.nodesById,
        startId,
        endId,
        options
      );

      if (path) {
        const cost = getPathCost(path, graph);
        if (cost < bestPathCost) {
          bestPathCost = cost;
          bestPathNodeIds = path;
          bestStartNodeId = startId;
          bestEndNodeId = endId;
        }
      }
    }
  }

  const startNodeId = bestStartNodeId ?? startNodeIdFallback;
  const endNodeId = bestEndNodeId ?? endNodeIdFallback;

  if (!startNodeId) throw new Error(`No navigation node found for room: ${fromRoomId}`);
  if (!endNodeId)   throw new Error(`No navigation node found for room: ${toRoomId}`);

  console.log("FROM ROOM:", fromRoomId);
  console.log("TO ROOM:", toRoomId);
  console.log("START CANDIDATES ALL:", startCandidatesAll);
  console.log("END CANDIDATES ALL:", endCandidatesAll);
  console.log("START CANDIDATES VALID:", startCandidatesValid);
  console.log("END CANDIDATES VALID:", endCandidatesValid);
  console.log("START NODE:", startNodeId);
  console.log("END NODE:", endNodeId);
  console.log("START ADJACENCY:", graph.adjacency.get(startNodeId)?.length ?? 0);
  console.log("END ADJACENCY:", graph.adjacency.get(endNodeId)?.length ?? 0);
  console.log("CAN REACH:", canReach(startNodeId, endNodeId, graph.adjacency, options));

  const pathNodeIds = bestPathNodeIds;

  if (!pathNodeIds) {
    console.warn('[RoutingService] No route found between graph nodes', {
      fromRoomId, toRoomId, startNodeId, endNodeId,
    });
    return {
      found: false,
      fromRoomId,
      toRoomId,
      pathNodeIds: [],
      pathGridCells: [],
      steps: [],
      totalDistanceM: 0,
      estimatedSeconds: 0,
      floorChanges: 0,
      accessible: false,
    };
  }

  // Build path details
  const pathNodes = pathNodeIds.map(id => graph.nodesById.get(id)!);

  const hudsonFloor = isHudsonFloor(fromRoom.floorId);
  const targetGridCols = hudsonFloor ? HUDSON_DISPLAY_GRID.cols : fromGridCols;
  const targetGridRows = hudsonFloor ? HUDSON_DISPLAY_GRID.rows : fromGridRows;
  const bounds = hudsonFloor ? getHudsonProjectionBounds(fromRoom.floorId) : null;
  const pathGridCells: GridCell[] = pathNodes.map(n => {
    if (hudsonFloor && bounds) {
      return projectHudsonCoordinate(
        n.gridX,
        n.gridY,
        targetGridCols,
        targetGridRows,
        bounds
      );
    }
    return { x: n.gridX, y: n.gridY };
  });

  console.log('[RoutingService] Route found:', {
    pathNodeCount: pathNodeIds.length,
    pathGridCellsCount: pathGridCells.length,
    firstCell: pathGridCells[0],
    lastCell: pathGridCells[pathGridCells.length - 1],
  });

  const scale = getFloorScale(fromRoom.floorId, fromRoom.floor?.scaleX, fromRoom.floor?.scaleY);

  // Calculate total distance in metres using the normalized route coordinates.
  let totalDistanceM = 0;
  for (let i = 1; i < pathGridCells.length; i++) {
    const a = pathGridCells[i - 1];
    const b = pathGridCells[i];
    totalDistanceM += Math.sqrt(
      ((b.x - a.x) * scale.x) ** 2 +
      ((b.y - a.y) * scale.y) ** 2
    );
  }

  // Count floor changes
  const floorIds = pathNodes.map(n => n.floorId);
  const floorChanges = floorIds.filter((id, i) => i > 0 && id !== floorIds[i - 1]).length;

  // Build turn-by-turn steps using normalised cells so distances are meaningful
  const steps = buildRouteSteps(
    pathGridCells,
    scale.x,
    scale.y
  );

  const enrichedSteps = enrichWithFloorChanges(steps, pathNodes, graph);

  // Persist session (best-effort)
  try {
    await prisma.navSession.create({
      data: {
        fromRoomId,
        toRoomId,
        path: JSON.stringify({ nodeIds: pathNodeIds, gridCells: pathGridCells }),
        distance: totalDistanceM,
        duration: estimateSeconds(totalDistanceM),
      },
    });
  } catch (e) {
    console.warn('[RoutingService] Failed to persist NavSession:', (e as Error).message);
  }

  return {
    found: true,
    fromRoomId,
    toRoomId,
    pathNodeIds,
    pathGridCells,
    steps: enrichedSteps,
    totalDistanceM: Math.round(totalDistanceM * 10) / 10,
    estimatedSeconds: estimateSeconds(totalDistanceM),
    floorChanges,
    accessible: options.accessibleOnly ?? false,
  };
}

function canReach(
  startId: string,
  endId: string,
  adjacency: Map<string, any[]>,
  options?: PathfindingOptions
): boolean {
  const visited = new Set<string>();
  const queue = [startId];
  while (queue.length) {
    const current = queue.shift()!;
    if (current === endId) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    for (const edge of (adjacency.get(current) ?? [])) {
      if (options?.accessibleOnly && !edge.isAccessible) continue;
      queue.push(edge.nodeId);
    }
  }
  return false;
}

// When a room has no directly linked navigation node, find the nearest one on
// the same floor. Hudson nodes use raw DWG pixel coords so we normalise before
// comparing against the room's grid coords.
function findNearestNode(
  graph: NavigationGraph,
  room: { gridX: number; gridY: number; floorId: string },
  gridCols: number,
  gridRows: number,
): string | null {
  const hudson = isHudsonFloor(room.floorId);
  const bounds = hudson ? getHudsonProjectionBounds(room.floorId) : null;
  let bestId: string | null = null;
  let bestDist = Infinity;

  for (const [nodeId, node] of graph.nodesById) {
    if (node.floorId !== room.floorId) continue;

    let nx: number;
    let ny: number;
    if (hudson && bounds) {
      const cell = projectHudsonCoordinate(
        node.gridX,
        node.gridY,
        gridCols,
        gridRows,
        bounds
      );
      nx = cell.x;
      ny = cell.y;
    } else {
      nx = node.gridX;
      ny = node.gridY;
    }

    const dist = Math.hypot(room.gridX - nx, room.gridY - ny);
    if (dist < bestDist) {
      bestDist = dist;
      bestId = nodeId;
    }
  }
  return bestId;
}

function enrichWithFloorChanges(
  steps: any[],
  pathNodes: GraphNode[],
  graph: NavigationGraph
): any[] {
  const enriched = [...steps];
  return enriched;
}

// ─── QR CODE LOOKUP ───────────────────────────────────────────────────────────

export async function getRoomByQR(
  prisma: PrismaClient,
  qrCode: string
) {
  return prisma.room.findUnique({
    where: { qrCode },
    include: { floor: { select: { id: true, name: true, level: true, buildingId: true } } },
  });
}