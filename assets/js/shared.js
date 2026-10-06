/* Shared behavior for a dependency-free GitHub Pages notebook. */
(() => {
  "use strict";

  const THEME_KEY = "math-notes-theme";
  const STATUSES = Object.freeze({
    Checked: "A written proof has been checked. See the note for the scope of verification.",
    Computational: "Supported by computation; this label does not establish a general proof.",
    Conjecture: "An unproved claim or open question."
  });
  const DEFAULT_SITE = Object.freeze({
    name: "Caleb Barnett",
    description: "AI-assisted mathematical research by Caleb Barnett.",
    intro: "AI-assisted mathematics.",
    about: "AI use and verification are documented in each result.",
    author: "Caleb Barnett",
    email: "",
    repositoryUrl: ""
  });
  let manifestPromise;
  let sitePromise;

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = String(text);
    return node;
  }

  function escapeHTML(text) {
    return String(text).replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[character]));
  }

  function localURL(path) {
    if (typeof path !== "string" || !path || /[\\\u0000-\u001f]/.test(path)) {
      throw new Error("Invalid local content path.");
    }
    const base = new URL(".", document.baseURI);
    const url = new URL(path, base);
    if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname) || path.startsWith("/")) {
      throw new Error("Content paths must stay within this website.");
    }
    return url;
  }

  function safeLink(path) {
    if (typeof path !== "string" || !path.trim()) return null;
    try {
      const url = new URL(path, document.baseURI);
      if (url.protocol === "https:") return url;
      if (url.origin === location.origin && ["http:", "https:"].includes(url.protocol)) return localURL(path);
    } catch (_) { /* An invalid optional link is omitted. */ }
    return null;
  }

  async function fetchText(path) {
    const response = await fetch(localURL(path), { cache: "no-cache" });
    if (!response.ok) throw new Error(`Could not load ${path} (${response.status}).`);
    return response.text();
  }

  async function fetchJSON(path) {
    return JSON.parse(await fetchText(path));
  }

  function validateResult(result, seen) {
    if (!result || typeof result !== "object" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(result.slug || "")) {
      throw new Error("Each note needs a unique, lowercase slug.");
    }
    if (seen.has(result.slug)) throw new Error("The note index contains a duplicate slug.");
    seen.add(result.slug);
    for (const key of ["title", "summary", "topic"]) {
      if (typeof result[key] !== "string" || !result[key].trim()) throw new Error(`A note is missing ${key}.`);
    }
    const isPaper = Object.hasOwn(result, "pdf");
    if (isPaper === Object.hasOwn(result, "markdown")) throw new Error("Each result needs exactly one Markdown or PDF file.");
    if (isPaper) {
      if (result.pdf !== `content/papers/${result.slug}.pdf`) throw new Error("A paper's PDF path must match its slug.");
    } else {
      if (result.markdown !== `content/results/${result.slug}.md`) throw new Error("A note's Markdown path must match its slug.");
      if (typeof result.date !== "string" || typeof result.status !== "string") throw new Error("Markdown notes need a date and verification status.");
    }
    if (result.date !== undefined) {
      const date = new Date(`${result.date}T00:00:00Z`);
      if (typeof result.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(result.date) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== result.date) {
        throw new Error("Note dates must use YYYY-MM-DD.");
      }
    }
    if (result.status !== undefined && !Object.hasOwn(STATUSES, result.status)) throw new Error("Unknown note verification status.");
    if (result.tags !== undefined && (!Array.isArray(result.tags) || result.tags.some((tag) => typeof tag !== "string"))) {
      throw new Error("Note tags must be an array of strings.");
    }
    if (result.isExample !== undefined && typeof result.isExample !== "boolean") throw new Error("isExample must be true or false.");
    if (result.authors !== undefined && (!Array.isArray(result.authors) || result.authors.some((author) => typeof author !== "string" || !author.trim()))) {
      throw new Error("Paper authors must be an array of names.");
    }
    if (result.readingMinutes !== undefined && (!Number.isInteger(result.readingMinutes) || result.readingMinutes <= 0)) {
      throw new Error("Reading time must be a positive number of minutes.");
    }
    if (result.attachments !== undefined && (!Array.isArray(result.attachments) || result.attachments.some((attachment) =>
      !attachment || typeof attachment.label !== "string" || !attachment.label.trim() || !safeLink(attachment.url)
    ))) throw new Error("Note attachments need a label and a safe URL.");
    return { ...result, tags: result.tags || [], authors: result.authors || [], attachments: result.attachments || [] };
  }

  function loadResults() {
    if (!manifestPromise) manifestPromise = fetchJSON("content/results.json").then((manifest) => {
      if (manifest.version !== 1 || !Array.isArray(manifest.results)) throw new Error("The note index has an unsupported format.");
      const seen = new Set();
      return manifest.results.map((result) => validateResult(result, seen));
    });
    return manifestPromise;
  }

  function loadSite() {
    if (!sitePromise) sitePromise = fetchJSON("content/site.json").then((config) => {
      const site = { ...DEFAULT_SITE };
      for (const key of Object.keys(site)) {
        if (typeof config[key] === "string") site[key] = config[key];
      }
      if (!site.name.trim()) site.name = DEFAULT_SITE.name;
      return site;
    }).catch(() => ({ ...DEFAULT_SITE }));
    return sitePromise;
  }

  function formatDate(date) {
    return new Intl.DateTimeFormat("en", { month: "short", day: "2-digit", year: "numeric", timeZone: "UTC" })
      .format(new Date(`${date}T00:00:00Z`));
  }

  function articleURL(slug) {
    return `article.html?result=${encodeURIComponent(slug)}`;
  }

  function statusBadge(status) {
    const badge = element("span", `status-badge status-${status.toLowerCase()}`, status);
    badge.title = STATUSES[status];
    return badge;
  }

  function renderMath(container) {
    if (typeof window.renderMathInElement !== "function") return;
    window.renderMathInElement(container, {
      delimiters: [
        { left: "$$", right: "$$", display: true },
        { left: "\\[", right: "\\]", display: true },
        { left: "$", right: "$", display: false },
        { left: "\\(", right: "\\)", display: false }
      ],
      throwOnError: false,
      trust: false,
      maxExpand: 1000,
      output: "htmlAndMathml"
    });
  }

  function initTheme() {
    const root = document.documentElement;
    const toggle = document.getElementById("theme-toggle");
    if (!toggle) return;
    const preference = window.matchMedia("(prefers-color-scheme: dark)");
    let stored;
    try { stored = localStorage.getItem(THEME_KEY); } catch (_) { /* Storage may be disabled. */ }
    const initial = ["light", "dark"].includes(root.dataset.theme) ? root.dataset.theme
      : ["light", "dark"].includes(stored) ? stored : preference.matches ? "dark" : "light";
    function apply(theme) {
      root.dataset.theme = theme;
      if (toggle) {
        const label = `Switch to ${theme === "dark" ? "light" : "dark"} theme`;
        toggle.setAttribute("aria-label", label);
        toggle.setAttribute("aria-pressed", String(theme === "dark"));
        toggle.title = label;
      }
    }
    apply(initial);
    if (toggle) toggle.addEventListener("click", () => {
      stored = root.dataset.theme === "dark" ? "light" : "dark";
      apply(stored);
      try { localStorage.setItem(THEME_KEY, stored); } catch (_) { /* Keep the current session usable. */ }
    });
    preference.addEventListener("change", (event) => {
      if (!["light", "dark"].includes(stored)) apply(event.matches ? "dark" : "light");
    });
  }

  async function initSite() {
    document.querySelectorAll("#current-year, [data-current-year]").forEach((node) => { node.textContent = new Date().getFullYear(); });
    const site = await loadSite();
    const bindings = { name: "[data-site-name], #site-name", description: "[data-site-description]", intro: "[data-site-intro]", about: "[data-site-about]", author: "[data-author]" };
    for (const [key, selector] of Object.entries(bindings)) {
      document.querySelectorAll(selector).forEach((node) => {
        node.textContent = site[key];
        if (key === "author") node.hidden = !site[key];
      });
    }
    document.querySelectorAll("[data-repository-link]").forEach((node) => {
      const url = safeLink(site.repositoryUrl);
      node.hidden = !url;
      if (url) { node.href = url.href; node.rel = "noopener noreferrer"; }
    });
    document.querySelectorAll("[data-email-link]").forEach((node) => {
      const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(site.email);
      node.hidden = !valid;
      if (valid) {
        node.href = `mailto:${site.email}`;
        node.textContent = site.email;
      }
    });
    document.querySelectorAll(".wordmark").forEach((node) => { node.setAttribute("aria-label", `${site.name} home`); });
    if (!document.getElementById("article-content")) {
      document.title = `${site.name} — Mathematics`;
      const description = document.querySelector('meta[name="description"]');
      if (description) description.content = site.description;
    }
  }

  window.MathNotes = Object.freeze({ element, escapeHTML, localURL, safeLink, fetchText, loadResults, loadSite, formatDate, articleURL, statusBadge, renderMath, statuses: STATUSES });
  initTheme();
  initSite();
})();
