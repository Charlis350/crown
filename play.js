function isIpadReadyGame(entry) {
  return Boolean(
    entry.playable &&
      entry.mobileReady !== false &&
      !entry.unsupportedReason &&
      entry.embedType === "html" &&
      entry.embedPath
  );
}

const games = (window.CROWN_GAMES || []).filter(isIpadReadyGame);
const FAVORITES_KEY = "crownFavoritesV1";
const THUMB_VERSION = "20260518-mobile-final";
const APPLE_TOUCH_DEVICE = /iPad|iPhone|iPod/i.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const MIN_LOADER_MS = 3500;
const LOADER_FADE_MS = APPLE_TOUCH_DEVICE ? 320 : 440;
const SLOW_LOAD_MS = APPLE_TOUCH_DEVICE ? 4200 : 6500;
const params = new URLSearchParams(location.search);
const id = params.get("id");
const game = games.find((entry) => entry.id === id);
const player = document.getElementById("player");
const playerShell = document.querySelector(".player-shell");
const fitToggle = document.getElementById("fitToggle");
const favoriteToggle = document.getElementById("favoriteToggle");
const reloadGame = document.getElementById("reloadGame");
const fullscreenToggle = document.getElementById("fullscreenToggle");
const gameLoader = document.getElementById("gameLoader");
const loaderIcon = document.getElementById("loaderIcon");
const loaderTitle = document.getElementById("loaderTitle");
const mobileQuery = window.matchMedia("(max-width: 820px), (pointer: coarse)");
const frameAllow =
  "autoplay; fullscreen; gamepad; pointer-lock; accelerometer; gyroscope; magnetometer; xr-spatial-tracking";

let activeFrame = null;
let activeSrc = "";
let loadSlowTimer = 0;
let loaderFallbackTimer = 0;
let loaderLeaveTimer = 0;
let loaderRemoveTimer = 0;
let loaderAutoHideTimer = 0;
let loaderShownAt = 0;
let favoriteIds = loadFavorites();
let browserFullscreenFallback = false;

document.getElementById("playTitle").textContent = game ? game.title : "Game not found";
document.getElementById("playMeta").textContent = game
  ? displayCategory(game.category) + " | " + sourceLabel(game)
  : "Pick a game from the main page";
document.title = game ? game.title + " - Crown Games" : "Play - Crown Games";

loaderIcon.src = versionedAsset("assets/crown-logo.svg");
loaderIcon.alt = "";
loaderTitle.textContent = "Crown Games";

function blockExternalNavigation(event) {
  const link = event.target.closest?.("a[href]");
  if (!link) return;
  const url = new URL(link.getAttribute("href"), location.href);
  if (url.origin === location.origin && !url.protocol.startsWith("javascript")) return;
  event.preventDefault();
  event.stopPropagation();
}

function sourceLabel() {
  return "Crown Player";
}

function displayCategory(category = "") {
  return category;
}

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

function updateFavoriteButton() {
  if (!game) {
    favoriteToggle.disabled = true;
    favoriteToggle.textContent = "Favorite";
    return;
  }
  const isFavorite = favoriteIds.has(game.id);
  favoriteToggle.textContent = isFavorite ? "Favorited" : "Favorite";
  favoriteToggle.setAttribute("aria-pressed", String(isFavorite));
  favoriteToggle.setAttribute(
    "aria-label",
    (isFavorite ? "Remove " : "Add ") + game.title + (isFavorite ? " from favorites" : " to favorites")
  );
}

function toggleFavorite() {
  if (!game) return;
  if (favoriteIds.has(game.id)) {
    favoriteIds.delete(game.id);
  } else {
    favoriteIds.add(game.id);
  }
  saveFavorites();
  updateFavoriteButton();
}

function showLoader() {
  window.clearTimeout(loaderFallbackTimer);
  window.clearTimeout(loaderLeaveTimer);
  window.clearTimeout(loaderRemoveTimer);
  window.clearTimeout(loaderAutoHideTimer);
  loaderShownAt = performance.now();
  gameLoader.hidden = false;
  gameLoader.classList.remove("is-leaving");
  gameLoader.classList.add("is-active");
  player.setAttribute("aria-busy", "true");
  loaderAutoHideTimer = window.setTimeout(() => hideLoader(0), SLOW_LOAD_MS + 2400);
}

