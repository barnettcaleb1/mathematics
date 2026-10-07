#!/usr/bin/env python3
"""Validate the static site and optionally stage only its public files."""

import argparse
from datetime import date
from html.parser import HTMLParser
import json
import os
from pathlib import Path
import re
import shutil
import sys
from urllib.parse import unquote, urlsplit


ROOT = Path(__file__).resolve().parents[1]
PUBLIC_FILES = ("index.html", "article.html", "404.html", ".nojekyll")
PUBLIC_DIRS = ("assets", "content")
VENDOR_FILES = (
    "assets/vendor/marked/marked.umd.js",
    "assets/vendor/dompurify/purify.min.js",
    "assets/vendor/katex/katex.min.css",
    "assets/vendor/katex/katex.min.js",
    "assets/vendor/katex/contrib/auto-render.min.js",
)
SLUG = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
ERRORS = []


def require(condition, message):
    if not condition:
        ERRORS.append(message)
    return condition


def local_file(value, source=None):
    """Resolve a site-relative URL without accepting an escape from the site."""
    source = source or ROOT / "index.html"
    if not isinstance(value, str):
        ERRORS.append(f"Invalid URL in {source.relative_to(ROOT)}: {value!r}")
        return None
    try:
        parts = urlsplit(value)
    except ValueError:
        ERRORS.append(f"Invalid URL: {value}")
        return None
    if parts.scheme or parts.netloc:
        require(parts.scheme in ("https", "http", "mailto", "tel"),
                f"Unsupported URL scheme: {value}")
        if parts.scheme in ("https", "http"):
            require(bool(parts.netloc), f"URL needs a hostname: {value}")
        return None
    path = unquote(parts.path)
    if not path:
        return None
    # Relative URLs work on both user sites and /repository/ project sites.
    if not require(not path.startswith("/") and "\\" not in path,
                   f"Use a relative site URL: {value}"):
        return None
    target = (source.parent / path).resolve()
    if not require(target.is_relative_to(ROOT), f"URL escapes the site: {value}"):
        return None
    if target.is_dir():
        target = target / "index.html"
    require(target.is_file(), f"Missing linked file: {target.relative_to(ROOT)}")
    return target


class Links(HTMLParser):
    def __init__(self, source):
        super().__init__()
        self.source = source

    def handle_starttag(self, tag, attrs):
        for name, value in attrs:
            if name in ("href", "src") and value:
                local_file(value, self.source)


