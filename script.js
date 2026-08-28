function isIpadReadyGame(game) {
  return Boolean(
    game.playable &&
      game.mobileReady !== false &&
      !game.unsupportedReason &&
      game.embedType === "html" &&
      game.embedPath
  );
}

function isRobloxStyleGame(game) {
  return /roblox|obby|minecraft|eagler|noob|block|parkour|monster school|herobrine|mine/i.test(
    [game.title, game.category, ...(game.tags || [])].join(" ")
  );
}

const rawGameCatalog = window.CROWN_GAMES || [];
const fullGameCatalog = rawGameCatalog.filter((game) => game.playable && (game.embedPath || game.embedUrl));
const hiddenGameIds = new Set(
  rawGameCatalog
    .filter((game) => game.mobileReady === false || game.unsupportedReason)
    .map((game) => game.id)
);
fullGameCatalog.filter((game) => !isIpadReadyGame(game)).forEach((game) => hiddenGameIds.add(game.id));
const hiddenExternalCount = hiddenGameIds.size;
const allGames = fullGameCatalog.filter(isIpadReadyGame);
const FAVORITES_KEY = "crownFavoritesV1";
const THUMB_VERSION = "20260518-mobile-final";
const APPLE_TOUCH_DEVICE = /iPad|iPhone|iPod/i.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const LAUNCH_FADE_MS = APPLE_TOUCH_DEVICE ? 180 : 360;
const hotSearches = [
  "Roblox",
  "Slope",
  "Moto X3M",
  "Subway Surfers",
  "FNAF",
  "Basketball",
  "Minecraft",
  "2 Player",
  "Driving",
  "Clicker",
];
const CUSTOM_APPS_KEY = "crownCustomAppsV1";
const fallbackCrownApps = [
  {
    id: "create",
    title: "Create an App",
    description: "Make your own Crown app shortcut on this device.",
    icon: "+",
  },
  {
    id: "notes",
    title: "Notes",
    description: "A quick saved notes pad.",
    icon: "N",
  },
  {
    id: "calculator",
    title: "Calculator",
    description: "Simple calculator for fast math.",
    icon: "C",
  },
  {
    id: "draw",
    title: "Draw",
    description: "Sketch pad with touch support.",
    icon: "D",
  },
  {
    id: "timer",
    title: "Timer",
    description: "Stopwatch and timer controls.",
    icon: "T",
  },
  {
    id: "checklist",
    title: "Checklist",
    description: "Save small task lists locally.",
    icon: "L",
  },
];

const categoryPriority = [
  "All",
  "Favorites",
  "2 Player",
  "3D",
  "Action",
  "Adventure",
  "Roblox-Style",
  "Racing",
  "Puzzle",
  "Shooting",
  "Sports",
  "Skill",
  "Multiplayer",
  "Bonus Games",
  "Games",
];
let activeCategory = "All";
const MIN_CATEGORY_SECTION_SIZE = 10;
let favoriteIds = loadFavorites();

const $ = (selector) => document.querySelector(selector);

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (ch) => {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    }[ch];
  });
}

function versionedAsset(url = "") {
  if (!url || /^(?:https?:|data:|blob:)/i.test(url)) return url;
  return url + (url.includes("?") ? "&" : "?") + "v=" + THUMB_VERSION;
}

function sourceLabel() {
  return "Crown";
}

function displayCategory(category = "") {
  return category;
}

function loadFavorites() {
  try {
    return new Set(JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]"));
  } catch (error) {
    return new Set();
  }
}

function saveFavorites() {
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify([...favoriteIds]));
  } catch (error) {}
}

function favoriteCount() {
  return allGames.filter((game) => favoriteIds.has(game.id)).length;
}

function updateFavoriteNavCount() {
  const badge = document.querySelector('[data-cat="Favorites"] small');
  if (badge) badge.textContent = favoriteCount();
}

