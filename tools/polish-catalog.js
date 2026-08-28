const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const catalogPath = path.join(root, "data", "games.js");

function loadGames() {
  const raw = fs
    .readFileSync(catalogPath, "utf8")
    .replace(/^\s*window\.CROWN_GAMES\s*=\s*/, "")
    .replace(/;\s*$/, "");
  return JSON.parse(raw);
}

function writeGames(games) {
  fs.writeFileSync(catalogPath, "window.CROWN_GAMES = " + JSON.stringify(games, null, 2) + ";\n");
}

function normalizeTitle(value = "") {
  return String(value)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(the|game|games|html|probably|glitchy|chance|of|loading)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sourceScore(game) {
  const target = String(game.embedUrl || game.embedPath || "");
  let score = 0;
  if (target.includes("pizzaedition.win/assets/mainstorage/")) score += 100;
  if (target.includes("class6x.gitlab.io/")) score += 80;
  if (game.driveFolderId || target.includes("embeds/drive/")) score += 60;
  if (game.embedType === "html") score += 20;
  if (game.sourceHadEmbed) score += 5;
  if (String(game.thumbnail || "").endsWith(".svg")) score -= 3;
  return score;
}

function isBlockedTarget(game) {
  const target = String(game.embedUrl || game.embedPath || "");
  return /(^|\/\/)(?:www\.)?playhop\.com\//i.test(target);
}

function dedupe(games) {
  const chosen = new Map();
  const removed = [];
  for (const game of games) {
    if (isBlockedTarget(game)) {
      removed.push(game);
      continue;
    }
    const key = normalizeTitle(game.title);
    if (!key) continue;
    const current = chosen.get(key);
    if (!current || sourceScore(game) > sourceScore(current)) {
      if (current) removed.push(current);
      chosen.set(key, game);
    } else {
      removed.push(game);
    }
  }
  return {
    games: [...chosen.values()].sort((a, b) => String(a.title).localeCompare(String(b.title))),
    removed,
  };
}

function escapeXml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function hash(value = "") {
  let out = 2166136261;
  for (const char of String(value)) {
    out ^= char.charCodeAt(0);
    out = Math.imul(out, 16777619);
  }
  return out >>> 0;
}

function slugify(value = "") {
  return String(value)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || "game";
}

function localFileExists(relativePath = "") {
  return Boolean(relativePath) && fs.existsSync(path.join(root, relativePath.replace(/\//g, path.sep)));
}

function hasUsableThumbnail(game) {
  const thumbnail = String(game.thumbnail || "");
  return (
    thumbnail &&
    !/assets\/thumbs\/logos\//i.test(thumbnail) &&
    !/assets\/thumbs\/crown-covers\//i.test(thumbnail) &&
    !/^https?:/i.test(thumbnail) &&
    localFileExists(thumbnail)
  );
}

const palettes = [
  ["#6d28d9", "#f97316", "#facc15"],
  ["#0f766e", "#38bdf8", "#a3e635"],
  ["#7c2d12", "#f59e0b", "#fde68a"],
  ["#1d4ed8", "#22d3ee", "#fef08a"],
  ["#be185d", "#fb7185", "#fef3c7"],
  ["#14532d", "#22c55e", "#fef08a"],
  ["#111827", "#64748b", "#ffffff"],
  ["#312e81", "#a855f7", "#f0abfc"],
];

function wrapTitle(title) {
  const words = String(title).replace(/\s+/g, " ").trim().split(" ");
  const lines = [];
  let line = "";
  for (const word of words) {
    const next = line ? line + " " + word : word;
    if (next.length > 14 && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 3);
}

function initials(title = "") {
  const words = String(title)
    .replace(/[^a-z0-9 ]/gi, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return "CG";
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return words.slice(0, 3).map((word) => word[0]).join("").toUpperCase();
}

function motifFor(title = "") {
  const text = String(title).toLowerCase();
  if (/angry birds?/.test(text)) {
    return '<circle cx="330" cy="148" r="76" fill="#ef2424" stroke="#111827" stroke-width="12"/><path d="M258 136c34-22 72-27 111-14" stroke="#111827" stroke-width="14" stroke-linecap="round"/><circle cx="306" cy="134" r="13" fill="#fff"/><circle cx="362" cy="134" r="13" fill="#fff"/><circle cx="310" cy="136" r="6" fill="#111827"/><circle cx="358" cy="136" r="6" fill="#111827"/><path d="M327 154l58 18-58 24z" fill="#facc15" stroke="#111827" stroke-width="9" stroke-linejoin="round"/><path d="M292 79l-26-39 47 23" fill="#ef2424" stroke="#111827" stroke-width="9" stroke-linejoin="round"/>';
  }
  if (/fnaf|five nights|freddy/.test(text)) {
    return '<circle cx="318" cy="156" r="80" fill="#7c3f1d" stroke="#111827" stroke-width="12"/><circle cx="258" cy="92" r="33" fill="#7c3f1d" stroke="#111827" stroke-width="10"/><circle cx="378" cy="92" r="33" fill="#7c3f1d" stroke="#111827" stroke-width="10"/><circle cx="290" cy="147" r="14" fill="#fff"/><circle cx="346" cy="147" r="14" fill="#fff"/><circle cx="290" cy="149" r="6" fill="#111827"/><circle cx="346" cy="149" r="6" fill="#111827"/><ellipse cx="318" cy="188" rx="40" ry="27" fill="#f7d7a8" stroke="#111827" stroke-width="8"/><path d="M302 194h32" stroke="#111827" stroke-width="8" stroke-linecap="round"/><rect x="285" y="64" width="66" height="18" rx="6" fill="#111827"/>';
  }
  if (/mario|koopa|luigi/.test(text)) {
    return '<circle cx="318" cy="153" r="78" fill="#f8d8b7" stroke="#111827" stroke-width="12"/><path d="M245 121c22-70 122-74 151 0z" fill="#ef2424" stroke="#111827" stroke-width="12"/><circle cx="318" cy="99" r="31" fill="#fff" stroke="#111827" stroke-width="8"/><text x="318" y="111" text-anchor="middle" font-size="34" font-family="Arial Black, Arial" fill="#ef2424">M</text><path d="M278 176c34 24 72 24 107 0" stroke="#111827" stroke-width="12" stroke-linecap="round"/><path d="M278 145h80" stroke="#111827" stroke-width="13" stroke-linecap="round"/>';
  }
  if (/sonic/.test(text)) {
    return '<circle cx="318" cy="151" r="85" fill="#2563eb" stroke="#111827" stroke-width="12"/><path d="M247 132c58-22 107-58 153-104-3 57-25 102-66 135 37 2 69 15 96 42-56 14-107 10-153-13z" fill="#38bdf8" stroke="#111827" stroke-width="9" stroke-linejoin="round"/><ellipse cx="328" cy="181" rx="49" ry="25" fill="#fef3c7" stroke="#111827" stroke-width="8"/><circle cx="294" cy="132" r="11" fill="#fff"/><circle cx="337" cy="128" r="11" fill="#fff"/><circle cx="298" cy="134" r="5" fill="#111827"/><circle cx="341" cy="130" r="5" fill="#111827"/>';
  }
  if (/kirby/.test(text)) {
    return '<circle cx="318" cy="151" r="82" fill="#fb8fc6" stroke="#111827" stroke-width="12"/><ellipse cx="251" cy="199" rx="45" ry="22" fill="#ef4444" stroke="#111827" stroke-width="9" transform="rotate(-16 251 199)"/><ellipse cx="386" cy="199" rx="45" ry="22" fill="#ef4444" stroke="#111827" stroke-width="9" transform="rotate(16 386 199)"/><ellipse cx="292" cy="135" rx="13" ry="24" fill="#111827"/><ellipse cx="344" cy="135" rx="13" ry="24" fill="#111827"/><path d="M297 186c15 11 29 11 44 0" stroke="#111827" stroke-width="9" stroke-linecap="round"/>';
  }
  if (/pokemon|pok[eé]mon/.test(text)) {
    return '<circle cx="318" cy="150" r="88" fill="#fff" stroke="#111827" stroke-width="13"/><path d="M231 150a88 88 0 0 1 176 0z" fill="#ef4444"/><path d="M230 150h176" stroke="#111827" stroke-width="14"/><circle cx="318" cy="150" r="29" fill="#fff" stroke="#111827" stroke-width="12"/><circle cx="318" cy="150" r="10" fill="#111827"/>';
  }
  if (/zelda/.test(text)) {
    return '<path d="M318 45l75 138H243z" fill="#facc15" stroke="#111827" stroke-width="11" stroke-linejoin="round"/><path d="M245 232l73-134 74 134z" fill="#facc15" stroke="#111827" stroke-width="11" stroke-linejoin="round"/><path d="M196 232l73-134 74 134zM293 232l73-134 74 134z" fill="#fde68a" stroke="#111827" stroke-width="10" stroke-linejoin="round"/>';
  }
  if (/bloons|balloon/.test(text)) {
    return '<ellipse cx="263" cy="124" rx="42" ry="55" fill="#ef4444" stroke="#111827" stroke-width="9"/><ellipse cx="326" cy="102" rx="42" ry="55" fill="#2563eb" stroke="#111827" stroke-width="9"/><ellipse cx="377" cy="143" rx="42" ry="55" fill="#22c55e" stroke="#111827" stroke-width="9"/><path d="M263 181c-10 34-21 59-33 75M326 159c-6 38-8 66-6 90M377 200c12 29 24 51 36 67" stroke="#111827" stroke-width="8" stroke-linecap="round"/>';
  }
  if (/baldi|baldy/.test(text)) {
    return '<rect x="238" y="70" width="168" height="150" rx="18" fill="#f8fafc" stroke="#111827" stroke-width="11"/><path d="M270 106h100M270 139h82M270 172h112" stroke="#22c55e" stroke-width="11" stroke-linecap="round"/><rect x="222" y="213" width="197" height="30" rx="10" fill="#facc15" stroke="#111827" stroke-width="9" transform="rotate(-8 320 228)"/>';
  }
  if (/geometry|dash/.test(text)) {
    return '<rect x="255" y="82" width="128" height="128" rx="18" fill="#7c3aed" stroke="#111827" stroke-width="12" transform="rotate(10 319 146)"/><circle cx="296" cy="128" r="13" fill="#fff"/><circle cx="348" cy="128" r="13" fill="#fff"/><path d="M281 168h78" stroke="#fff" stroke-width="12" stroke-linecap="round"/><path d="M213 237l35-59 36 59zM352 237l35-59 36 59z" fill="#facc15" stroke="#111827" stroke-width="9" stroke-linejoin="round"/>';
  }
  if (/duck/.test(text)) {
    return '<ellipse cx="323" cy="160" rx="88" ry="68" fill="#facc15" stroke="#111827" stroke-width="12"/><circle cx="265" cy="109" r="45" fill="#facc15" stroke="#111827" stroke-width="11"/><circle cx="276" cy="99" r="9" fill="#111827"/><path d="M220 122l-58 19 58 21z" fill="#f97316" stroke="#111827" stroke-width="9" stroke-linejoin="round"/><path d="M347 221c14 23 31 33 52 31" stroke="#111827" stroke-width="11" stroke-linecap="round"/>';
  }
  if (/minecraft|noob|miner|dig/.test(text)) {
    return '<rect x="244" y="74" width="150" height="150" rx="14" fill="#22c55e" stroke="#111827" stroke-width="12"/><path d="M244 148h150M319 74v150" stroke="#14532d" stroke-width="12" opacity=".55"/><rect x="271" y="126" width="30" height="28" fill="#111827"/><rect x="336" y="126" width="30" height="28" fill="#111827"/><path d="M279 182h80" stroke="#111827" stroke-width="13" stroke-linecap="round"/><path d="M389 74l51 51" stroke="#f8fafc" stroke-width="18" stroke-linecap="round"/><path d="M410 86l36-36" stroke="#facc15" stroke-width="18" stroke-linecap="round"/>';
  }
  if (/pizza/.test(text)) {
    return '<path d="M241 58l166 62-118 128z" fill="#facc15" stroke="#111827" stroke-width="12" stroke-linejoin="round"/><path d="M241 58c54 8 108 29 166 62" stroke="#f97316" stroke-width="20" stroke-linecap="round"/><circle cx="312" cy="139" r="14" fill="#ef4444"/><circle cx="347" cy="170" r="14" fill="#ef4444"/><circle cx="296" cy="191" r="14" fill="#ef4444"/>';
  }
  if (/plants|zombies/.test(text)) {
    return '<circle cx="276" cy="142" r="60" fill="#22c55e" stroke="#111827" stroke-width="11"/><path d="M252 111c39-50 90-62 155-35-14 62-51 97-110 106" fill="#16a34a" stroke="#111827" stroke-width="9" stroke-linejoin="round"/><circle cx="260" cy="134" r="9" fill="#111827"/><circle cx="297" cy="134" r="9" fill="#111827"/><path d="M279 203v55" stroke="#14532d" stroke-width="16" stroke-linecap="round"/>';
  }
  if (/tetris|2048|sudoku|word|quiz|trivia/.test(text)) {
    return '<rect x="242" y="78" width="56" height="56" rx="9" fill="#ef4444" stroke="#111827" stroke-width="8"/><rect x="298" y="78" width="56" height="56" rx="9" fill="#facc15" stroke="#111827" stroke-width="8"/><rect x="354" y="78" width="56" height="56" rx="9" fill="#22c55e" stroke="#111827" stroke-width="8"/><rect x="298" y="134" width="56" height="56" rx="9" fill="#3b82f6" stroke="#111827" stroke-width="8"/><rect x="298" y="190" width="56" height="56" rx="9" fill="#a855f7" stroke="#111827" stroke-width="8"/>';
  }
  return "";
}

function categoryIcon(category = "", title = "") {
  const text = (category + " " + title).toLowerCase();
  if (/roblox|obby|simulator|blox|brookhaven|steal|brainrot|tycoon/.test(text)) {
    return '<rect x="110" y="82" width="108" height="108" rx="22" fill="#f8fafc" opacity=".95" transform="rotate(-10 164 136)"/><rect x="144" y="115" width="40" height="40" rx="7" fill="#111827" opacity=".78" transform="rotate(-10 164 136)"/><rect x="268" y="92" width="110" height="110" rx="24" fill="#facc15" opacity=".95" transform="rotate(12 323 147)"/><rect x="304" y="128" width="40" height="40" rx="7" fill="#111827" opacity=".78" transform="rotate(12 323 147)"/><path d="M138 256c40-36 79-53 118-50 42 3 78 23 118 50" fill="none" stroke="#f8fafc" stroke-width="22" stroke-linecap="round" opacity=".8"/>';
  }
  if (/racing|driving|car|kart|moto|bike|truck/.test(text)) {
    return '<path d="M135 187h242l38 44v44h-34a45 45 0 0 0-88 0h-74a45 45 0 0 0-88 0H96v-50l39-38z" fill="#111827" opacity=".82"/><circle cx="175" cy="278" r="29" fill="#f8fafc"/><circle cx="337" cy="278" r="29" fill="#f8fafc"/><path d="M171 204h129l30 31H138l33-31z" fill="#38bdf8"/>';
  }
  if (/shoot|gun|sniper|doom|war|battle|combat/.test(text)) {
    return '<circle cx="374" cy="126" r="54" fill="none" stroke="#f8fafc" stroke-width="14" opacity=".75"/><path d="M374 52v148M300 126h148" stroke="#f8fafc" stroke-width="11" opacity=".75"/><path d="M83 244h245l47 34-47 34H83z" fill="#111827" opacity=".82"/><path d="M293 244l42-54h67l-38 72z" fill="#facc15"/>';
  }
  if (/sport|soccer|basket|ball|pool|football|golf/.test(text)) {
    return '<circle cx="350" cy="155" r="72" fill="#f8fafc" opacity=".92"/><path d="M282 155h136M350 87v136M302 108c35 32 61 65 96 93M398 108c-35 32-61 65-96 93" stroke="#111827" stroke-width="10" opacity=".75"/>';
  }
  if (/puzzle|word|trivia|2048|mahjong|tetris|chess/.test(text)) {
    return '<path d="M304 82h70v64h64v70h-64v64h-70v-64h-64v-70h64z" fill="#f8fafc" opacity=".9"/><rect x="88" y="178" width="162" height="118" rx="22" fill="#111827" opacity=".78"/><path d="M110 228h118M110 262h76" stroke="#facc15" stroke-width="13" stroke-linecap="round"/>';
  }
  if (/click|idle|miner|merge/.test(text)) {
    return '<path d="M331 77c48 28 72 77 62 134-10 58-50 94-107 101-58 7-106-18-132-69l61-22c15 28 37 40 67 36 31-4 50-22 56-52 6-31-7-56-36-73z" fill="#f8fafc" opacity=".88"/><path d="M187 282l-55-154 152 58-61 31 54 54-36 36-54-54z" fill="#facc15" stroke="#111827" stroke-width="8" stroke-linejoin="round"/>';
  }
  return '<path d="M158 96l64 64 58-91 53 91 74-58-28 150H129z" fill="#facc15" stroke="#111827" stroke-width="13" stroke-linejoin="round"/><rect x="124" y="249" width="260" height="38" rx="12" fill="#f8fafc" stroke="#111827" stroke-width="10"/>';
}

function svgFor(game) {
  const id = "g" + hash(game.id || game.title);
  const palette = palettes[hash(game.title) % palettes.length];
  const lines = wrapTitle(game.title);
  const baseSize = lines.length === 1 ? 62 : lines.length === 2 ? 47 : 35;
  const logoText = escapeXml(initials(game.title));
  const motif = motifFor(game.title) || categoryIcon(game.category, game.title);
  const lineSvg = lines
    .map((line, index) => {
      const y = 188 + index * (baseSize + 3);
      return `<text x="34" y="${y}" font-size="${baseSize}" font-family="Impact, Arial Black, sans-serif" fill="#fff" stroke="#111827" stroke-width="7" paint-order="stroke" letter-spacing=".5">${escapeXml(line.toUpperCase())}</text>`;
    })
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="288" viewBox="0 0 512 288" role="img" aria-label="${escapeXml(game.title)}">
  <defs>
    <linearGradient id="${id}bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${palette[0]}"/>
      <stop offset=".58" stop-color="${palette[1]}"/>
      <stop offset="1" stop-color="${palette[2]}"/>
    </linearGradient>
    <filter id="${id}shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="12" stdDeviation="9" flood-color="#000" flood-opacity=".38"/>
    </filter>
    <pattern id="${id}dots" width="34" height="34" patternUnits="userSpaceOnUse">
      <circle cx="4" cy="4" r="2" fill="#fff" opacity=".2"/>
    </pattern>
  </defs>
  <rect width="512" height="288" rx="28" fill="url(#${id}bg)"/>
  <rect width="512" height="288" rx="28" fill="url(#${id}dots)" opacity=".7"/>
  <circle cx="430" cy="12" r="138" fill="#fff" opacity=".16"/>
  <circle cx="64" cy="298" r="166" fill="#000" opacity=".2"/>
  <g filter="url(#${id}shadow)" transform="translate(18 -6) scale(.9)">
    ${motif}
  </g>
  <rect x="25" y="24" width="168" height="38" rx="19" fill="#111827" opacity=".86"/>
  <text x="43" y="50" font-size="18" font-family="Arial Black, Arial, sans-serif" fill="#fef3c7" letter-spacing="1.5">CROWN GAMES</text>
  <rect x="32" y="78" width="130" height="72" rx="18" fill="#f8fafc" stroke="#111827" stroke-width="8" opacity=".92"/>
  <text x="97" y="126" text-anchor="middle" font-size="${logoText.length > 2 ? 34 : 42}" font-family="Arial Black, Arial, sans-serif" fill="#111827">${logoText}</text>
  ${lineSvg}
</svg>
`;
}

function refreshAllCovers(games) {
  let updated = 0;
  for (const game of games) {
    if (hasUsableThumbnail(game)) continue;
    const coverPath = path
      .join(
        "assets",
        "thumbs",
        "crown-covers",
        `${slugify(game.title || game.id)}-${hash(game.id || game.title).toString(16)}.svg`
      )
      .replace(/\\/g, "/");
    const file = path.join(root, coverPath);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, svgFor(game));
    game.thumbnail = coverPath;
    game.thumbnailSource = "crown";
    updated++;
  }
  return updated;
}

const games = loadGames();
const { games: deduped, removed } = dedupe(games);
const updatedCovers = refreshAllCovers(deduped);
writeGames(deduped);
console.log(JSON.stringify({ before: games.length, after: deduped.length, removed: removed.length, updatedCovers }, null, 2));
