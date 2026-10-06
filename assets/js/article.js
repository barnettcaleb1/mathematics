/* Markdown is sanitized before math is rendered or inserted into the page. */
(() => {
  "use strict";
  const notebook = window.MathNotes;
  const content = document.getElementById("article-content");
  if (!notebook || !content) return;
  const title = document.getElementById("article-title");
  const summary = document.getElementById("article-summary");
  const meta = document.getElementById("article-meta");
  const toc = document.getElementById("article-toc");
  const attachments = document.getElementById("article-attachments");
  const neighbors = document.getElementById("article-neighbors");
  const loadState = document.getElementById("article-load-state");

  function markdownParser() {
    if (!window.marked || !window.DOMPurify) throw new Error("The Markdown libraries are unavailable.");
    const parser = new window.marked.Marked({ gfm: true, breaks: false });
    const tableMath = new Map();
    let tablePrefix = "";
    function protectTableMath(source) {
      tableMath.clear();
      tablePrefix = "\uE000math-notes-";
      while (source.includes(tablePrefix)) tablePrefix += "x";
      let fence = null;
      let rawCodeTag = null;
      return source.split("\n").map((line) => {
        const boundary = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
        if (fence) {
          if (boundary && boundary[1][0] === fence.character && boundary[1].length >= fence.length && /^[ \t]*$/.test(boundary[2])) fence = null;
          return line;
        }
        if (boundary) { fence = { character: boundary[1][0], length: boundary[1].length }; return line; }
        if (rawCodeTag) {
          if (new RegExp(`</${rawCodeTag}\\s*>`, "i").test(line)) rawCodeTag = null;
          return line;
        }
        const rawCode = /^ {0,3}<(pre|code|script|style|textarea)\b/i.exec(line);
        if (rawCode) {
          if (!new RegExp(`</${rawCode[1]}\\s*>`, "i").test(line)) rawCodeTag = rawCode[1];
          return line;
        }
        if (!line.includes("|") || /^(?: {4}|\t)/.test(line)) return line;
        let output = "";
        for (let index = 0; index < line.length;) {
          if (line[index] === "`") {
            const opening = /^`+/.exec(line.slice(index))[0];
            const runs = /`+/g;
            runs.lastIndex = index + opening.length;
            let closing;
            while ((closing = runs.exec(line)) && closing[0].length !== opening.length) { /* Find the matching code delimiter. */ }
            const end = closing ? closing.index + closing[0].length : index + opening.length;
            output += line.slice(index, end);
            index = end;
            continue;
          }
          const remaining = line.slice(index);
          const inlineCodeTag = /^<(pre|code|script|style|textarea)\b[^>]*>/i.exec(remaining);
          if (inlineCodeTag) {
            const closingTag = new RegExp(`</${inlineCodeTag[1]}\\s*>`, "ig");
            closingTag.lastIndex = index + inlineCodeTag[0].length;
            const closing = closingTag.exec(line);
            const end = closing ? closing.index + closing[0].length : line.length;
            output += line.slice(index, end);
            index = end;
            if (!closing) rawCodeTag = inlineCodeTag[1];
            continue;
          }
          if (remaining.startsWith("\\") && !/^\\[[(]/.test(remaining)) {
            output += remaining.slice(0, 2);
            index += Math.min(2, remaining.length);
            continue;
          }
          const math = /^(?:\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\$(?!\$)(?:\\.|[^\\$])+?\$(?!\$)|\\\([\s\S]+?\\\))/.exec(remaining);
          if (math) {
            const token = `${tablePrefix}${tableMath.size}\uE001`;
            tableMath.set(token, math[0]);
            output += token;
            index += math[0].length;
          } else output += line[index++];
        }
        return output;
      }).join("\n");
    }
    // Protect TeX from Markdown's backslash escapes, emphasis, and link parsing.
    // Normal Markdown still handles fenced and inline code before their interiors.
    parser.use({
      hooks: {
        preprocess: protectTableMath,
        postprocess(html) {
          // GFM splits table cells before inline tokenization and unescapes \|.
          // Opaque tokens keep TeX pipes out of that step, then restore safe HTML.
          for (const [token, formula] of tableMath) {
            html = html.replaceAll(token, () => `<span class="math-source">${notebook.escapeHTML(formula)}</span>`);
          }
          return html;
        }
      },
      extensions: [
      {
        name: "displayMath", level: "block",
        start(source) { return source.match(/(^|\n) {0,3}(?:\$\$|\\\[)/)?.index; },
        tokenizer(source) {
          const match = /^ {0,3}(?:\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\])(?:[ \t]*(?:\n|$))/.exec(source);
          if (match) return { type: "displayMath", raw: match[0], formula: match[0].trim() };
        },
        renderer(token) { return `<div class="math-source">${notebook.escapeHTML(token.formula)}</div>\n`; }
      },
      {
        name: "inlineMath", level: "inline",
        start(source) { return source.search(/\$\$|\$(?!\$)|\\\[|\\\(/); },
        tokenizer(source) {
          const match = /^(?:\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\$(?!\$)((?:\\[\s\S]|[^\\$])+?)\$(?!\$)|\\\(([\s\S]+?)\\\))/.exec(source);
          if (match && !/\n[ \t]*\n/.test(match[3] || match[4] || "")) return { type: "inlineMath", raw: match[0], formula: match[0] };
        },
        renderer(token) { return `<span class="math-source">${notebook.escapeHTML(token.formula)}</span>`; }
      }
    ] });
    return parser;
  }

  function renderMetadata(result) {
    if (!meta) return;
    const details = [];
    if (result.authors.length) details.push(notebook.element("span", "article-meta-item", result.authors.join(", ")));
    if (result.topic) details.push(notebook.element("span", "article-meta-item", result.topic));
    if (result.pdf) details.push(notebook.element("span", "article-meta-item", "PDF"));
    if (result.date) {
      const date = notebook.element("time", "article-meta-item", notebook.formatDate(result.date));
      date.dateTime = result.date;
      details.push(date);
    }
    if (result.status) details.push(notebook.statusBadge(result.status));
    meta.replaceChildren(...details);
    if (result.readingMinutes) meta.append(notebook.element("span", "article-meta-item", `${result.readingMinutes} min read`));
    if (result.isExample) meta.append(notebook.element("span", "example-badge", "Example note"));
  }

  function renderTOC() {
    if (!toc) return;
    toc.replaceChildren();
    const seen = new Set();
    for (const heading of content.querySelectorAll("h2, h3")) {
      const text = heading.textContent;
      const stem = text.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "section";
      let id = `note-${stem}`;
      let repeat = 2;
      while (seen.has(id) || document.getElementById(id)) id = `note-${stem}-${repeat++}`;
      seen.add(id);
      heading.id = id;
      const link = notebook.element("a", `toc-link${heading.tagName === "H3" ? " toc-link-subsection" : ""}`, text);
      link.href = `#${id}`;
      toc.append(link);
    }
    toc.hidden = !toc.childElementCount;
    const wrapper = toc.closest("[data-toc-section]");
    if (wrapper) wrapper.hidden = !toc.childElementCount;
  }

  function adaptContentLinks(markdownPath) {
    // Markdown-local links (figures or PDFs beside the note) resolve like a .md file.
    const source = notebook.localURL(markdownPath);
    for (const link of content.querySelectorAll("a[href]")) {
      const href = link.getAttribute("href");
      if (href.startsWith("#")) continue;
      try {
        const url = new URL(href, source);
        if (!["https:", "http:", "mailto:"].includes(url.protocol)) { link.removeAttribute("href"); continue; }
        link.href = url.href;
        if (url.origin !== location.origin && url.protocol !== "mailto:") link.rel = "noopener noreferrer";
      } catch (_) { link.removeAttribute("href"); }
    }
    for (const image of content.querySelectorAll("img[src]")) {
      try {
        const url = new URL(image.getAttribute("src"), source);
        if (!["https:", "http:"].includes(url.protocol)) { image.remove(); continue; }
        image.src = url.href;
        image.loading = "lazy";
        image.decoding = "async";
      } catch (_) { image.remove(); }
    }
  }

  function renderAttachments(result) {
    if (!attachments) return;
    attachments.replaceChildren();
    const source = notebook.element("a", "attachment-link", result.pdf ? "Read the paper (PDF)" : "View Markdown source ↗");
    source.href = result.pdf || result.markdown;
    attachments.append(source);
    for (const attachment of result.attachments) {
      const url = notebook.safeLink(attachment.url);
      if (!url) continue;
      const link = notebook.element("a", "attachment-link", `${attachment.label} ↗`);
      link.href = url.href;
      if (url.origin !== location.origin) link.rel = "noopener noreferrer";
      attachments.append(link);
    }
  }

  function renderNeighbors(result, results) {
    if (!neighbors) return;
    const sorted = [...results].sort((a, b) => (b.date || "").localeCompare(a.date || "") || b.title.localeCompare(a.title));
    const index = sorted.findIndex((entry) => entry.slug === result.slug);
    neighbors.replaceChildren();
    for (const [neighbor, label] of [[sorted[index - 1], "Previous result"], [sorted[index + 1], "Next result"]]) {
      if (!neighbor) continue;
      const link = notebook.element("a", "neighbor-link");
      link.href = neighbor.pdf || notebook.articleURL(neighbor.slug);
      link.append(notebook.element("span", "neighbor-label", label), notebook.element("span", "neighbor-title", neighbor.title));
      neighbors.append(link);
    }
    neighbors.hidden = !neighbors.childElementCount;
  }

  async function init() {
    content.setAttribute("aria-busy", "true");
    const slug = new URLSearchParams(location.search).get("result");
    try {
      if (!slug) throw new Error("missing");
      const [results, site] = await Promise.all([notebook.loadResults(), notebook.loadSite()]);
      const result = results.find((entry) => entry.slug === slug);
      if (!result) throw new Error("missing");
      if (result.pdf) {
        const paragraph = notebook.element("p");
        const link = notebook.element("a", "attachment-link", "Read the paper (PDF)");
        link.href = notebook.localURL(result.pdf).href;
        paragraph.append(link);
        content.replaceChildren(paragraph);
      } else {
        const source = (await notebook.fetchText(result.markdown)).replace(/^[\u200B-\u200F\uFEFF]+/, "");
        const parsed = markdownParser().parse(source);
        content.innerHTML = window.DOMPurify.sanitize(parsed, { USE_PROFILES: { html: true }, FORBID_TAGS: ["style", "form", "input", "button"] });
        adaptContentLinks(result.markdown);
      }
      if (title) title.textContent = result.title;
      if (summary) summary.textContent = result.summary;
      document.title = `${result.title} — ${site.name}`;
      const description = document.querySelector('meta[name="description"]');
      if (description) description.content = result.summary;
      renderMetadata(result);
      renderTOC();
      notebook.renderMath(content);
      if (toc) notebook.renderMath(toc);
      renderAttachments(result);
      renderNeighbors(result, results);
      if (loadState) loadState.hidden = true;
    } catch (error) {
      const missing = error.message === "missing";
      if (title) title.textContent = missing ? "Note not found" : "This note could not be loaded";
      if (summary) summary.textContent = missing ? "This link does not match a note in the notebook." : "Refresh the page to try again, or return to the notebook.";
      if (loadState) { loadState.hidden = false; loadState.classList.add("load-error"); loadState.textContent = missing ? "Choose a note from the index to continue." : "The note or its rendering libraries are unavailable. For local previews, start the server described in README.md."; }
      content.replaceChildren();
      const link = notebook.element("a", "attachment-link", "← Return to all notes");
      link.href = "index.html#notes";
      content.append(link);
      if (toc) toc.hidden = true;
      const tocSection = toc?.closest("[data-toc-section]");
      if (tocSection) tocSection.hidden = true;
      if (attachments) attachments.hidden = true;
      if (neighbors) neighbors.hidden = true;
      console.error("Article:", error);
    } finally {
      content.setAttribute("aria-busy", "false");
    }
  }
  init();
})();