function toggleFavorite(id) {
  if (favoriteIds.has(id)) {
    favoriteIds.delete(id);
  } else {
    favoriteIds.add(id);
  }
  saveFavorites();
  render();
}

function logoFallback(title = "") {
  const words = String(title).replace(/[^a-z0-9 ]/gi, " ").trim().split(/\s+/).filter(Boolean);
  const initial = escapeHtml(
    (words.length > 1 ? words.slice(0, 3).map((word) => word[0]).join("") : (words[0] || "C").slice(0, 3)).toUpperCase()
  );
  const label = escapeHtml(title);
  return (
    '<span class="thumb-fallback" aria-hidden="true">' +
    "<b>" +
    initial +
    "</b><em>" +
    label +
    "</em></span>"
  );
}

function favoriteButton(game) {
  const pressed = favoriteIds.has(game.id);
  return (
    '<button class="favorite-button" type="button" data-fav-id="' +
    escapeHtml(game.id) +
    '" aria-pressed="' +
    (pressed ? "true" : "false") +
    '" aria-label="' +
    escapeHtml((pressed ? "Remove " : "Add ") + game.title + (pressed ? " from favorites" : " to favorites")) +
    '"><span>&#9733;</span></button>'
  );
}

function loadCustomApps() {
  try {
    const apps = JSON.parse(localStorage.getItem(CUSTOM_APPS_KEY) || "[]");
    return Array.isArray(apps) ? apps : [];
  } catch (error) {
    return [];
  }
}

function appSearchText(app) {
  return [app.title, app.description, app.status, ...(app.categories || [])].join(" ").toLowerCase();
}

function appCard(app) {
  const title = escapeHtml(app.title || "Crown App");
  const description = escapeHtml(app.description || "Saved Crown app.");
  const status = escapeHtml(app.status || "WIP");
  const icon = escapeHtml(String(app.icon || title.slice(0, 1) || "C").slice(0, 2).toUpperCase());
  const logo = app.logo ? versionedAsset(app.logo) : "";
  const appId = encodeURIComponent(app.id || app.title || "create");
  const colors = app.colors || ["#8b5cf6", "#ffd447"];
  const style =
    "--app-color-a:" + escapeHtml(colors[0]) + ";--app-color-b:" + escapeHtml(colors[1] || colors[0]) + ";";
  return (
    '<a class="app-card" style="' +
    style +
    '" href="apps/app.html?app=' +
    appId +
    '">' +
    '<span class="app-icon">' +
    (logo ? '<img class="app-logo" src="' + escapeHtml(logo) + '" alt="" loading="lazy" decoding="async">' : icon) +
    "</span><span><strong>" +
    title +
    '</strong><span class="app-status">' +
    status +
    "</span><small>" +
    description +
    "</small></span></a>"
  );
}

function renderApps(query = "") {
  const holder = $("#appsGrid");
  if (!holder) return;
  const section = $("#appsSection");
  const catalogApps = Array.isArray(window.CROWN_APPS) ? window.CROWN_APPS : fallbackCrownApps;
  const allApps = [...catalogApps, ...loadCustomApps()];
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) {
    holder.innerHTML = "";
    if (section) section.hidden = true;
    return;
  }
  const matches = allApps.filter((app) => appSearchText(app).includes(trimmed));
  if (section) section.hidden = !matches.length;
  holder.innerHTML = matches.map(appCard).join("");
}