function hideLoader(delay = 0) {
  window.clearTimeout(loaderFallbackTimer);
  window.clearTimeout(loaderLeaveTimer);
  window.clearTimeout(loaderRemoveTimer);
  window.clearTimeout(loaderAutoHideTimer);
  const remaining = Math.max(0, MIN_LOADER_MS - (performance.now() - loaderShownAt));
  const wait = Math.max(delay, remaining);
  loaderLeaveTimer = window.setTimeout(() => {
    gameLoader.classList.add("is-leaving");
    loaderRemoveTimer = window.setTimeout(() => {
      gameLoader.classList.remove("is-active", "is-leaving");
      gameLoader.hidden = true;
      player.removeAttribute("aria-busy");
    }, LOADER_FADE_MS);
  }, wait);
}

function armLoaderFallback() {
  window.clearTimeout(loaderFallbackTimer);
  loaderFallbackTimer = window.setTimeout(() => {
    player.classList.add("load-slow");
  }, SLOW_LOAD_MS);
}

function notice(message) {
  activeFrame = null;
  activeSrc = "";
  player.innerHTML = '<div class="notice">' + message + "</div>";
  hideLoader(150);
}

function setViewportHeight() {
  const height = window.visualViewport?.height || window.innerHeight;
  const playbar = document.querySelector(".playbar");
  document.documentElement.style.setProperty("--app-height", height + "px");
  if (playbar) {
    document.documentElement.style.setProperty(
      "--actual-playbar-height",
      Math.ceil(playbar.getBoundingClientRect().height) + "px"
    );
  }
}

function setPlayerMode(fill) {
  player.classList.toggle("fill-mode", fill);
  player.classList.toggle("fit-mode", !fill);
  fitToggle.textContent = fill ? "Fit" : "Fill";
  fitToggle.setAttribute("aria-pressed", String(fill));
}

function preferredFillMode(settings = window.CrownSettings?.get?.()) {
  if (settings?.playerMode === "fill") return true;
  if (settings?.playerMode === "fit") return false;
  return mobileQuery.matches;
}

function reloadFrame(iframe, src) {
  showLoader();
  armLoaderFallback();
  iframe.src = "about:blank";
  window.setTimeout(() => {
    iframe.src = src;
  }, 80);
}

function frameStayedOnCrown(iframe, src) {
  try {
    const href = iframe.contentWindow?.location?.href || "";
    if (!href || href === "about:blank") return true;
    const current = new URL(href, location.href);
    const expected = new URL(src, location.href);
    return current.origin === location.origin && current.pathname.startsWith(expected.pathname.replace(/\/[^/]*$/, "/"));
  } catch (error) {
    return false;
  }
}

function frame(src) {
  let loaded = false;
  const iframe = document.createElement("iframe");
  const hint = document.createElement("div");
  const reload = document.createElement("button");

  activeFrame = iframe;
  activeSrc = src;

  iframe.className = "game-frame";
  iframe.title = game ? game.title : "Crown game";
  iframe.allow = frameAllow;
  iframe.allowFullscreen = true;
  iframe.loading = "eager";
  iframe.referrerPolicy = /^https?:/i.test(src) ? "origin" : "no-referrer-when-downgrade";
  iframe.sandbox =
    "allow-scripts allow-same-origin allow-forms allow-pointer-lock allow-orientation-lock allow-presentation";
  iframe.setAttribute("allowfullscreen", "");
  iframe.setAttribute("webkitallowfullscreen", "");
  iframe.setAttribute("mozallowfullscreen", "");
  iframe.setAttribute("scrolling", "no");
  iframe.setAttribute("fetchpriority", "high");
  iframe.setAttribute("importance", "high");

  hint.className = "loading-hint";
  hint.innerHTML =
    "<strong>Still loading?</strong><span>" +
    (APPLE_TOUCH_DEVICE
      ? "Tap Reload once if the screen stays blank; some games need a second pass on mobile."
      : "Tap Reload once if the screen stays blank.") +
    "</span>";
  reload.type = "button";
  reload.textContent = "Reload game";
  reload.addEventListener("click", () => reloadFrame(iframe, src));
  hint.appendChild(reload);

  iframe.addEventListener("load", () => {
    if (iframe.getAttribute("src") === "about:blank") return;
    if (!frameStayedOnCrown(iframe, src)) {
      reloadFrame(iframe, src);
      return;
    }
    loaded = true;
    player.classList.remove("load-slow");
    hideLoader(120);
  });

  window.clearTimeout(loadSlowTimer);
  player.classList.remove("load-slow");
  player.replaceChildren(iframe, hint);

  loadSlowTimer = window.setTimeout(() => {
    if (!loaded) player.classList.add("load-slow");
  }, SLOW_LOAD_MS + 2800);

  armLoaderFallback();
  iframe.src = src;
}

