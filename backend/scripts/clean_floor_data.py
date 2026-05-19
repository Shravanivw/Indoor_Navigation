#!/usr/bin/env python3
"""
scripts/clean_floor_data.py
---------------------------
Cleans the raw floor_data.json produced by parse_dxf.py.
Tailored to COORDINATED LAYOUT.dxf (Pinakiin Designs office).

Run:
    python3 scripts/clean_floor_data.py \
        --input  src/data/floor_data.json \
        --output src/data/floor_data_clean.json

What gets removed:
    - Walls on decorative / non-structural layers (wallpaper, finishes, dims)
    - Walls shorter than 200 mm (hatch lines, artefacts)
    - Duplicate wall segments
    - ALL 2548 raw labels (electrical codes, ceiling notes, furniture tags, etc.)
    - The 9 raw "AREA SEPARATOR LINE" rooms (wrong layer, no real room names)
    - layerNames list (341 CAD layer names, not needed at runtime)
    - sourceFile path

What gets added:
    - rooms[]   — extracted from TEXT + FL-LEGED labels, cleaned of MText codes
                  and embedded dimensions, deduplicated, with coordinates
    - meta{}    — summary counts + timestamp

Output shape:
    {
      "boundingBox": { minX, minY, maxX, maxY, widthM, heightM },
      "walls": [
        { "points": [[x,y], [x,y]], "layer": "WALL" },
        ...
      ],
      "rooms": [
        {
          "name":    "Boardroom",
          "code":    "BOARDROOM",
          "x":       487500.0,
          "y":        16200.0,
          "widthMm":  6200,       <- present when embedded in label, else null
          "heightMm": 9010        <- present when embedded in label, else null
        },
        ...
      ],
      "meta": {
        "totalWalls":  int,
        "totalRooms":  int,
        "cleanedAt":   "ISO datetime",
        "originalWalls":  int,
        "originalLabels": int
      }
    }
"""

import argparse
import json
import math
import re
from datetime import datetime, timezone
from pathlib import Path


# ─── WALL LAYERS TO KEEP ─────────────────────────────────────────────────────
# Identified from layer analysis of this specific file.
# Only structural / partition layers that define navigable space.

KEEP_WALL_LAYERS = {
    "WALL",
    "0- WALL",
    "A-PLAN-WALL",
    "PARTITION GYPSUM",
    "PARTITION PLY",
    "GYPSUM PARTITION",
    "682-GYPSUM PARTITION",
    "PLY PARTITION",
    "GLASS PARTITION",
    "PARTITION GLASS",
    "682-GLASS PARTITION",
    "682-WALL",
}

# Walls shorter than this (mm) are noise — hatch lines, artefacts, dim ticks
MIN_WALL_LENGTH_MM = 200


# ─── ROOM NAME LAYERS TO EXTRACT FROM ────────────────────────────────────────
# TEXT layer has room labels embedded with dimensions (BOARDROOMP6200X9010).
# FL-LEGED has the clean legend names (BOARDROOM, 8 PAX MEETING ROOM - 1, etc.)
# We use TEXT for coordinates (they sit inside the room) and FL-LEGED for names.

ROOM_NAME_LAYERS = {"TEXT"}

# Real room keywords — labels containing these are considered space names.
# Electrical codes, material specs, etc. are filtered out below.
ROOM_KEYWORDS = {
    "cabin", "office", "room", "hall", "lobby", "reception", "toilet",
    "wc", "pantry", "store", "storage", "server", "board", "meet",
    "conf", "open", "work", "lounge", "passage", "corridor", "entry",
    "exit", "stair", "lift", "wash", "rest", "cafeteria", "dining",
    "library", "training", "discuss", "collab", "focus", "phone",
    "print", "copy", "manager", "director", "ceo", "finance", "admin",
    "security", "visitor", "waiting", "locker", "shower", "gym",
    "terrace", "balcony", "breakout", "odc", "repro", "thinking",
    "recreation", "sick", "battery", "hub", "novac", "kitchen",
    "compactor", "pot wash", "punching", "dry pantry", "it store",
    "team", "executive", "md cabin", "cfo", "m.d.", "c.f.o.",
}

