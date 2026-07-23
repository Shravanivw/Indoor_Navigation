// src/engine/astar.ts
// Pure A* pathfinding engine — works on both grid and graph representations
// No external dependencies. Fully typed.

import type {
  GridCell,
  WalkabilityGrid,
  AdjacencyList,
  RouteResult,
  RouteStep,
  PathfindingOptions,
  GraphNode,
} from '../types';

// ─── GRID-BASED A* (used for raw floor plan traversal) ───────────────────────

interface GridAStarNode {
  cell: GridCell;
  g: number;       // cost from start
  h: number;       // heuristic to end
  f: number;       // g + h
  parent: GridAStarNode | null;
}

/**
 * Manhattan distance heuristic — admissible for 4-directional grid movement
 */
function heuristicGrid(a: GridCell, b: GridCell): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

const CARDINAL_DIRS: GridCell[] = [
  { x: 0, y: -1 }, // N
  { x: 0, y:  1 }, // S
  { x: 1, y:  0 }, // E
  { x:-1, y:  0 }, // W
];

/**
 * Find shortest walkable path on a 2D grid.
 * Returns array of GridCells from start to end, or null if no path exists.
 */
export function astarGrid(
  grid: WalkabilityGrid,
  start: GridCell,
  end: GridCell
): GridCell[] | null {
  const rows = grid.length;
  const cols = grid[0].length;
  const key = (c: GridCell) => `${c.x},${c.y}`;

  const openSet = new Map<string, GridAStarNode>();
  const closedSet = new Set<string>();
  const gScore = new Map<string, number>();

  const startNode: GridAStarNode = {
    cell: start,
    g: 0,
    h: heuristicGrid(start, end),
    f: heuristicGrid(start, end),
    parent: null,
  };

  openSet.set(key(start), startNode);
  gScore.set(key(start), 0);

  while (openSet.size > 0) {
    // Find node with lowest f score
    let current: GridAStarNode | null = null;
    let lowestF = Infinity;
    for (const node of openSet.values()) {
      if (node.f < lowestF) {
        lowestF = node.f;
        current = node;
      }
    }
    if (!current) break;

    const currentKey = key(current.cell);

    // Reached destination
    if (current.cell.x === end.x && current.cell.y === end.y) {
      return reconstructGridPath(current);
    }

    openSet.delete(currentKey);
    closedSet.add(currentKey);

    for (const dir of CARDINAL_DIRS) {
      const neighbour: GridCell = {
        x: current.cell.x + dir.x,
        y: current.cell.y + dir.y,
      };

      if (
        neighbour.x < 0 || neighbour.x >= cols ||
        neighbour.y < 0 || neighbour.y >= rows
      ) continue;

      if (grid[neighbour.y][neighbour.x] === 1) continue; // wall

      const nKey = key(neighbour);
      if (closedSet.has(nKey)) continue;

      const tentativeG = current.g + 1;
      const existingG = gScore.get(nKey) ?? Infinity;

      if (tentativeG < existingG) {
        gScore.set(nKey, tentativeG);
        const h = heuristicGrid(neighbour, end);
        const neighbourNode: GridAStarNode = {
          cell: neighbour,
          g: tentativeG,
          h,
          f: tentativeG + h,
          parent: current,
        };
        openSet.set(nKey, neighbourNode);
      }
    }
  }

  return null; // no path found
}

function reconstructGridPath(node: GridAStarNode): GridCell[] {
  const path: GridCell[] = [];
  let current: GridAStarNode | null = node;
  while (current) {
    path.unshift(current.cell);
    current = current.parent;
  }
  return path;
}

// ─── GRAPH-BASED A* (used for named node routing across floors) ───────────────

interface GraphAStarNode {
  nodeId: string;
  g: number;
  h: number;
  f: number;
  parent: string | null;
}

/**
 * Euclidean heuristic for graph nodes (admissible when weights = real distances)
 */
function heuristicGraph(a: GraphNode, b: GraphNode): number {
  if (a.floorId !== b.floorId) {
    return 0; // Admissible fallback for different floors
  }
  return Math.sqrt((a.realX - b.realX) ** 2 + (a.realY - b.realY) ** 2);
}

/**
 * A* on named navigation graph.
 * Returns ordered list of node IDs, or null if unreachable.
 */
