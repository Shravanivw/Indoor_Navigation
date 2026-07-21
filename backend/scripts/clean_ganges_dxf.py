#!/usr/bin/env python3
"""
backend/scripts/clean_ganges_dxf.py
-----------------------------------
A standalone utility to preprocess and clean the Ganges 9th Floor DXF file
by stripping out all non-navigation-relevant layers and entities.

Usage:
    python backend/scripts/clean_ganges_dxf.py --input <path_to_ganges_dxf> --output <path_to_output_clean_dxf>
"""

import os
import sys
import re
import argparse

class PeekingIterator:
    def __init__(self, iterator):
        self.iterator = iterator
        self.peeked_val = None
        self.has_peeked = False

    def __iter__(self):
        return self

    def __next__(self):
        if self.has_peeked:
            self.has_peeked = False
            val = self.peeked_val
            self.peeked_val = None
            return val
        return next(self.iterator)

    def peek(self):
        if not self.has_peeked:
            try:
                self.peeked_val = next(self.iterator)
                self.has_peeked = True
            except StopIteration:
                self.peeked_val = None
                self.has_peeked = False
        return self.peeked_val


def classify_layer(name):
    name = name.upper()
    tokens = [t for t in re.split(r'[^A-Z0-9]', name) if t]
    
    # Explicitly keep legend text layers containing room labels
    if name in ('FL-LEGED', 'FL-LEGED TEXT'):
        return 'KEEP'
    
    # 1. Defpoints and non-plot layers
    if 'DEFPOINTS' in tokens or 'ASHADE' in tokens:
        return 'DISCARD'
        
    # 2. Dimensions & annotations
    dim_keywords = {'DIM', 'DIMS', 'ANNOTATION', 'ANNOTATIONS', 'MEASURE', 'REVISION', 'REVISIONS', 'REV', 'LEGEND', 'LEGENDS', 'TITLE', 'DRG', 'BORDER', 'PLOT', 'TEMPLATE', 'SPEC', 'LOGO', 'STAMP', 'TITLEBLOCK', 'TEXTBLOCK'}
    if any(k in tokens for k in dim_keywords) or 'TITLE' in tokens or 'DRG' in tokens or 'BORDER' in tokens:
        return 'DISCARD'
    if 'DIM' in name or 'DIMS' in name:
        return 'DISCARD'
        
    # 3. Electrical / Lighting / Power / Communication / Security
    elec_keywords = {
        'ELECT', 'ELEC', 'ELECTRICAL', 'LIGHT', 'LIGHTS', 'LIGHTING', 'EMERGENCY', 'EARTHING', 'POWER', 'DB', 'SLD', 'CABLE', 
        'WIRE', 'LOOP', 'LOOPING', 'BUSBAR', 'FEEDER', 'SWITCH', 'SOCKET', 'SOCKETS', 'COMM', 'DATA', 'TEL', 'TELEPHONE', 'UPS', 
        'RACK', 'CONDUIT', 'FIRE', 'SMOKE', 'DETECTOR', 'SPEAKER', 'PA', 'CCTV', 'SECURITY', 'ELV', 'WIFI', 'LAN', 'TV', 
        'AUDIO', 'SOUND', 'ACCESS', 'CONTROL', 'ACCS', 'VISTA', 'VESDA', 'FAS', 'HOOTER', 'STROBE', 'WLAN', 'BATTERY', 
        'GENERATOR', 'GEN', 'TRANSFORMER', 'TX', 'SWITCHGEAR', 'SUBSTATION', 'INVERTER', 'LIGHTNING', 'BUSWAY'
    }
    if name.startswith('E-') or name.startswith('E_') or name.startswith('EL-') or name.startswith('EL_'):
        return 'DISCARD'
    if any(k in tokens for k in elec_keywords):
        return 'DISCARD'
        
    # 4. HVAC & Plumbing / Sanitary
    hvac_keywords = {
        'HVAC', 'AC', 'DUCT', 'DUCTS', 'DIFFUSER', 'DIFFUSERS', 'GRILLE', 'GRILL', 'GRILLS', 'VENT', 'VENTS', 'PIPE', 'PIPES', 
        'PLUMB', 'DRAIN', 'DRAINAGE', 'SANITARY', 'TOILET', 'TOILETS', 'DADDO', 'SPRINKLER', 'SPRINKLERS', 'SPK', 'WET', 
        'PLUMBING', 'SEWER', 'WATER', 'SUMP', 'PUMP', 'COOLS', 'HEATS', 'EXHAUST', 'CHILL', 'FCU', 'AHU', 'VCD', 'DAMPER', 'DMPR',
        'ODU', 'CAV', 'COWL', 'AIR', 'EXTING', 'VALVE', 'VALVES', 'HEATER', 'BOILER', 'CONDENSER', 'REFRIGERANT', 'REFRISYNTH', 
        'INSULATION', 'INSUL'
    }
    if any(k in tokens for k in hvac_keywords):
        return 'DISCARD'
        
    # 5. Furniture & Interior decoration
    furn_keywords = {
        'FURN', 'FURNITURE', 'CHAIR', 'CHAIRS', 'DESK', 'DESKS', 'TABLE', 'TABLES', 'CABINET', 'CABINETS', 'WARDROBE', 
        'SOFA', 'LOOSE', 'MODULAR', 'PLANT', 'PLANTS', 'TREE', 'TREES', 'LANDSCAPE', 'DECOR', 'FIXTURE', 'FIXTURES', 
        'I-FUR', 'I-FURN', 'FUNITURE', 'WORKSTATION', 'WORKSTATIONS', 'SEATING', 'SCREEN', 'DIVIDER', 'PEDESTAL', 'CARPET',
        'PLANTER', 'PLANTERS', 'SHRUB', 'SHRUBS', 'POT', 'FOLIAGE', 'SOFAS', 'TABLETOP', 'GROMMET', 'HUMAN', 'OFFICE',
        'EQUIP', 'EQUIPMENT', 'EQPM', 'APPLIANCE', 'APPLIANCES', 'REFRIGERATOR', 'FRIDGE', 'MICROWAVE', 'OVEN', 'COFFEE',
        'TV', 'DISPLAY', 'MONITOR', 'BOARD', 'WHITEBOARD', 'RUG', 'BLIND', 'BLINDS', 'CURTAIN', 'CURTAINS', 'ART', 'FRAME',
        'PAINTING', 'MIRROR', 'MIRRORS', 'CORIAN', 'INTERIOR', 'JOINERY', 'CARPENTRY', 'SHELF', 'SHELVES', 'RACKING'
    }
    if any(k in tokens for k in furn_keywords) or 'I-FUR' in name or 'I-FURN' in name or 'EQUIP' in name:
        return 'DISCARD'
        
    # 6. Ceiling & Flooring & Finishes
    ceil_floor_keywords = {
        'CEILING', 'FLOORING', 'TILE', 'TILES', 'GRANITE', 'MARBLE', 'FINISH', 'FINISHES', 'PAINT', 'LAMINATE', 'PANEL', 
        'PANELS', 'GRAPHIC', 'GRAPHICS', 'HATCH', 'HATCHES', 'PATTERN', 'PLASTER', 'CLADDING', 'SKIRTING', 'CARPET', 
        'VINYL', 'WOODEN', 'SCREED', 'BAFFLE', 'CONCRETE', 'WALLPAPER', 'ASPHALT', 'TERRAZZO', 'EPOXY', 'COATING', 'BASEBOARD'
    }
    if any(k in tokens for k in ceil_floor_keywords) or 'HATCH' in name or 'CEILING' in name:
        return 'DISCARD'

    # 7. Structural/Architectural Keep layers (Walls, doors, columns, stairs, elevators, building outline, room names)
    keep_keywords = {
        'WALL', 'WALLS', 'PARTITION', 'PARTITIONS', 'GLASS', 'GLAZ', 'MULLION', 'MULLIONS', 'DOOR', 'DOORS', 'SLIDING', 
        'STAIR', 'STAIRS', 'LIFT', 'LIFTS', 'ELEVATOR', 'ELEVATORS', 'COLUMN', 'COLUMNS', 'COL', 'STRUCT', 'CIVIL', 
        'ROOM', 'ROOMS', 'SPACE', 'SPACES', 'AREA', 'AREAS', 'CORE', 'SHELL', 'OUTLINE', 'BOUNDARY', 'TEXT', 'LABEL', 
        'LABELS', 'NAME', 'TAG', 'TAGS', 'ANNO', 'GRID', 'GRIDS', 'AXIS', 'BUILDING', 'PROPERTY', 'SITE', 'NAMEPLATE', 
        'SHAFT', 'SHAFTS', 'RAILING', 'RAILINGS', 'HANDRAIL', 'RAMP', 'RAMPS', 'CORRIDOR', 'CORRIDORS', 'LOBBY', 'LOBBIES', 
        'PASSA', 'PASSAGE', 'PASSAGES', 'WAY', 'WAYS', 'PATH', 'PATHS', 'WALKWAY', 'WALKWAYS'
    }
    if any(k in tokens for k in keep_keywords) or 'WALL' in name or 'DOOR' in name or 'GLASS' in name or 'STAIR' in name or 'LIFT' in name:
        return 'KEEP'
        
    # Generic layers to keep
    generic_keeps = {'0', 'P', 'LINES1', 'LINES2', 'FRAME', 'BOX', 'BULKHEAD', 'CO', 'TEXT2', 'T'}
    if name in generic_keeps or any(k in tokens for k in generic_keeps):
        return 'KEEP'
        
    return 'UNKNOWN'


