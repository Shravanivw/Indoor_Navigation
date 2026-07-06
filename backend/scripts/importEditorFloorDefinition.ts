// scripts/importEditorFloorDefinition.ts
// Imports layout-editor's floorDefinition.json into the Indoor Navigation DB.
//
// Usage:
//   ts-node scripts/importEditorFloorDefinition.ts \
//     --file ../layout-editor/floorDefinition.json \
//     --building-id building-hudson \
//     --building-name Hudson \
//     --floor-id floor-hudson-f5 \
//     --level 5 \
//     --floor-name "5th Floor"

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

type Point = { x: number; y: number };

type EditorDoor = Point & {
  id: string;
  width?: number;
};

type EditorRoom = {
  id: string;
  type?: string;
  polygon: Point[];
  doors?: EditorDoor[];
};

type EditorPath = {
  id: string;
  width?: number;
  points: Point[];
};

type EditorGraphNode = Point & {
  id: string;
  type?: string;
  roomId?: string;
  doorId?: string;
};

type EditorGraphEdge = {
  from: string;
  to: string;
  distance?: number;
};

type EditorFloorDefinition = {
  rooms: EditorRoom[];
  paths?: EditorPath[];
  graph: {
    nodes: EditorGraphNode[];
    edges: EditorGraphEdge[];
  };
};

type ImportOptions = {
  file: string;
  buildingId: string;
  buildingName: string;
  floorId: string;
  level: string;
  floorName: string;
  qrPrefix: string;
  replaceGraph: boolean;
  realWidthM: number | null;
  realHeightM: number | null;
};

const prisma = new PrismaClient();

function getArg(name: string, fallback?: string): string | undefined {
  const args = process.argv.slice(2);
  const index = args.indexOf(name);
  if (index === -1) return fallback;
  return args[index + 1] ?? fallback;
}

function hasFlag(name: string): boolean {
  return process.argv.slice(2).includes(name);
}

function readOptions(): ImportOptions {
  const file = getArg('--file');
  if (!file) {
    throw new Error('Missing --file path/to/floorDefinition.json');
  }

  const floorId = getArg('--floor-id', 'floor-hudson-f5')!;
  const level = getArg('--level', '5')!;

  return {
    file,
    buildingId: getArg('--building-id', 'building-hudson')!,
    buildingName: getArg('--building-name', 'Hudson')!,
    floorId,
    level,
    floorName: getArg('--floor-name', `${level}th Floor`)!,
    qrPrefix: getArg('--qr-prefix', `LOC-${level}`)!,
    replaceGraph: !hasFlag('--keep-existing-graph'),
    realWidthM: parseFloat(getArg('--real-width-m', '0') ?? '0') || null,
    realHeightM: parseFloat(getArg('--real-height-m', '0') ?? '0') || null,
  };
}

function assertPoint(point: unknown, label: string): asserts point is Point {
  if (
    !point ||
    typeof point !== 'object' ||
    typeof (point as Point).x !== 'number' ||
    typeof (point as Point).y !== 'number'
  ) {
    throw new Error(`Invalid point at ${label}`);
  }
}

function validateDefinition(data: unknown): asserts data is EditorFloorDefinition {
  const definition = data as EditorFloorDefinition;
  if (!Array.isArray(definition?.rooms)) {
    throw new Error('Invalid floor definition: rooms must be an array');
  }
  if (!Array.isArray(definition?.graph?.nodes)) {
    throw new Error('Invalid floor definition: graph.nodes must be an array');
  }
  if (!Array.isArray(definition?.graph?.edges)) {
    throw new Error('Invalid floor definition: graph.edges must be an array');
  }

  definition.rooms.forEach((room, roomIndex) => {
    if (!room.id || !Array.isArray(room.polygon) || room.polygon.length < 3) {
      throw new Error(`Invalid room at rooms[${roomIndex}]`);
    }
    room.polygon.forEach((point, pointIndex) =>
      assertPoint(point, `rooms[${roomIndex}].polygon[${pointIndex}]`)
    );
    room.doors?.forEach((door, doorIndex) =>
      assertPoint(door, `rooms[${roomIndex}].doors[${doorIndex}]`)
    );
  });

  definition.graph.nodes.forEach((node, index) => {
    if (!node.id) throw new Error(`Invalid graph node at graph.nodes[${index}]`);
    assertPoint(node, `graph.nodes[${index}]`);
  });

  definition.graph.edges.forEach((edge, index) => {
    if (!edge.from || !edge.to) {
      throw new Error(`Invalid graph edge at graph.edges[${index}]`);
    }
  });
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'item';
}

