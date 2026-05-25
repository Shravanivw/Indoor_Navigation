-- CreateTable
CREATE TABLE "buildings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "floors" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "buildingId" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "svgData" TEXT,
    "gridData" TEXT,
    "widthM" REAL,
    "heightM" REAL,
    "gridCols" INTEGER,
    "gridRows" INTEGER,
    "scaleX" REAL DEFAULT 1,
    "scaleY" REAL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "floors_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "buildings" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "rooms" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "floorId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "capacity" INTEGER,
    "gridX" INTEGER NOT NULL DEFAULT 0,
    "gridY" INTEGER NOT NULL DEFAULT 0,
    "gridW" INTEGER NOT NULL DEFAULT 10,
    "gridH" INTEGER NOT NULL DEFAULT 10,
    "centreX" REAL NOT NULL DEFAULT 0,
    "centreY" REAL NOT NULL DEFAULT 0,
    "qrCode" TEXT,
    "description" TEXT,
    "isAccessible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "rooms_floorId_fkey" FOREIGN KEY ("floorId") REFERENCES "floors" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "nodes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "floorId" TEXT NOT NULL,
    "roomId" TEXT,
    "gridX" INTEGER NOT NULL,
    "gridY" INTEGER NOT NULL,
    "realX" REAL NOT NULL,
    "realY" REAL NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'WAYPOINT',
    "label" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "nodes_floorId_fkey" FOREIGN KEY ("floorId") REFERENCES "floors" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "nodes_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "edges" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fromNodeId" TEXT NOT NULL,
    "toNodeId" TEXT NOT NULL,
    "weight" REAL NOT NULL,
    "isBidirectional" BOOLEAN NOT NULL DEFAULT true,
    "isAccessible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "edges_fromNodeId_fkey" FOREIGN KEY ("fromNodeId") REFERENCES "nodes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "edges_toNodeId_fkey" FOREIGN KEY ("toNodeId") REFERENCES "nodes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "nav_sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fromRoomId" TEXT NOT NULL,
    "toRoomId" TEXT NOT NULL,
    "path" TEXT,
    "distance" REAL,
    "duration" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "nav_sessions_fromRoomId_fkey" FOREIGN KEY ("fromRoomId") REFERENCES "rooms" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "nav_sessions_toRoomId_fkey" FOREIGN KEY ("toRoomId") REFERENCES "rooms" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "floors_buildingId_idx" ON "floors"("buildingId");

-- CreateIndex
CREATE UNIQUE INDEX "floors_buildingId_level_key" ON "floors"("buildingId", "level");

-- CreateIndex
CREATE UNIQUE INDEX "rooms_qrCode_key" ON "rooms"("qrCode");

-- CreateIndex
CREATE INDEX "rooms_floorId_idx" ON "rooms"("floorId");

-- CreateIndex
CREATE INDEX "rooms_type_idx" ON "rooms"("type");

-- CreateIndex
CREATE INDEX "rooms_qrCode_idx" ON "rooms"("qrCode");

-- CreateIndex
CREATE INDEX "nodes_floorId_idx" ON "nodes"("floorId");

-- CreateIndex
CREATE INDEX "nodes_roomId_idx" ON "nodes"("roomId");

-- CreateIndex
CREATE INDEX "nodes_gridX_gridY_idx" ON "nodes"("gridX", "gridY");

-- CreateIndex
CREATE INDEX "edges_fromNodeId_idx" ON "edges"("fromNodeId");

-- CreateIndex
CREATE INDEX "edges_toNodeId_idx" ON "edges"("toNodeId");

-- CreateIndex
CREATE UNIQUE INDEX "edges_fromNodeId_toNodeId_key" ON "edges"("fromNodeId", "toNodeId");

-- CreateIndex
CREATE INDEX "nav_sessions_fromRoomId_idx" ON "nav_sessions"("fromRoomId");

-- CreateIndex
CREATE INDEX "nav_sessions_toRoomId_idx" ON "nav_sessions"("toRoomId");