def should_keep_entity(entity_pairs, stats):
    ent_type = entity_pairs[0][1][1]
    
    # 1. Discard specific complex or non-architectural entity types
    discard_types = {'DIMENSION', 'HATCH', 'OLE2FRAME', 'LEADER', 'MULTILEADER', 'TOLERANCE'}
    if ent_type in discard_types:
        return False
        
    # 2. Extract layer
    layer_name = '0'
    for raw, stripped in entity_pairs:
        code, val = stripped
        if code == '8':
            layer_name = val
            break
            
    # 3. Classify layer
    cls = classify_layer(layer_name)
    if cls == 'KEEP':
        stats['layers_retained'].add(layer_name)
        return True
    elif cls == 'DISCARD':
        stats['layers_discarded'].add(layer_name)
        return False
    else:
        # Default to DISCARD for unknown layers to be safe
        stats['unknown_layers'].add(layer_name)
        return False


def read_entity(peekable_gen):
    first = next(peekable_gen)
    entity_pairs = [first]
    while True:
        peek = peekable_gen.peek()
        if peek is None:
            break
        raw, stripped = peek
        code, val = stripped
        if code == '0':
            break
        next(peekable_gen)
        entity_pairs.append((raw, stripped))
    return entity_pairs


def process_entities_section(peekable, outfile, section_type, stats):
    while True:
        peek = peekable.peek()
        if peek is None:
            break
        raw, stripped = peek
        code, val = stripped
        
        if code == '0' and val == 'ENDSEC':
            next(peekable)
            outfile.write(raw[0] + raw[1])
            break
            
        entity_pairs = read_entity(peekable)
        
        if section_type == 'ENTITIES':
            stats['total_entities'] += 1
            if should_keep_entity(entity_pairs, stats):
                stats['entities_retained'] += 1
                for raw_p, _ in entity_pairs:
                    outfile.write(raw_p[0] + raw_p[1])
            else:
                stats['entities_removed'] += 1
        elif section_type == 'BLOCKS':
            ent_type = entity_pairs[0][1][1]
            if ent_type in ('BLOCK', 'ENDBLK'):
                for raw_p, _ in entity_pairs:
                    outfile.write(raw_p[0] + raw_p[1])
            else:
                stats['total_entities'] += 1
                if should_keep_entity(entity_pairs, stats):
                    stats['entities_retained'] += 1
                    for raw_p, _ in entity_pairs:
                        outfile.write(raw_p[0] + raw_p[1])
                else:
                    stats['entities_removed'] += 1


