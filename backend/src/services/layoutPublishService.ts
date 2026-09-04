// src/services/layoutPublishService.ts
// Service for validating and publishing Layout Editor floor definitions into the database.

import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { invalidateGraphCache } from './routingService';

export type Point = { x: number; y: number };

export type EditorDoor = Point & {
  id: string;
  width?: number;
};

export type EditorRoom = {
  id: string;
  type?: string;
  polygon: Point[];
  doors?: EditorDoor[];
};

export type EditorPath = {
  id: string;
  width?: number;
  points: Point[];
};

export type EditorGraphNode = Point & {
  id: string;
  type?: string;
  roomId?: string | null;
  doorId?: string | null;
};

export type EditorGraphEdge = {
  from: string;
  to: string;
  distance?: number;
};

export type EditorFloorDefinition = {
  rooms: EditorRoom[];
  paths?: EditorPath[];
  graph: {
    nodes: EditorGraphNode[];
    edges: EditorGraphEdge[];
  };
};

export interface LayoutPublishBuildingInput {
  id: string;
  name: string;
  location?: string;
}

export interface LayoutPublishFloorInput {
  id: string;
  name: string;
  level: string | number;
  realWidthM?: number | null;
  realHeightM?: number | null;
}

export interface LayoutPublishOptions {
  qrPrefix?: string;
  replaceGraph?: boolean;
  location?: string;
}

export interface LayoutPublishParams {
  building: LayoutPublishBuildingInput;
  floor: LayoutPublishFloorInput;
  definition: EditorFloorDefinition;
  options?: LayoutPublishOptions;
}

export interface LayoutPublishStats {
  buildingId: string;
  floorId: string;
  roomsImported: number;
  graphNodesImported: number;
  graphEdgesImported: number;
  syntheticDoorNodes: number;
  publishedAt: string;
}

// ─── ZOD VALIDATION SCHEMAS ──────────────────────────────────────────────────

export const pointSchema = z.object({
  x: z.number().finite({ message: 'x coordinate must be a finite number' }),
  y: z.number().finite({ message: 'y coordinate must be a finite number' }),
});

export const editorDoorSchema = pointSchema.extend({
  id: z.string().trim().min(1, { message: 'Door id must not be empty' }),
  width: z.number().finite().positive({ message: 'Door width must be positive' }).optional(),
});

export const editorRoomSchema = z.object({
  id: z.string().trim().min(1, { message: 'Room id must not be empty' }),
  type: z.string().optional(),
  polygon: z.array(pointSchema).min(3, { message: 'Room polygon must contain at least 3 points' }),
  doors: z.array(editorDoorSchema).optional(),
});

export const editorPathSchema = z.object({
  id: z.string().trim().min(1, { message: 'Path id must not be empty' }),
  width: z.number().finite().positive().optional(),
  points: z.array(pointSchema).min(2, { message: 'Path must have at least 2 points' }),
});

export const editorGraphNodeSchema = pointSchema.extend({
  id: z.string().trim().min(1, { message: 'Graph node id must not be empty' }),
  type: z.string().optional(),
  roomId: z.string().trim().min(1).nullable().optional(),
  doorId: z.string().trim().min(1).nullable().optional(),
});

export const editorGraphEdgeSchema = z.object({
  from: z.string().trim().min(1, { message: 'Graph edge from must not be empty' }),
  to: z.string().trim().min(1, { message: 'Graph edge to must not be empty' }),
  distance: z.number().finite().nonnegative().optional(),
});