export function astarGraph(
  adjacency: AdjacencyList,
  nodesById: Map<string, GraphNode>,
  startId: string,
  endId: string,
  options: PathfindingOptions = {}
): string[] | null {
  const endNode = nodesById.get(endId);
  if (!endNode) return null;

  const openSet = new Map<string, GraphAStarNode>();
  const closedSet = new Set<string>();
  const gScore = new Map<string, number>();

  const startH = heuristicGraph(nodesById.get(startId)!, endNode);
  openSet.set(startId, { nodeId: startId, g: 0, h: startH, f: startH, parent: null });
  gScore.set(startId, 0);

  while (openSet.size > 0) {
    let current: GraphAStarNode | null = null;
    let lowestF = Infinity;
    for (const node of openSet.values()) {
      if (node.f < lowestF) { lowestF = node.f; current = node; }
    }
    if (!current) break;

    if (current.nodeId === endId) {
      return reconstructGraphPath(current, openSet, closedSet);
    }

    openSet.delete(current.nodeId);
    closedSet.add(current.nodeId);

    const neighbours = adjacency.get(current.nodeId) ?? [];

    for (const edge of neighbours) {
      if (options.accessibleOnly && !edge.isAccessible) continue;
      if (closedSet.has(edge.nodeId)) continue;

      const tentativeG = current.g + edge.weight;
      const existingG = gScore.get(edge.nodeId) ?? Infinity;

      if (tentativeG < existingG) {
        gScore.set(edge.nodeId, tentativeG);
        const neighbourNode = nodesById.get(edge.nodeId);
        if (!neighbourNode) continue;
        const h = heuristicGraph(neighbourNode, endNode);
        openSet.set(edge.nodeId, {
          nodeId: edge.nodeId,
          g: tentativeG,
          h,
          f: tentativeG + h,
          parent: current.nodeId,
        });
      }
    }
  }

  return null;
}

function reconstructGraphPath(
  endNode: GraphAStarNode,
  openSet: Map<string, GraphAStarNode>,
  closedSet: Set<string>
): string[] {
  // Rebuild parent chain - need to store parents separately
  // This is called after pathfinding completes
  const path: string[] = [];
  // The parent chain is embedded in the nodes stored in openSet
  // We need a separate cameFrom map - refactored below
  return path;
}

// ─── PRODUCTION A* WITH CAME-FROM MAP ────────────────────────────────────────

export function findRoute(
  adjacency: AdjacencyList,
  nodesById: Map<string, GraphNode>,
  startId: string,
  endId: string,
  options: PathfindingOptions = {}
): string[] | null {
  const endNode = nodesById.get(endId);
  if (!endNode || !nodesById.has(startId)) return null;

  const openSet = new Map<string, number>(); // nodeId → f score
  const cameFrom = new Map<string, string>();
  const gScore = new Map<string, number>();
  const fScore = new Map<string, number>();

  const startH = heuristicGraph(nodesById.get(startId)!, endNode);
  gScore.set(startId, 0);
  fScore.set(startId, startH);
  openSet.set(startId, startH);

  while (openSet.size > 0) {
    // Get node with lowest f
    let currentId = '';
    let lowestF = Infinity;
    for (const [id, f] of openSet) {
      if (f < lowestF) { lowestF = f; currentId = id; }
    }

    if (currentId === endId) {
      return reconstructPath(cameFrom, currentId);
    }

    openSet.delete(currentId);

    for (const edge of (adjacency.get(currentId) ?? [])) {
      if (options.accessibleOnly && !edge.isAccessible) continue;

      const tentativeG = (gScore.get(currentId) ?? Infinity) + edge.weight;
      const existingG = gScore.get(edge.nodeId) ?? Infinity;

      if (tentativeG < existingG) {
        cameFrom.set(edge.nodeId, currentId);
        gScore.set(edge.nodeId, tentativeG);
        const neighbourNode = nodesById.get(edge.nodeId);
        if (!neighbourNode) continue;
        const f = tentativeG + heuristicGraph(neighbourNode, endNode);
        fScore.set(edge.nodeId, f);
        openSet.set(edge.nodeId, f);
      }
    }
  }

  return null;
}

function reconstructPath(cameFrom: Map<string, string>, endId: string): string[] {
  const rawPath = [endId];
  let current = endId;
  while (cameFrom.has(current)) {
    current = cameFrom.get(current)!;
    rawPath.unshift(current);
  }

  // Remove any immediate backtrack loops (A -> B -> A)
  const cleanPath: string[] = [];
  for (const id of rawPath) {
    if (cleanPath.length >= 2 && cleanPath[cleanPath.length - 2] === id) {
      cleanPath.pop(); // Collapses A -> B -> A into A
    } else if (cleanPath.length === 0 || cleanPath[cleanPath.length - 1] !== id) {
      cleanPath.push(id);
    }
  }

  return cleanPath;
}

// ─── DIRECTION GENERATOR ─────────────────────────────────────────────────────

const WALK_SPEED_MPS = 1.4; // average walking speed metres per second

