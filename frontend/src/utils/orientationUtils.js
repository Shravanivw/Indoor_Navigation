import { getCardinalName, normalizeAngle } from "../hooks/useDeviceOrientation";

/**
 * Calculates vector angle in degrees from grid cell A to cell B.
 * 0° = North, 90° = East, 180° = South, 270° = West.
 */
export function getSegmentBearing(cellA, cellB) {
  if (!cellA || !cellB) return 0;
  const dx = cellB.x - cellA.x;
  const dy = cellB.y - cellA.y;

  // In grid coordinate space where Y increases upwards (or inverted in CAD space):
  // dx > 0 (East), dy < 0 (North in standard top-left origin grids)
  let angleRad = Math.atan2(dx, -dy);
  let angleDeg = (angleRad * 180) / Math.PI;
  return normalizeAngle(angleDeg);
}

/**
 * Enriches navigation steps with orientation headings (North, East, South, West, etc.)
 * relative to segment directions and physical user facing heading.
 */
export function enrichStepsWithOrientation(steps, options = {}) {
  if (!Array.isArray(steps) || steps.length === 0) return [];

  const { userHeading = null } = options;

  return steps.map((step, idx) => {
    // Keep destination arrival & static messages intact
    if (!step || step.instruction === 'Arrived at destination' || step.instruction === 'You are already here') {
      return step;
    }

    let segmentHeading = null;
    if (step.gridCell && steps[idx + 1] && steps[idx + 1].gridCell) {
      segmentHeading = getSegmentBearing(step.gridCell, steps[idx + 1].gridCell);
    }

    const cardinalName = segmentHeading !== null ? getCardinalName(segmentHeading) : null;
    const distStr = step.distanceM ? `${Math.round(step.distanceM)} m` : "";

    let orientationInstruction = step.instruction;

    if (cardinalName) {
      const orig = step.instruction.toLowerCase();

      if (orig.includes("walk straight") || orig.includes("head straight")) {
        orientationInstruction = `Head ${cardinalName} for ${distStr}`;
      } else if (orig.includes("continue straight")) {
        orientationInstruction = `Continue ${cardinalName} for ${distStr}`;
      } else if (orig.includes("turn left")) {
        orientationInstruction = `Turn left toward ${cardinalName} (${distStr})`;
      } else if (orig.includes("turn right")) {
        orientationInstruction = `Turn right toward ${cardinalName} (${distStr})`;
      } else if (orig.includes("slight left")) {
        orientationInstruction = `Bear slight left toward ${cardinalName} (${distStr})`;
      } else if (orig.includes("slight right")) {
        orientationInstruction = `Bear slight right toward ${cardinalName} (${distStr})`;
      } else if (orig.includes("around")) {
        orientationInstruction = `Turn around toward ${cardinalName} (${distStr})`;
      } else {
        orientationInstruction = `${step.instruction} (${cardinalName})`;
      }

      // Prefix user's current facing direction on active first step if sensor is active
      if (userHeading !== null && idx === 0) {
        const facingName = getCardinalName(userHeading);
        orientationInstruction = `Facing ${facingName} — ${orientationInstruction}`;
      }
    }

    return {
      ...step,
      cardinalHeading: segmentHeading,
      cardinalName,
      orientationInstruction,
    };
  });
}
