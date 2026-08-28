const CROWN_SETTINGS_KEY = "crownSettingsV1";

const defaultCrownSettings = {
  theme: "classic",
  density: "comfortable",
  motion: "on",
  playerMode: "auto",
};

const settingGroups = [
  {
    id: "theme",
    title: "Atmosphere",
    help: "Adds a background effect without changing the layout.",
    options: [
      ["classic", "Crown Edition", "Clean dark Crown background."],
      ["snow", "Snowfall", "Adds falling snow over the same site."],
      ["rain", "Rain Loop", "Adds a rain overlay over the same site."],
      ["neon", "Neon Arcade", "Adds an arcade glow over the same site."],
      ["sunset", "Sunset", "Adds a warm haze over the same site."],
    ],
  },
  {
    id: "density",
    title: "Game Grid",
    help: "Controls how many games fit on screen.",
    options: [
      ["comfortable", "Comfortable", "Bigger cards and more breathing room."],
      ["compact", "Compact", "More games visible at once."],
    ],
  },
  {
    id: "motion",
    title: "Weather Motion",
    help: "Turns animated effects on or off.",
    options: [
      ["on", "On", "Snow, rain, and smooth fades."],
      ["calm", "Calm", "Keeps themes but reduces movement."],
    ],
  },
  {
    id: "playerMode",
    title: "Game Screen",
    help: "Default sizing when a game opens.",
    options: [
      ["auto", "Auto", "Fill on mobile, fit on desktop."],
      ["fit", "Fit", "Keeps most games from stretching."],
      ["fill", "Fill", "Uses the full player area."],
    ],
  },
];

function loadCrownSettings() {
  try {
    return {
      ...defaultCrownSettings,
      ...JSON.parse(localStorage.getItem(CROWN_SETTINGS_KEY) || "{}"),
    };
  } catch (error) {
    return { ...defaultCrownSettings };
  }
}

let crownSettings = loadCrownSettings();

function saveCrownSettings() {
  try {
    localStorage.setItem(CROWN_SETTINGS_KEY, JSON.stringify(crownSettings));
  } catch (error) {}
}

function applyCrownSettings() {
  const root = document.documentElement;
  root.dataset.theme = "classic";
  root.dataset.atmosphere = crownSettings.theme;
  root.dataset.density = crownSettings.density;
  root.dataset.motion = crownSettings.motion;
  root.dataset.playerMode = crownSettings.playerMode;
  const rainVideo = document.querySelector(".rain-video");
  if (rainVideo) {
    if (crownSettings.theme === "rain") {
      rainVideo.play?.().catch(() => {});
    } else {
      rainVideo.pause?.();
    }
  }
}

function setCrownSetting(key, value) {
  crownSettings = { ...crownSettings, [key]: value };
  saveCrownSettings();
  applyCrownSettings();
  syncSettingsPanel();
  window.dispatchEvent(new CustomEvent("crown-settings-change", { detail: { ...crownSettings } }));
}

function settingsOptionButton(group, option) {
  const [value, label, description] = option;
  const active = crownSettings[group.id] === value;
  return (
    '<button class="setting-choice' +
    (active ? " active" : "") +
    '" type="button" data-setting="' +
    group.id +
    '" data-value="' +
    value +
    '" aria-pressed="' +
    String(active) +
    '"><strong>' +
    label +
    "</strong><span>" +
    description +
    "</span></button>"
  );
}

function settingsGroup(group) {
  return (
    '<section class="setting-group"><div><h3>' +
    group.title +
    "</h3><p>" +
    group.help +
    '</p></div><div class="setting-options">' +
    group.options.map((option) => settingsOptionButton(group, option)).join("") +
    "</div></section>"
  );
}

function createSettingsPanel() {
  if (document.getElementById("settingsPanel")) return;
  createWeatherLayers();
  const panel = document.createElement("div");
  panel.id = "settingsPanel";
  panel.className = "settings-panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "true");
  panel.setAttribute("aria-labelledby", "settingsTitle");
  panel.setAttribute("hidden", "");
  panel.innerHTML =
    '<div class="settings-backdrop" data-close-settings></div>' +
    '<div class="settings-card"><header><div><p class="eyebrow">Crown Control</p><h2 id="settingsTitle">Settings</h2></div>' +
    '<button class="settings-close" type="button" data-close-settings aria-label="Close settings">Close</button></header>' +
    '<div class="settings-list">' +
    settingGroups.map(settingsGroup).join("") +
    '</div><footer><button id="resetSettings" type="button">Reset Settings</button><span>Saved on this browser.</span></footer></div>';
  document.body.appendChild(panel);
}

function createWeatherLayers() {
  if (document.getElementById("themeWeather")) return;
  const weather = document.createElement("div");
  weather.id = "themeWeather";
  weather.className = "theme-weather";
  weather.setAttribute("aria-hidden", "true");
  weather.innerHTML =
    '<div class="snow-field snow-field-a"></div>' +
    '<div class="snow-field snow-field-b"></div>' +
    '<video class="rain-video" muted loop autoplay playsinline preload="auto" src="assets/rain-loop.webm"></video>' +
    '<div class="neon-grid"></div>' +
    '<div class="sunset-haze"></div>';
  document.body.prepend(weather);
  applyCrownSettings();
}

function syncSettingsPanel() {
  document.querySelectorAll(".setting-choice").forEach((button) => {
    const active = crownSettings[button.dataset.setting] === button.dataset.value;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function openSettings() {
  createSettingsPanel();
  const panel = document.getElementById("settingsPanel");
  panel.removeAttribute("hidden");
  document.body.classList.add("settings-open");
  syncSettingsPanel();
  panel.querySelector(".settings-close")?.focus();
}

function closeSettings() {
  const panel = document.getElementById("settingsPanel");
  if (!panel) return;
  panel.setAttribute("hidden", "");
  document.body.classList.remove("settings-open");
  document.getElementById("settingsButton")?.focus();
}

function bindSettingsUi() {
  createSettingsPanel();
  document.getElementById("settingsButton")?.addEventListener("click", openSettings);
  document.addEventListener("click", (event) => {
    const choice = event.target.closest(".setting-choice");
    if (choice) {
      setCrownSetting(choice.dataset.setting, choice.dataset.value);
      return;
    }
    if (event.target.closest("[data-close-settings]")) closeSettings();
  });
  document.getElementById("resetSettings")?.addEventListener("click", () => {
    crownSettings = { ...defaultCrownSettings };
    saveCrownSettings();
    applyCrownSettings();
    syncSettingsPanel();
    window.dispatchEvent(new CustomEvent("crown-settings-change", { detail: { ...crownSettings } }));
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeSettings();
  });
}

window.CrownSettings = {
  get: () => ({ ...crownSettings }),
  set: setCrownSetting,
  apply: applyCrownSettings,
};

applyCrownSettings();
bindSettingsUi();