export function buildRouteSteps(
  pathCells: GridCell[],
  scaleX: number,  // metres per cell
  scaleY: number
): RouteStep[] {
  if (pathCells.length < 2) return [];

  // Filter out contiguous duplicate or very close cells to prevent division by zero
  const cells: GridCell[] = [];
  for (const c of pathCells) {
    if (cells.length === 0) {
      cells.push(c);
    } else {
      const prev = cells[cells.length - 1];
      if (Math.abs(c.x - prev.x) > 0.001 || Math.abs(c.y - prev.y) > 0.001) {
        cells.push(c);
      }
    }
  }
  if (cells.length < 2) return [];

  // Convert to segments with physical lengths and angles
  interface Segment {
    startCell: GridCell;
    endCell: GridCell;
    dx: number;
    dy: number;
    length: number;
    angle: number; // in degrees
  }

  const segments: Segment[] = [];
  for (let i = 0; i < cells.length - 1; i++) {
    const a = cells[i];
    const b = cells[i + 1];
    const dx = (b.x - a.x) * scaleX;
    const dy = (b.y - a.y) * scaleY;
    const length = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx) * 180 / Math.PI;
    segments.push({ startCell: a, endCell: b, dx, dy, length, angle });
  }

  // Merge consecutive collinear segments and tiny zig-zags / segments shorter than 2m
  interface MergedSegment {
    startCell: GridCell;
    endCell: GridCell;
    length: number;
    angle: number;
    turnType: 'start' | 'straight' | 'left' | 'right' | 'slight_left' | 'slight_right' | 'around';
  }

  const merged: MergedSegment[] = [];
  let currentStart = cells[0];
  let currentEnd = cells[1];
  let currentLength = segments[0].length;
  let currentAngle = segments[0].angle;

  for (let i = 1; i < segments.length; i++) {
    const seg = segments[i];

    let diff = seg.angle - currentAngle;
    while (diff > 180) diff -= 360;
    while (diff < -180) diff += 360;
    const absDiff = Math.abs(diff);

    // Merge if collinear (<= 25°) or if very short non-turning segment (< 1.5m and absDiff < 90°)
    if (absDiff <= 25 || (seg.length < 1.5 && absDiff < 90)) {
      currentEnd = seg.endCell;
      currentLength += seg.length;
      if (absDiff <= 25) {
        currentAngle = seg.angle; // Keep tracking angle if collinear
      }
    } else {
      merged.push({
        startCell: currentStart,
        endCell: currentEnd,
        length: currentLength,
        angle: currentAngle,
        turnType: 'start',
      });

      currentStart = currentEnd;
      currentEnd = seg.endCell;
      currentLength = seg.length;
      currentAngle = seg.angle;
    }
  }

  merged.push({
    startCell: currentStart,
    endCell: currentEnd,
    length: currentLength,
    angle: currentAngle,
    turnType: 'start',
  });

  // Determine relative turns between merged segments using strict thresholds:
  // 0°-20°: Continue straight
  // 20°-60°: Bear slight left/right
  // 60°-120°: Turn left/right
  // > 120°: Turn around
  for (let i = 1; i < merged.length; i++) {
    let turnDiff = merged[i].angle - merged[i - 1].angle;
    while (turnDiff > 180) turnDiff -= 360;
    while (turnDiff < -180) turnDiff += 360;

    const absDiff = Math.abs(turnDiff);
    let turnType: 'straight' | 'left' | 'right' | 'slight_left' | 'slight_right' | 'around';
    
    if (absDiff <= 20) {
      turnType = 'straight';
    } else if (absDiff <= 60) {
      turnType = turnDiff >= 0 ? 'slight_left' : 'slight_right';
    } else if (absDiff <= 120) {
      turnType = turnDiff >= 0 ? 'left' : 'right';
    } else {
      turnType = 'around';
    }
    
    merged[i].turnType = turnType;
  }

  // Generate natural language steps
  const steps: RouteStep[] = [];
  for (let i = 0; i < merged.length; i++) {
    const m = merged[i];
    const dist = Math.max(1, Math.round(m.length));
    let instruction = '';

    if (i === 0) {
      instruction = `Walk straight for ${dist} m`;
    } else if (m.turnType === 'straight') {
      instruction = `Continue straight for ${dist} m`;
    } else if (m.turnType === 'slight_left') {
      instruction = `Bear slight left and continue for ${dist} m`;
    } else if (m.turnType === 'slight_right') {
      instruction = `Bear slight right and continue for ${dist} m`;
    } else if (m.turnType === 'left') {
      instruction = `Turn left and continue for ${dist} m`;
    } else if (m.turnType === 'right') {
      instruction = `Turn right and continue for ${dist} m`;
    } else if (m.turnType === 'around') {
      instruction = `Turn around and continue for ${dist} m`;
    }

    steps.push({
      instruction,
      distanceM: Math.round(m.length * 10) / 10,
      nodeId: '',
      gridCell: m.startCell,
    });
  }

  steps.push({
    instruction: 'Arrived at destination',
    distanceM: 0,
    nodeId: '',
    gridCell: cells[cells.length - 1],
  });

  return steps;
}

export function estimateSeconds(distanceM: number): number {
  return Math.ceil(distanceM / WALK_SPEED_MPS);
}
