# Vendored browser libraries

The site serves these pinned libraries locally, including the KaTeX font files. No package install, runtime CDN, or build step is required.

| Library | Version | Entry point | Source |
| --- | --- | --- | --- |
| Marked | 18.1.0 | `marked/marked.umd.js` | [Official releases](https://github.com/markedjs/marked/releases/tag/v18.1.0) |
| DOMPurify | 3.4.16 | `dompurify/purify.min.js` | [Official releases](https://github.com/cure53/DOMPurify/releases/tag/3.4.16) |
| KaTeX | 0.19.0 | `katex/katex.min.js` | [Official releases](https://github.com/KaTeX/KaTeX/releases/tag/v0.19.0) |

Files are copied from the corresponding pinned npm packages. Licenses are included in each library directory. KaTeX uses `katex/katex.min.css`, `katex/contrib/auto-render.min.js`, and `katex/fonts/` at their original relative locations.

When updating, replace the compiled browser files and the full KaTeX fonts directory from a pinned release. Verify math rendering, Markdown tables/code, sanitization, and a GitHub Pages project-path preview before publishing. See the official [Marked documentation](https://marked.js.org/), [DOMPurify documentation](https://github.com/cure53/DOMPurify), and [KaTeX browser documentation](https://katex.org/docs/browser.html).