function card(game, index = 0) {
  const href = "play.html?id=" + encodeURIComponent(game.id);
  const title = escapeHtml(game.title);
  const thumb = game.thumbnail || "";
  const thumbSrc = versionedAsset(thumb);
  const eager = index < 18;
  const img = thumb
    ? '<img class="thumb" loading="' +
      (eager ? "eager" : "lazy") +
      '" decoding="async" src="' +
      escapeHtml(thumbSrc) +
      '" alt="' +
      title +
      ' cover"' +
      ' onerror="this.remove()"'+
      (eager ? ' fetchpriority="high"' : "") +
      ">"
    : "";

  return (
    '<article class="card' +
    (favoriteIds.has(game.id) ? " is-favorite" : "") +
    '" data-category="' +
    escapeHtml(displayCategory(game.category)) +
    '">' +
    favoriteButton(game) +
    '<a class="card-link" href="' +
    href +
    '" data-game-id="' +
    escapeHtml(game.id) +
    '" data-game-title="' +
    title +
    '" data-game-thumbnail="' +
    escapeHtml(thumbSrc) +
    '">' +
    '<span class="thumb-wrap">' +
    img +
    logoFallback(game.title) +
    "</span>" +
    '<span class="card-title">' +
    title +
    "</span>" +
    '<span class="card-meta"><span>' +
    escapeHtml(displayCategory(game.category)) +
    '</span><b>' +
    sourceLabel(game) +
    "</b></span></a></article>"
  );
}

function showLaunchLoader(link) {
  const loader = document.getElementById("launchLoader");
  if (!loader) return false;
  const icon = document.getElementById("launchLoaderIcon");
  const title = document.getElementById("launchLoaderTitle");
  const fallback = versionedAsset("assets/crown-logo.svg");
  if (icon) icon.src = fallback;
  if (title) title.textContent = link.dataset.gameTitle || "Loading Crown Game";
  loader.removeAttribute("hidden");
  requestAnimationFrame(() => loader.classList.add("is-active"));
  return true;
}

function blockExternalNavigation(event) {
  const link = event.target.closest?.("a[href]");
  if (!link) return;
  const url = new URL(link.getAttribute("href"), location.href);
  if (url.origin === location.origin && !url.protocol.startsWith("javascript")) return;
  event.preventDefault();
  event.stopPropagation();
}

function searchableText(game) {
  return [game.title, displayCategory(game.category), ...(game.tags || [])].join(" ").toLowerCase();
}

function categoryMatches(game) {
  if (activeCategory === "All") return true;
  if (activeCategory === "Favorites") return favoriteIds.has(game.id);
  return game.category === activeCategory;
}

function filteredGames() {
  const query = $("#search").value.trim().toLowerCase();
  return allGames.filter((game) => {
    const searchMatches = !query || searchableText(game).includes(query);
    return categoryMatches(game) && searchMatches;
  });
}

function currentQuery() {
  return $("#search").value.trim();
}

function emptyMessage() {
  if (activeCategory === "Favorites" && !currentQuery()) {
    return "No favorites yet. Hit the star on games you want to save.";
  }
  return "No games found. Try another search or category.";
}

function renderGrid(element, list, limit = list.length) {
  const slice = list.slice(0, limit);
  element.innerHTML = slice.length
    ? slice.map((game, index) => card(game, index)).join("")
    : '<div class="empty">' + escapeHtml(emptyMessage()) + "</div>";
}

function render() {
  const query = currentQuery();
  const list = filteredGames();
  const isFiltering = Boolean(query) || activeCategory !== "All";
  const featured = list.slice(0, 24);
  const fresh = [...list].reverse().slice(0, 24);

  document.body.classList.toggle("is-filtering", isFiltering);
  if (!isFiltering) {
    renderGrid($("#trendingGrid"), featured);
    renderGrid($("#latestGrid"), fresh);
  }
  renderGrid($("#allGrid"), list);
  renderApps(query);

  $("#resultsTitle").textContent = isFiltering
    ? query
      ? 'Search Results for "' + query + '"'
      : displayCategory(activeCategory)
    : "All Games";
  $("#gameCount").textContent = allGames.length;
  $("#search").placeholder = "Search " + allGames.length + " games...";
  const modeNote = $("#modeNote");
  if (modeNote) {
    modeNote.textContent =
      hiddenExternalCount > 0
        ? hiddenExternalCount + " remote-only games are hidden until they have Crown-local launch files."
        : "All Crown games are loading from Crown-local launch files.";
  }
  updateFavoriteNavCount();
}