export const layoutPublishSchema = z.object({
  building: z.object({
    id: z.string().trim().min(1, { message: 'Building id is required' }),
    name: z.string().trim().min(1, { message: 'Building name is required' }),
    location: z.string().trim().min(1).optional(),
  }),
  floor: z.object({
    id: z.string().trim().min(1, { message: 'Floor id is required' }),
    name: z.string().trim().min(1, { message: 'Floor name is required' }),
    level: z.union([
      z.string().trim().min(1),
      z.number().finite(),
    ]).transform(v => String(v)),
    realWidthM: z.number().finite().positive().nullable().optional(),
    realHeightM: z.number().finite().positive().nullable().optional(),
  }),
  definition: z.object({
    rooms: z.array(editorRoomSchema).min(1, { message: 'Definition must contain at least one room' }),
    paths: z.array(editorPathSchema).optional(),
    graph: z.object({
      nodes: z.array(editorGraphNodeSchema).min(1, { message: 'Definition graph must contain at least one node' }),
      edges: z.array(editorGraphEdgeSchema),
    }),
  }),
  options: z.object({
    qrPrefix: z.string().trim().min(1).optional(),
    replaceGraph: z.boolean().optional(),
    location: z.string().trim().min(1).optional(),
  }).optional(),
}).superRefine((data, ctx) => {
  // ─── SEMANTIC VALIDATION ───────────────────────────────────────────────────

  // 1. Unique room IDs & unique door IDs within each room
  const roomIds = new Set<string>();
  const roomMap = new Map<string, z.infer<typeof editorRoomSchema>>();

  data.definition.rooms.forEach((room, roomIdx) => {
    if (roomIds.has(room.id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['definition', 'rooms', roomIdx, 'id'],
        message: `Duplicate room id detected: "${room.id}"`,
      });
    } else {
      roomIds.add(room.id);
      roomMap.set(room.id, room);
    }

    if (room.doors && room.doors.length > 0) {
      const doorIds = new Set<string>();
      room.doors.forEach((door, doorIdx) => {
        if (doorIds.has(door.id)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['definition', 'rooms', roomIdx, 'doors', doorIdx, 'id'],
            message: `Duplicate door id "${door.id}" in room "${room.id}"`,
          });
        } else {
          doorIds.add(door.id);
        }
      });
    }
  });

  // 2. Unique node IDs
  const nodeIds = new Set<string>();
  data.definition.graph.nodes.forEach((node, nodeIdx) => {
    if (nodeIds.has(node.id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['definition', 'graph', 'nodes', nodeIdx, 'id'],
        message: `Duplicate graph node id detected: "${node.id}"`,
      });
    } else {
      nodeIds.add(node.id);
    }

    // 3. Node roomId references an existing room
    if (node.roomId) {
      const targetRoom = roomMap.get(node.roomId);
      if (!targetRoom) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['definition', 'graph', 'nodes', nodeIdx, 'roomId'],
          message: `Graph node "${node.id}" references non-existent roomId "${node.roomId}"`,
        });
      } else if (node.doorId) {
        // 4. Graph node doorId is valid on the referenced room
        const hasDoor = targetRoom.doors?.some(d => d.id === node.doorId);
        if (!hasDoor) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['definition', 'graph', 'nodes', nodeIdx, 'doorId'],
            message: `Graph node "${node.id}" references doorId "${node.doorId}" which does not exist on room "${node.roomId}"`,
          });
        }
      }
    } else if (node.doorId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['definition', 'graph', 'nodes', nodeIdx, 'doorId'],
        message: `Graph node "${node.id}" specifies doorId "${node.doorId}" without a roomId`,
      });
    }
  });

  // 5. Graph edges must reference submitted nodes and cannot be self-loops
  data.definition.graph.edges.forEach((edge, edgeIdx) => {
    if (!nodeIds.has(edge.from)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['definition', 'graph', 'edges', edgeIdx, 'from'],
        message: `Graph edge references missing "from" node: "${edge.from}"`,
      });
    }
    if (!nodeIds.has(edge.to)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['definition', 'graph', 'edges', edgeIdx, 'to'],
        message: `Graph edge references missing "to" node: "${edge.to}"`,
      });
    }
    if (edge.from === edge.to) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['definition', 'graph', 'edges', edgeIdx],
        message: `Self-looping edge detected: "${edge.from}" -> "${edge.to}"`,
      });
    }
  });
});

// ─── UTILITY HELPERS ─────────────────────────────────────────────────────────

export function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'item';
}

export function codeify(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'ITEM';
}

export function normaliseRoomType(type?: string): string {
  const value = (type ?? 'OTHER').toUpperCase().replace(/[^A-Z0-9]+/g, '_');
  if (value.includes('OPEN')) return 'OPEN_WORKSPACE';
  if (value.includes('LOBBY')) return 'RECEPTION';
  if (value.includes('STAIR')) return 'EXIT';
  if (value.includes('ROOM')) return 'OFFICE';
  return value || 'OTHER';
}

export function centroid(points: Point[]): Point {
  return {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
  };
}

export function bounds(points: Point[]) {
  if (points.length === 0) {
    return { minX: 0, minY: 0, maxX: 100, maxY: 100, width: 100, height: 100 };
  }
  const xs = points.map(point => point.x);
  const ys = points.map(point => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  };
}

export function distance(a: Point, b: Point): number {
  return Math.round(Math.hypot(b.x - a.x, b.y - a.y) * 100) / 100;
}

export function distanceToSegment(p: Point, a: Point, b: Point): { dist: number; t: number } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) {
    const dist = Math.hypot(p.x - a.x, p.y - a.y);
    return { dist, t: 0 };
  }
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  const closestX = a.x + t * dx;
  const closestY = a.y + t * dy;
  const dist = Math.hypot(p.x - closestX, p.y - closestY);
  return { dist, t };
}

