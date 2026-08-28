const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const dataFile = path.join(root, "data", "games.js");
const ffmpeg = "C:\\Users\\weswo\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.0.1-full_build\\bin\\ffmpeg.exe";

function readGames() {
  const raw = fs.readFileSync(dataFile, "utf8");
  return JSON.parse(raw.slice(raw.indexOf("["), raw.lastIndexOf("]") + 1));
}

function uniqueThumbs() {
  const thumbs = new Set();
  for (const game of readGames()) {
    const thumb = String(game.thumbnail || "");
    if (thumb && !/^(?:https?:|data:|blob:)/i.test(thumb)) thumbs.add(thumb);
  }
  return [...thumbs];
}

function cropDetect(file, invert = false) {
  const vf = `${invert ? "negate," : ""}cropdetect=limit=0.08:round=2:reset=0`;
  try {
    const output = execFileSync(
      ffmpeg,
      ["-hide_banner", "-nostats", "-i", file, "-vf", vf, "-frames:v", "1", "-f", "null", "-"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
    return parseCrop(output);
  } catch (error) {
    return parseCrop(`${error.stdout || ""}\n${error.stderr || ""}`);
  }
}

function parseCrop(output) {
  const matches = [...String(output).matchAll(/crop=(\d+):(\d+):(\d+):(\d+)/g)];
  if (!matches.length) return null;
  const [, w, h, x, y] = matches[matches.length - 1].map(Number);
  return { w, h, x, y, area: w * h };
}

function getSize(file) {
  try {
    const output = execFileSync(ffmpeg, ["-hide_banner", "-i", file], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return parseSize(output);
  } catch (error) {
    return parseSize(`${error.stdout || ""}\n${error.stderr || ""}`);
  }
}

function parseSize(output) {
  const match = String(output).match(/,\s*(\d+)x(\d+)[,\s]/);
  if (!match) return null;
  return { w: Number(match[1]), h: Number(match[2]) };
}

function usefulCrop(size, crop) {
  if (!size || !crop) return false;
  if (crop.w <= 0 || crop.h <= 0) return false;
  if (crop.w === size.w && crop.h === size.h) return false;
  const removedX = size.w - crop.w;
  const removedY = size.h - crop.h;
  if (removedX < 8 && removedY < 8) return false;
  if (crop.w < size.w * 0.55 || crop.h < size.h * 0.55) return false;
  return true;
}

function cropImage(file, crop) {
  const ext = path.extname(file);
  const tmp = file.replace(new RegExp(`${ext.replace(".", "\\.")}$`), `.crop-tmp${ext}`);
  execFileSync(ffmpeg, ["-y", "-hide_banner", "-loglevel", "error", "-i", file, "-vf", `crop=${crop.w}:${crop.h}:${crop.x}:${crop.y}`, tmp]);
  fs.renameSync(tmp, file);
}

let cropped = 0;
const failures = [];
for (const thumb of uniqueThumbs()) {
  const file = path.join(root, thumb);
  if (!fs.existsSync(file) || !/\.(png|jpe?g|webp)$/i.test(file)) continue;
  const size = getSize(file);
  const black = cropDetect(file, false);
  const white = cropDetect(file, true);
  const candidates = [black, white].filter((crop) => usefulCrop(size, crop));
  if (!candidates.length) continue;
  candidates.sort((a, b) => b.area - a.area);
  try {
    cropImage(file, candidates[0]);
    cropped += 1;
  } catch (error) {
    failures.push({ thumb, error: error.message });
  }
}

console.log(JSON.stringify({ cropped, failures: failures.slice(0, 20) }, null, 2));
