import QRCode from "qrcode";
import fs from "fs";

// Floor 5 code
const code = "FF5";

// CHANGE THIS for your intranet
const BASE_URL = "http://10.104.152.169:5174";
// or "http://indoor-nav-app"

const url = `${BASE_URL}/?location=${code}`;

// create folder if needed
if (!fs.existsSync("./qrcodes")) {
  fs.mkdirSync("./qrcodes");
}

// generate QR
QRCode.toFile(`./qrcodes/${code}.png`, url, (err) => {
  if (err) {
    console.error(err);
    return;
  }
  console.log("QR created");
  console.log("🔗", url);
});