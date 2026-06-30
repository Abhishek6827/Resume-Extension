import fs from "fs";
import path from "path";

const base64Png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
const buffer = Buffer.from(base64Png, "base64");

const iconsDir = path.resolve("public/icons");
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

fs.writeFileSync(path.join(iconsDir, "icon-16.png"), buffer);
fs.writeFileSync(path.join(iconsDir, "icon-48.png"), buffer);
fs.writeFileSync(path.join(iconsDir, "icon-128.png"), buffer);

console.log("Placeholder icons generated successfully.");
