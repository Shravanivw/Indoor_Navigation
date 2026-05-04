import { useState } from "react";
import StatusBar from "../components/StatusBar";
import TopBar from "../components/TopBar";
import "../css/ScanQR.css";

export default function ScanQR({ onBack, onConfirm }) {
  const [manual, setManual] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [confirmedVal, setConfirmedVal] = useState("");

  function handleConfirm() {
    const val = manual.trim() || "Lift 1 — Floor 5";
    setConfirmedVal(val);
    setConfirmed(true);
    setTimeout(() => onConfirm(val), 1500);
  }

  return (
    <div className="qr-page">
      <StatusBar />
      <TopBar
        title="Scan QR code"
        subtitle="Point camera at QR on any wall, lift or entrance"
        onBack={onBack}
      />
      <div className="qr-body">
        <div className="qr-viewport">
          <div className="qr-cam-bg">
            <div className="qr-pattern">
              {[...Array(16)].map((_, i) => (
                <div key={i} className={`qr-cell ${[0,2,3,5,7,8,10,13,15].includes(i) ? "dark" : ""}`} />
              ))}
            </div>
          </div>
          <div className="qr-corner tl" />
          <div className="qr-corner tr" />
          <div className="qr-corner bl" />
          <div className="qr-corner br" />
          <div className="qr-scanline" />
        </div>

        {!confirmed ? (
          <div className="qr-hint">Scanning for QR code…<br />Make sure it's well lit and in frame</div>
        ) : (
          <div className="qr-success">
            <div className="qr-success-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#EAF3DE" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <div>
              <div className="qr-success-text">{confirmedVal}</div>
              <div className="qr-success-sub">Location confirmed</div>
            </div>
          </div>
        )}

        <div className="qr-or">
          <div className="qr-or-line" />
          <span>or enter manually</span>
          <div className="qr-or-line" />
        </div>

        <div className="qr-manual">
          <input
            className="qr-manual-input"
            placeholder="e.g. F2-LIFT-A or Room 204"
            value={manual}
            onChange={e => setManual(e.target.value)}
          />
          <button className="qr-confirm-btn" onClick={handleConfirm}>
            Confirm location
          </button>
        </div>
      </div>
    </div>
  );
}