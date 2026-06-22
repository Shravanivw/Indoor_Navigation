// src/services/routingService.ts
// Orchestrates route requests: looks up rooms, runs A*, formats the response.

import { PrismaClient } from '@prisma/client';
import { findRoute, buildRouteSteps, estimateSeconds } from '../engine/astar';
import { buildGraph, getRoomEntryNode, validateGraph } from '../engine/graphBuilder';
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

const PIXELS_TO_METERS = 73.579 / 800;

// ─── HUDSON FLOOR ROUTE GRAPH BOUNDS ─────────────────────────────────────────
// seedManualGraph.ts stores Hudson corridor/POI nodes in manualGraph pixel
// space, not in raw Hudson_5th.json DWG coordinates.
const HUDSON_GRAPH_PIXELS = {
  width: 800,
  height: 500,
};

/**
 * Normalise a manualGraph pixel coordinate (0..800 / 0..500)
 * into the 0–gridCols / 0–gridRows space that FloorMap.jsx uses.
 *
 * FloorMap flips Y internally via gy(g) = PAD + (gridRows - g) * sy, so the
 * value we store here must already be in the flipped (screen) orientation.
 */
function normaliseHudsonCell(
  rawX: number,
  rawY: number,
  gridCols: number,
  gridRows: number,
): GridCell {
  const { width, height } = HUDSON_GRAPH_PIXELS;
  return {
    x: (rawX / width) * gridCols,
    y: gridRows - ((rawY / height) * gridRows),
  };
}

/**
 * Returns true when the floor is Hudson F5 — these nodes need normalisation
 * because they are stored in raw DWG pixel space (0–5465), not grid space.
 */
function isHudsonFloor(floorId: string): boolean {
  return floorId === 'floor-hudson-f5';
}

export async function buildGraphCache(prisma: PrismaClient): Promise<void> {
  console.log('[RoutingService] Building navigation graph cache...');

  const nodes = await prisma.node.findMany();
  const edges = await prisma.edge.findMany();

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

  const startNodeId =
    getRoomEntryNode(fromRoomId, graph) ??
    findNearestNode(graph, fromRoom, fromGridCols, fromGridRows);

  const endNodeId =
    getRoomEntryNode(toRoomId, graph) ??
    findNearestNode(graph, toRoom, toGridCols, toGridRows);

  if (!startNodeId) throw new Error(`No navigation node found for room: ${fromRoomId}`);
  if (!endNodeId)   throw new Error(`No navigation node found for room: ${toRoomId}`);

  console.log("FROM ROOM:", fromRoomId);
  console.log("TO ROOM:", toRoomId);
  console.log("START NODE:", startNodeId);
  console.log("END NODE:", endNodeId);
  console.log("START ADJACENCY:", graph.adjacency.get(startNodeId)?.length ?? 0);
  console.log("END ADJACENCY:", graph.adjacency.get(endNodeId)?.length ?? 0);
  console.log("CAN REACH:", canReach(startNodeId, endNodeId, graph.adjacency));

  // Run A*
  const pathNodeIds = findRoute(
    graph.adjacency,
    graph.nodesById,
    startNodeId,
    endNodeId,
    options
  );

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

  // ── COORDINATE NORMALISATION ────────────────────────────────────────────────
  // Hudson graph nodes are stored in manualGraph pixel space (800x500). Convert
  // them to the same grid space used by room polygons before sending them to UI.
  const hudsonFloor = isHudsonFloor(fromRoom.floorId);
  const pathGridCells: GridCell[] = pathNodes.map(n => {
    if (hudsonFloor && n.type === 'CORRIDOR_JUNCTION') {
      return normaliseHudsonCell(n.gridX, n.gridY, fromGridCols, fromGridRows);
    }
    return { x: n.gridX, y: n.gridY };
  });

  // Calculate total distance
  let totalDistanceM = 0;
  for (let i = 1; i < pathNodes.length; i++) {
    const a = pathNodes[i - 1];
    const b = pathNodes[i];
    const pixelDistance = Math.sqrt(
      (b.realX - a.realX) ** 2 +
      (b.realY - a.realY) ** 2
    );
    totalDistanceM += pixelDistance * PIXELS_TO_METERS;
  }

  // Count floor changes
  const floorIds = pathNodes.map(n => n.floorId);
  const floorChanges = floorIds.filter((id, i) => i > 0 && id !== floorIds[i - 1]).length;

  // Build turn-by-turn steps using normalised cells so distances are meaningful
  const steps = buildRouteSteps(
    pathGridCells,
    PIXELS_TO_METERS,
    PIXELS_TO_METERS
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
  adjacency: Map<string, any[]>
): boolean {
  const visited = new Set<string>();
  const queue = [startId];
  while (queue.length) {
    const current = queue.shift()!;
    if (current === endId) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    for (const edge of (adjacency.get(current) ?? [])) {
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
  let bestId: string | null = null;
  let bestDist = Infinity;

  for (const [nodeId, node] of graph.nodesById) {
    if (node.floorId !== room.floorId) continue;

    let nx: number;
    let ny: number;
    if (hudson && node.type === 'CORRIDOR_JUNCTION') {
      // Normalise raw DWG coords to grid space so they're comparable to room.gridX/Y
      const cell = normaliseHudsonCell(node.gridX, node.gridY, gridCols, gridRows);
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