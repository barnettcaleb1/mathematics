/* Searchable note index; all paths remain relative for GitHub project Pages. */
(() => {
  "use strict";
  const notebook = window.MathNotes;
  const list = document.getElementById("results-list");
  if (!notebook || !list) return;
  const search = document.getElementById("search-input") || document.getElementById("search");
  const topic = document.getElementById("topic-filter");
  const status = document.getElementById("status-filter");
  const sort = document.getElementById("sort-order");
  const clear = document.getElementById("clear-filters");
  const count = document.getElementById("result-count");
  const empty = document.getElementById("empty-state");
  const loadState = document.getElementById("results-load-state");
  const hasStaticResults = Boolean(list.querySelector("li"));
  let results = [];
  let ready = false;

  function setCount(id, number) {
    const node = document.getElementById(id);
    if (node) node.textContent = String(number).padStart(2, "0");
  }

  function populateSelect(select, values, allLabel) {
    if (!select) return;
    select.replaceChildren();
    const all = notebook.element("option", "", allLabel);
    all.value = "";
    select.append(all);
    for (const value of values) {
      const option = notebook.element("option", "", value);
      option.value = value;
      select.append(option);
    }
  }

  function resultRow(result) {
    const row = notebook.element("li", "result-entry");
    const link = notebook.element("a", "result-link", result.title);
    link.href = result.pdf || notebook.articleURL(result.slug);
    const metadata = notebook.element("div", "result-metadata");
    const details = [];
    if (result.authors.length) details.push(notebook.element("span", "result-authors", result.authors.join(", ")));
    if (result.topic) details.push(notebook.element("span", "result-topic", result.topic));
    if (result.pdf) details.push(notebook.element("span", "result-format", "PDF"));
    if (result.status) details.push(notebook.statusBadge(result.status));
    if (result.date) {
      const date = notebook.element("time", "result-date", notebook.formatDate(result.date));
      date.dateTime = result.date;
      details.push(date);
    }
    if (result.isExample) details.push(notebook.element("span", "result-example", "Example"));
    details.forEach((detail, index) => { if (index) metadata.append(" · "); metadata.append(detail); });
    row.append(link, metadata);
    return row;
  }

  function render() {
    if (!ready) return;
    const query = (search?.value || "").trim().toLocaleLowerCase();
    const terms = query.split(/\s+/).filter(Boolean);
    const matches = results.filter((result) => {
      const searchable = [result.title, result.summary, result.topic, result.status, ...result.authors, ...result.tags].join(" ").toLocaleLowerCase();
      return terms.every((term) => searchable.includes(term)) && (!topic?.value || result.topic === topic.value) && (!status?.value || result.status === status.value);
    }).sort((a, b) => {
      const order = (a.date || "").localeCompare(b.date || "") || a.title.localeCompare(b.title);
      return sort?.value === "oldest" ? order : -order;
    });
    list.replaceChildren(...matches.map(resultRow));
    if (count) count.textContent = `${matches.length} ${matches.length === 1 ? "result" : "results"}`;
    if (empty) empty.hidden = matches.length !== 0;
    if (clear) clear.hidden = !(query || topic?.value || status?.value);
    const params = new URLSearchParams();
    if (query) params.set("q", search.value.trim());
    if (topic?.value) params.set("topic", topic.value);
    if (status?.value) params.set("status", status.value);
    if (sort?.value === "oldest") params.set("sort", "oldest");
    const next = `${location.pathname}${params.size ? `?${params}` : ""}${location.hash}`;
    try { history.replaceState(null, "", next); } catch (_) { /* Filtering works even if history is unavailable. */ }
  }

  search?.addEventListener("input", render);
  for (const select of [topic, status, sort]) select?.addEventListener("change", render);
  clear?.addEventListener("click", () => {
    if (search) search.value = "";
    if (topic) topic.value = "";
    if (status) status.value = "";
    render();
    search?.focus();
  });
  document.addEventListener("keydown", (event) => {
    const editing = event.target instanceof Element && (event.target.matches("input, textarea, select") || event.target.isContentEditable);
    if (event.key === "/" && !event.ctrlKey && !event.metaKey && !event.altKey && !editing && search) {
      event.preventDefault();
      search.focus();
    }
    if (event.key === "Escape" && event.target === search && search.value) {
      search.value = "";
      render();
    }
  });

  async function init() {
    list.setAttribute("aria-busy", "true");
    if (loadState) { loadState.hidden = false; loadState.textContent = "Loading notes…"; }
    try {
      results = await notebook.loadResults();
      const topics = [...new Set(results.map((result) => result.topic))].sort();
      populateSelect(topic, topics, "All subjects");
      populateSelect(status, Object.keys(notebook.statuses), "All statuses");
      const params = new URLSearchParams(location.search);
      const canSearch = results.length >= 2;
      document.querySelectorAll("[data-search-controls]").forEach((node) => { node.hidden = !canSearch; });
      if (search) search.value = canSearch ? params.get("q") || "" : "";
      if (canSearch && topic && topics.includes(params.get("topic"))) topic.value = params.get("topic");
      if (canSearch && status && Object.hasOwn(notebook.statuses, params.get("status"))) status.value = params.get("status");
      if (sort && params.get("sort") === "oldest") sort.value = "oldest";
      setCount("total-notes", results.length);
      setCount("topic-count", topics.length);
      setCount("checked-count", results.filter((result) => result.status === "Checked").length);
      document.querySelectorAll("[data-example-notice]").forEach((node) => {
        node.hidden = !results.some((result) => result.isExample);
      });
      ready = true;
      render();
      if (loadState) loadState.hidden = true;
    } catch (error) {
      if (!hasStaticResults) list.replaceChildren();
      if (empty) empty.hidden = true;
      if (count && !hasStaticResults) count.textContent = "Notes unavailable";
      if (loadState) {
        loadState.hidden = false;
        loadState.classList.add("load-error");
        loadState.textContent = "The notes could not be loaded. Refresh the page to try again. For local previews, start the server described in README.md.";
      } else list.append(notebook.element("p", "load-error", "The notes could not be loaded. Refresh the page to try again."));
      console.error("Note index:", error);
    } finally {
      list.setAttribute("aria-busy", "false");
    }
  }
  init();
})();
