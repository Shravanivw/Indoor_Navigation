// scripts/test_layout_publish.ts
// Comprehensive automated test suite for Layout Publish Service, HTTP API,
// validation, atomic transactions, rollback, isolation, cache invalidation, and CLI wrapper.

import { PrismaClient } from '@prisma/client';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { createApp } from '../src/app';
import {
  publishLayoutDefinition,
  layoutPublishSchema,
  EditorFloorDefinition,
} from '../src/services/layoutPublishService';
import {
  buildGraphCache,
  isGraphCacheWarm,
  getRoute,
} from '../src/services/routingService';
import { runImport } from './importEditorFloorDefinition';

const prisma = new PrismaClient();

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function requestHttp(
  server: http.Server,
  method: string,
  urlPath: string,
  body?: any
): Promise<{ status: number; body: any }> {
  const addr = server.address() as any;
  const port = addr.port;

  return new Promise((resolve, reject) => {
    const dataString = body ? JSON.stringify(body) : '';
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: urlPath,
        method,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(dataString),
        },
      },
      (res) => {
        let resBody = '';
        res.on('data', (chunk) => {
          resBody += chunk;
        });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(resBody);
            resolve({ status: res.statusCode || 500, body: parsed });
          } catch (e) {
            resolve({ status: res.statusCode || 500, body: resBody });
          }
        });
      }
    );

    req.on('error', reject);
    if (dataString) {
      req.write(dataString);
    }
    req.end();
  });
}

async function cleanupTestData() {
  const testBuildingIds = [
    'building-test-pub',
    'building-test-iso-a',
    'building-test-iso-b',
    'building-test-cli',
    'building-test-rb',
  ];

  for (const bId of testBuildingIds) {
    const floors = await prisma.floor.findMany({ where: { buildingId: bId } });
    for (const fl of floors) {
      await prisma.edge.deleteMany({
        where: {
          OR: [
            { fromNode: { floorId: fl.id } },
            { toNode: { floorId: fl.id } },
          ],
        },
      });
      await prisma.navSession.deleteMany({
        where: {
          OR: [
            { fromRoom: { floorId: fl.id } },
            { toRoom: { floorId: fl.id } },
          ],
        },
      });
      await prisma.node.deleteMany({ where: { floorId: fl.id } });
      await prisma.room.deleteMany({ where: { floorId: fl.id } });
    }
    await prisma.floor.deleteMany({ where: { buildingId: bId } });
    await prisma.building.deleteMany({ where: { id: bId } });
  }
}