# Labels that match ROOM_KEYWORDS but are clearly NOT room names
NOISE_PATTERNS = [
    r"^\d",                          # starts with a number
    r"^[A-Z]{1,4}\d",               # electrical codes: DB-01, LDB3, RP DB
    r"^\d+\s*(mm|sqmm|kw|a,)",      # measurements
    r"elevation",                    # drawing view labels
    r"section",
    r"plan detail",
    r"flooring plan",
    r"rcp layout",
    r"ceiling plan",
    r"^\s*(spare|option|plan|section|legend|symbol|typical)\s*$",
    r"cable",
    r"conduit",
    r"busbar",
    r"panel",
    r"db\b",
    r"mcb|mccb|apfc",
    r"feeder",
    r"^loc[:\-]",                    # LOC: ELEC ROOM — electrical location tags
    r"electrical room",
    r"^ahu",
    r"^ups\b",
    r"^vav",
    r"xlpe|cu wire|pvc",
    r"drain|pump",
    r"outdoor",
    r"builder scope",
    r"^\d+\s*x\s*\d+",              # raw dimensions like 3600 x 2700
    r"percent|sqmm|kva|kw\b",
    r"^(source|bank|spare|rack|seating|counter|drawer|ramp|shutter)$",
]


# ─── HELPERS ──────────────────────────────────────────────────────────────────

def wall_length(points):
    total = 0.0
    for i in range(len(points) - 1):
        dx = points[i + 1][0] - points[i][0]
        dy = points[i + 1][1] - points[i][1]
        total += math.sqrt(dx * dx + dy * dy)
    return total


def round_pt(pt, decimals=1):
    return [round(pt[0], decimals), round(pt[1], decimals)]


def wall_key(points):
    """Canonical key for deduplication — order-insensitive for 2-point lines."""
    pts = [tuple(round_pt(p, 0)) for p in points]
    return tuple(sorted(pts))


def strip_mtext(raw):
    """Remove AutoCAD MText formatting codes, return plain text."""
    t = raw
    # Remove \pxqc; \pxql; \pxqr; \pxqd; style codes
    t = re.sub(r'\\px[a-z][^;]*;', '', t, flags=re.IGNORECASE)
    # Remove \fArial|b0|... font codes
    t = re.sub(r'\\f[^;]+;', '', t, flags=re.IGNORECASE)
    # Remove \C1; \H0.6x; \W1; style codes
    t = re.sub(r'\\[CHWQTOA]\d*[.x]*\d*;', '', t, flags=re.IGNORECASE)
    # Remove \P (paragraph / newline marker) — replace with space
    t = re.sub(r'\\P', ' ', t)
    # Remove remaining backslash codes
    t = re.sub(r'\\[a-zA-Z]', '', t)
    # Remove curly braces
    t = t.replace('{', '').replace('}', '')
    # Collapse whitespace
    t = re.sub(r'\s+', ' ', t).strip()
    return t


def extract_dimensions(text):
    """
    Extract WxH from labels like 'BOARDROOMP6200X9010' or 'CAFETERIA 13355X15770'.
    Returns (clean_name, width_mm, height_mm).
    """
    # Pattern: text, optional P/space, NNNNxNNNN
    m = re.search(r'[P\s](\d{3,})\s*[Xx]\s*(\d{3,})\s*$', text)
    if m:
        name = text[:m.start()].strip()
        w = int(m.group(1))
        h = int(m.group(2))
        return name, w, h
    return text, None, None


def is_noise(name):
    """Return True if this label is clearly not a room name."""
    lower = name.lower().strip()
    for pattern in NOISE_PATTERNS:
        if re.search(pattern, lower):
            return True
    return False


def is_room_name(name):
    """Return True if name looks like a real room/space name."""
    lower = name.lower()
    return any(kw in lower for kw in ROOM_KEYWORDS)


def to_title_case(name):
    """Convert ALL CAPS room names to Title Case, preserving abbreviations."""
    # Abbreviations to keep uppercase
    abbrevs = {"Wc", "Md", "Cfo", "Pd", "Hd", "It", "Ups", "Ahu", "Odc", "Db"}
    words = name.split()
    result = []
    for w in words:
        titled = w.capitalize()
        if titled in abbrevs:
            result.append(w.upper() if len(w) <= 3 else titled)
        else:
            result.append(titled)
    return " ".join(result)


# ─── MAIN ─────────────────────────────────────────────────────────────────────

