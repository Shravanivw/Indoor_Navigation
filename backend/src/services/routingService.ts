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
// Graphs are built once at startup and cached in memory.
// Call rebuildGraphCache() when the map data changes.

let graphCache: Map<string, NavigationGraph> = new Map(); // floorId → graph
let globalGraph: NavigationGraph | null = null;           // full building graph

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

  // Get entry nodes for each room
  const startNodeId = getRoomEntryNode(fromRoomId, graph);
  const endNodeId   = getRoomEntryNode(toRoomId, graph);

  if (!startNodeId) throw new Error(`No navigation node found for room: ${fromRoomId}`);
  if (!endNodeId)   throw new Error(`No navigation node found for room: ${toRoomId}`);

  // Run A*
  const pathNodeIds = findRoute(
    graph.adjacency,
    graph.nodesById,
    startNodeId,
    endNodeId,
    options
  );

  if (!pathNodeIds) {
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
  const pathGridCells: GridCell[] = pathNodes.map(n => ({ x: n.gridX, y: n.gridY }));

  // Calculate total distance
  let totalDistanceM = 0;
  for (let i = 1; i < pathNodes.length; i++) {
    const a = pathNodes[i - 1];
    const b = pathNodes[i];
    totalDistanceM += Math.sqrt((b.realX - a.realX) ** 2 + (b.realY - a.realY) ** 2);
  }

  // Count floor changes
  const floorIds = pathNodes.map(n => n.floorId);
  const floorChanges = floorIds.filter((id, i) => i > 0 && id !== floorIds[i - 1]).length;

  // Build turn-by-turn steps
  // Use floor scale for distance labels; default 1m per grid cell if no floor data
  const floor = await prisma.floor.findUnique({ where: { id: fromRoom.floorId } });
  const scaleX = floor?.scaleX ?? 1;
  const scaleY = floor?.scaleY ?? 1;
  const steps = buildRouteSteps(pathGridCells, scaleX, scaleY);

  // Add floor change instructions
  const enrichedSteps = enrichWithFloorChanges(steps, pathNodes, graph);

  // Persist the session (best-effort — don't fail the request if persistence errors)
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

function enrichWithFloorChanges(
  steps: any[],
  pathNodes: GraphNode[],
  graph: NavigationGraph
): any[] {
  // Insert staircase/lift instructions where floor changes
  const enriched = [...steps];
  // Future: detect STAIRCASE_LANDING and LIFT_LOBBY node types and insert steps
  return enriched;
}

// ─── QR CODE LOOKUP ───────────────────────────────────────────────────────────

export async function getRoomByQR(
  prisma: PrismaClient,
  qrCode: string
): Promise<{ id: string; name: string; floorId: string; code: string } | null> {
  const room = await prisma.room.findUnique({
    where: { qrCode },
    select: { id: true, name: true, floorId: true, code: true },
  });
  return room;
}