function loadCurrentGame() {
  showLoader();
  window.clearTimeout(loadSlowTimer);
  player.classList.remove("load-slow");

  if (!game) {
    notice('Game not found. <a href="index.html">Back to Crown Games</a>');
  } else if (game.embedType === "html" && game.embedPath) {
    frame(game.embedPath);
  } else if (game.embedUrl) {
    notice(
      'This game still needs a Crown-local iPad build before it can run here. <a href="index.html">Back to Crown Games</a>'
    );
  } else {
    notice('This game does not have a usable embed. <a href="index.html">Back to Crown Games</a>');
  }
}

function reloadCurrentGame() {
  if (!game) return;
  if (activeFrame?.tagName === "IFRAME" && activeSrc) {
    reloadFrame(activeFrame, activeSrc);
    return;
  }
  loadCurrentGame();
}

function fullscreenActive() {
  return Boolean(document.fullscreenElement || browserFullscreenFallback);
}

function updateFullscreenButton() {
  fullscreenToggle.textContent = fullscreenActive() ? "Exit Full" : "Fullscreen";
  fullscreenToggle.setAttribute("aria-pressed", String(fullscreenActive()));
}

async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      browserFullscreenFallback = false;
    } else if (document.documentElement.requestFullscreen) {
      await document.documentElement.requestFullscreen();
    } else {
      browserFullscreenFallback = !browserFullscreenFallback;
      document.body.classList.toggle("browser-fullscreen", browserFullscreenFallback);
    }
  } catch (error) {
    browserFullscreenFallback = !browserFullscreenFallback;
    document.body.classList.toggle("browser-fullscreen", browserFullscreenFallback);
  }
  updateFullscreenButton();
}

fitToggle.addEventListener("click", () => {
  const fill = !player.classList.contains("fill-mode");
  setPlayerMode(fill);
  window.CrownSettings?.set?.("playerMode", fill ? "fill" : "fit");
});
favoriteToggle.addEventListener("click", toggleFavorite);
reloadGame.addEventListener("click", reloadCurrentGame);
fullscreenToggle.addEventListener("click", toggleFullscreen);
document.addEventListener("click", blockExternalNavigation, true);
document.addEventListener("fullscreenchange", () => {
  browserFullscreenFallback = false;
  document.body.classList.remove("browser-fullscreen");
  updateFullscreenButton();
});
window.addEventListener("crown-settings-change", (event) => {
  setPlayerMode(preferredFillMode(event.detail));
});

try {
  setViewportHeight();
  window.addEventListener("resize", setViewportHeight);
  window.visualViewport?.addEventListener("resize", setViewportHeight);
  window.visualViewport?.addEventListener("scroll", setViewportHeight);
  setPlayerMode(preferredFillMode());
  updateFavoriteButton();
  updateFullscreenButton();
  reloadGame.disabled = !game;
  fullscreenToggle.disabled = !game;
  loadCurrentGame();
} catch (error) {
  notice('The game hit a load error. <a href="index.html">Back to Crown Games</a>');
}
