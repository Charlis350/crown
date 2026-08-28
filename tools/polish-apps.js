const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const catalogPath = path.join(root, "apps", "catalog.js");
const iconDir = path.join(root, "assets", "app-icons");

function slugify(value = "") {
  return String(value)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "app";
}

function escapeXml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function initials(title = "") {
  const words = String(title)
    .replace(/[^a-z0-9 ]/gi, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return "C";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return words.slice(0, 2).map((word) => word[0]).join("").toUpperCase();
}

function loadApps() {
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(catalogPath, "utf8"), context);
  return Array.isArray(context.window.CROWN_APPS) ? context.window.CROWN_APPS : [];
}

function writeApps(apps) {
  fs.writeFileSync(catalogPath, "window.CROWN_APPS = " + JSON.stringify(apps, null, 2) + ";\n");
}

function mark(app) {
  const title = String(app.title || "");
  const key = title.toLowerCase();
  if (/youtube/.test(key)) return '<rect x="78" y="106" width="180" height="128" rx="34" fill="#ff0033"/><path d="M151 139l71 31-71 32z" fill="#fff"/>';
  if (/discord/.test(key)) return '<rect x="72" y="80" width="192" height="172" rx="48" fill="#5865f2"/><circle cx="126" cy="168" r="15" fill="#fff"/><circle cx="210" cy="168" r="15" fill="#fff"/><path d="M112 204c38 24 78 24 116 0" stroke="#fff" stroke-width="18" stroke-linecap="round" fill="none"/>';
  if (/gmail|google mail/.test(key)) return '<rect x="58" y="94" width="220" height="148" rx="22" fill="#fff"/><path d="M72 112l96 72 96-72" fill="none" stroke="#ea4335" stroke-width="24" stroke-linejoin="round"/><path d="M70 225V117l98 73 98-73v108" fill="none" stroke="#4285f4" stroke-width="18" stroke-linejoin="round"/>';
  if (/google gemini|gemini/.test(key)) return '<rect x="58" y="58" width="220" height="220" rx="48" fill="#050505"/><path d="M169 77c17 56 46 84 101 101-55 16-84 46-101 101-17-55-46-85-101-101 55-17 84-45 101-101z" fill="#8ab4f8"/>';
  if (/google$/.test(key)) return '<circle cx="168" cy="168" r="88" fill="none" stroke="#fff" stroke-width="42"/><path d="M170 168h89" stroke="#4285f4" stroke-width="38"/><path d="M99 111a88 88 0 0 1 126-3" stroke="#ea4335" stroke-width="42" fill="none"/><path d="M226 108a88 88 0 0 1 16 92" stroke="#fbbc05" stroke-width="42" fill="none"/><path d="M242 200a88 88 0 0 1-143 25" stroke="#34a853" stroke-width="42" fill="none"/>';
  if (/chatgpt|openai/.test(key)) return '<circle cx="168" cy="168" r="92" fill="#050505"/><path d="M132 111c31-31 72-13 77 24 38 6 51 47 23 76 7 38-29 65-65 50-31 28-72 9-76-29-37-10-47-51-21-78-8-38 27-64 62-43z" fill="none" stroke="#fff" stroke-width="15" stroke-linejoin="round"/>';
  if (/spotify/.test(key)) return '<circle cx="168" cy="168" r="105" fill="#1ed760"/><path d="M103 133c50-15 98-10 143 15M113 168c42-11 82-7 119 11M124 199c31-7 62-4 91 8" stroke="#07150b" stroke-width="17" stroke-linecap="round"/>';
  if (/steam/.test(key)) return '<circle cx="168" cy="168" r="105" fill="#173252"/><circle cx="207" cy="131" r="40" fill="none" stroke="#fff" stroke-width="15"/><circle cx="207" cy="131" r="16" fill="#fff"/><circle cx="117" cy="202" r="27" fill="none" stroke="#fff" stroke-width="15"/><path d="M137 190l42-39" stroke="#fff" stroke-width="16" stroke-linecap="round"/>';
  if (/snapchat/.test(key)) return '<rect width="336" height="336" rx="72" fill="#fffc00"/><path d="M168 67c38 0 58 29 58 70v34c14 10 30 16 49 19-8 22-31 31-53 36-12 26-31 42-54 42s-42-16-54-42c-22-5-45-14-53-36 19-3 35-9 49-19v-34c0-41 20-70 58-70z" fill="#fff" stroke="#111" stroke-width="10"/>';
  if (/tiktok/.test(key)) return '<rect width="336" height="336" rx="72" fill="#050505"/><path d="M194 77v113c0 42-27 70-72 70-36 0-63-24-63-58 0-36 29-59 70-55v38c-19-3-31 5-31 19 0 13 10 22 25 22 17 0 27-12 27-34V77z" fill="#25f4ee"/><path d="M205 77c12 38 37 57 73 62v43c-31-2-56-13-74-31v39" fill="none" stroke="#fe2c55" stroke-width="19"/>';
  if (/pinterest/.test(key)) return '<circle cx="168" cy="168" r="105" fill="#e60023"/><path d="M152 229c11-44 20-82 26-111-8-13-32-7-32 21 0 17 6 29 16 35-9 14-29 16-42 3-11-11-16-28-12-48 8-41 47-64 91-55 44 10 69 45 59 87-9 40-39 66-75 60-7-1-14-5-20-10l-9 35z" fill="#fff"/>';
  if (/proton/.test(key)) return '<path d="M70 90h196v156H70z" fill="#6d4aff"/><path d="M70 90l98 84 98-84v156H70z" fill="#fff" opacity=".9"/><path d="M70 90l98 104 98-104" fill="none" stroke="#6d4aff" stroke-width="24" stroke-linejoin="round"/>';
  if (/premier/.test(key)) return '<path d="M172 55c49 14 83 58 83 111 0 64-51 116-114 116-38 0-71-18-92-45 51 13 86-1 104-38-33-4-56-27-56-58 0-34 26-60 60-60 6 0 11 1 16 2z" fill="#5f267f"/><path d="M194 64l46-13-23 41z" fill="#5f267f"/>';
  if (/github/.test(key)) return '<circle cx="168" cy="168" r="104" fill="#050505"/><path d="M119 247c4-24 3-39-12-52-28-3-50-21-50-62 0-18 6-33 18-46-2-9-1-23 5-42 0 0 16-5 48 18 27-7 56-7 83 0 32-23 48-18 48-18 6 19 7 33 5 42 12 13 18 28 18 46 0 41-22 59-50 62-16 13-17 28-13 52" fill="#fff"/>';
  if (/instagram/.test(key)) return '<rect x="62" y="62" width="212" height="212" rx="58" fill="url(#ig)"/><rect x="105" y="105" width="126" height="126" rx="38" fill="none" stroke="#fff" stroke-width="18"/><circle cx="168" cy="168" r="31" fill="none" stroke="#fff" stroke-width="18"/><circle cx="224" cy="111" r="12" fill="#fff"/>';
  if (/twitter/.test(key)) return '<rect width="336" height="336" rx="72" fill="#1da1f2"/><path d="M278 118c-8 4-17 7-27 8 10-6 17-15 20-26-9 5-20 10-31 12-28-30-77-8-69 32-38-2-72-20-94-48-13 22-7 50 16 64-8 0-16-2-23-6 0 24 17 45 41 50-8 2-16 3-24 1 7 21 27 36 51 37-22 17-49 25-78 22 24 15 52 24 83 24 100 0 157-86 153-164 10-7 19-16 26-26z" fill="#fff"/>';
  if (/facebook|messenger/.test(key)) return '<circle cx="168" cy="168" r="105" fill="#0084ff"/><path d="M88 205l58-90 47 48 55-48-57 90-47-48z" fill="#fff"/>';
  if (/netflix|hbo|max|paramount|movie|flix|fmovies|hd today|soud?o|wattpad|writer/.test(key)) return '<rect x="74" y="72" width="188" height="192" rx="30" fill="#111827"/><path d="M111 231V105h35l44 74V105h35v126h-35l-44-75v75z" fill="#ef4444"/>';
  if (/nfl|nba|mlb|espn|fifa|goal|soccer|premier/.test(key)) return '<circle cx="168" cy="168" r="102" fill="#fff"/><path d="M168 65c44 42 66 77 66 103s-22 61-66 103c-44-42-66-77-66-103s22-61 66-103z" fill="#2563eb"/><path d="M94 168h148M168 72v192" stroke="#fff" stroke-width="13"/>';
  if (/chess/.test(key)) return '<rect x="74" y="74" width="188" height="188" rx="26" fill="#2b2b2b"/><path d="M140 224h64l-9-64c26-34 21-66-27-83-48 17-53 49-27 83z" fill="#81b64c" stroke="#fff" stroke-width="10" stroke-linejoin="round"/>';
  if (/android|aptoide|now\.gg|gba|emulator|gef?orce|luna/.test(key)) return '<rect x="72" y="84" width="192" height="168" rx="42" fill="#3ddc84"/><path d="M115 78l-30-43M221 78l30-43" stroke="#3ddc84" stroke-width="15" stroke-linecap="round"/><circle cx="130" cy="162" r="13" fill="#052e16"/><circle cx="206" cy="162" r="13" fill="#052e16"/><path d="M128 207h80" stroke="#052e16" stroke-width="13" stroke-linecap="round"/>';
  if (/scratch|cool math|gidd|y8|newgrounds|poki|blooket|fancade/.test(key)) return '<path d="M169 62l37 64 74 15-51 55 9 76-69-32-69 32 9-76-51-55 74-15z" fill="#facc15" stroke="#111827" stroke-width="13" stroke-linejoin="round"/>';
  return "";
}

