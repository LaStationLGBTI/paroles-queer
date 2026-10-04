/* gallery.js — home page: load issues.json, render cards, handle lang toggle. */
(function () {
  "use strict";

  var i18n = window.PQ_I18N;
  var lang = i18n.getLang();
  var issuesCache = null;

  function applyStaticStrings() {
    document.getElementById("pq-site-title").textContent = i18n.t(lang, "siteTitle");
    document.getElementById("pq-section-title").textContent = i18n.t(lang, "sectionTitle");
    document.title = i18n.t(lang, "siteTitle");
    document.documentElement.setAttribute("lang", lang);

    var btnFr = document.getElementById("pq-lang-fr");
    var btnEn = document.getElementById("pq-lang-en");
    btnFr.classList.toggle("active", lang === "fr");
    btnEn.classList.toggle("active", lang === "en");
  }

  function renderCards(issues) {
    var grid = document.getElementById("pq-grid");
    grid.innerHTML = "";

    if (!issues || issues.length === 0) {
      var empty = document.createElement("p");
      empty.className = "pq-empty";
      empty.textContent = lang === "fr" ? "Aucun numéro pour le moment." : "No issues yet.";
      grid.appendChild(empty);
      return;
    }

    issues.forEach(function (issue) {
      var hasLang = issue.langs && issue.langs[lang];
      var frenchOnly = lang !== "fr" && !hasLang && issue.langs && issue.langs.fr;

      var card = document.createElement("a");
      card.className = "pq-card";
      card.href = "viewer.html?n=" + issue.id;

      var coverWrap = document.createElement("div");
      coverWrap.className = "pq-card-cover";
      var img = document.createElement("img");
      img.src = issue.cover;
      img.alt = i18n.t(lang, "issueLabel") + issue.id;
      img.loading = "lazy";
      coverWrap.appendChild(img);

      var title = document.createElement("h3");
      title.className = "pq-card-title";
      title.textContent = i18n.t(lang, "issueLabel") + issue.id;

      var meta = document.createElement("p");
      meta.className = "pq-card-meta";
      var dateStr = i18n.formatMonthYear(lang, issue.date);
      meta.textContent = dateStr + " · " + issue.pages + " " + i18n.t(lang, "pagesSuffix");

      card.appendChild(coverWrap);
      card.appendChild(title);
      card.appendChild(meta);

      if (frenchOnly) {
        var note = document.createElement("span");
        note.className = "pq-card-note";
        note.textContent = i18n.t(lang, "frenchOnlyNote");
        card.appendChild(document.createElement("br"));
        card.appendChild(note);
      }

      grid.appendChild(card);
    });
  }

  function loadIssues() {
    if (window.PQ_ISSUES) return Promise.resolve(window.PQ_ISSUES);
    return fetch("data/issues.json", { cache: "no-store" })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      });
  }

  function setLang(newLang) {
    lang = i18n.setLang(newLang);
    applyStaticStrings();
    if (issuesCache) renderCards(issuesCache);
  }

  function init() {
    applyStaticStrings();

    document.getElementById("pq-lang-fr").addEventListener("click", function () { setLang("fr"); });
    document.getElementById("pq-lang-en").addEventListener("click", function () { setLang("en"); });

    loadIssues()
      .then(function (issues) {
        issuesCache = issues;
        renderCards(issues);
      })
      .catch(function () {
        var grid = document.getElementById("pq-grid");
        grid.innerHTML = "";
        var err = document.createElement("p");
        err.className = "pq-error";
        err.textContent = i18n.t(lang, "loadError");
        grid.appendChild(err);
      });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
