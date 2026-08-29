/* crown-sidebar.js — Slide-in sidebar for Crown Games
   Sections: Favorites ⭐ / Quick Actions ⚡ / Bonus Games 🎁  */

(function () {
  'use strict';

  const FAVORITES_KEY = 'crownFavoritesV1';
  const THUMB_VERSION = '20260518-mobile-final';

  // ── DOM refs ──────────────────────────────────────────────
  const toggleBtn   = document.getElementById('crownSidebarToggle');
  const sidebar     = document.getElementById('crownSidebar');
  const backdrop    = document.getElementById('crownSidebarBackdrop');
  const closeBtn    = document.getElementById('crownSidebarClose');
  const favList     = document.getElementById('sidebarFavList');
  const bonusList   = document.getElementById('sidebarBonusList');

  if (!toggleBtn || !sidebar) return; // guard

  // ── Open / close ──────────────────────────────────────────
  function openSidebar() {
    document.body.classList.add('sidebar-open');
    sidebar.setAttribute('aria-hidden', 'false');
    toggleBtn.setAttribute('aria-expanded', 'true');
    populateFavorites();
    closeBtn.focus();
  }

  function closeSidebar() {
    document.body.classList.remove('sidebar-open');
    sidebar.setAttribute('aria-hidden', 'true');
    toggleBtn.setAttribute('aria-expanded', 'false');
    toggleBtn.focus();
  }

  toggleBtn.addEventListener('click', () => {
    const isOpen = document.body.classList.contains('sidebar-open');
    isOpen ? closeSidebar() : openSidebar();
  });

  closeBtn.addEventListener('click', closeSidebar);
  backdrop.addEventListener('click', closeSidebar);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.body.classList.contains('sidebar-open')) {
      closeSidebar();
    }
  });

  // ── Helpers ───────────────────────────────────────────────
  function loadFavorites() {
    try {
      return new Set(JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]'));
    } catch (_) {
      return new Set();
    }
  }

  function saveFavorites(set) {
    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify([...set]));
    } catch (_) {}
  }

  function getAllGames() {
    const raw = window.CROWN_GAMES || [];
    return raw.filter(g =>
      g.playable &&
      g.mobileReady !== false &&
      !g.unsupportedReason &&
      g.embedType === 'html' &&
      g.embedPath
    );
  }

  function thumbSrc(game) {
    if (!game.thumbnail) return '';
    const t = game.thumbnail;
    if (/^https?:/i.test(t)) return t;
    return t + (t.includes('?') ? '&' : '?') + 'v=' + THUMB_VERSION;
  }

  function playHref(game) {
    return 'play.html?id=' + encodeURIComponent(game.id);
  }

  // ── Populate favorites ────────────────────────────────────
  function populateFavorites() {
    if (!favList) return;
    const favIds = loadFavorites();
    const all    = getAllGames();
    const favs   = all.filter(g => favIds.has(g.id));

    if (favs.length === 0) {
      favList.innerHTML = '<p class="sidebar-fav-empty">Star a game to save it here.</p>';
      return;
    }

    favList.innerHTML = favs.slice(0, 20).map(g => {
      const thumb = thumbSrc(g);
      const img   = thumb
        ? `<img class="sidebar-fav-thumb" src="${thumb}" alt="" loading="lazy">`
        : `<span class="sidebar-fav-thumb" style="display:flex;align-items:center;justify-content:center;font-size:18px;">🎮</span>`;
      return `
        <a class="sidebar-fav-row" href="${playHref(g)}">
          ${img}
          <span class="sidebar-fav-name">${escHtml(g.title)}</span>
        </a>`;
    }).join('');
  }

  // ── Populate bonus games ──────────────────────────────────
  function populateBonusGames() {
    if (!bonusList) return;
    const all = getAllGames();

    // "Bonus" = pick a cross-section: last 8 added + 4 random from middle
    const pool   = [...all];
    const recent = pool.slice(-8);
    const mid    = pool.slice(Math.floor(pool.length * 0.3), Math.floor(pool.length * 0.7));
    const randoms = mid.sort(() => Math.random() - 0.5).slice(0, 6);
    const bonus  = [...new Map([...recent, ...randoms].map(g => [g.id, g])).values()].slice(0, 12);

    if (bonus.length === 0) {
      bonusList.innerHTML = '<p class="sidebar-fav-empty">No bonus games found.</p>';
      return;
    }

    const labels = ['NEW', 'HOT', 'TOP', 'FUN', 'PICK', '★'];

    bonusList.innerHTML = bonus.map((g, i) => {
      const label = labels[i % labels.length];
      return `
        <a class="sidebar-bonus-row" href="${playHref(g)}">
          <span class="sidebar-bonus-dot"></span>
          <span style="flex:1;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">${escHtml(g.title)}</span>
          <span class="sidebar-bonus-pill">${label}</span>
        </a>`;
    }).join('');
  }

  function escHtml(s) {
    return String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  }

  // ── Quick actions ─────────────────────────────────────────
  function bindAction(id, fn) {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', fn);
  }

  bindAction('sidebarActionRandom', () => {
    const all = getAllGames();
    if (!all.length) return;
    const game = all[Math.floor(Math.random() * all.length)];
    closeSidebar();
    window.location.href = playHref(game);
  });

  bindAction('sidebarActionTop', () => {
    closeSidebar();
    const el = document.getElementById('trendingGrid') || document.getElementById('trendingBlock');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  });

  bindAction('sidebarActionNew', () => {
    closeSidebar();
    const el = document.getElementById('latestBlock') || document.getElementById('latestGrid');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  });

  bindAction('sidebarActionClearFavs', () => {
    if (!confirm('Clear all favorites?')) return;
    saveFavorites(new Set());
    // Refresh any starred cards on the page
    document.querySelectorAll('.card.is-favorite').forEach(c => {
      c.classList.remove('is-favorite');
    });
    document.querySelectorAll('.favorite-button[aria-pressed="true"]').forEach(b => {
      b.setAttribute('aria-pressed', 'false');
    });
    populateFavorites();
  });

  bindAction('sidebarActionSettings', () => {
    closeSidebar();
    // Trigger the existing settings open mechanism
    document.getElementById('settingsButton')?.click();
  });

  // ── Force snowfall atmosphere always ─────────────────────
  // Sets data-atmosphere="snow" on html regardless of saved prefs.
  // This overrides the settings system visually without breaking it.
  function enforceSnow() {
    document.documentElement.dataset.atmosphere = 'snow';
  }

  enforceSnow();

  // Re-enforce after any settings change (in case settings.js resets it)
  window.addEventListener('crown-settings-change', () => {
    // Small delay to let settings.js apply first, then override
    setTimeout(enforceSnow, 10);
  });

  // Also re-apply on applyCrownSettings patch
  const origApply = window.CrownSettings?.apply;
  if (origApply) {
    const patchedApply = function() {
      origApply.apply(this, arguments);
      enforceSnow();
    };
    window.CrownSettings.apply = patchedApply;
  }

  // ── Init ──────────────────────────────────────────────────
  // Bonus games can be populated immediately (data is already loaded)
  document.addEventListener('DOMContentLoaded', () => {
    populateBonusGames();
  });

  // If DOMContentLoaded already fired
  if (document.readyState !== 'loading') {
    populateBonusGames();
  }

  // Re-populate favorites whenever sidebar is reopened
  // (handled inside openSidebar above)

})();
