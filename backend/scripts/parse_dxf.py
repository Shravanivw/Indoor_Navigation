#!/usr/bin/env python3
"""
scripts/parse_dxf.py
--------------------
Run this ONCE after you convert your DWG to DXF using ODA File Converter.
It extracts walls, rooms, and labels and writes floor_data.json.

Usage:
    python3 scripts/parse_dxf.py --input your_file.dxf --output src/data/floor_data.json

Requirements:
    pip install ezdxf

How to get your DXF:
    1. Use ODA File Converter (opendesign.com/guestfiles/oda_file_converter)
    2. Set output format to DXF R2000 or R2004 (NOT R2018 — Inkscape needs older)
    3. Run this script on the output .dxf file
"""

import argparse
import json
import sys
from pathlib import Path

try:
    import ezdxf
    from ezdxf import recover 
    from ezdxf.math import BoundingBox2d
except ImportError:
    print("ERROR: ezdxf not installed. Run: pip install ezdxf")
    sys.exit(1)


WALL_LAYER_KEYWORDS  = ['WALL', 'A-WALL', 'STR', 'PARTITION', 'CORE']
ROOM_LAYER_KEYWORDS  = ['ROOM', 'SPACE', 'AREA', 'A-ROOM', 'A-AREA']
LABEL_LAYER_KEYWORDS = ['TEXT', 'LABEL', 'TAG', 'ANNO', 'A-ANNO', 'NAME']

# ─── HELPERS ─────────────────────────────────────────────────────────────────

def is_wall_layer(name: str) -> bool:
    n = name.upper()
    return any(k in n for k in WALL_LAYER_KEYWORDS)

def is_room_layer(name: str) -> bool:
    n = name.upper()
    return any(k in n for k in ROOM_LAYER_KEYWORDS)

def is_label_layer(name: str) -> bool:
    n = name.upper()
    return any(k in n for k in LABEL_LAYER_KEYWORDS)

def polyline_points(entity) -> list:
    """Extract XY points from LWPOLYLINE or POLYLINE."""
    if entity.dxftype() == 'LWPOLYLINE':
        return [list(p[:2]) for p in entity.get_points('xy')]
    elif entity.dxftype() == 'POLYLINE':
        return [[v.dxf.location.x, v.dxf.location.y] for v in entity.vertices]
    return []

def polygon_centroid(points: list) -> tuple:
    if not points:
        return (0.0, 0.0)
    xs = [p[0] for p in points]
    ys = [p[1] for p in points]
    return (sum(xs) / len(xs), sum(ys) / len(ys))

# ─── MAIN PARSER ─────────────────────────────────────────────────────────────

