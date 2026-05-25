// src/types/index.ts — All shared types for the Indoor Nav backend

// ─── GRAPH TYPES ──────────────────────────────────────────────────────────────

export interface GridCell {
  x: number; // column
  y: number; // row
}

export interface RealCoord {
  x: number; // metres from floor origin
  y: number;
}

export interface GraphNode {
  id: string;
  floorId: string;
  roomId: string | null;
  gridX: number;
  gridY: number;
  realX: number;
  realY: number;
  type: string;
  label: string | null;
}

export interface GraphEdge {
  fromNodeId: string;
  toNodeId: string;
  weight: number;        // metres
  isAccessible: boolean;
}

// Adjacency list: nodeId → list of connected nodes with weights
export type AdjacencyList = Map<string, Array<{ nodeId: string; weight: number; isAccessible: boolean }>>;

// ─── PATHFINDING TYPES ───────────────────────────────────────────────────────

export interface PathfindingOptions {
  accessibleOnly?: boolean;   // avoid stairs
  preferLifts?: boolean;
}

export interface RouteStep {
  instruction: string;        // "Head north along the corridor"
  distanceM: number;
  nodeId: string;
  gridCell: GridCell;
  floorLevel?: number;
  floorName?: string;
}

export interface RouteResult {
  found: boolean;
  fromRoomId: string;
  toRoomId: string;
  pathNodeIds: string[];
  pathGridCells: GridCell[];
  steps: RouteStep[];
  totalDistanceM: number;
  estimatedSeconds: number;
  floorChanges: number;
  accessible: boolean;
}

// ─── MAP / FLOOR TYPES ───────────────────────────────────────────────────────

// 0 = walkable, 1 = wall/obstacle
export type WalkabilityGrid = number[][];

export interface FloorMapData {
  floorId: string;
  level: string;
  name: string;
  gridRows: number;
  gridCols: number;
  grid: WalkabilityGrid;
  scaleX: number;         // metres per grid cell X
  scaleY: number;         // metres per grid cell Y
  rooms: RoomMapData[];
}

export interface RoomMapData {
  id: string;
  code: string;
  name: string;
  type: string;
  gridX: number;
  gridY: number;
  gridW: number;
  gridH: number;
  centreX: number;
  centreY: number;
  qrCode: string | null;
  capacity: number | null;
  isAccessible: boolean;
}

// ─── API RESPONSE TYPES ──────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: {
    timestamp: string;
    requestId?: string;
  };
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

// ─── DXF PARSER TYPES ────────────────────────────────────────────────────────

export interface DxfWall {
  type: 'LINE' | 'LWPOLYLINE';
  layer: string;
  points: Array<[number, number]>; // [[x1,y1],[x2,y2],...]
}

export interface DxfRoom {
  layer: string;
  label: string;
  points: Array<[number, number]>;
  centreX: number;
  centreY: number;
  closed: boolean;
}

export interface DxfLabel {
  text: string;
  x: number;
  y: number;
  layer: string;
}

export interface ParsedFloorplan {
  walls: DxfWall[];
  rooms: DxfRoom[];
  labels: DxfLabel[];
  boundingBox: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    widthM: number;
    heightM: number;
  };
}