async function runTests() {
  console.log('=== STARTING LAYOUT PUBLISH SERVICE TEST SUITE ===\n');

  await cleanupTestData();

  const app = createApp(prisma);
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as any).port;
  console.log(`Test Express server listening on ephemeral port ${port}`);

  try {
    // ─────────────────────────────────────────────────────────────────────────
    // TEST B: MALFORMED DEFINITION VALIDATION
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- Running Test B: Malformed Definition Validation ---');

    // B1: Empty building or floor fields
    let res = await requestHttp(server, 'POST', '/api/v1/layouts/publish', {
      building: { id: '', name: '' },
      floor: { id: '', name: '', level: '' },
      definition: { rooms: [], graph: { nodes: [], edges: [] } },
    });
    assert(res.status === 400, 'Empty building/floor should return 400');
    assert(res.body.success === false, 'Empty building should return success: false');
    console.log('  [PASS] B1: Empty building/floor rejected');

    // B2: Room polygon with fewer than 3 points
    res = await requestHttp(server, 'POST', '/api/v1/layouts/publish', {
      building: { id: 'b-test', name: 'Test' },
      floor: { id: 'f-test', name: 'Test Floor', level: 1 },
      definition: {
        rooms: [{ id: 'room-1', polygon: [{ x: 10, y: 10 }, { x: 20, y: 20 }] }],
        graph: { nodes: [{ id: 'n1', x: 10, y: 10 }], edges: [] },
      },
    });
    assert(res.status === 400, 'Room polygon with <3 points should return 400');
    assert(res.body.error.includes('Room polygon must contain at least 3 points'), 'Polygon message mismatch');
    console.log('  [PASS] B2: Incomplete polygon rejected');

    // B3: Duplicate room ID (allowed and disambiguated)
    res = await requestHttp(server, 'POST', '/api/v1/layouts/publish', {
      building: { id: 'b-test', name: 'Test' },
      floor: { id: 'f-test', name: 'Test Floor', level: 1 },
      definition: {
        rooms: [
          { id: 'room-dup', polygon: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }] },
          { id: 'room-dup', polygon: [{ x: 20, y: 20 }, { x: 30, y: 20 }, { x: 30, y: 30 }] },
        ],
        graph: { nodes: [{ id: 'n1', x: 0, y: 0 }], edges: [] },
      },
    });
    assert(res.status === 200, 'Duplicate room ID should succeed with disambiguation');
    assert(res.body.data.roomsImported === 2, 'Both duplicate rooms should be imported');
    console.log('  [PASS] B3: Duplicate room ID supported and disambiguated');

    // B4: Duplicate node ID
    res = await requestHttp(server, 'POST', '/api/v1/layouts/publish', {
      building: { id: 'b-test', name: 'Test' },
      floor: { id: 'f-test', name: 'Test Floor', level: 1 },
      definition: {
        rooms: [{ id: 'room-1', polygon: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }] }],
        graph: {
          nodes: [
            { id: 'node-dup', x: 0, y: 0 },
            { id: 'node-dup', x: 10, y: 10 },
          ],
          edges: [],
        },
      },
    });
    assert(res.status === 400, 'Duplicate node ID should return 400');
    assert(res.body.error.includes('Duplicate graph node id detected'), 'Duplicate node message mismatch');
    console.log('  [PASS] B4: Duplicate node ID rejected');

    // B5: Edge referencing non-existent node
    res = await requestHttp(server, 'POST', '/api/v1/layouts/publish', {
      building: { id: 'b-test', name: 'Test' },
      floor: { id: 'f-test', name: 'Test Floor', level: 1 },
      definition: {
        rooms: [{ id: 'room-1', polygon: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }] }],
        graph: {
          nodes: [{ id: 'n1', x: 0, y: 0 }],
          edges: [{ from: 'n1', to: 'n-ghost' }],
        },
      },
    });
    assert(res.status === 400, 'Edge referencing ghost node should return 400');
    assert(res.body.error.includes('missing "to" node'), 'Missing node message mismatch');
    console.log('  [PASS] B5: Missing edge endpoint node rejected');

    // B6: Node referencing non-existent roomId
    res = await requestHttp(server, 'POST', '/api/v1/layouts/publish', {
      building: { id: 'b-test', name: 'Test' },
      floor: { id: 'f-test', name: 'Test Floor', level: 1 },
      definition: {
        rooms: [{ id: 'room-1', polygon: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }] }],
        graph: {
          nodes: [{ id: 'n1', x: 0, y: 0, roomId: 'room-ghost' }],
          edges: [],
        },
      },
    });
    assert(res.status === 400, 'Node referencing non-existent roomId should return 400');
    assert(res.body.error.includes('references non-existent roomId'), 'Room reference message mismatch');
    console.log('  [PASS] B6: Non-existent roomId reference rejected');

    // B7: Node doorId without a matching door in room
    res = await requestHttp(server, 'POST', '/api/v1/layouts/publish', {
      building: { id: 'b-test', name: 'Test' },
      floor: { id: 'f-test', name: 'Test Floor', level: 1 },
      definition: {
        rooms: [{
          id: 'room-1',
          polygon: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }],
          doors: [{ id: 'd1', x: 5, y: 0 }],
        }],
        graph: {
          nodes: [{ id: 'n1', x: 5, y: 0, roomId: 'room-1', doorId: 'd-wrong' }],
          edges: [],
        },
      },
    });
    assert(res.status === 400, 'Node referencing invalid doorId should return 400');
    assert(res.body.error.includes('references doorId "d-wrong" which does not exist'), 'Door reference message mismatch');
    console.log('  [PASS] B7: Invalid doorId reference rejected');

    // ─────────────────────────────────────────────────────────────────────────
    // TEST A1: VALID PUBLICATION - NEW FLOOR
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- Running Test A1: Valid Publication - New Floor ---');

    const validNewFloorPayload = {
      building: {
        id: 'building-test-pub',
        name: 'Test Publication Building',
        location: 'Pune',
      },
      floor: {
        id: 'floor-test-pub-f1',
        name: '1st Floor',
        level: 1,
        realWidthM: 50.0,
        realHeightM: 30.0,
      },
      definition: {
        rooms: [
          {
            id: 'Conference Alpha',
            type: 'Meeting room',
            polygon: [
              { x: 10, y: 10 },
              { x: 30, y: 10 },
              { x: 30, y: 25 },
              { x: 10, y: 25 },
            ],
            doors: [{ id: 'd1', x: 20, y: 10 }],
          },
          {
            id: 'Cafeteria Main',
            type: 'Cafeteria',
            polygon: [
              { x: 40, y: 10 },
              { x: 60, y: 10 },
              { x: 60, y: 25 },
              { x: 40, y: 25 },
            ],
            doors: [{ id: 'd1', x: 50, y: 10 }],
          },
        ],
        graph: {
          nodes: [
            { id: 'corridor-j1', x: 20, y: 5, type: 'junction' },
            { id: 'corridor-j2', x: 50, y: 5, type: 'junction' },
          ],
          edges: [
            { from: 'corridor-j1', to: 'corridor-j2' },
          ],
        },
      },
    };

    res = await requestHttp(server, 'POST', '/api/v1/layouts/publish', validNewFloorPayload);
    assert(res.status === 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
    assert(res.body.success === true, 'Response success should be true');
    assert(res.body.data.roomsImported === 2, 'Should import 2 rooms');
    assert(res.body.data.graphNodesImported === 2, 'Should import 2 graph nodes');
    assert(res.body.data.syntheticDoorNodes === 2, 'Should create 2 synthetic door nodes');
    assert(res.body.data.publishedAt !== undefined, 'Should include publishedAt ISO timestamp');

    // Verify DB persistence
    const dbBuilding = await prisma.building.findUnique({ where: { id: 'building-test-pub' } });
    assert(dbBuilding !== null && dbBuilding.name === 'Test Publication Building', 'Building must exist in DB');
    const dbFloor = await prisma.floor.findUnique({ where: { id: 'floor-test-pub-f1' } });
    assert(dbFloor !== null && dbFloor.level === '1', 'Floor must exist in DB');
    const dbRooms = await prisma.room.findMany({ where: { floorId: 'floor-test-pub-f1' } });
    assert(dbRooms.length === 2, 'DB must contain exactly 2 rooms');
    const dbNodes = await prisma.node.findMany({ where: { floorId: 'floor-test-pub-f1' } });
    assert(dbNodes.length === 4, 'DB must contain 2 junction + 2 door nodes = 4 nodes');
    const dbEdges = await prisma.edge.findMany({
      where: { fromNode: { floorId: 'floor-test-pub-f1' } },
    });
    assert(dbEdges.length === 3, 'DB must contain 1 corridor edge + 2 door connector edges = 3 edges');
    console.log('  [PASS] A1: New floor publication succeeded and verified in DB');

    // Also test alias route POST /layouts/publish directly without /api/v1 prefix
    const aliasRes = await requestHttp(server, 'POST', '/layouts/publish', validNewFloorPayload);
    assert(aliasRes.status === 200, `Expected 200 on direct alias, got ${aliasRes.status}`);
    console.log('  [PASS] Direct alias POST /layouts/publish working');

    // ─────────────────────────────────────────────────────────────────────────
    // TEST A2: VALID PUBLICATION - EXISTING FLOOR REPLACEMENT
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- Running Test A2: Existing Floor Replacement ---');

    const updatedFloorPayload = {
      building: {
        id: 'building-test-pub',
        name: 'Test Publication Building Updated',
        location: 'Pune',
      },
      floor: {
        id: 'floor-test-pub-f1',
        name: '1st Floor Renovation',
        level: 1,
      },
      definition: {
        rooms: [
          {
            id: 'Executive Suite',
            type: 'Office',
            polygon: [
              { x: 10, y: 10 },
              { x: 25, y: 10 },
              { x: 25, y: 20 },
              { x: 10, y: 20 },
            ],
            doors: [{ id: 'd-main', x: 15, y: 10 }],
          },
          {
            id: 'Server Hub',
            type: 'Server room',
            polygon: [
              { x: 30, y: 10 },
              { x: 45, y: 10 },
              { x: 45, y: 20 },
              { x: 30, y: 20 },
            ],
            doors: [{ id: 'd-sec', x: 35, y: 10 }],
          },
          {
            id: 'Wellness Center',
            type: 'Amenity',
            polygon: [
              { x: 50, y: 10 },
              { x: 65, y: 10 },
              { x: 65, y: 20 },
              { x: 50, y: 20 },
            ],
            doors: [{ id: 'd-entry', x: 55, y: 10 }],
          },
        ],
        graph: {
          nodes: [
            { id: 'w-1', x: 15, y: 5 },
            { id: 'w-2', x: 35, y: 5 },
            { id: 'w-3', x: 55, y: 5 },
          ],
          edges: [
            { from: 'w-1', to: 'w-2' },
            { from: 'w-2', to: 'w-3' },
          ],
        },
      },
    };

    res = await requestHttp(server, 'POST', '/api/v1/layouts/publish', updatedFloorPayload);
    assert(res.status === 200, `Replacement failed: ${JSON.stringify(res.body)}`);
    assert(res.body.data.roomsImported === 3, 'Should import 3 new rooms');

    const updatedRooms = await prisma.room.findMany({ where: { floorId: 'floor-test-pub-f1' } });
    assert(updatedRooms.length === 3, 'DB should now contain 3 rooms');
    const oldRoom = updatedRooms.find((r) => r.name === 'Conference Alpha');
    assert(!oldRoom, 'Old room "Conference Alpha" must have been removed');
    const newRoom = updatedRooms.find((r) => r.name === 'Executive Suite');
    assert(newRoom !== undefined, 'New room "Executive Suite" must be present');
    console.log('  [PASS] A2: Existing floor was cleanly replaced');

    // ─────────────────────────────────────────────────────────────────────────
    // TEST E: FLOOR ISOLATION
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- Running Test E: Floor Isolation ---');

    // Publish Floor A
    await requestHttp(server, 'POST', '/api/v1/layouts/publish', {
      building: { id: 'building-test-iso-a', name: 'Iso Building A' },
      floor: { id: 'floor-test-iso-a', name: 'Floor A', level: 1 },
      definition: {
        rooms: [{ id: 'Room A1', polygon: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }] }],
        graph: { nodes: [{ id: 'node-a1', x: 5, y: 5 }], edges: [] },
      },
    });

    // Publish Floor B
    await requestHttp(server, 'POST', '/api/v1/layouts/publish', {
      building: { id: 'building-test-iso-b', name: 'Iso Building B' },
      floor: { id: 'floor-test-iso-b', name: 'Floor B', level: 1 },
      definition: {
        rooms: [{ id: 'Room B1', polygon: [{ x: 50, y: 50 }, { x: 60, y: 50 }, { x: 60, y: 60 }] }],
        graph: { nodes: [{ id: 'node-b1', x: 55, y: 55 }], edges: [] },
      },
    });

    // Capture Floor B state
    const floorBRoomsBefore = await prisma.room.findMany({ where: { floorId: 'floor-test-iso-b' } });
    const floorBNodesBefore = await prisma.node.findMany({ where: { floorId: 'floor-test-iso-b' } });

    // Update Floor A with new rooms
    await requestHttp(server, 'POST', '/api/v1/layouts/publish', {
      building: { id: 'building-test-iso-a', name: 'Iso Building A' },
      floor: { id: 'floor-test-iso-a', name: 'Floor A', level: 1 },
      definition: {
        rooms: [
          { id: 'Room A2', polygon: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }] },
          { id: 'Room A3', polygon: [{ x: 20, y: 0 }, { x: 30, y: 0 }, { x: 30, y: 10 }] },
        ],
        graph: { nodes: [{ id: 'node-a2', x: 5, y: 5 }], edges: [] },
      },
    });

    // Verify Floor B is 100% unchanged
    const floorBRoomsAfter = await prisma.room.findMany({ where: { floorId: 'floor-test-iso-b' } });
    const floorBNodesAfter = await prisma.node.findMany({ where: { floorId: 'floor-test-iso-b' } });

    assert(floorBRoomsBefore.length === floorBRoomsAfter.length, 'Floor B rooms count changed!');
    assert(floorBNodesBefore.length === floorBNodesAfter.length, 'Floor B nodes count changed!');
    assert(floorBRoomsAfter[0].id === floorBRoomsBefore[0].id, 'Floor B room IDs altered!');
    console.log('  [PASS] E: Publishing Floor A had zero impact on Floor B');

    // ─────────────────────────────────────────────────────────────────────────
    // TEST C: ATOMIC TRANSACTION & ROLLBACK
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- Running Test C: Atomic Transaction & Rollback ---');

    // Create an initial intact floor
    await requestHttp(server, 'POST', '/api/v1/layouts/publish', {
      building: { id: 'building-test-rb', name: 'Rollback Test Building' },
      floor: { id: 'floor-test-rb-f1', name: 'Rollback Floor 1', level: 1 },
      definition: {
        rooms: [{ id: 'Safe Room', polygon: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }] }],
        graph: { nodes: [{ id: 'safe-node', x: 5, y: 5 }], edges: [] },
      },
    });

    const safeRoomsBefore = await prisma.room.findMany({ where: { floorId: 'floor-test-rb-f1' } });
    assert(safeRoomsBefore.length === 1 && safeRoomsBefore[0].name === 'Safe Room', 'Safe room must exist');

    // Now attempt a publication that fails during transaction execution.
    // We pass a valid schema object to the service, but force a database error inside the transaction.
    try {
      // Mocking edge insertion to force mid-transaction failure
      const failingPrisma: any = new Proxy(prisma, {
        get(target, prop, receiver) {
          if (prop === '$transaction') {
            return async (cb: any, opts: any) => {
              return target.$transaction(async (tx: any) => {
                // Intercept edge.upsert to throw an intentional DB error midway
                const txProxy = new Proxy(tx, {
                  get(t2, p2) {
                    if (p2 === 'edge') {
                      return {
                        ...t2.edge,
                        upsert: async () => {
                          throw new Error('SIMULATED_DATABASE_IO_FAILURE');
                        },
                      };
                    }
                    return Reflect.get(t2, p2);
                  },
                });
                return cb(txProxy);
              }, opts);
            };
          }
          return Reflect.get(target, prop, receiver);
        },
      });

      await publishLayoutDefinition(failingPrisma, {
        building: { id: 'building-test-rb', name: 'Rollback Test Building' },
        floor: { id: 'floor-test-rb-f1', name: 'Rollback Floor 1', level: 1 },
        definition: {
          rooms: [
            { id: 'Doomed Room 1', polygon: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }] },
          ],
          graph: {
            nodes: [
              { id: 'doomed-n1', x: 5, y: 5 },
              { id: 'doomed-n2', x: 15, y: 5 },
            ],
            edges: [{ from: 'doomed-n1', to: 'doomed-n2' }],
          },
        },
      });
      assert(false, 'Should have thrown simulated error');
    } catch (err: any) {
      assert(err.message === 'SIMULATED_DATABASE_IO_FAILURE', `Expected simulated error, got: ${err.message}`);
    }

    // Verify rollback: original "Safe Room" must still exist!
    const safeRoomsAfter = await prisma.room.findMany({ where: { floorId: 'floor-test-rb-f1' } });
    assert(safeRoomsAfter.length === 1, 'Rollback failed: room count is not 1');
    assert(safeRoomsAfter[0].name === 'Safe Room', 'Rollback failed: Safe Room was deleted');
    console.log('  [PASS] C: Mid-transaction failure rolled back cleanly; original data remained intact');

    // ─────────────────────────────────────────────────────────────────────────
    // TEST D: CACHE INVALIDATION & NEXT ROUTE REBUILD
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- Running Test D: Cache Invalidation & Next Route Rebuild ---');

    // 1. Pre-warm cache
    await buildGraphCache(prisma);
    assert(isGraphCacheWarm() === true, 'Cache should be warm after buildGraphCache');
    console.log('  Cache is warm: true');

    // 2. Publish replacement floor with 2 connected rooms
    const cacheTestPayload = {
      building: { id: 'building-test-pub', name: 'Test Publication Building' },
      floor: { id: 'floor-test-pub-f1', name: '1st Floor', level: 1 },
      definition: {
        rooms: [
          {
            id: 'Source Office',
            polygon: [{ x: 10, y: 10 }, { x: 20, y: 10 }, { x: 20, y: 20 }, { x: 10, y: 20 }],
            doors: [{ id: 'd1', x: 15, y: 10 }],
          },
          {
            id: 'Target Office',
            polygon: [{ x: 40, y: 10 }, { x: 50, y: 10 }, { x: 50, y: 20 }, { x: 40, y: 20 }],
            doors: [{ id: 'd1', x: 45, y: 10 }],
          },
        ],
        graph: {
          nodes: [
            { id: 'c-n1', x: 15, y: 5 },
            { id: 'c-n2', x: 45, y: 5 },
          ],
          edges: [{ from: 'c-n1', to: 'c-n2' }],
        },
      },
    };

    await requestHttp(server, 'POST', '/api/v1/layouts/publish', cacheTestPayload);

    // 3. Verify cache is now invalidated
    assert(isGraphCacheWarm() === false, 'Cache MUST be invalidated after layout publication');
    console.log('  Cache is invalidated post-publish: true');

    // 4. Compute route between newly published rooms
    const r1 = await prisma.room.findFirst({ where: { floorId: 'floor-test-pub-f1', name: 'Source Office' } });
    const r2 = await prisma.room.findFirst({ where: { floorId: 'floor-test-pub-f1', name: 'Target Office' } });
    assert(r1 !== null && r2 !== null, 'Published rooms must exist in DB');

    const routeResult = await getRoute(prisma, {
      fromRoomId: r1!.id,
      toRoomId: r2!.id,
    });

    assert(routeResult.found === true, 'Route should be found on newly built graph');
    assert(routeResult.pathGridCells.length >= 2, 'Route should have path cells');
    assert(isGraphCacheWarm() === true, 'Cache should be warm again after routing rebuild');
    console.log('  Route computed successfully on fresh graph; cache re-warmed: true');
    console.log('  [PASS] D: Cache invalidation and automatic on-demand rebuild verified');

    // ─────────────────────────────────────────────────────────────────────────
    // TEST F: EXISTING CLI SCRIPT COMPATIBILITY
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- Running Test F: Existing CLI Script Compatibility ---');

    const tempJsonPath = path.resolve(__dirname, '../scratch/temp_cli_definition.json');
    const cliDefinition: EditorFloorDefinition = {
      rooms: [
        {
          id: 'CLI Test Lab',
          type: 'Workspace',
          polygon: [{ x: 10, y: 10 }, { x: 25, y: 10 }, { x: 25, y: 25 }, { x: 10, y: 25 }],
          doors: [{ id: 'd-cli', x: 17, y: 10 }],
        },
      ],
      graph: {
        nodes: [{ id: 'cli-n1', x: 17, y: 5 }],
        edges: [],
      },
    };

    fs.writeFileSync(tempJsonPath, JSON.stringify(cliDefinition, null, 2), 'utf-8');

    const cliStats = await runImport({
      file: tempJsonPath,
      buildingId: 'building-test-cli',
      buildingName: 'CLI Test Facility',
      floorId: 'floor-test-cli-f1',
      level: '1',
      floorName: 'CLI Floor 1',
      qrPrefix: 'LOC-CLI',
    });

    assert(cliStats.roomsImported === 1, 'CLI should import 1 room');
    assert(cliStats.graphNodesImported === 1, 'CLI should import 1 node');
    assert(cliStats.syntheticDoorNodes === 1, 'CLI should create 1 synthetic door');

    const cliRoom = await prisma.room.findFirst({ where: { floorId: 'floor-test-cli-f1' } });
    assert(cliRoom !== null && cliRoom.name === 'CLI Test Lab', 'CLI room must be in DB');

    if (fs.existsSync(tempJsonPath)) {
      fs.unlinkSync(tempJsonPath);
    }
    console.log('  [PASS] F: importEditorFloorDefinition.ts CLI wrapper executed successfully');

    // ─────────────────────────────────────────────────────────────────────────
    // CLEANUP
    // ─────────────────────────────────────────────────────────────────────────
    await cleanupTestData();
    console.log('\n=== ALL TESTS PASSED SUCCESSFULLY! ===');
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await prisma.$disconnect();
  }
}

runTests().catch((err) => {
  console.error('\n[FATAL] Test failed:', err);
  process.exit(1);
});