function codeify(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'ITEM';
}

function normaliseRoomType(type?: string): string {
  const value = (type ?? 'OTHER').toUpperCase().replace(/[^A-Z0-9]+/g, '_');
  if (value.includes('OPEN')) return 'OPEN_WORKSPACE';
  if (value.includes('LOBBY')) return 'RECEPTION';
  if (value.includes('STAIR')) return 'EXIT';
  if (value.includes('ROOM')) return 'OFFICE';
  return value || 'OTHER';
}

function centroid(points: Point[]): Point {
  return {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
  };
}

function bounds(points: Point[]) {
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

function distance(a: Point, b: Point): number {
  return Math.round(Math.hypot(b.x - a.x, b.y - a.y) * 100) / 100;
}

function nodeDbId(floorId: string, nodeId: string): string {
  return `editor-${floorId}-node-${slugify(nodeId)}`;
}

function roomDbId(floorId: string, roomId: string): string {
  return `editor-${floorId}-room-${slugify(roomId)}`;
}

function doorNodeDbId(floorId: string, roomId: string, doorId: string): string {
  return `editor-${floorId}-door-${slugify(roomId)}-${slugify(doorId)}`;
}

function nodeType(node: EditorGraphNode): string {
  if (node.type === 'door') return 'ROOM_ENTRY';
  if (node.type === 'junction') return 'CORRIDOR_JUNCTION';
  return 'WAYPOINT';
}

async function main() {
  const options = readOptions();
  const absoluteFile = path.resolve(options.file);
  const parsed = JSON.parse(fs.readFileSync(absoluteFile, 'utf-8'));
  validateDefinition(parsed);

  const allPoints = [
    ...parsed.rooms.flatMap(room => room.polygon),
    ...parsed.graph.nodes,
    ...(parsed.paths ?? []).flatMap(editorPath => editorPath.points),
  ];
  const floorBounds = bounds(allPoints);

  console.log(`Importing ${absoluteFile}`);
  console.log(`  Floor bounds: ${floorBounds.width} x ${floorBounds.height} px`);

  const building = await prisma.building.upsert({
    where: { id: options.buildingId },
    create: {
      id: options.buildingId,
      name: options.buildingName,
    },
    update: {
      name: options.buildingName,
    },
  });

  const floor = await prisma.floor.upsert({
    where: {
      buildingId_level: {
        buildingId: building.id,
        level: options.level,
      },
    },
    create: {
      id: options.floorId,
      buildingId: building.id,
      level: options.level,
      name: options.floorName,
      gridCols: Math.ceil(floorBounds.maxX),
      gridRows: Math.ceil(floorBounds.maxY),
      // scaleX/scaleY are metres-per-layout-unit for real-world distance calculations.
      // If --real-width-m and --real-height-m are supplied, compute them correctly.
      // Otherwise default to 1 (layout units treated as metres — distances will be wrong).
      scaleX: options.realWidthM ? options.realWidthM / floorBounds.width : 1,
      scaleY: options.realHeightM ? options.realHeightM / floorBounds.height : 1,
      widthM: floorBounds.width,
      heightM: floorBounds.height,
      realWidthM: options.realWidthM ?? floorBounds.width,
      realHeightM: options.realHeightM ?? floorBounds.height,
    },
    update: {
      name: options.floorName,
      gridCols: Math.ceil(floorBounds.maxX),
      gridRows: Math.ceil(floorBounds.maxY),
      scaleX: options.realWidthM ? options.realWidthM / floorBounds.width : 1,
      scaleY: options.realHeightM ? options.realHeightM / floorBounds.height : 1,
      widthM: floorBounds.width,
      heightM: floorBounds.height,
      realWidthM: options.realWidthM ?? floorBounds.width,
      realHeightM: options.realHeightM ?? floorBounds.height,
    },
  });

  if (options.replaceGraph) {
    console.log('  Clearing existing floor graph...');
    await prisma.edge.deleteMany({
      where: {
        OR: [
          { fromNode: { floorId: floor.id } },
          { toNode: { floorId: floor.id } },
        ],
      },
    });
    await prisma.node.deleteMany({ where: { floorId: floor.id } });
    await prisma.navSession.deleteMany({
      where: {
        OR: [
          { fromRoom: { floorId: floor.id } },
          { toRoom: { floorId: floor.id } },
        ],
      },
    });
    await prisma.room.deleteMany({ where: { floorId: floor.id } });
  }

  const roomIdMap = new Map<string, string>();

  console.log(`  Upserting ${parsed.rooms.length} rooms...`);
  for (const room of parsed.rooms) {
    const roomBounds = bounds(room.polygon);
    const centre = centroid(room.polygon);
    const id = roomDbId(floor.id, room.id);
    const code = `${codeify(options.buildingName)}_${codeify(options.level)}_${codeify(room.id)}`;

    await prisma.room.upsert({
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
        qrCode: `${options.qrPrefix}-${codeify(room.id)}`,
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
        qrCode: `${options.qrPrefix}-${codeify(room.id)}`,
      },
    });

    roomIdMap.set(room.id, id);
  }

  const graphNodeByEditorId = new Map<string, EditorGraphNode>();
  const graphNodeIdMap = new Map<string, string>();
  const importedDoorKeys = new Set<string>();

  console.log(`  Upserting ${parsed.graph.nodes.length} graph nodes...`);
  for (const node of parsed.graph.nodes) {
    const id = nodeDbId(floor.id, node.id);
    const roomId = node.roomId ? roomIdMap.get(node.roomId) ?? null : null;
    graphNodeByEditorId.set(node.id, node);
    graphNodeIdMap.set(node.id, id);

    if (node.type === 'door' && node.roomId && node.doorId) {
      importedDoorKeys.add(`${node.roomId}:${node.doorId}`);
    }

    await prisma.node.upsert({
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
  }

  console.log(`  Upserting ${parsed.graph.edges.length} graph edges...`);
  for (const edge of parsed.graph.edges) {
    if (floor.id === 'floor-hudson-f6') {
      const isN4N34 = (edge.from === 'N4' && edge.to === 'N34') || (edge.from === 'N34' && edge.to === 'N4');
      if (isN4N34) {
        console.log(`  [Hudson F6] Skipping raw N4-N34 corridor edge (will inject split edges)...`);
        continue;
      }
    }

    const fromId = graphNodeIdMap.get(edge.from);
    const toId = graphNodeIdMap.get(edge.to);
    const fromNode = graphNodeByEditorId.get(edge.from);
    const toNode = graphNodeByEditorId.get(edge.to);

    if (!fromId || !toId || !fromNode || !toNode) {
      console.warn(`  [WARN] Skipping edge ${edge.from} -> ${edge.to}; node missing`);
      continue;
    }

    const id = `editor-${floor.id}-edge-${slugify(edge.from)}-${slugify(edge.to)}`;
    await prisma.edge.upsert({
      where: { id },
      create: {
        id,
        fromNodeId: fromId,
        toNodeId: toId,
        weight: edge.distance ?? distance(fromNode, toNode),
        isAccessible: true,
        isBidirectional: true,
      },
      update: {
        weight: edge.distance ?? distance(fromNode, toNode),
        isAccessible: true,
      },
    });
  }

  if (floor.id === 'floor-hudson-f6') {
    console.log("  [Hudson F6] Injecting split corridor edges to connect BYOD component...");
    const fromId_n4 = nodeDbId(floor.id, 'N4');
    const toId_n37 = nodeDbId(floor.id, 'N37');
    const toId_n34 = nodeDbId(floor.id, 'N34');

    await prisma.edge.upsert({
      where: { id: `editor-${floor.id}-edge-n4-n37` },
      create: {
        id: `editor-${floor.id}-edge-n4-n37`,
        fromNodeId: fromId_n4,
        toNodeId: toId_n37,
        weight: 120.0,
        isAccessible: true,
        isBidirectional: true,
      },
      update: {
        weight: 120.0,
      },
    });

    await prisma.edge.upsert({
      where: { id: `editor-${floor.id}-edge-n37-n34` },
      create: {
        id: `editor-${floor.id}-edge-n37-n34`,
        fromNodeId: toId_n37,
        toNodeId: toId_n34,
        weight: 287.0,
        isAccessible: true,
        isBidirectional: true,
      },
      update: {
        weight: 287.0,
      },
    });

    console.log("  [Hudson F6] Injecting missing corridor edges to connect isolated subgraphs...");
    const extraEdges = [
      { from: 'N10', to: 'N15', weight: 37.0 },
      { from: 'N37', to: 'N43', weight: 20.0 },
      { from: 'N24', to: 'N56', weight: 31.0 },
      { from: 'N5', to: 'N9', weight: 52.0 },
      { from: 'J127', to: 'N40', weight: 49.2 }
    ];

    for (const edgeInfo of extraEdges) {
      const fromNodeId = nodeDbId(floor.id, edgeInfo.from);
      const toNodeId = nodeDbId(floor.id, edgeInfo.to);
      const edgeId = `editor-${floor.id}-edge-extra-${slugify(edgeInfo.from)}-to-${slugify(edgeInfo.to)}`;
      
      await prisma.edge.upsert({
        where: { id: edgeId },
        create: {
          id: edgeId,
          fromNodeId,
          toNodeId,
          weight: edgeInfo.weight,
          isAccessible: true,
          isBidirectional: true,
        },
        update: {
          weight: edgeInfo.weight,
        },
      });

      const revEdgeId = `editor-${floor.id}-edge-extra-${slugify(edgeInfo.to)}-to-${slugify(edgeInfo.from)}`;
      await prisma.edge.upsert({
        where: { id: revEdgeId },
        create: {
          id: revEdgeId,
          fromNodeId: toNodeId,
          toNodeId: fromNodeId,
          weight: edgeInfo.weight,
          isAccessible: true,
          isBidirectional: true,
        },
        update: {
          weight: edgeInfo.weight,
        },
      });
    }
  }

  const graphNodes = parsed.graph.nodes;
  const importedGraphDoorCount = importedDoorKeys.size;
  let syntheticDoorCount = 0;

  console.log('  Upserting door entry nodes...');
  for (const room of parsed.rooms) {
    const roomId = roomIdMap.get(room.id);
    if (!roomId) continue;

    const roomDoors = room.doors && room.doors.length > 0 ? room.doors : [];
    if (roomDoors.length === 0 && room.polygon && room.polygon.length > 0) {
      const avg = room.polygon.reduce(
        (acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }),
        { x: 0, y: 0 }
      );
      roomDoors.push({
        id: 'centroid-door',
        x: avg.x / room.polygon.length,
        y: avg.y / room.polygon.length
      });
    }

    for (const door of roomDoors) {
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

      await prisma.node.upsert({
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
      await prisma.edge.upsert({
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

      syntheticDoorCount += 1;
    }
  }

  console.log('\nImport complete.');
  console.log(`  Building: ${building.id}`);
  console.log(`  Floor:    ${floor.id}`);
  console.log(`  Rooms:    ${parsed.rooms.length}`);
  console.log(`  Nodes:    ${parsed.graph.nodes.length} graph (${importedGraphDoorCount} doors) + ${syntheticDoorCount} synthetic doors`);
  console.log(`  Edges:    ${parsed.graph.edges.length} graph + ${syntheticDoorCount} synthetic door connectors`);
}

main()
  .catch(error => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