def clean_dxf(input_path, output_path):
    print(f"Cleaning DXF: {input_path} -> {output_path}")
    
    stats = {
        'total_entities': 0,
        'entities_retained': 0,
        'entities_removed': 0,
        'layers_retained': set(),
        'layers_discarded': set(),
        'unknown_layers': set()
    }
    
    with open(input_path, 'r', encoding='utf-8', errors='ignore') as infile, \
         open(output_path, 'w', encoding='utf-8') as outfile:
         
        def line_generator():
            while True:
                code_line = infile.readline()
                if not code_line:
                    break
                val_line = infile.readline()
                if not val_line:
                    yield (code_line, ""), (code_line.strip(), "")
                    break
                yield (code_line, val_line), (code_line.strip(), val_line.strip())

        peekable = PeekingIterator(line_generator())
        current_section = None
        
        while True:
            peek = peekable.peek()
            if peek is None:
                break
                
            raw, stripped = peek
            code, val = stripped
            
            if code == '0' and val == 'SECTION':
                next(peekable)
                peek_name = peekable.peek()
                if peek_name:
                    raw_name, stripped_name = peek_name
                    c_name, val_name = stripped_name
                    if c_name == '2':
                        next(peekable)
                        current_section = val_name
                        outfile.write(raw[0] + raw[1])
                        outfile.write(raw_name[0] + raw_name[1])
                        
                        if current_section in ('BLOCKS', 'ENTITIES'):
                            process_entities_section(peekable, outfile, current_section, stats)
                            current_section = None
                        continue
                outfile.write(raw[0] + raw[1])
            elif code == '0' and val == 'ENDSEC':
                next(peekable)
                current_section = None
                outfile.write(raw[0] + raw[1])
            else:
                next(peekable)
                outfile.write(raw[0] + raw[1])

    # Report results
    print("\n====================================================")
    print("CLEANING COMPLETE REPORT")
    print("====================================================")
    print(f"Total entities parsed: {stats['total_entities']}")
    print(f"Entities retained:     {stats['entities_retained']}")
    print(f"Entities removed:      {stats['entities_removed']}")
    print(f"Layers retained ({len(stats['layers_retained'])}):")
    for l in sorted(stats['layers_retained']):
        print(f"  {l}")
    print(f"Layers discarded ({len(stats['layers_discarded'])}):")
    for l in sorted(stats['layers_discarded'])[:100]:
        print(f"  {l}")
    if len(stats['layers_discarded']) > 100:
        print(f"  ... and {len(stats['layers_discarded']) - 100} more")
    print(f"Unknown layers discarded ({len(stats['unknown_layers'])}):")
    for l in sorted(stats['unknown_layers']):
        print(f"  {l}")
    print("====================================================")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Clean Ganges DXF file")
    parser.add_argument("--input", default="backend/data_source/VWITS-GANGES PUNE_9TH FLOOR.dxf", help="Input DXF path")
    parser.add_argument("--output", default="backend/data_source/Ganges_9th_Floor_Clean.dxf", help="Output DXF path")
    args = parser.parse_args()
    
    clean_dxf(args.input, args.output)