def clean(input_path: str, output_path: str):
    print(f"Reading {input_path}...")
    with open(input_path) as f:
        raw = json.load(f)

    original_wall_count  = len(raw.get("walls", []))
    original_label_count = len(raw.get("labels", []))

    # ── 1. CLEAN WALLS ────────────────────────────────────────────────────────
    print(f"Processing {original_wall_count} walls...")

    seen_keys = set()
    clean_walls = []

    for w in raw["walls"]:
        layer = w.get("layer", "")
        points = w.get("points", [])

        # Keep only structural layers
        if layer not in KEEP_WALL_LAYERS:
            continue

        # Drop too-short segments
        if wall_length(points) < MIN_WALL_LENGTH_MM:
            continue

        # Deduplicate
        key = wall_key(points)
        if key in seen_keys:
            continue
        seen_keys.add(key)

        clean_walls.append({
            "layer":  layer,
            "points": [round_pt(p) for p in points],
        })

    print(f"  Kept {len(clean_walls)} walls (removed {original_wall_count - len(clean_walls)})")

    # ── 2. EXTRACT ROOMS FROM LABELS ─────────────────────────────────────────
    print(f"Processing {original_label_count} labels...")

    room_candidates = []

    for label in raw.get("labels", []):
        layer = label.get("layer", "")
        if layer not in ROOM_NAME_LAYERS:
            continue

        raw_text = label.get("text", "")
        clean_text = strip_mtext(raw_text)
        if not clean_text:
            continue

        name, w_mm, h_mm = extract_dimensions(clean_text)
        name = name.strip()

        if not name or len(name) < 3:
            continue

        if is_noise(name):
            continue

        if not is_room_name(name):
            continue

        room_candidates.append({
            "name":     to_title_case(name),
            "code":     re.sub(r'\s+', '_', name.upper()),
            "x":        round(label["x"], 1),
            "y":        round(label["y"], 1),
            "widthMm":  w_mm,
            "heightMm": h_mm,
        })

    # Deduplicate by name (keep first occurrence — closest to room centre)
    seen_names = set()
    clean_rooms = []
    for r in room_candidates:
        key = r["code"]
        if key in seen_names:
            continue
        seen_names.add(key)
        clean_rooms.append(r)

    # Sort alphabetically for readability
    clean_rooms.sort(key=lambda r: r["name"])

    print(f"  Found {len(clean_rooms)} distinct rooms")

    # ── 3. BOUNDING BOX (rounded) ─────────────────────────────────────────────
    bb = raw["boundingBox"]
    bounding_box = {
        "minX":   round(bb["minX"], 1),
        "minY":   round(bb["minY"], 1),
        "maxX":   round(bb["maxX"], 1),
        "maxY":   round(bb["maxY"], 1),
        "widthM": round(bb["widthM"], 3),
        "heightM":round(bb["heightM"], 3),
    }

    # ── 4. ASSEMBLE OUTPUT ────────────────────────────────────────────────────
    output = {
        "boundingBox": bounding_box,
        "walls": clean_walls,
        "rooms": clean_rooms,
        "meta": {
            "originalWalls":   original_wall_count,
            "originalLabels":  original_label_count,
            "totalWalls":      len(clean_walls),
            "totalRooms":      len(clean_rooms),
            "cleanedAt":       datetime.now(timezone.utc).isoformat(),
        },
    }

    # ── 5. WRITE ──────────────────────────────────────────────────────────────
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w") as f:
        json.dump(output, f, indent=2)

    original_size = Path(input_path).stat().st_size
    output_size   = Path(output_path).stat().st_size
    reduction     = (1 - output_size / original_size) * 100

    print(f"\n✓ Written to {output_path}")
    print(f"  Walls:    {original_wall_count:>6} → {len(clean_walls)}")
    print(f"  Labels:   {original_label_count:>6} → 0 (replaced by {len(clean_rooms)} named rooms)")
    print(f"  File:     {original_size/1024:.0f} KB → {output_size/1024:.0f} KB  ({reduction:.0f}% smaller)")
    print()
    print("Rooms extracted:")
    for r in clean_rooms:
        dims = f"  {r['widthMm']}×{r['heightMm']}mm" if r["widthMm"] else ""
        print(f"  {r['name']}{dims}")


def main():
    parser = argparse.ArgumentParser(description="Clean floor_data.json for indoor navigation")
    parser.add_argument("--input",  default="src/data/floor_data.json",       help="Raw JSON from parse_dxf.py")
    parser.add_argument("--output", default="src/data/floor_data_clean.json", help="Cleaned output path")
    args = parser.parse_args()
    clean(args.input, args.output)


if __name__ == "__main__":
    main()
