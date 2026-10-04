/* i18n.js — FR (default) / EN string tables and small helpers.
 * Persists the chosen language in localStorage (wrapped in try/catch, since
 * localStorage can throw in private-browsing / disabled-storage contexts).
 */
(function (global) {
  "use strict";

  var STORAGE_KEY = "pq_lang";
  var DEFAULT_LANG = "fr";

  var STRINGS = {
    fr: {
      siteTitle: "Paroles Queer",
      sectionTitle: "Archives · Numéros",
      pagesSuffix: "p.",
      issueLabel: "N°",
      frenchOnlyNote: "Disponible en français uniquement",
      back: "Retour",
      zoom: "Zoom",
      fullscreen: "Plein écran",
      pageIndicatorSep: "–",
      of: "/",
      footerContact: "contact@lastation-lgbti.eu",
      loadError: "Impossible de charger les numéros.",
      months: [
        "janvier", "février", "mars", "avril", "mai", "juin",
        "juillet", "août", "septembre", "octobre", "novembre", "décembre"
      ]
    },
    en: {
      siteTitle: "Paroles Queer",
      sectionTitle: "Archives · Issues",
      pagesSuffix: "p.",
      issueLabel: "No.",
      frenchOnlyNote: "Available in French only",
      back: "Back",
      zoom: "Zoom",
      fullscreen: "Fullscreen",
      pageIndicatorSep: "–",
      of: "/",
      footerContact: "contact@lastation-lgbti.eu",
      loadError: "Could not load issues.",
      months: [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
      ]
    }
  };

  function getLang() {
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "fr" || saved === "en") return saved;
    } catch (e) {
      /* ignore storage errors */
    }
    return DEFAULT_LANG;
  }

  function setLang(lang) {
    if (lang !== "fr" && lang !== "en") lang = DEFAULT_LANG;
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch (e) {
      /* ignore storage errors */
    }
    return lang;
  }

  function t(lang, key) {
    var table = STRINGS[lang] || STRINGS[DEFAULT_LANG];
    return table[key] !== undefined ? table[key] : key;
  }

  /* Format "YYYY-MM" into a localized "Month YYYY" string, e.g. "Juin 2026". */
  function formatMonthYear(lang, yyyyMm) {
    var parts = String(yyyyMm).split("-");
    var year = parts[0];
    var monthIdx = parseInt(parts[1], 10) - 1;
    var table = STRINGS[lang] || STRINGS[DEFAULT_LANG];
    var monthName = table.months[monthIdx] || "";
    monthName = monthName.charAt(0).toUpperCase() + monthName.slice(1);
    return monthName + " " + year;
  }

  global.PQ_I18N = {
    DEFAULT_LANG: DEFAULT_LANG,
    getLang: getLang,
    setLang: setLang,
    t: t,
    formatMonthYear: formatMonthYear
  };
})(window);
