import React from "react";
import "../css/Compass.css";

/**
 * Google Maps / Apple Maps Style Floating Orientation Indicator
 *
 * Completely replaces the traditional N/E/S/W compass dial with a minimalist
 * floating navigation control button containing a smooth paper-plane direction
 * arrow, subtle North red tick mark, and click-to-reset orientation handler.
 */
export default function Compass({
  heading = 0,
  isSensorActive = false,
  isPermissionRequired = false,
  permissionGranted = null,
  onRequestPermission,
  onResetOrientation,
  size = "md",
  label,
  style = {},
}) {
  const roundedHeading = Math.round(heading);

  const handleClick = (e) => {
    e.stopPropagation();
    if (isPermissionRequired && permissionGranted !== true && onRequestPermission) {
      onRequestPermission();
    } else if (typeof onResetOrientation === "function") {
      onResetOrientation();
    }
  };

  return (
    <div
      className={`nav-indicator-wrap nav-size-${size} ${isSensorActive ? "sensor-active" : "map-mode"}`}
      style={style}
    >
      <button
        type="button"
        className="nav-indicator-btn"
        onClick={handleClick}
        title={
          isSensorActive
            ? `Phone Compass Heading: ${roundedHeading}° (Tap to reset)`
            : `Orientation: ${roundedHeading}° (Tap to reset North)`
        }
        aria-label={`Orientation indicator ${roundedHeading} degrees`}
      >
        {/* Subtle Red North Tick Mark at top edge (0° position) */}
        <div className="nav-north-tick" />

        {/* Smooth Rotating Navigation Arrow */}
        <div
          className="nav-arrow-dial"
          style={{ transform: `rotate(${-heading}deg)` }}
        >
          <svg viewBox="0 0 24 24" className="nav-arrow-svg" fill="none">
            {/* Paper-Plane / Navigation Chevron Pointer */}
            <path
              d="M12 3L4 19L12 15.5L20 19L12 3Z"
              fill={isSensorActive ? "#0284c7" : "#0f766e"}
              stroke={isSensorActive ? "#0369a1" : "#0d9488"}
              strokeWidth="1.2"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        {/* Sensor active status dot */}
        {isSensorActive && <span className="nav-sensor-dot" />}
      </button>

      {/* iOS Permission Prompt fallback badge */}
      {isPermissionRequired && permissionGranted !== true && (
        <button
          type="button"
          className="nav-perm-badge"
          onClick={onRequestPermission}
        >
          Enable Sensor
        </button>
      )}

      {label && <span className="nav-mode-label">{label}</span>}
    </div>
  );
}
