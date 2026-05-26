// useDeadReckoning — phone-only live position tracking with no network.
//
// Combines two browser sensor APIs that work over plain HTTP/HTTPS without
// any backend, GPS, BLE, or Wi-Fi:
//
//   • DeviceMotionEvent.accelerationIncludingGravity → step detection.
//     We watch the magnitude |a| of the acceleration vector and count a step
//     each time the signal crosses a threshold while moving (peak detection
//     with a refractory period to debounce double-counts).
//
//   • DeviceOrientationEvent.alpha (or .webkitCompassHeading on iOS) →
//     the compass heading in degrees, 0 = magnetic north.
//
// On every detected step we advance the user's grid position by the stride
// length (metres, default 0.7) in the current heading direction. The hook
// returns the current position in *grid coordinates* so it overlays cleanly
// on FloorMap / Walk3D, plus the live heading and a step counter.
//
// iOS Safari requires a user-gesture permission for both APIs — call
// requestPermission() from a button click before tracking starts.

import { useEffect, useRef, useState, useCallback } from "react";

const STEP_THRESHOLD     = 11.5;   // |a| (m/s²) peak that counts as a step
const STEP_REFRACTORY_MS = 300;    // min ms between two steps
const SMOOTH_ALPHA       = 0.18;   // low-pass filter factor for |a|

export default function useDeadReckoning({
  initialGridX = 0,
  initialGridY = 0,
  scaleX       = 1,         // metres per grid cell, X
  scaleY       = 1,         // metres per grid cell, Y
  strideM      = 0.7,       // average stride length in metres
  enabled      = false,
} = {}) {
  const [position, setPosition] = useState({ gx: initialGridX, gy: initialGridY });
  const [heading,  setHeading]  = useState(0);    // degrees, 0 = north
  const [steps,    setSteps]    = useState(0);
  const [status,   setStatus]   = useState("idle"); // idle | running | denied | unsupported
  const [error,    setError]    = useState(null);

  // Keep mutable copies in refs so the sensor handlers always read fresh state
  const posRef       = useRef({ gx: initialGridX, gy: initialGridY });
  const headingRef   = useRef(0);
  const smoothedRef  = useRef(9.81);
  const lastStepRef  = useRef(0);
  const risingRef    = useRef(false);

  // Snap position to a known location (called when user scans a QR sticker)
  const recalibrate = useCallback((gx, gy) => {
    posRef.current = { gx, gy };
    setPosition({ gx, gy });
    setSteps(0);
  }, []);

  // iOS gesture-gated permission. Resolves to true if we can listen.
  const requestPermission = useCallback(async () => {
    setError(null);
    try {
      let motionGranted = true;
      let orientGranted = true;
      if (typeof DeviceMotionEvent !== "undefined" &&
          typeof DeviceMotionEvent.requestPermission === "function") {
        const r = await DeviceMotionEvent.requestPermission();
        motionGranted = r === "granted";
      }
      if (typeof DeviceOrientationEvent !== "undefined" &&
          typeof DeviceOrientationEvent.requestPermission === "function") {
        const r = await DeviceOrientationEvent.requestPermission();
        orientGranted = r === "granted";
      }
      if (!motionGranted || !orientGranted) {
        setStatus("denied");
        return false;
      }
      return true;
    } catch (err) {
      setError(err?.message || String(err));
      setStatus("denied");
      return false;
    }
  }, []);

  // Reset everything to a fresh start (no listeners)
  const reset = useCallback(() => {
    smoothedRef.current = 9.81;
    lastStepRef.current = 0;
    risingRef.current   = false;
    setSteps(0);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setStatus("idle");
      return;
    }
    if (typeof window === "undefined" ||
        typeof DeviceMotionEvent === "undefined" ||
        typeof DeviceOrientationEvent === "undefined") {
      setStatus("unsupported");
      return;
    }

    function onMotion(e) {
      const a = e.accelerationIncludingGravity;
      if (!a) return;
      const mag = Math.sqrt((a.x || 0) ** 2 + (a.y || 0) ** 2 + (a.z || 0) ** 2);
      // Low-pass filter to suppress hand-shake noise
      smoothedRef.current = smoothedRef.current * (1 - SMOOTH_ALPHA) + mag * SMOOTH_ALPHA;
      const filtered = smoothedRef.current;

      // Simple peak detector: edge-trigger on rising → falling above threshold
      const now = e.timeStamp || performance.now();
      if (filtered > STEP_THRESHOLD && !risingRef.current) {
        risingRef.current = true;
        if (now - lastStepRef.current > STEP_REFRACTORY_MS) {
          lastStepRef.current = now;
          // Translate one stride in the current heading.
          // Heading is degrees clockwise from north; convert to a unit vector
          // in (gx, gy) grid space. North = -Y in screen-space grids.
          const rad = (headingRef.current * Math.PI) / 180;
          const dxM =  Math.sin(rad) * strideM;
          const dyM = -Math.cos(rad) * strideM;
          const next = {
            gx: posRef.current.gx + dxM / scaleX,
            gy: posRef.current.gy + dyM / scaleY,
          };
          posRef.current = next;
          setPosition(next);
          setSteps(s => s + 1);
        }
      } else if (filtered < STEP_THRESHOLD - 0.6) {
        risingRef.current = false;
      }
    }

    function onOrientation(e) {
      // iOS reports an absolute compass heading via webkitCompassHeading;
      // other browsers give alpha (0–360, may be relative unless `absolute`).
      let h = e.webkitCompassHeading;
      if (h == null) {
        // alpha = rotation around Z (0 when device top points north on most)
        h = (360 - (e.alpha || 0)) % 360;
      }
      headingRef.current = h;
      setHeading(h);
    }

    window.addEventListener("devicemotion",      onMotion);
    window.addEventListener("deviceorientation", onOrientation);
    setStatus("running");

    return () => {
      window.removeEventListener("devicemotion",      onMotion);
      window.removeEventListener("deviceorientation", onOrientation);
    };
  }, [enabled, scaleX, scaleY, strideM]);

  return {
    position,             // { gx, gy } in grid cells
    heading,              // degrees, 0 = north
    steps,                // raw step count
    status,               // idle | running | denied | unsupported
    error,
    requestPermission,
    recalibrate,
    reset,
  };
}
