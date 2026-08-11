import { useState, useEffect, useRef, useCallback } from "react";

/**
 * Normalizes an angle into [0, 360) range.
 */
export function normalizeAngle(deg) {
  let a = deg % 360;
  if (a < 0) a += 360;
  return a;
}

/**
 * Interpolates smoothly between two angles handling circular wrap-around (359° <-> 1°).
 */
export function shortestAngleInterpolate(current, target, alpha = 0.15) {
  let diff = (target - current) % 360;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  return normalizeAngle(current + diff * alpha);
}

/**
 * Returns 8-point cardinal/ordinal direction code ("N", "NE", "E", "SE", "S", "SW", "W", "NW")
 */
export function getCardinalDirection(headingDeg) {
  const normalized = normalizeAngle(headingDeg);
  const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const index = Math.round(normalized / 45) % 8;
  return directions[index];
}

/**
 * Returns 8-point cardinal/ordinal full name ("North", "North-East", "East", etc.)
 */
export function getCardinalName(headingDeg) {
  const normalized = normalizeAngle(headingDeg);
  const names = [
    "North",
    "North-East",
    "East",
    "South-East",
    "South",
    "South-West",
    "West",
    "North-West"
  ];
  const index = Math.round(normalized / 45) % 8;
  return names[index];
}

/**
 * Custom React Hook for Mobile Device Orientation & Compass System.
 * Automatically falls back to desktop map/camera heading when sensors are absent.
 */
export default function useDeviceOrientation(options = {}) {
  const { enabled = true, fallbackHeading = 0 } = options;

  const [heading, setHeading]               = useState(fallbackHeading);
  const [isSupported, setIsSupported]       = useState(false);
  const [isPermissionRequired, setIsPermissionRequired] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(null); // null | true | false
  const [isSensorActive, setIsSensorActive] = useState(false);

  const headingRef      = useRef(fallbackHeading);
  const animFrameRef    = useRef(null);
  const sensorActiveRef = useRef(false);

  // iOS Permission Request helper
  const requestPermission = useCallback(async () => {
    if (
      typeof DeviceOrientationEvent !== "undefined" &&
      typeof DeviceOrientationEvent.requestPermission === "function"
    ) {
      try {
        const response = await DeviceOrientationEvent.requestPermission();
        if (response === "granted") {
          setPermissionGranted(true);
          return true;
        } else {
          setPermissionGranted(false);
          return false;
        }
      } catch (err) {
        console.warn("[Compass] DeviceOrientation permission error:", err);
        setPermissionGranted(false);
        return false;
      }
    }
    setPermissionGranted(true);
    return true;
  }, []);

  useEffect(() => {
    if (!enabled) {
      setIsSensorActive(false);
      sensorActiveRef.current = false;
      return;
    }

    const hasDeviceOrientation = typeof window !== "undefined" && "DeviceOrientationEvent" in window;
    setIsSupported(hasDeviceOrientation);

    if (
      hasDeviceOrientation &&
      typeof DeviceOrientationEvent.requestPermission === "function"
    ) {
      setIsPermissionRequired(true);
    }

    let rawHeadingTarget = null;

    const handleOrientation = (event) => {
      let rawHeading = null;

      // iOS webkitCompassHeading (0 = Magnetic North, clockwise)
      if (typeof event.webkitCompassHeading === "number" && !isNaN(event.webkitCompassHeading)) {
        rawHeading = event.webkitCompassHeading;
      } else if (event.alpha !== null && event.alpha !== undefined) {
        // Android / W3C Standard: alpha increases counter-clockwise from North
        // Convert to clockwise from North: (360 - alpha) % 360
        rawHeading = (360 - event.alpha) % 360;
      }

      if (rawHeading !== null && !isNaN(rawHeading)) {
        rawHeadingTarget = rawHeading;
        if (!sensorActiveRef.current) {
          sensorActiveRef.current = true;
          setIsSensorActive(true);
        }
      }
    };

    if (hasDeviceOrientation) {
      window.addEventListener("deviceorientation", handleOrientation, true);
    }

    // Low-pass filter loop running on RAF for smooth animation
    const updateLoop = () => {
      if (rawHeadingTarget !== null) {
        const newHeading = shortestAngleInterpolate(headingRef.current, rawHeadingTarget, 0.15);
        headingRef.current = newHeading;
        setHeading(Math.round(newHeading * 10) / 10);
      } else if (!sensorActiveRef.current) {
        // Smoothly sync to fallback angle when sensor is inactive
        const newHeading = shortestAngleInterpolate(headingRef.current, fallbackHeading, 0.1);
        headingRef.current = newHeading;
        setHeading(Math.round(newHeading * 10) / 10);
      }
      animFrameRef.current = requestAnimationFrame(updateLoop);
    };

    animFrameRef.current = requestAnimationFrame(updateLoop);

    return () => {
      if (hasDeviceOrientation) {
        window.removeEventListener("deviceorientation", handleOrientation, true);
      }
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [enabled, fallbackHeading]);

  return {
    heading,
    cardinalDirection: getCardinalDirection(heading),
    cardinalName: getCardinalName(heading),
    isSupported,
    isPermissionRequired,
    permissionGranted,
    isSensorActive,
    requestPermission,
  };
}