def parse_dxf(input_path: str) -> dict:
    print(f"Loading DXF: {input_path}")
    
    try:
        doc = ezdxf.readfile(input_path)
    except Exception as e:
        try:
            doc, auditor = recover.readfile(input_path)
            if auditor.has_errors:
                print(f"WARNING: DXF has {len(auditor.errors)} errors but was recovered")
        except Exception as e2:
            print(f"ERROR: Cannot read DXF file: {e2}")
            sys.exit(1)
    
    msp = doc.modelspace()
    
    # ── Step 1: List all layers ──────────────────────────────────────────────
    print("\n=== LAYERS FOUND IN YOUR FILE ===")
    layer_names = [layer.dxf.name for layer in doc.layers]
    for name in sorted(layer_names):
        print(f"  {name}")
    print(f"\nTotal layers: {len(layer_names)}")
    
    # ── Step 2: Extract walls ────────────────────────────────────────────────
    walls = []
    
    for entity in msp.query('LINE'):
        if is_wall_layer(entity.dxf.layer):
            walls.append({
                'type': 'LINE',
                'layer': entity.dxf.layer,
                'points': [
                    [entity.dxf.start.x, entity.dxf.start.y],
                    [entity.dxf.end.x,   entity.dxf.end.y],
                ]
            })
    
    for entity in msp.query('LWPOLYLINE POLYLINE'):
        if is_wall_layer(entity.dxf.layer):
            pts = polyline_points(entity)
            if pts:
                walls.append({
                    'type': 'LWPOLYLINE',
                    'layer': entity.dxf.layer,
                    'points': pts
                })
    
    print(f"\nWalls extracted: {len(walls)}")
    
    # ── Step 3: Extract room boundaries ─────────────────────────────────────
    rooms = []
    
    for entity in msp.query('LWPOLYLINE POLYLINE'):
        if is_room_layer(entity.dxf.layer):
            pts = polyline_points(entity)
            if len(pts) >= 3:  # must be a closed shape
                cx, cy = polygon_centroid(pts)
                closed = getattr(entity.dxf, 'closed', False) or (
                    entity.dxftype() == 'LWPOLYLINE' and entity.is_closed
                )
                rooms.append({
                    'layer': entity.dxf.layer,
                    'label': '',  # filled in from labels step
                    'points': pts,
                    'centreX': cx,
                    'centreY': cy,
                    'closed': closed,
                })
    
    print(f"Rooms extracted: {len(rooms)}")
    
    # ── Step 4: Extract text labels ──────────────────────────────────────────
    labels = []
    
    for entity in msp.query('TEXT'):
        text = entity.dxf.text.strip()
        if text:
            labels.append({
                'text': text,
                'x': entity.dxf.insert.x,
                'y': entity.dxf.insert.y,
                'layer': entity.dxf.layer,
            })
    
    for entity in msp.query('MTEXT'):
        try:
            text = entity.plain_mtext().strip()
        except Exception:
            text = entity.dxf.text.strip()
        if text:
            labels.append({
                'text': text,
                'x': entity.dxf.insert.x,
                'y': entity.dxf.insert.y,
                'layer': entity.dxf.layer,
            })
    
    print(f"Labels extracted: {len(labels)}")
    
    # ── Step 5: Match labels to rooms ────────────────────────────────────────
    def point_in_polygon(px, py, polygon):
        """Ray casting algorithm."""
        n = len(polygon)
        inside = False
        j = n - 1
        for i in range(n):
            xi, yi = polygon[i]
            xj, yj = polygon[j]
            if ((yi > py) != (yj > py)) and (px < (xj - xi) * (py - yi) / (yj - yi + 1e-10) + xi):
                inside = not inside
            j = i
        return inside
    
    for label in labels:
        for room in rooms:
            if point_in_polygon(label['x'], label['y'], room['points']):
                if not room['label']:
                    room['label'] = label['text']
                break
    
    # ── Step 6: Compute bounding box ─────────────────────────────────────────
    all_pts = []
    for w in walls:
        all_pts.extend(w['points'])
    
    if all_pts:
        min_x = min(p[0] for p in all_pts)
        min_y = min(p[1] for p in all_pts)
        max_x = max(p[0] for p in all_pts)
        max_y = max(p[1] for p in all_pts)
    else:
        min_x = min_y = 0
        max_x = max_y = 1000
    
    bbox = {
        'minX': min_x, 'minY': min_y,
        'maxX': max_x, 'maxY': max_y,
        # DXF units are usually mm — convert to metres
        'widthM':  (max_x - min_x) / 1000,
        'heightM': (max_y - min_y) / 1000,
    }
    
    print(f"\nBounding box: {bbox}")
    
    result = {
        'sourceFile': input_path,
        'walls': walls,
        'rooms': rooms,
        'labels': labels,
        'boundingBox': bbox,
        'layerNames': layer_names,
    }
    
    return result


def main():
    parser = argparse.ArgumentParser(description='Parse DXF floor plan for indoor navigation')
    parser.add_argument('--input',  required=True, help='Path to .dxf file')
    parser.add_argument('--output', default='src/data/floor_data.json', help='Output JSON path')
    args = parser.parse_args()
    
    data = parse_dxf(args.input)
    
    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(out_path, 'w') as f:
        json.dump(data, f, indent=2)
    
    print(f"\n✓ Saved to {out_path}")
    print(f"  Walls:  {len(data['walls'])}")
    print(f"  Rooms:  {len(data['rooms'])}")
    print(f"  Labels: {len(data['labels'])}")
    print("\nNext step: run `ts-node scripts/importFloorData.ts` to load into DB")


if __name__ == '__main__':
    main()