function buildTrendChips() {
  const holder = $("#trendChips");
  if (!holder) return;
  holder.innerHTML = hotSearches
    .map((term) => '<button type="button" data-search="' + escapeHtml(term) + '">' + escapeHtml(term) + "</button>")
    .join("");
  holder.addEventListener("click", (event) => {
    const chip = event.target.closest("button[data-search]");
    if (!chip) return;
    $("#search").value = chip.dataset.search;
    if (activeCategory !== "All") activeCategory = "All";
    document
      .querySelectorAll(".nav button")
      .forEach((item) => item.classList.toggle("active", item.dataset.cat === activeCategory));
    render();
    document.getElementById("allGamesSection")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function buildHeroGallery() {
  const tracks = document.querySelectorAll(".hero-track");
  if (!tracks.length) return;
  const picks = allGames
    .filter((game) => game.thumbnail)
    .slice(0, 36);
  tracks.forEach((track, trackIndex) => {
    const offset = trackIndex * 8;
    const list = [...picks.slice(offset, offset + 10), ...picks.slice(offset, offset + 10)];
    track.innerHTML = list
      .map((game) => {
        const href = "play.html?id=" + encodeURIComponent(game.id);
        return (
          '<a href="' +
          href +
          '" class="hero-tile" aria-label="' +
          escapeHtml(game.title) +
          '">' +
          '<img src="' +
          escapeHtml(versionedAsset(game.thumbnail)) +
          '" alt="" loading="eager" decoding="async">' +
          "</a>"
        );
      })
      .join("");
  });
}

function categoryCount(category) {
  if (category === "All") return allGames.length;
  if (category === "Favorites") return favoriteCount();
  return allGames.filter((game) => game.category === category).length;
}

function buildNav() {
  const available = [...new Set(allGames.map((game) => game.category))].filter(
    (category) => categoryCount(category) >= MIN_CATEGORY_SECTION_SIZE
  );
  const priority = categoryPriority.filter(
    (category) => category === "All" || category === "Favorites" || available.includes(category)
  );
  const remaining = available
    .filter((category) => !priority.includes(category))
    .sort((a, b) => a.localeCompare(b));
  const categories = [...priority, ...remaining];

  $("#categoryNav").innerHTML = categories
    .map((category) => {
      return (
        '<button type="button" data-cat="' +
        escapeHtml(category) +
        '"><span>' +
        escapeHtml(displayCategory(category).replace(/ Games$/, "")) +
        "</span><small>" +
        categoryCount(category) +
        "</small></button>"
      );
    })
    .join("");

  $("#categoryNav").addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    setActiveCategory(button.dataset.cat, true);
  });

  $("#categoryNav button")?.classList.add("active");
}

function setActiveCategory(category, shouldScroll = false) {
  activeCategory = category;
  document
    .querySelectorAll(".nav button")
    .forEach((item) => item.classList.toggle("active", item.dataset.cat === activeCategory));
  render();
  if (shouldScroll) {
    document.getElementById("allGamesSection")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }
}

document.addEventListener(
  "error",
  (event) => {
    if (!event.target.matches?.(".thumb")) return;
    event.target.closest(".thumb-wrap")?.classList.add("thumb-missing");
    event.target.remove();
  },
  true
);

document.addEventListener("click", (event) => {
  const button = event.target.closest(".favorite-button");
  if (!button) return;
  event.preventDefault();
  event.stopPropagation();
  toggleFavorite(button.dataset.favId);
});

document.addEventListener("click", (event) => {
  const link = event.target.closest(".card-link, .hero-tile");
  if (!link || event.defaultPrevented) return;
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  showLaunchLoader(link);
  window.setTimeout(() => {
    window.location.href = link.href;
  }, LAUNCH_FADE_MS);
});

document.addEventListener("click", blockExternalNavigation, true);

$("#search").addEventListener("input", () => {
  if (activeCategory !== "All") {
    setActiveCategory("All");
    return;
  }
  render();
});

buildTrendChips();
buildHeroGallery();
buildNav();
render();
