/* viewer.js — page-by-page / spread viewer for a single issue.
 * Pages are drawn into <canvas> elements (never as plain <img src=...> in the
 * DOM) as a basic deterrent against casual right-click "save image as".
 * This does not defend against screenshots — documented as a known limit.
 */
(function () {
  "use strict";

  var i18n = window.PQ_I18N;
  var lang = i18n.getLang();

  var issue = null;       // the issue object from issues.json
  var effectiveLang = "fr"; // lang actually used to source pages (fallback aware)
  var frenchOnlyFallback = false;
  var pageCount = 0;
  var spreads = [];       // array of arrays of page numbers, e.g. [[1],[2,3],[4,5]...]
  var currentSpreadIndex = 0;
  var imageCache = {};    // pageNum -> HTMLImageElement
  var isMobileLayout = false;
  var zoomed = false;
  var panState = null;

  function qs(name) {
    var m = new RegExp("[?&]" + name + "=([^&]+)").exec(window.location.search);
    return m ? decodeURIComponent(m[1]) : null;
  }

  function getHashPage() {
    var m = /#p=(\d+)/.exec(window.location.hash);
    return m ? parseInt(m[1], 10) : null;
  }

  function setHashPage(pageNum) {
    history.replaceState(null, "", "#p=" + pageNum);
  }

  function computeIsMobile() {
    return window.matchMedia("(max-width: 767px), (orientation: portrait)").matches;
  }

  function buildSpreads(count, mobile) {
    if (count < 1) return [];
    var result = [];
    if (mobile) {
      for (var i = 1; i <= count; i++) result.push([i]);
      return result;
    }
    result.push([1]);
    var p = 2;
    while (p <= count) {
      if (p === count) {
        result.push([p]); // last unpaired page alone
        p += 1;
      } else {
        result.push([p, p + 1]);
        p += 2;
      }
    }
    return result;
  }

  function pagePath(pageNum) {
    return "issues/" + issue.id + "/" + effectiveLang + "/p" + pad3(pageNum) + ".webp";
  }

  function thumbPath(pageNum) {
    return "issues/" + issue.id + "/" + effectiveLang + "/thumbs/t" + pad3(pageNum) + ".webp";
  }

  function pad3(n) {
    return String(n).padStart(3, "0");
  }

  function loadImage(pageNum) {
    var key = effectiveLang + ":" + pageNum;
    if (imageCache[key]) return imageCache[key];
    var img = new Image();
    img.src = pagePath(pageNum);
    imageCache[key] = img;
    return img;
  }

  function preloadAround(spreadIdx) {
    var toLoad = [];
    [spreadIdx - 1, spreadIdx, spreadIdx + 1].forEach(function (idx) {
      if (idx >= 0 && idx < spreads.length) {
        spreads[idx].forEach(function (p) { toLoad.push(p); });
      }
    });
    toLoad.forEach(loadImage);
  }

  function drawPageCanvas(pageNum) {
    var wrap = document.createElement("div");
    wrap.className = "pq-page-canvas-wrap";
    var canvas = document.createElement("canvas");
    wrap.appendChild(canvas);

    var img = loadImage(pageNum);

    function render() {
      var w = img.naturalWidth || 612;
      var h = img.naturalHeight || 859;
      canvas.width = w;
      canvas.height = h;
      var ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, w, h);
    }

    if (img.complete && img.naturalWidth) {
      render();
    } else {
      img.addEventListener("load", render);
    }

    canvas.addEventListener("contextmenu", function (e) { e.preventDefault(); });
    canvas.addEventListener("dragstart", function (e) { e.preventDefault(); });

    return wrap;
  }

  function renderSpread(direction) {
    var stage = document.getElementById("pq-stage");
    var old = stage.querySelector(".pq-spread");
    var spreadPages = spreads[currentSpreadIndex];

    var spreadEl = document.createElement("div");
    spreadEl.className = "pq-spread";

    var prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!prefersReduced) {
      spreadEl.classList.add(isMobileLayout ? "pq-slide-in" : "pq-flip-in");
    }

    spreadPages.forEach(function (p) {
      spreadEl.appendChild(drawPageCanvas(p));
    });

    if (old) stage.removeChild(old);
    stage.appendChild(spreadEl);

    updateTopbar();
    preloadAround(currentSpreadIndex);
    setHashPage(spreadPages[0]);
    renderThumbActive();
    resetZoom();
  }

  function updateTopbar() {
    var spreadPages = spreads[currentSpreadIndex];
    var first = spreadPages[0];
    var last = spreadPages[spreadPages.length - 1];
    var indicator = document.getElementById("pq-page-indicator");
    if (first === last) {
      indicator.textContent = first + " " + i18n.t(lang, "of") + " " + pageCount;
    } else {
      indicator.textContent = first + i18n.t(lang, "pageIndicatorSep") + last + " " + i18n.t(lang, "of") + " " + pageCount;
    }

    document.getElementById("pq-topbar-title").textContent =
      i18n.t(lang, "siteTitle") + " " + i18n.t(lang, "issueLabel") + issue.id;

    document.getElementById("pq-back-link-label").textContent = i18n.t(lang, "back");
  }

  function renderThumbstrip() {
    var strip = document.getElementById("pq-thumbstrip");
    strip.innerHTML = "";
    for (var p = 1; p <= pageCount; p++) {
      (function (pageNum) {
        var btn = document.createElement("button");
        btn.className = "pq-thumb";
        btn.setAttribute("data-page", pageNum);
        var img = document.createElement("img");
        img.src = thumbPath(pageNum);
        img.loading = "lazy";
        img.alt = String(pageNum);
        img.draggable = false;
        btn.appendChild(img);
        btn.addEventListener("click", function () {
          goToPage(pageNum);
        });
        strip.appendChild(btn);
      })(p);
    }
  }

  function renderThumbActive() {
    var strip = document.getElementById("pq-thumbstrip");
    var spreadPages = spreads[currentSpreadIndex];
    var active = strip.querySelectorAll(".pq-thumb.active");
    active.forEach && active.forEach(function (el) { el.classList.remove("active"); });
    if (!active.forEach) {
      for (var i = 0; i < active.length; i++) active[i].classList.remove("active");
    }
    spreadPages.forEach(function (p) {
      var el = strip.querySelector('.pq-thumb[data-page="' + p + '"]');
      if (el) {
        el.classList.add("active");
        el.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
      }
    });
  }

  function spreadIndexForPage(pageNum) {
    for (var i = 0; i < spreads.length; i++) {
      if (spreads[i].indexOf(pageNum) !== -1) return i;
    }
    return 0;
  }

  function goToPage(pageNum) {
    currentSpreadIndex = spreadIndexForPage(pageNum);
    renderSpread();
  }

  function nextSpread() {
    if (currentSpreadIndex < spreads.length - 1) {
      currentSpreadIndex += 1;
      renderSpread("next");
    }
  }

  function prevSpread() {
    if (currentSpreadIndex > 0) {
      currentSpreadIndex -= 1;
      renderSpread("prev");
    }
  }

  /* ---------- Zoom / pan ---------- */

  function resetZoom() {
    zoomed = false;
    panState = null;
    var stage = document.getElementById("pq-stage");
    stage.classList.remove("pq-zoomed");
    var spreadEl = stage.querySelector(".pq-spread");
    if (spreadEl) spreadEl.style.transform = "";
  }

  function toggleZoom() {
    var stage = document.getElementById("pq-stage");
    var spreadEl = stage.querySelector(".pq-spread");
    if (!spreadEl) return;
    zoomed = !zoomed;
    stage.classList.toggle("pq-zoomed", zoomed);
    if (zoomed) {
      spreadEl.style.transform = "scale(2)";
    } else {
      spreadEl.style.transform = "";
      panState = null;
    }
  }

  function setupPan() {
    var stage = document.getElementById("pq-stage");

    stage.addEventListener("pointerdown", function (e) {
      if (!zoomed) return;
      var spreadEl = stage.querySelector(".pq-spread");
      if (!spreadEl) return;
      panState = { startX: e.clientX, startY: e.clientY, baseX: 0, baseY: 0 };
      var m = /translate\(([-0-9.]+)px,\s*([-0-9.]+)px\)/.exec(spreadEl.style.transform || "");
      if (m) {
        panState.baseX = parseFloat(m[1]);
        panState.baseY = parseFloat(m[2]);
      }
      stage.setPointerCapture(e.pointerId);
    });

    stage.addEventListener("pointermove", function (e) {
      if (!zoomed || !panState) return;
      var spreadEl = stage.querySelector(".pq-spread");
      if (!spreadEl) return;
      var dx = e.clientX - panState.startX;
      var dy = e.clientY - panState.startY;
      var x = panState.baseX + dx;
      var y = panState.baseY + dy;
      spreadEl.style.transform = "scale(2) translate(" + x + "px, " + y + "px)";
    });

    stage.addEventListener("pointerup", function () { panState = null; });
    stage.addEventListener("pointercancel", function () { panState = null; });

    /* Basic pinch-to-zoom via two-pointer distance tracking */
    var activePointers = {};
    var pinchStartDist = null;

    stage.addEventListener("pointerdown", function (e) {
      activePointers[e.pointerId] = { x: e.clientX, y: e.clientY };
      if (Object.keys(activePointers).length === 2) {
        var pts = Object.values(activePointers);
        pinchStartDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      }
    });
    stage.addEventListener("pointermove", function (e) {
      if (!activePointers[e.pointerId]) return;
      activePointers[e.pointerId] = { x: e.clientX, y: e.clientY };
      if (Object.keys(activePointers).length === 2 && pinchStartDist) {
        var pts = Object.values(activePointers);
        var dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        if (dist > pinchStartDist * 1.15 && !zoomed) {
          toggleZoom();
          pinchStartDist = dist;
        } else if (dist < pinchStartDist * 0.85 && zoomed) {
          toggleZoom();
          pinchStartDist = dist;
        }
      }
    });
    ["pointerup", "pointercancel"].forEach(function (evt) {
      stage.addEventListener(evt, function (e) {
        delete activePointers[e.pointerId];
        if (Object.keys(activePointers).length < 2) pinchStartDist = null;
      });
    });
  }

  /* ---------- Swipe navigation ---------- */

  function setupSwipe() {
    var stage = document.getElementById("pq-stage");
    var startX = null, startY = null;

    stage.addEventListener("touchstart", function (e) {
      if (zoomed || e.touches.length !== 1) return;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    }, { passive: true });

    stage.addEventListener("touchend", function (e) {
      if (startX === null || zoomed) return;
      var endX = e.changedTouches[0].clientX;
      var endY = e.changedTouches[0].clientY;
      var dx = endX - startX;
      var dy = endY - startY;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
        if (dx < 0) nextSpread(); else prevSpread();
      }
      startX = null; startY = null;
    }, { passive: true });
  }

  /* ---------- Keyboard ---------- */

  function setupKeyboard() {
    document.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight") nextSpread();
      else if (e.key === "ArrowLeft") prevSpread();
      else if (e.key === "Escape") {
        if (zoomed) resetZoom();
        else if (document.fullscreenElement) document.exitFullscreen();
        else if (document.webkitFullscreenElement) document.webkitExitFullscreen();
      }
    });
  }

  /* ---------- Fullscreen ---------- */

  function setupFullscreen() {
    var btn = document.getElementById("pq-fullscreen-btn");
    var el = document.getElementById("pq-viewer-root");
    var canRequest = !!(el.requestFullscreen || el.webkitRequestFullscreen);
    var canExit = !!(document.exitFullscreen || document.webkitExitFullscreen);
    if (!canRequest || !canExit) {
      btn.style.display = "none";
      return;
    }
    btn.addEventListener("click", function () {
      var isFullscreen = document.fullscreenElement || document.webkitFullscreenElement;
      if (!isFullscreen) {
        if (el.requestFullscreen) el.requestFullscreen();
        else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
      } else {
        if (document.exitFullscreen) document.exitFullscreen();
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
      }
    });
  }

  /* ---------- Protection: block contextmenu / drag / selection on viewer ---------- */

  function setupProtection() {
    var root = document.getElementById("pq-viewer-root");
    root.addEventListener("contextmenu", function (e) { e.preventDefault(); });
    root.addEventListener("dragstart", function (e) { e.preventDefault(); });
    root.addEventListener("selectstart", function (e) { e.preventDefault(); });
  }

  /* ---------- Lang toggle ---------- */

  function setupLangToggle() {
    var btnFr = document.getElementById("pq-lang-fr");
    var btnEn = document.getElementById("pq-lang-en");
    btnFr.classList.toggle("active", lang === "fr");
    btnEn.classList.toggle("active", lang === "en");

    btnFr.addEventListener("click", function () { switchLang("fr"); });
    btnEn.addEventListener("click", function () { switchLang("en"); });
  }

  function switchLang(newLang) {
    lang = i18n.setLang(newLang);
    document.getElementById("pq-lang-fr").classList.toggle("active", lang === "fr");
    document.getElementById("pq-lang-en").classList.toggle("active", lang === "en");
    var oldEffectiveLang = effectiveLang;
    resolveEffectiveLang();
    updateTopbar();
    updateFrOnlyNote();
    if (effectiveLang !== oldEffectiveLang) {
      renderThumbstrip();
      renderSpread();
    }
  }

  function resolveEffectiveLang() {
    if (issue.langs && issue.langs[lang]) {
      effectiveLang = lang;
      frenchOnlyFallback = false;
    } else if (issue.langs && issue.langs.fr) {
      effectiveLang = "fr";
      frenchOnlyFallback = lang !== "fr";
    }
  }

  function updateFrOnlyNote() {
    var note = document.getElementById("pq-fr-only-note");
    note.textContent = frenchOnlyFallback ? i18n.t(lang, "frenchOnlyNote") : "";
  }

  /* ---------- Init ---------- */

  function showError(msg) {
    var stage = document.getElementById("pq-stage");
    stage.innerHTML = '<p class="pq-error">' + msg + "</p>";
  }

  function init() {
    var issueId = parseInt(qs("n"), 10);
    document.getElementById("pq-back-link").setAttribute("href", "index.html");

    setupLangToggle();
    setupKeyboard();
    setupSwipe();
    setupPan();
    setupFullscreen();
    setupProtection();

    document.getElementById("pq-nav-prev").addEventListener("click", prevSpread);
    document.getElementById("pq-nav-next").addEventListener("click", nextSpread);
    document.getElementById("pq-zoom-btn").addEventListener("click", toggleZoom);

    window.addEventListener("resize", function () {
      var wasMobile = isMobileLayout;
      isMobileLayout = computeIsMobile();
      if (wasMobile !== isMobileLayout && spreads.length) {
        var currentFirstPage = spreads[currentSpreadIndex][0];
        spreads = buildSpreads(pageCount, isMobileLayout);
        currentSpreadIndex = spreadIndexForPage(currentFirstPage);
        renderSpread();
      }
    });

    (window.PQ_ISSUES ? Promise.resolve(window.PQ_ISSUES) : fetch("data/issues.json", { cache: "no-store" })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      }))
      .then(function (issues) {
        issue = issues.find(function (x) { return x.id === issueId; });
        if (!issue) {
          showError(lang === "fr" ? "Numéro introuvable." : "Issue not found.");
          return;
        }
        resolveEffectiveLang();
        updateFrOnlyNote();
        pageCount = Number(issue.pages) || 0;
        isMobileLayout = computeIsMobile();
        spreads = buildSpreads(pageCount, isMobileLayout);
        if (!spreads.length) {
          showError(i18n.t(lang, "loadError"));
          return;
        }

        renderThumbstrip();

        var hashPage = getHashPage();
        currentSpreadIndex = hashPage ? spreadIndexForPage(hashPage) : 0;
        renderSpread();
      })
      .catch(function () {
        showError(i18n.t(lang, "loadError"));
      });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
