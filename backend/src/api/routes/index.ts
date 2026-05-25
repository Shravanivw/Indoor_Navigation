// src/api/routes/index.ts
// Registers all routes on the Express app.

import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { getRoute, getRoomByQR } from '../../services/routingService';
import { getFloorMap, getAllFloors, searchRooms, getRoomById } from '../../services/mapService';
import type { ApiResponse } from '../../types';

const ok  = <T>(data: T): ApiResponse<T> => ({ success: true,  data, meta: { timestamp: new Date().toISOString() } });
const err = (msg: string, code = 400) => ({ success: false, error: msg, meta: { timestamp: new Date().toISOString() } });

export function createRouter(prisma: PrismaClient): Router {
  const router = Router();

  // ─── HEALTH ─────────────────────────────────────────────────────────────────

  /**
   * GET /health
   * Returns 200 if API is alive.
   */
  router.get('/health', (_req, res) => {
    res.json(ok({ status: 'ok', version: '1.0.0' }));
  });

  // ─── BUILDINGS ───────────────────────────────────────────────────────────────

  /**
   * GET /buildings
   * List all buildings.
   */
  router.get('/buildings', async (_req, res) => {
    try {
      const buildings = await prisma.building.findMany({
        include: { _count: { select: { floors: true } } },
      });
      res.json(ok(buildings));
    } catch (e: any) {
      res.status(500).json(err(e.message));
    }
  });

  // ─── FLOORS ──────────────────────────────────────────────────────────────────

  /**
   * GET /buildings/:buildingId/floors
   * List all floors in a building with room counts.
   *
   * Response: [{ id, level, name, gridRows, gridCols, _count: { rooms } }]
   */
  router.get('/buildings/:buildingId/floors', async (req, res) => {
    try {
      const floors = await getAllFloors(prisma, req.params.buildingId);
      res.json(ok(floors));
    } catch (e: any) {
      res.status(500).json(err(e.message));
    }
  });

  /**
   * GET /floors/:floorId/map
   * Full floor map: grid + all rooms + metadata.
   * This is the primary endpoint the frontend uses to render the map.
   *
   * Response: FloorMapData (includes walkability grid and room list)
   */
  router.get('/floors/:floorId/map', async (req, res) => {
    try {
      const map = await getFloorMap(prisma, req.params.floorId);
      if (!map) return res.status(404).json(err('Floor not found', 404));
      res.json(ok(map));
    } catch (e: any) {
      res.status(500).json(err(e.message));
    }
  });

  // ─── ROOMS ───────────────────────────────────────────────────────────────────

  /**
   * GET /rooms/search?q=boardroom&floorId=xxx
   * Search rooms by name, code, or QR code.
   *
   * Response: Array of matching rooms with floor info.
   */
router.get('/rooms/search', async (req, res) => {
  const schema = z.object({
    q:       z.string().optional(),  // ✅ optional now
    floorId: z.string().optional(),
    type:    z.string().optional(),  // ✅ added type filter
  });
  const parsed = schema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json(err('Invalid params'));

  try {
    const rooms = await searchRooms(
      prisma,
      parsed.data.q ?? '',        // ✅ empty string if no query
      parsed.data.floorId,
      parsed.data.type            // ✅ pass type to service
    );
    res.json(ok(rooms));
  } catch (e: any) {
    res.status(500).json(err(e.message));
  }
});

  /**
   * GET /rooms/:roomId
   * Get a single room by ID.
   */
  router.get('/rooms/:roomId', async (req, res) => {
    try {
      const room = await getRoomById(prisma, req.params.roomId);
      if (!room) return res.status(404).json(err('Room not found', 404));
      res.json(ok(room));
    } catch (e: any) {
      res.status(500).json(err(e.message));
    }
  });

  /**
   * GET /rooms/qr/:qrCode
   * Resolve a QR code to a room — called by the QR scanner tab.
   *
   * Response: { id, name, floorId, code }
   */
  router.get('/rooms/qr/:qrCode', async (req, res) => {
    try {
      const room = await getRoomByQR(prisma, req.params.qrCode);
      if (!room) return res.status(404).json(err('QR code not recognised', 404));
      res.json(ok(room));
    } catch (e: any) {
      res.status(500).json(err(e.message));
    }
  });

  // ─── ROUTE ───────────────────────────────────────────────────────────────────

  /**
   * POST /route
   * Compute a route between two rooms.
   *
   * Request body:
   * {
   *   "fromRoomId": "clxxx",
   *   "toRoomId":   "clyyy",
   *   "options": {
   *     "accessibleOnly": false
   *   }
   * }
   *
   * Response:
   * {
   *   "found": true,
   *   "fromRoomId": "...",
   *   "toRoomId": "...",
   *   "pathGridCells": [{"x":5,"y":3}, ...],
   *   "steps": [
   *     { "instruction": "Head north for 20m", "distanceM": 20, "gridCell": {"x":5,"y":3} },
   *     { "instruction": "Turn east, continue for 60m", "distanceM": 60, "gridCell": {"x":5,"y":1} },
   *     { "instruction": "Arrived at destination", "distanceM": 0, "gridCell": {"x":9,"y":1} }
   *   ],
   *   "totalDistanceM": 80,
   *   "estimatedSeconds": 57,
   *   "floorChanges": 0,
   *   "accessible": false
   * }
   */
  router.post('/route', async (req, res) => {
    const schema = z.object({
      fromRoomId: z.string().min(1),
      toRoomId:   z.string().min(1),
      options: z.object({
        accessibleOnly: z.boolean().optional(),
        preferLifts:    z.boolean().optional(),
      }).optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(err('Invalid request body: ' + JSON.stringify(parsed.error.flatten())));
    }

    try {
      const result = await getRoute(prisma, {
        fromRoomId: parsed.data.fromRoomId,
        toRoomId:   parsed.data.toRoomId,
        options:    parsed.data.options,
      });
      res.json(ok(result));
    } catch (e: any) {
      if (e.message.includes('not found')) {
        return res.status(404).json(err(e.message, 404));
      }
      res.status(500).json(err(e.message));
    }
  });

  /**
   * GET /route/qr?from=LOC-GF-ENTRANCE&to=LOC-GF-BOARDROOM
   * Convenience: compute route directly from QR codes.
   * Used by the QR scanner tab without needing to look up room IDs first.
   */
  router.get('/route/qr', async (req, res) => {
    const schema = z.object({
      from: z.string().min(1),
      to:   z.string().min(1),
      accessible: z.coerce.boolean().optional(),
    });
    const parsed = schema.safeParse(req.query);
    if (!parsed.success) return res.status(400).json(err('Missing params: from, to'));

    try {
      const [fromRoom, toRoom] = await Promise.all([
        getRoomByQR(prisma, parsed.data.from),
        getRoomByQR(prisma, parsed.data.to),
      ]);
      if (!fromRoom) return res.status(404).json(err(`QR not found: ${parsed.data.from}`));
      if (!toRoom)   return res.status(404).json(err(`QR not found: ${parsed.data.to}`));

      const result = await getRoute(prisma, {
        fromRoomId: fromRoom.id,
        toRoomId:   toRoom.id,
        options: { accessibleOnly: parsed.data.accessible },
      });
      res.json(ok(result));
    } catch (e: any) {
      res.status(500).json(err(e.message));
    }
  });

  return router;
}