def read_json(relative):
    try:
        return json.loads((ROOT / relative).read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        ERRORS.append(f"Cannot read {relative}: {exc}")
        return None


def check_manifest():
    site = read_json("content/site.json")
    if isinstance(site, dict):
        for field in ("name", "description"):
            require(isinstance(site.get(field), str) and site[field].strip(),
                    f"site.json needs a nonempty {field}")
    else:
        require(False, "site.json must be a JSON object")

    manifest = read_json("content/results.json")
    if not require(isinstance(manifest, dict), "results.json must be a JSON object"):
        return
    require(type(manifest.get("version")) is int and manifest["version"] == 1,
            "results.json version must be 1")
    results = manifest.get("results")
    if not require(isinstance(results, list), "results.json needs a results array"):
        return

    seen = set()
    for index, result in enumerate(results):
        prefix = f"Result {index + 1}"
        if not require(isinstance(result, dict), f"{prefix} must be an object"):
            continue
        slug = result.get("slug")
        if not require(isinstance(slug, str) and bool(SLUG.fullmatch(slug)),
                       f"{prefix} needs a lowercase, hyphenated slug"):
            continue
        prefix = slug
        require(slug not in seen, f"Duplicate result slug: {slug}")
        seen.add(slug)
        for field in ("title", "summary", "topic"):
            require(isinstance(result.get(field), str) and result[field].strip(),
                    f"{prefix}: missing {field}")
        has_markdown = "markdown" in result
        has_pdf = "pdf" in result
        require(has_markdown != has_pdf, f"{prefix}: use exactly one of markdown or pdf")
        if has_markdown or "status" in result:
            require(result.get("status") in ("Draft", "Checked", "Computational", "Conjecture"),
                    f"{prefix}: status must be Draft, Checked, Computational, or Conjecture")
        if has_markdown or "date" in result:
            require(isinstance(result.get("date"), str) and
                    bool(re.fullmatch(r"\d{4}-\d{2}-\d{2}", result["date"])),
                    f"{prefix}: date must use YYYY-MM-DD")
            try:
                date.fromisoformat(result.get("date", ""))
            except (ValueError, TypeError):
                ERRORS.append(f"{prefix}: date must use YYYY-MM-DD")
        if has_markdown:
            markdown = result.get("markdown")
            expected = f"content/results/{slug}.md"
            require(markdown == expected, f"{prefix}: markdown must be {expected}")
            if markdown == expected:
                local_file(markdown)
        if has_pdf:
            pdf = result.get("pdf")
            expected = f"content/papers/{slug}.pdf"
            require(pdf == expected, f"{prefix}: pdf must be {expected}")
            if pdf == expected:
                path = local_file(pdf)
                if path and path.is_file():
                    require(path.stat().st_size > 5, f"{prefix}: PDF must not be empty")
                    with path.open("rb") as paper:
                        require(paper.read(5) == b"%PDF-", f"{prefix}: file needs a PDF header")
        authors = result.get("authors", [])
        require(isinstance(authors, list) and
                all(isinstance(author, str) and author.strip() for author in authors),
                f"{prefix}: authors must be an array of nonempty strings")
        require(isinstance(result.get("isExample", False), bool),
                f"{prefix}: isExample must be true or false")
        minutes = result.get("readingMinutes", 1)
        require(type(minutes) is int and minutes > 0,
                f"{prefix}: readingMinutes must be a positive integer")
        tags = result.get("tags", [])
        require(isinstance(tags, list) and all(isinstance(tag, str) for tag in tags),
                f"{prefix}: tags must be an array of strings")
        attachments = result.get("attachments", [])
        if require(isinstance(attachments, list), f"{prefix}: attachments must be an array"):
            for attachment in attachments:
                if not require(isinstance(attachment, dict),
                               f"{prefix}: each attachment must be an object"):
                    continue
                require(isinstance(attachment.get("label"), str) and attachment["label"].strip(),
                        f"{prefix}: attachment needs a label")
                url = attachment.get("url")
                if require(isinstance(url, str) and url.strip(), f"{prefix}: attachment needs a URL"):
                    require(not re.match(r"^[a-z]+:", url, re.I) or url.startswith("https://"),
                            f"{prefix}: attachments need a relative file URL or https:// URL")
                    local_file(url)


def check_files():
    for relative in PUBLIC_FILES + PUBLIC_DIRS:
        require((ROOT / relative).exists(), f"Missing public file or directory: {relative}")
    for relative in VENDOR_FILES:
        require((ROOT / relative).is_file(), f"Missing vendored library: {relative}")
    for directory in PUBLIC_DIRS:
        for path in (ROOT / directory).rglob("*"):
            require(not path.is_symlink(), f"Public files cannot be symlinks: {path.relative_to(ROOT)}")
            require(not any(part.startswith(".") for part in path.relative_to(ROOT).parts),
                    f"Remove hidden public file: {path.relative_to(ROOT)}")
    for name in PUBLIC_FILES:
        path = ROOT / name
        require(not path.is_symlink(), f"Public files cannot be symlinks: {name}")
        if path.suffix == ".html" and path.exists():
            Links(path).feed(path.read_text(encoding="utf-8"))
    for path in (ROOT / "assets").rglob("*.css"):
        for value in re.findall(r"url\(\s*['\"]?([^)'\"\s]+)", path.read_text(encoding="utf-8")):
            if not value.startswith("data:"):
                local_file(value, path)


def stage(destination):
    destination = destination.resolve()
    if destination.is_relative_to(ROOT):
        raise ValueError("Stage outside the source directory, for example /tmp/math-site.")
    if destination.exists():
        raise ValueError(f"Staging directory already exists: {destination}")
    destination.mkdir(parents=True)
    for name in PUBLIC_FILES:
        shutil.copy2(ROOT / name, destination / name)
    for name in PUBLIC_DIRS:
        shutil.copytree(ROOT / name, destination / name)
    repository = os.environ.get("GITHUB_REPOSITORY", "")
    owner, separator, name = repository.partition("/")
    valid_name = re.compile(r"^[A-Za-z0-9_.-]+$")
    base_path = "/"
    if separator and valid_name.fullmatch(owner) and valid_name.fullmatch(name):
        if name.lower() != f"{owner.lower()}.github.io":
            base_path = f"/{name}/"
    error_page = destination / "404.html"
    error_page.write_text(
        error_page.read_text(encoding="utf-8").replace(
            '"__PAGES_BASE_PATH__"', json.dumps(base_path)
        ),
        encoding="utf-8",
    )
    print(f"Public files staged in {destination}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--stage", type=Path, help="Copy validated public files to a new directory")
    args = parser.parse_args()
    check_files()
    check_manifest()
    if ERRORS:
        for error in ERRORS:
            print(f"ERROR: {error}", file=sys.stderr)
        return 1
    print("Site checks passed: metadata, publication files, HTML links, and CSS assets.")
    if args.stage:
        try:
            stage(args.stage)
        except (OSError, ValueError) as exc:
            print(f"ERROR: {exc}", file=sys.stderr)
            return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
