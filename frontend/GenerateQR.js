// GenerateQR.js — generate the single Reception QR sticker.
//
// Scope: for now the only physical QR sticker is at Reception. Scanning it
// opens the app with ?qr=LOC-GF-RECEPTION, the frontend resolves that to
// the Reception room via GET /rooms/qr/:qrCode, and sets it as the user's
// start location so they can navigate to any point of interest from there.
//
// Usage:
//   1. Edit BASE_URL below to the LAN address your phones will hit.
//   2. Run:  node GenerateQR.js
// Output: ./qrcodes/LOC-GF-RECEPTION.png

import QRCode from "qrcode";
import fs from "fs";
import path from "path";

// 👉 Change this to wherever you serve the Vite build on your LAN.
const BASE_URL = "http://10.104.152.169:5174";

const RECEPTION = { code: "LOC-GF-RECEPTION", label: "Reception" };

const OUT_DIR = path.join(process.cwd(), "qrcodes");
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const url     = `${BASE_URL}/?qr=${encodeURIComponent(RECEPTION.code)}`;
const outPath = path.join(OUT_DIR, `${RECEPTION.code}.png`);

QRCode.toFile(outPath, url, {
  errorCorrectionLevel: "H",
  margin: 2,
  width: 600,
  color: { dark: "#0C447C", light: "#FFFFFF" },
})
  .then(() => {
    console.log(`✓ ${RECEPTION.label} QR -> ${outPath}`);
    console.log(`  ${url}`);
    console.log("\nPrint, label \"Scan to start navigation\", and stick at reception.");
  })
  .catch(err => {
    console.error(`✗ Failed: ${err.message}`);
    process.exit(1);
  });
