# Caleb Barnett — Mathematics

A plain HTML research page for AI-assisted mathematics, ready for GitHub Pages. Publish papers directly as PDFs or write results in Markdown with rendered LaTeX. A JSON index controls their metadata. The site has no build step, package manager, or backend.

The archive currently contains three papers by Caleb Barnett:

- [Kirchberg algebras as full amalgams of stably finite algebras](content/papers/kirchberg-algebras-full-amalgams-stably-finite-draft.pdf), dated 7 October 2026 — Draft (conditional verification).
- [Cubic lower bounds for conjugacy separation in nilpotent groups](content/papers/cubic-lower-bounds-conjugacy-separation-nilpotent-groups-draft.pdf), dated 7 October 2026 — Draft (independent review pending).
- [Rapid Decay and C*-Simplicity: A Supplementary Sunflower Proof](content/papers/rapid-decay-c-star-simplicity-sunflower-proof.pdf), dated 4 October 2026.

Website: <https://barnettcaleb1.github.io/mathematics/>. Repository: <https://github.com/barnettcaleb1/mathematics>.

## Preview locally

Run these commands from this folder:

```sh
python3 scripts/check_site.py
python3 -m http.server 8000
```

Open <http://localhost:8000>. Use the local server because the article reader loads its content with `fetch`; opening an HTML file directly does not provide that behavior.

## Add a PDF paper

1. Copy the paper to `content/papers/my-paper.pdf`.
2. Add its metadata to the `results` array in `content/results.json`.
3. Update the publication list in `index.html` with the same title and PDF link. This is the fallback for readers with JavaScript disabled.
4. Run the site check and preview the paper link.

```json
{
  "slug": "my-paper",
  "title": "Paper title",
  "summary": "A short description of the paper.",
  "topic": "Number theory",
  "authors": ["Author name"],
  "pdf": "content/papers/my-paper.pdf",
  "tags": ["divisibility"]
}
```

Use the title and authors listed in the paper. A PDF entry needs no Markdown file, publication date, or verification label. Its homepage link opens the PDF directly. If you supply a date or status, the usual date and status rules below apply.

Keep the top-level manifest as `{"version": 1, "results": [...]}`. Each entry must have exactly one `pdf` or `markdown` field. Slugs must be unique lowercase words separated by hyphens, and the content filename must match the slug. Any topic can be used. Search covers titles, descriptions, subjects, authors, and tags.

## Add a Markdown result

1. Create `content/results/my-result.md`.
2. Add an entry to the `results` array in `content/results.json`.
3. Update the publication list in `index.html` to keep its static fallback current.
4. Run the site check and preview the result.

```json
{
  "slug": "my-result",
  "title": "A title for the result",
  "summary": "A short description of the claim and its scope.",
  "date": "2026-10-06",
  "topic": "Number theory",
  "status": "Conjecture",
  "isExample": false,
  "readingMinutes": 5,
  "markdown": "content/results/my-result.md",
  "tags": ["divisibility"],
  "attachments": []
}
```

Markdown entries require a date using `YYYY-MM-DD` and a status.

The four statuses are `Draft`, `Checked`, `Computational`, and `Conjecture`. Use `Draft` for research drafts pending independent mathematical verification, including papers with conditional formal verification. Choose the status that reflects the evidence you have; the status is an editorial label and is not assigned by the site. Explain the model, prompts, checks, limitations, and any human review within the result itself.

The article title comes from the index, so start the Markdown body with an introduction or `##` heading. Second-level headings populate the table of contents. Write mathematics as `$inline math$` and `$$display math$$`, or use `\(...\)` and `\[...\]`. Regular Markdown tables, links, and fenced code blocks are supported.

```markdown
## Statement

For every integer $n \geq 1$,

$$
\sum_{k=1}^{n} k = \frac{n(n+1)}{2}.
$$

## Proof and checks

Write the argument and describe how it was checked.
```

To attach a PDF, notebook, or other file, save it inside `content/attachments/` and add an attachment:

```json
{"label": "Download PDF", "url": "content/attachments/my-result.pdf"}
```

An attachment can also use a full `https://` URL. Keep local links relative to the site root so they work when GitHub hosts the site under a repository name. A result's shareable address is `article.html?result=my-result`.

To remove a publication, delete its index entry and associated public content file. An empty `results` array is supported.

## Customize

- Edit `content/site.json` for the site name, description, introduction, about text, author, email, and repository URL. Leave optional contact fields empty to omit their links.
- Edit `assets/css/style.css` to change the type, spacing, or link colors.
- Edit `index.html` for the homepage structure and `article.html` for the reader structure. Their script and data paths are relative, so no repository-specific base URL is needed.

Markdown, sanitizing, and math rendering libraries are stored in `assets/vendor/`, including KaTeX fonts. Their license files accompany the local copies. The site can render without a CDN.

## Publish with GitHub Pages

Create a GitHub repository and upload this folder, including `.github/workflows/pages.yml`. A public repository works with GitHub Free. Use `YOUR_USERNAME.github.io` as the repository name for `https://YOUR_USERNAME.github.io/`, or another name for `https://YOUR_USERNAME.github.io/YOUR_REPOSITORY/`. [GitHub's setup guide](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site) explains these options.

For a new repository, replace the placeholders and run:

```sh
git init -b main
git add .
git commit -m "Create mathematics archive"
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
git push -u origin main
```

If this folder already belongs to a Git repository, use its existing history and remote instead of initializing again. The workflow publishes the `main` branch; change the workflow's branch setting if your publishing branch has a different name.

In the GitHub repository, open **Settings → Pages → Build and deployment**, then choose **GitHub Actions** as the source. The workflow runs on pushes to `main`, or can be started manually from **Actions → Publish GitHub Pages → Run workflow**. Once it succeeds, the Pages settings and deployment expose the published URL. [GitHub's publishing-source guide](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site) documents this setup.

The workflow validates the site, stages only `index.html`, `article.html`, `404.html`, `.nojekyll`, `assets/`, and `content/`, then deploys that artifact. Documentation, scripts, and repository metadata stay out of the published artifact. Put primary PDFs inside `content/papers/` and other downloads inside `content/attachments/`.

During deployment, the staging script sets the 404 page's home link from the GitHub repository name, so it works for both account sites and project sites. Custom domains use `/` as their home address.

## Files

```text
index.html                       Homepage and result index
article.html                     Markdown article reader
404.html                         Missing-page fallback
assets/css/style.css             Design and responsive layout
assets/js/                       Filtering, rendering, and interactions
assets/vendor/                   Local rendering libraries and fonts
content/site.json                Identity and contact settings
content/results.json             Result metadata
content/papers/*.pdf              Published PDF papers
content/results/*.md             Results written in Markdown
content/attachments/              Optional public downloads
scripts/check_site.py            Validation and isolated deployment staging
.github/workflows/pages.yml       GitHub Pages publishing workflow
```
