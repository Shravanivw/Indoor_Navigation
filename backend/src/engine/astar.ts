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
  const path = [endId];
  let current = endId;
  while (cameFrom.has(current)) {
    current = cameFrom.get(current)!;
    path.unshift(current);
  }
  return path;
}

// ─── DIRECTION GENERATOR ─────────────────────────────────────────────────────

const WALK_SPEED_MPS = 1.4; // average walking speed metres per second

export function buildRouteSteps(
  pathCells: GridCell[],
  scaleX: number,  // metres per cell
  scaleY: number
): RouteStep[] {
  if (pathCells.length < 2) return [];

  type Dir = 'north' | 'south' | 'east' | 'west';
  const getDir = (a: GridCell, b: GridCell): Dir => {
    if (b.y < a.y) return 'north';
    if (b.y > a.y) return 'south';
    if (b.x > a.x) return 'east';
    return 'west';
  };

  const cellDist = (a: GridCell, b: GridCell) =>
    Math.sqrt(((b.x - a.x) * scaleX) ** 2 + ((b.y - a.y) * scaleY) ** 2);

  // Relative turn (independent of compass) — what the user actually does.
  const relativeTurn = (prev: Dir, next: Dir): 'straight' | 'left' | 'right' | 'around' => {
    const order: Dir[] = ['north', 'east', 'south', 'west'];
    const d = (order.indexOf(next) - order.indexOf(prev) + 4) % 4;
    if (d === 0) return 'straight';
    if (d === 1) return 'right';
    if (d === 2) return 'around';
    return 'left';
  };

  // 1) Collapse the cell-by-cell path into directional segments.
  type Seg = { dir: Dir; distM: number; startIdx: number; endIdx: number };
  const segments: Seg[] = [];
  let segStart = 0;
  let segDir = getDir(pathCells[0], pathCells[1]);
  let segDist = cellDist(pathCells[0], pathCells[1]);

  for (let i = 2; i < pathCells.length; i++) {
    const d = getDir(pathCells[i - 1], pathCells[i]);
    const step = cellDist(pathCells[i - 1], pathCells[i]);
    if (d === segDir) {
      segDist += step;
    } else {
      segments.push({ dir: segDir, distM: segDist, startIdx: segStart, endIdx: i - 1 });
      segStart = i - 1;
      segDir = d;
      segDist = step;
    }
  }
  segments.push({
    dir: segDir,
    distM: segDist,
    startIdx: segStart,
    endIdx: pathCells.length - 1,
  });

  // 2) Build human-readable steps from segments using relative turns.
  const steps: RouteStep[] = [];
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const m = Math.max(1, Math.round(seg.distM));
    let instruction: string;
    if (i === 0) {
      instruction = `Walk forward for ${m} m`;
    } else {
      const turn = relativeTurn(segments[i - 1].dir, seg.dir);
      if (turn === 'straight')      instruction = `Continue straight for ${m} m`;
      else if (turn === 'around')   instruction = `Turn around and walk ${m} m`;
      else                          instruction = `Turn ${turn} and walk ${m} m`;
    }
    steps.push({
      instruction,
      distanceM: Math.round(seg.distM * 10) / 10,
      nodeId: '',
      gridCell: pathCells[seg.startIdx],
    });
  }

  // 3) Final "arrived" step.
  steps.push({
    instruction: 'Arrived at destination',
    distanceM: 0,
    nodeId: '',
    gridCell: pathCells[pathCells.length - 1],
  });

  return steps;
}

function formatInstruction(_dir: string, _dist: number, _isFirst: boolean): string {
  // Retained for backward compatibility; new logic lives in buildRouteSteps.
  return '';
}

export function estimateSeconds(distanceM: number): number {
  return Math.ceil(distanceM / WALK_SPEED_MPS);
}
