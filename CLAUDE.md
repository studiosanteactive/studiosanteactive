# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Static marketing website for Studio Santé Active, a training studio in Montréal (https://studiosanteactive.com). Plain hand-written HTML, CSS and one small vanilla JS file, deployed by Netlify straight from the GitHub repo (pushing to `master` publishes the live site). There is no build step, package manager, or test suite. All site content is in **French** (`lang="fr-CA"`), so keep new copy in French.

## Running locally

Links and assets use root-absolute paths, so serve the site from the repo root rather than opening files directly:

```sh
python3 -m http.server 8000   # then open http://localhost:8000
```

Internal links must point to the `.html` files (`/apropos.html`; the home page is `/`) so they work on any static server. Only the canonical URLs, `og:url`, JSON-LD and `sitemap.xml` use extensionless URLs (`/apropos`), which Netlify also serves.

Checks (the relaxed html-validate rules are intentional: lowercase doctype, inline `--bg` photo variables, muted autoplay hero video):

```sh
npx html-validate@8 --config <(echo '{"extends":["html-validate:recommended"],"rules":{"doctype-style":"off","no-inline-style":"off","tel-non-breaking":"off","no-autoplay":"off"}}') *.html
node --check scripts/site.js
```

## Architecture

- **One self-contained HTML file per page** (`index`, `apropos`, `services`, `therapeutes`, `ceg`, `contact`, `faq`, `conditions`, plus `404.html`, which Netlify serves for missing URLs). There are no templates or includes, so the `<head>`, skip link, floating `.contact-popin` CTA (omitted on `contact.html`/`404.html`), `<header class="site-header">` navbar, holiday notice bar, and `<footer class="site-footer">` are **duplicated in every page and must stay identical**. A change to any of them (phone, hours, a nav link) must be made in all 9 files.
- **Per-page SEO** in each `<head>`: unique `<title>`, meta description, canonical + `og:url` (extensionless, matching `sitemap.xml`; internal links still use `.html`), `og:image` (the page's banner photo, with its real width/height), and a JSON-LD `@graph`. The current nav link gets `active` + `aria-current="page"`. When adding a page, add it to `sitemap.xml` too.
- **Structured data (JSON-LD)**: every page's graph has the `ExerciseGym` business (`@id` `https://studiosanteactive.com/#studio`), a `WebSite`, and the page node with a breadcrumb. The **full** business node (address, hours, holiday `specialOpeningHoursSpecification`, contact) lives only on `index.html` and `contact.html`; other pages reference it by `@id` and add their own data: trainers as `employee` Persons (`apropos`), therapists as `member` (`therapeutes`), an `OfferCatalog` of services (`services`, `ceg`), and `FAQPage` questions (`faq`). When page content changes (new trainer, new class, edited FAQ answer), update the matching JSON-LD on that page.
- **Things that must agree** when hours or holidays change: footer hours (all pages), `HOURS` / `SPECIAL_DAYS` in `scripts/site.js`, `specialOpeningHoursSpecification` in the JSON-LD on `index.html` + `contact.html` (closed days use `opens`/`closes` `00:00`), the static FAQ hours and `[data-holiday-list]` entries, and the FAQ JSON-LD answers.
- **Holiday-season hours** (Christmas Eve, Boxing Day, New Year's Eve...) are set each year in `SPECIAL_DAYS` in `scripts/site.js`, plus the matching JSON-LD and FAQ list entries above. There is no separate seasonal banner to edit: the notice bar under the navbar announces them automatically (up to `NOTICE_MAX_ITEMS` dates, `NOTICE_DAYS_AHEAD` days ahead).
- **`scripts/site.js`** (loaded with `defer` on every page) is purely progressive: pages are complete without it. It fills `[data-current-year]`, the footer open/closed badge `[data-hours-status]`, the `[data-holiday-notice]` bar, and rewrites the FAQ `[data-holiday-list]` to the next 12 months. It shows the homepage video's pause/play button (`[data-video-toggle]`, choice remembered in `localStorage`, hidden under `prefers-reduced-motion`) and opens a FAQ `<details>` when a link targets it (e.g. `/faq.html#conges`). It also adds `js-contact-popin` to `<html>` so the floating CTA only shows between the first banner and the footer. All dates are computed in `America/Montreal`. Statutory closures (Jour de l'An, Pâques, Fête nationale, Fête du Canada, Fête du travail, Action de grâce, Noël) are calculated automatically; one-off closures or reduced hours go in `SPECIAL_DAYS`.
- **Page content** lives in `<main id="contenu">`. Each page has exactly one `<h1>` (the first banner title, or the `.prose` heading on FAQ/Conditions), and heading levels must not skip.
- **CSS**: a single `stylesheets/stylesheet.css`, mobile-first (base = phone, `@media (min-width: 768px)` = tablet, `992px` = desktop). It loads *after* Bootstrap 5.3.3 so it overrides Bootstrap. Brand colours are custom properties on `:root`: use `--ssa-turquoise` for borders/backgrounds and `--ssa-turquoise-text` for any turquoise **text on white** (the bright turquoise fails contrast as text). Bootstrap provides the grid, the collapsing navbar (`navbar-expand-lg`), and utilities like `.visually-hidden` and the `[hidden]` reset.
- **Reusable markup patterns** (copy an existing instance when adding one):
  - Banner: `.banner` > `img.banner-media` + optional `.banner-overlay` with `.banner-title` / `.banner-subtitle`. The first banner image on a page has `fetchpriority="high"`; later ones `loading="lazy"`. The homepage hero is `.banner.banner-hero` with a `<video>`.
  - Photo cards: `.cards` > `.card-category`, and `.large-cards` > `.large-card-category`, with the photo passed as `style="--bg: url('/images/...')"`. The dark gradient is added in CSS. Always use root-absolute image paths in `--bg`.
  - Staff: `.trainers` > `.trainer-card` (with a slug `id` such as `yan-thach` for deep links) > `.trainer-photo` containing an `<img>` (with `width`/`height`) and `.trainer-name`, then `.trainer-role` and bio paragraphs. Trainers are in `apropos.html`; therapists in `therapeutes.html` (wrapped in `a.trainer-link` to their booking site).
  - FAQ: each question is `<details class="faq-item">` > `<summary class="faq-question">` + `<div class="faq-answer">`, grouped under `<h2>` sections. Give a question an `id` on its `<details>` to link to it. The FAQ JSON-LD mirrors these question/answer pairs.
  - Generic "En savoir plus!" / "Essai gratuit" buttons inside cards carry a `<span class="visually-hidden"> : Card title</span>` so screen-reader link lists stay meaningful.
- **Image-based content**: the group class schedule (`images/CEG-schedule.jpeg`, on `index.html` and `ceg.html`) and the price lists (`images/prices/web_*.png` desktop + `mobile_*.png` mobile) are images. Updating a schedule or price usually means replacing the image and keeping the filename. Each price list is one `<figure class="media-figure">` with a `<picture>` that serves the `web_` version at ≥768px; keep the `width`/`height` attributes in sync if image dimensions change.
- **External services**: contact form is an embedded Mailchimp iframe (`contact.html`); "Espace client" and "Essai gratuit" go to the Fliip client portal; Google Analytics tag is in every `<head>`.
- **`netlify.toml`** only holds 301 redirects for legacy URLs (e.g. `/nosservices`). Don't add long cache headers for images: files like `CEG-schedule.jpeg` are replaced in place under the same name.
