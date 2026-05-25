// src/services/routingService.ts
// Orchestrates route requests: looks up rooms, runs A*, formats the response.

import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { findRoute, buildRouteSteps, estimateSeconds, astarGrid } from '../engine/astar';
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
    type: e.type,
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
  const nodeGridCells: GridCell[] = pathNodes.map(n => ({ x: n.gridX, y: n.gridY }));

  // Refine to a cell-by-cell walkable path so the route hugs corridors
  const grid = loadFloorGrid(fromRoom.floorId);
  let pathGridCells: GridCell[] = refinePathThroughGrid(nodeGridCells, grid);

  // Stop at the *doorway* of the destination room rather than walking the user
  // into the middle of the room (where the nav node happens to sit).
  pathGridCells = trimToRoomEntrance(pathGridCells, {
    gridX: toRoom.gridX, gridY: toRoom.gridY,
    gridW: toRoom.gridW, gridH: toRoom.gridH,
  });

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

  // Persist the session
  await prisma.navSession.create({
    data: {
      fromRoomId,
      toRoomId,
      pathNodeIds: JSON.stringify(pathNodeIds),
      pathGridCells: JSON.stringify(pathGridCells),
      distanceM: totalDistanceM,
      estimatedSec: estimateSeconds(totalDistanceM),
      floorChanges,
      accessible: options.accessibleOnly ?? false,
    },
  });

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

// ─── GRID LOADING + PATH REFINEMENT ───────────────────────────────────────────
// We refine the sparse graph path into a cell-by-cell trail that only crosses
// walkable corridor cells. This makes the rendered route visually follow the
// floor plan instead of cutting diagonally across rooms.

const gridCache = new Map<string, WalkabilityGrid>();

function loadFloorGrid(_floorId: string): WalkabilityGrid {
  const cached = gridCache.get(_floorId);
  if (cached) return cached;

  const candidates = [
    path.join(process.cwd(), 'src',  'data', 'nav_floor_data.json'),
    path.join(process.cwd(), 'data', 'nav_floor_data.json'),
  ];
  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    try {
      const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (Array.isArray(parsed?.grid)) {
        gridCache.set(_floorId, parsed.grid as WalkabilityGrid);
        return parsed.grid as WalkabilityGrid;
      }
    } catch {
      /* try next candidate */
    }
  }
  return [];
}

// Find the nearest walkable cell to a given cell within a small radius.
function snapToWalkable(grid: WalkabilityGrid, c: GridCell, maxR = 6): GridCell {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  if (!rows || !cols) return c;
  if (grid[c.y]?.[c.x] === 0) return c;

  for (let r = 1; r <= maxR; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
        const x = c.x + dx;
        const y = c.y + dy;
        if (x < 0 || x >= cols || y < 0 || y >= rows) continue;
        if (grid[y][x] === 0) return { x, y };
      }
    }
  }
  return c;
}

function refinePathThroughGrid(
  nodeCells: GridCell[],
  grid: WalkabilityGrid
): GridCell[] {
  if (nodeCells.length === 0) return [];
  if (!grid.length) return nodeCells;

  const cells: GridCell[] = [];
  const push = (c: GridCell) => {
    const last = cells[cells.length - 1];
    if (!last || last.x !== c.x || last.y !== c.y) cells.push(c);
  };

  let prev = snapToWalkable(grid, nodeCells[0]);
  push(prev);

  for (let i = 1; i < nodeCells.length; i++) {
    const next = snapToWalkable(grid, nodeCells[i]);
    const seg = astarGrid(grid, prev, next);
    if (seg && seg.length > 1) {
      for (let k = 1; k < seg.length; k++) push(seg[k]);
    } else {
      // Fallback: orthogonal L-shape if grid A* fails to connect
      const corner: GridCell = { x: next.x, y: prev.y };
      push(corner);
      push(next);
    }
    prev = next;
  }

  return cells;
}

// Trim the tail of the path so it ends at the corridor cell immediately
// adjacent to the destination room footprint (i.e. the doorway), rather than
// the interior nav-node. We walk the path from the end backwards while we are
// still inside the room rectangle.
function trimToRoomEntrance(
  cells: GridCell[],
  rect: { gridX: number; gridY: number; gridW: number; gridH: number }
): GridCell[] {
  if (cells.length < 2) return cells;
  const inside = (c: GridCell) =>
    c.x >= rect.gridX && c.x < rect.gridX + rect.gridW &&
    c.y >= rect.gridY && c.y < rect.gridY + rect.gridH;

  // Find the first index that is inside the destination room. Everything from
  // that point on is interior — truncate just before it so we stop at the
  // doorway. If no cell is inside (path already ends outside) keep as-is.
  for (let i = 0; i < cells.length; i++) {
    if (inside(cells[i])) {
      return i === 0 ? cells : cells.slice(0, i);
    }
  }
  return cells;
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