export function nodeDbId(floorId: string, nodeId: string): string {
  return `editor-${floorId}-node-${slugify(nodeId)}`;
}

export function roomDbId(floorId: string, roomId: string): string {
  return `editor-${floorId}-room-${slugify(roomId)}`;
}

export function doorNodeDbId(floorId: string, roomId: string, doorId: string): string {
  return `editor-${floorId}-door-${slugify(roomId)}-${slugify(doorId)}`;
}

export function nodeType(node: EditorGraphNode): string {
  if (node.type === 'door') return 'ROOM_ENTRY';
  if (node.type === 'junction') return 'CORRIDOR_JUNCTION';
  return 'WAYPOINT';
}

// ─── CORE SERVICE IMPLEMENTATION ─────────────────────────────────────────────

/**
 * Publishes an editor floor definition into the database inside an atomic transaction.
 * Automatically handles building/floor upsert, room boundaries, graph nodes,
 * inline edge splitting, synthetic door entries, and post-commit cache invalidation.
 */
export async function publishLayoutDefinition(
  prisma: PrismaClient,
  rawParams: LayoutPublishParams
): Promise<LayoutPublishStats> {
  // 1. Strict semantic & syntactic validation
  const params = layoutPublishSchema.parse(rawParams);
  const { building: bData, floor: fData, definition, options = {} } = params;

  const allPoints: Point[] = [
    ...definition.rooms.flatMap(room => room.polygon),
    ...definition.graph.nodes,
    ...(definition.paths ?? []).flatMap(editorPath => editorPath.points),
  ];
  const floorBounds = bounds(allPoints);

  const buildingLoc =
    bData.location ??
    options.location ??
    (bData.id.toLowerCase().includes('jupiter') || bData.id.toLowerCase().includes('gravity')
      ? 'Bangalore'
      : bData.id.toLowerCase().includes('gurugram')
        ? 'Gurugram'
        : 'Pune');

  const levelStr = String(fData.level);
  const replaceGraph = options.replaceGraph !== false;

  let roomsImported = 0;
  let graphNodesImported = 0;
  let graphEdgesImported = 0;
  let syntheticDoorNodes = 0;

  // 2. ATOMIC DATABASE TRANSACTION
  await prisma.$transaction(async (tx) => {
    // 2.1 Upsert Building
    const building = await tx.building.upsert({
      where: { id: bData.id },
      create: {
        id: bData.id,
        name: bData.name,
        location: buildingLoc,
      },
      update: {
        name: bData.name,
        location: buildingLoc,
      },
    });

    // 2.2 Find or Upsert Floor safely
    const existingFloorById = await tx.floor.findUnique({ where: { id: fData.id } });
    const existingFloorByLevel = await tx.floor.findUnique({
      where: { buildingId_level: { buildingId: building.id, level: levelStr } },
    });

    let floor;
    if (existingFloorById) {
      floor = await tx.floor.update({
        where: { id: fData.id },
        data: {
          buildingId: building.id,
          level: levelStr,
          name: fData.name,
          gridCols: Math.ceil(floorBounds.maxX),
          gridRows: Math.ceil(floorBounds.maxY),
          scaleX: fData.realWidthM ? fData.realWidthM / floorBounds.width : 1,
          scaleY: fData.realHeightM ? fData.realHeightM / floorBounds.height : 1,
          widthM: floorBounds.width,
          heightM: floorBounds.height,
          realWidthM: fData.realWidthM ?? floorBounds.width,
          realHeightM: fData.realHeightM ?? floorBounds.height,
        },
      });
    } else if (existingFloorByLevel) {
      floor = await tx.floor.update({
        where: { id: existingFloorByLevel.id },
        data: {
          name: fData.name,
          gridCols: Math.ceil(floorBounds.maxX),
          gridRows: Math.ceil(floorBounds.maxY),
          scaleX: fData.realWidthM ? fData.realWidthM / floorBounds.width : 1,
          scaleY: fData.realHeightM ? fData.realHeightM / floorBounds.height : 1,
          widthM: floorBounds.width,
          heightM: floorBounds.height,
          realWidthM: fData.realWidthM ?? floorBounds.width,
          realHeightM: fData.realHeightM ?? floorBounds.height,
        },
      });
    } else {
      floor = await tx.floor.create({
        data: {
          id: fData.id,
          buildingId: building.id,
          level: levelStr,
          name: fData.name,
          gridCols: Math.ceil(floorBounds.maxX),
          gridRows: Math.ceil(floorBounds.maxY),
          scaleX: fData.realWidthM ? fData.realWidthM / floorBounds.width : 1,
          scaleY: fData.realHeightM ? fData.realHeightM / floorBounds.height : 1,
          widthM: floorBounds.width,
          heightM: floorBounds.height,
          realWidthM: fData.realWidthM ?? floorBounds.width,
          realHeightM: fData.realHeightM ?? floorBounds.height,
        },
      });
    }

    // 2.3 Safely clear old floor-scoped graph if replacing
    if (replaceGraph) {
      // Delete edges connecting nodes on this floor
      await tx.edge.deleteMany({
        where: {
          OR: [
            { fromNode: { floorId: floor.id } },
            { toNode: { floorId: floor.id } },
          ],
        },
      });

      // Delete navSessions referencing rooms on this floor
      await tx.navSession.deleteMany({
        where: {
          OR: [
            { fromRoom: { floorId: floor.id } },
            { toRoom: { floorId: floor.id } },
          ],
        },
      });

      // Delete nodes on this floor
      await tx.node.deleteMany({
        where: { floorId: floor.id },
      });

      // Delete rooms on this floor
      await tx.room.deleteMany({
        where: { floorId: floor.id },
      });
    }

    // 2.4 Import rooms
    const roomIdMap = new Map<string, string>();
    const qrPrefix = options.qrPrefix ?? `LOC-F${codeify(levelStr)}`;

    for (const room of definition.rooms) {
      const roomBounds = bounds(room.polygon);
      const centre = centroid(room.polygon);
      const id = roomDbId(floor.id, room.id);
      const code = `${codeify(bData.name)}_${codeify(levelStr)}_${codeify(room.id)}`;

      await tx.room.upsert({
        where: { id },
        create: {
          id,
          floorId: floor.id,
          code,
          name: room.id,
          type: normaliseRoomType(room.type),
          gridX: Math.round(roomBounds.minX),
          gridY: Math.round(roomBounds.minY),
          gridW: Math.round(roomBounds.width),
          gridH: Math.round(roomBounds.height),
          centreX: Math.round(centre.x * 100) / 100,
          centreY: Math.round(centre.y * 100) / 100,
          qrCode: `${qrPrefix}-${codeify(room.id)}`,
          isAccessible: true,
        },
        update: {
          name: room.id,
          type: normaliseRoomType(room.type),
          gridX: Math.round(roomBounds.minX),
          gridY: Math.round(roomBounds.minY),
          gridW: Math.round(roomBounds.width),
          gridH: Math.round(roomBounds.height),
          centreX: Math.round(centre.x * 100) / 100,
          centreY: Math.round(centre.y * 100) / 100,
          qrCode: `${qrPrefix}-${codeify(room.id)}`,
        },
      });

      roomIdMap.set(room.id, id);
      roomsImported++;
    }

    // 2.5 Import graph nodes
    const graphNodeByEditorId = new Map<string, EditorGraphNode>();
    const graphNodeIdMap = new Map<string, string>();
    const importedDoorKeys = new Set<string>();

    for (const node of definition.graph.nodes) {
      const id = nodeDbId(floor.id, node.id);
      const roomId = node.roomId ? roomIdMap.get(node.roomId) ?? null : null;
      graphNodeByEditorId.set(node.id, node);
      graphNodeIdMap.set(node.id, id);

      if (node.type === 'door' && node.roomId && node.doorId) {
        importedDoorKeys.add(`${node.roomId}:${node.doorId}`);
      }

      await tx.node.upsert({
        where: { id },
        create: {
          id,
          floorId: floor.id,
          roomId,
          gridX: Math.round(node.x),
          gridY: Math.round(node.y),
          realX: node.x,
          realY: node.y,
          type: nodeType(node),
          label: node.doorId ? `${node.roomId ?? 'door'} ${node.doorId}` : node.id,
        },
        update: {
          roomId,
          gridX: Math.round(node.x),
          gridY: Math.round(node.y),
          realX: node.x,
          realY: node.y,
          type: nodeType(node),
          label: node.doorId ? `${node.roomId ?? 'door'} ${node.doorId}` : node.id,
        },
      });

      graphNodesImported++;
    }

    // 2.6 Import graph edges with inline splitting
    const threshold = 5.0; // Layout units threshold to detect intermediate nodes
    const createdEdgeIds = new Set<string>();

    for (const edge of definition.graph.edges) {
      const fromNode = graphNodeByEditorId.get(edge.from);
      const toNode = graphNodeByEditorId.get(edge.to);

      if (!fromNode || !toNode) {
        continue;
      }

      // Find all nodes that lie on this segment (excluding endpoints)
      const onSegmentNodes: { id: string; dbId: string; node: EditorGraphNode; t: number }[] = [];
      for (const node of definition.graph.nodes) {
        if (node.id === edge.from || node.id === edge.to) continue;

        const { dist, t } = distanceToSegment(node, fromNode, toNode);
        if (dist < threshold && t > 0.001 && t < 0.999) {
          const dbId = graphNodeIdMap.get(node.id);
          if (dbId) {
            onSegmentNodes.push({ id: node.id, dbId, node, t });
          }
        }
      }

      const orderedNodes: { id: string; dbId: string; node: EditorGraphNode }[] = [
        { id: edge.from, dbId: graphNodeIdMap.get(edge.from)!, node: fromNode },
        ...onSegmentNodes.sort((a, b) => a.t - b.t),
        { id: edge.to, dbId: graphNodeIdMap.get(edge.to)!, node: toNode },
      ];

      for (let i = 0; i < orderedNodes.length - 1; i++) {
        const u = orderedNodes[i];
        const v = orderedNodes[i + 1];

        const edgeId = `editor-${floor.id}-edge-${slugify(u.id)}-${slugify(v.id)}`;
        if (createdEdgeIds.has(edgeId)) continue;
        createdEdgeIds.add(edgeId);

        const weight = distance(u.node, v.node);

        await tx.edge.upsert({
          where: { id: edgeId },
          create: {
            id: edgeId,
            fromNodeId: u.dbId,
            toNodeId: v.dbId,
            weight,
            isAccessible: true,
            isBidirectional: true,
          },
          update: {
            weight,
            isAccessible: true,
          },
        });

        graphEdgesImported++;
      }
    }

    // 2.7 Create synthetic door entry nodes and connectors
    const graphNodes = definition.graph.nodes;

    for (const room of definition.rooms) {
      const roomId = roomIdMap.get(room.id);
      if (!roomId) continue;

      const roomDoors: EditorDoor[] = room.doors && room.doors.length > 0 ? [...room.doors] : [];
      if (roomDoors.length === 0 && room.polygon && room.polygon.length > 0) {
        const avg = room.polygon.reduce(
          (acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }),
          { x: 0, y: 0 }
        );
        roomDoors.push({
          id: 'centroid-door',
          x: avg.x / room.polygon.length,
          y: avg.y / room.polygon.length,
        });
      }

      for (const door of roomDoors) {
        // If the door already has an editor graph node with matching roomId & doorId, skip duplicate
        if (importedDoorKeys.has(`${room.id}:${door.id}`)) {
          continue;
        }

        const nearest = graphNodes.reduce<EditorGraphNode | null>((best, node) => {
          if (!best) return node;
          return distance(door, node) < distance(door, best) ? node : best;
        }, null);

        if (!nearest) continue;

        const doorDbId = doorNodeDbId(floor.id, room.id, door.id);
        const nearestDbId = graphNodeIdMap.get(nearest.id);
        if (!nearestDbId) continue;

        await tx.node.upsert({
          where: { id: doorDbId },
          create: {
            id: doorDbId,
            floorId: floor.id,
            roomId,
            gridX: Math.round(door.x),
            gridY: Math.round(door.y),
            realX: door.x,
            realY: door.y,
            type: 'ROOM_ENTRY',
            label: `${room.id} ${door.id}`,
          },
          update: {
            roomId,
            gridX: Math.round(door.x),
            gridY: Math.round(door.y),
            realX: door.x,
            realY: door.y,
            label: `${room.id} ${door.id}`,
          },
        });

        const edgeId = `editor-${floor.id}-edge-door-${slugify(room.id)}-${slugify(door.id)}-to-${slugify(nearest.id)}`;
        await tx.edge.upsert({
          where: { id: edgeId },
          create: {
            id: edgeId,
            fromNodeId: doorDbId,
            toNodeId: nearestDbId,
            weight: distance(door, nearest),
            isAccessible: true,
            isBidirectional: true,
          },
          update: {
            weight: distance(door, nearest),
            isAccessible: true,
          },
        });

        syntheticDoorNodes++;
      }
    }
  }, {
    timeout: 30000,
  });

  // 3. INVALIDATE CACHE ONLY AFTER TRANSACTION COMMITS
  invalidateGraphCache();

  return {
    buildingId: bData.id,
    floorId: fData.id,
    roomsImported,
    graphNodesImported,
    graphEdgesImported,
    syntheticDoorNodes,
    publishedAt: new Date().toISOString(),
  };
}
