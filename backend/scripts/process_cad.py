#!/usr/bin/env python3
"""
scripts/process_cad.py
----------------------
Unified automation pipeline to onboard a new floor from its DXF drawing and Layout Editor JSON definition.

Usage:
  python scripts/process_cad.py \\
    --dxf C:/Users/UGKLKGF/Downloads/floor6.dxf \\
    --layout src/data/Hudson_6th_Floor.json \\
    --floor-id floor-hudson-f6 \\
    --building-id building-hudson \\
    --building-name Hudson \\
    --level 6 \\
    --floor-name "6th Floor"
"""

import argparse
import subprocess
import sys
from pathlib import Path

def run_command(cmd: list[str], description: str):
    print(f"\n>>> Running: {description}...")
    print(f"    Command: {' '.join(cmd)}")
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        print(f"ERROR: {description} failed!", file=sys.stderr)
        print(res.stderr, file=sys.stderr)
        sys.exit(res.returncode)
    print(res.stdout)

def main():
    parser = argparse.ArgumentParser(description="Onboard a new floor from DXF and layout JSON.")
    parser.add_argument("--dxf", required=True, help="Path to the converted DXF file.")
    parser.add_argument("--layout", required=True, help="Path to the Layout Editor JSON file (e.g. Hudson_6th_Floor.json).")
    parser.add_argument("--floor-id", required=True, help="The floor ID (e.g. floor-hudson-f6).")
    parser.add_argument("--building-id", required=True, help="The building ID (e.g. building-hudson).")
    parser.add_argument("--building-name", required=True, help="The building name (e.g. Hudson).")
    parser.add_argument("--level", required=True, type=int, help="The floor level/number (e.g. 6).")
    parser.add_argument("--floor-name", required=True, help="Display name of the floor (e.g. '6th Floor').")
    
    args = parser.parse_args()

    # Define intermediate and final file paths
    # Match the naming conventions of existing floors
    clean_suffix = "6th_clean" if "f6" in args.floor_id else "clean"
    nav_suffix = "f6" if "f6" in args.floor_id else f"f{args.level}"

    raw_json = Path(f"src/data/floor_{args.floor_id}_raw.json")
    clean_json = Path(f"src/data/floor_hudson_{clean_suffix}.json")
    nav_json = Path(f"src/data/nav_hudson_{nav_suffix}.json")

    # Step 1: Parse the DXF to raw JSON
    run_command([
        "python", "scripts/parse_dxf.py",
        "--input", args.dxf,
        "--output", str(raw_json)
    ], "Step 1: Parsing DXF CAD geometry")

    # Step 2: Clean the raw JSON walls and rooms
    run_command([
        "python", "scripts/clean_floor_data.py",
        "--input", str(raw_json),
        "--output", str(clean_json)
    ], "Step 2: Cleaning structural CAD walls")

    # Step 3: Build the walkability navigation grid
    run_command([
        "python", "scripts/build_nav_data.py",
        "--input", str(clean_json),
        "--output", str(nav_json),
        "--floor-id", args.floor_id,
        "--building", args.building_name,
        "--level", str(args.level),
        "--qr-prefix", f"LOC-F{args.level}"
    ], "Step 3: Generating walkability grid")

    # Step 4: Import editor rooms, nodes, and edges into the database
    run_command([
        "npx", "ts-node", "scripts/importEditorFloorDefinition.ts",
        "--file", args.layout,
        "--building-id", args.building_id,
        "--building-name", args.building_name,
        "--floor-id", args.floor_id,
        "--level", str(args.level),
        "--floor-name", args.floor_name
    ], "Step 4: Seeding rooms, nodes, and edges into database")

    print("\n====================================================")
    print("SUCCESS: Floor onboarding pipeline completed!")
    print(f"Generated clean geometry: {clean_json}")
    print(f"Generated nav grid:       {nav_json}")
    print("Database seeding completed successfully.")
    print("====================================================")
    print("\nNext Steps:")
    print("1. Ensure mapService.ts FLOOR_DATA_MAP includes the new floor mapping:")
    print(f"   '{args.floor_id}': {{")
    print(f"     clean: '{clean_json.name}',")
    print(f"     nav: '{nav_json.name}'")
    print("   }")

if __name__ == "__main__":
    main()