function iconSvg(app) {
  const title = app.title || "Crown App";
  const colors = app.colors || ["#8b5cf6", "#ffd447"];
  const id = slugify(title).replace(/-/g, "");
  const customMark = mark(app);
  const letter = escapeXml(initials(title));
  const fontSize = letter.length > 2 ? 78 : 104;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="336" height="336" viewBox="0 0 336 336" role="img" aria-label="${escapeXml(title)}">
  <defs>
    <linearGradient id="${id}bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${escapeXml(colors[0] || "#8b5cf6")}"/>
      <stop offset="1" stop-color="${escapeXml(colors[1] || colors[0] || "#ffd447")}"/>
    </linearGradient>
    <linearGradient id="ig" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#feda75"/><stop offset=".35" stop-color="#fa7e1e"/><stop offset=".68" stop-color="#d62976"/><stop offset="1" stop-color="#4f5bd5"/>
    </linearGradient>
    <filter id="${id}shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="12" stdDeviation="12" flood-color="#000" flood-opacity=".3"/>
    </filter>
  </defs>
  <rect width="336" height="336" rx="72" fill="url(#${id}bg)"/>
  <circle cx="292" cy="34" r="92" fill="#fff" opacity=".18"/>
  <circle cx="38" cy="328" r="118" fill="#000" opacity=".16"/>
  <g filter="url(#${id}shadow)">
    ${customMark || `<rect x="74" y="74" width="188" height="188" rx="44" fill="#fff" opacity=".92"/><text x="168" y="194" text-anchor="middle" font-size="${fontSize}" font-family="Arial Black, Arial, sans-serif" fill="#111827">${letter}</text>`}
  </g>
</svg>
`;
}

fs.mkdirSync(iconDir, { recursive: true });
const apps = loadApps().map((app) => {
  const logo = "assets/app-icons/" + slugify(app.title || app.id) + ".svg";
  fs.writeFileSync(path.join(root, logo), iconSvg(app));
  return { ...app, logo };
});

writeApps(apps);
console.log(JSON.stringify({ apps: apps.length, icons: apps.length }, null, 2));
