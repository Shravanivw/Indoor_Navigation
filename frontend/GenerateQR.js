// GenerateQR.js — generate the single Reception QR sticker.
//
// Scope: the only physical QR sticker is at Reception. Scanning it opens
// the app with ?qr=LOC-GF-RECEPTION; the frontend resolves that to the
// Reception room via GET /rooms/qr/:qrCode, sets it as the user's start
// location, and arms live tracking.
//
// Usage:
//   # default (LAN dev):
//   node GenerateQR.js
//   # with a Cloudflare tunnel:
//   $env:BASE_URL="https://your-tunnel.trycloudflare.com"; node GenerateQR.js
//
// Output: ./qrcodes/LOC-GF-RECEPTION.png

import QRCode from "qrcode";
import fs from "fs";
import path from "path";

const BASE_URL = process.env.BASE_URL ?? "http://192.168.1.102:5174";

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
  })
  .catch(err => {
    console.error(`✗ Failed: ${err.message}`);
    process.exit(1);
  });