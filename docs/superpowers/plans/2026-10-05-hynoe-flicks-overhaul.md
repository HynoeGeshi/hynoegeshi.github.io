# Hynoe Flicks Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild hynoeflicks.com into a fast, photo-first, conversion-focused Chicago photography site with optimized galleries, improved booking, stronger branding, complete SEO infrastructure, and a clean path to future platform features.

**Architecture:** Keep GitHub Pages and a static-first architecture. Split the current monolithic HTML/CSS/JS into focused reusable assets, add an image-derivative pipeline for the existing portfolio originals, use dependency-light vanilla JavaScript modules for interactive features, keep EmailJS isolated behind a booking submission adapter, and add automated structural/SEO tests plus browser verification before publish.

**Tech Stack:** HTML5, CSS, vanilla JavaScript ES modules, Python 3 `unittest`, Pillow for image derivatives, Node built-in test runner for pure JS modules, GitHub Pages, EmailJS, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-05-hynoe-flicks-overhaul-design.md`

## Global Constraints

- Keep the site deployable through the existing GitHub Pages repository and `hynoeflicks.com` custom domain.
- Stay static-first and dependency-light; do not introduce a front-end framework.
- Real Hynoe Flicks photography must be visible above the fold on desktop and mobile.
- Do not fabricate pricing, testimonials, client names, awards, availability, deposits, or turnaround guarantees.
- Do not expose private secrets in HTML or client JavaScript.
- Keep EmailJS configuration treated as public client configuration and isolate submission logic so it can be swapped later.
- Use the custom domain in canonical URLs, sitemap, robots, structured data, and social metadata.
- Do not use multi-megabyte originals as thumbnail/card images.
- Respect `prefers-reduced-motion` and keyboard accessibility.
- Analytics must never receive form PII or message contents.
- Keep copy concise, conversational, Chicago-aware, and free of generic photography clichés.

## Review Focus

1. **Missing or failed portfolio derivative:** the page must preserve layout, show a controlled fallback, and never expose a broken-image icon.
2. **Booking provider failure or offline state:** the user must keep entered data and receive a useful fallback contact path.
3. **Unknown `?service=` query value:** the booking flow must ignore invalid values rather than selecting the wrong service or crashing.
4. **Keyboard-only and reduced-motion users:** navigation, lightbox, before/after control, and booking steps must remain fully usable without animation dependence.
5. **SEO page drift:** every production page must use `hynoeflicks.com`, one H1, a unique title/description, canonical URL, OG metadata, and be present in the sitemap.

---

### Task 1: Verification Harness and File Structure

**Files:**
- Create: `tests/test_site_structure.py`
- Create: `tests/js/site-utils.test.mjs`
- Create: `scripts/verify_site.py`
- Create: `package.json`
- Create: `.github/workflows/site-verify.yml`
- Create directories: `assets/css/`, `assets/js/`, `assets/data/`, `assets/img/brand/`, `assets/img/portfolio/originals/`, `assets/img/portfolio/thumbs/`, `assets/img/portfolio/cards/`, `assets/img/portfolio/large/`, `assets/img/editing/`, `assets/img/about/`

**Interfaces:**
- Produces: `python scripts/verify_site.py` as the structural/SEO verifier.
- Produces: `npm test` using Node's built-in test runner for pure JS utility modules.
- Produces: GitHub Actions verification on pushes and pull requests.

- [ ] **Step 1: Write failing Python tests**

Add tests asserting that required production pages exist, every HTML page has exactly one H1, and every production page has a canonical URL on `https://hynoeflicks.com`.

- [ ] **Step 2: Run the Python tests and verify RED**

Run: `python -m unittest tests/test_site_structure.py -v`

Expected: FAIL because the new page set and verifier structure do not yet exist.

- [ ] **Step 3: Add the minimal verifier skeleton and directory/package structure**

Create `scripts/verify_site.py` with reusable helpers:

- `discover_html_pages(root: Path) -> list[Path]`
- `parse_page(path: Path) -> PageAudit`
- `audit_site(root: Path) -> list[str]`

Create `package.json` with `test` mapped to `node --test tests/js/*.test.mjs` and no runtime dependencies.

- [ ] **Step 4: Run the Python tests and keep only harness-specific assertions GREEN**

Run: `python -m unittest tests/test_site_structure.py -v`

Expected: harness parsing tests PASS; missing future production pages may remain as deliberately failing acceptance assertions until their owning tasks are implemented.

- [ ] **Step 5: Add CI workflow**

Workflow must install Python 3 and Node, run Python unittest, run `npm test`, then run `python scripts/verify_site.py`.

- [ ] **Step 6: Commit**

Commit message: `test: add Hynoe Flicks site verification harness`

---

### Task 2: Shared Design System and Brand Foundation

**Files:**
- Create: `assets/css/site.css`
- Create: `assets/js/site.js`
- Create: `assets/js/site-utils.mjs`
- Create: `assets/img/brand/hynoe-flicks-mark.png`
- Create: `assets/img/brand/hynoe-flicks-og.jpg`
- Create: `favicon.png`
- Create: `site.webmanifest`
- Modify: `index.html`
- Modify: `booking.html`
- Deprecate after migration: `assets/css/style.css`, `assets/js/app.js`

**Interfaces:**
- Produces: `initSiteChrome()` in `assets/js/site.js` for nav/menu/sticky CTA setup.
- Produces: `setExpanded(el, expanded)` and `isReducedMotion()` in `assets/js/site-utils.mjs`.
- Produces: reusable CSS tokens/components consumed by all later pages.

- [ ] **Step 1: Write failing JS utility tests**

Test `setExpanded()` updates `aria-expanded` correctly and `isReducedMotion()` returns a boolean from an injected media-query result.

- [ ] **Step 2: Run JS tests and verify RED**

Run: `npm test`

Expected: FAIL because `assets/js/site-utils.mjs` does not exist.

- [ ] **Step 3: Implement the minimal JS utilities**

Implement the exact exported functions from the Interfaces block.

- [ ] **Step 4: Run JS tests and verify GREEN**

Run: `npm test`

Expected: PASS.

- [ ] **Step 5: Create the shared CSS design system**

Move the validated dark/nightlife/brass design language into `assets/css/site.css`. Define typography, spacing, nav, buttons, cards, section shells, focus states, responsive breakpoints, reduced-motion rules, and sticky mobile booking CTA styles.

- [ ] **Step 6: Create brand assets**

Generate a distinct Hynoe Flicks mark and matching social-preview art. Derive `favicon.png` from the compact mark. Do not use a generic camera clip-art mark.

- [ ] **Step 7: Migrate shared nav/footer shell in `index.html` and `booking.html`**

Both pages must load `assets/css/site.css`, use the real mark, use consistent nav/footer structure, and keep the booking path working.

- [ ] **Step 8: Run structural tests**

Run: `python -m unittest tests/test_site_structure.py -v`

Expected: shared-shell assertions PASS.

- [ ] **Step 9: Commit**

Commit message: `feat: establish Hynoe Flicks shared design system`

---

### Task 3: Portfolio Image Optimization Pipeline

**Files:**
- Create: `scripts/optimize_portfolio.py`
- Create: `tests/test_image_pipeline.py`
- Create: `assets/data/portfolio.json`
- Move/copy source images into: `assets/img/portfolio/originals/`
- Generate: `assets/img/portfolio/thumbs/`
- Generate: `assets/img/portfolio/cards/`
- Generate: `assets/img/portfolio/large/`

**Interfaces:**
- Produces: `build_derivatives(source: Path, output_root: Path, stem: str) -> dict[str, str]`.
- Produces: `assets/data/portfolio.json` with `id`, `category`, `alt`, `caption`, `thumb`, `card`, `large`, `width`, `height`.
- Consumed by: gallery rendering and service/landing-page imagery.

- [ ] **Step 1: Write failing image-pipeline tests**

Use a small fixture image created during the test. Assert derivatives exist at thumbnail/card/large sizes, dimensions do not exceed configured maximum widths, and metadata paths use the optimized folders rather than originals.

- [ ] **Step 2: Run tests and verify RED**

Run: `python -m unittest tests/test_image_pipeline.py -v`

Expected: FAIL because optimizer does not exist.

- [ ] **Step 3: Implement `scripts/optimize_portfolio.py`**

Use Pillow with orientation correction and high-quality resizing. Generate WebP and JPEG fallback derivatives; attempt AVIF only if the installed Pillow build supports it, without making AVIF support a hard failure.

- [ ] **Step 4: Run image tests and verify GREEN**

Run: `python -m unittest tests/test_image_pipeline.py -v`

Expected: PASS.

- [ ] **Step 5: Process the real existing portfolio images**

Create thumb/card/large derivatives for all current `p1`–`p8` images. Preserve originals only as source assets.

- [ ] **Step 6: Create `portfolio.json`**

Use real categories/alt text based on visible image content. If a category cannot be confidently inferred, use a neutral `Portfolio` category instead of inventing specifics.

- [ ] **Step 7: Verify size targets**

Run optimizer in report/check mode and confirm no generated thumbnail/card variant exceeds configured size thresholds without an explicit logged exception.

- [ ] **Step 8: Commit**

Commit message: `perf: add optimized portfolio image pipeline`

---

### Task 4: Photo-First Homepage and Editorial Portfolio

**Files:**
- Replace: `index.html`
- Create: `assets/js/gallery.js`
- Create: `assets/js/gallery-utils.mjs`
- Create: `tests/js/gallery-utils.test.mjs`
- Modify: `assets/css/site.css`
- Read: `assets/data/portfolio.json`

**Interfaces:**
- Produces: `initGallery(root, items)` in `assets/js/gallery.js`.
- Produces pure utilities: `nextIndex(current, length)`, `previousIndex(current, length)`, `normalizeCategory(value)`.
- Gallery DOM supports click, Escape, ArrowLeft, ArrowRight, and mobile swipe.

- [ ] **Step 1: Write failing gallery utility tests**

Assert index wrapping, empty-list guard behavior, and category normalization.

- [ ] **Step 2: Run JS tests and verify RED**

Run: `npm test`

Expected: FAIL because gallery utilities do not exist.

- [ ] **Step 3: Implement gallery utilities and verify GREEN**

Run: `npm test`

Expected: PASS.

- [ ] **Step 4: Rebuild the homepage hero**

Hero must show an optimized real photograph above the fold, concise Chicago/service label, one `Book a Shoot` CTA, and one `View Portfolio` CTA. Use responsive `<picture>` sources and explicit dimensions/aspect handling.

- [ ] **Step 5: Build editorial portfolio sections**

Render a featured grid from `portfolio.json`, category filters when supported by real metadata, and a reusable lightbox with focus management and swipe/keyboard controls.

- [ ] **Step 6: Add service modules, About shell, process, testimonial-ready state, FAQ, and final CTA**

Use real content only. Testimonials remain a clearly empty/content-ready component until verified quotes are supplied.

- [ ] **Step 7: Add mobile sticky booking behavior**

Show after the initial hero scroll, not immediately over the hero.

- [ ] **Step 8: Run structural and JS tests**

Run: `npm test && python -m unittest tests/test_site_structure.py -v`

Expected: PASS for homepage/gallery assertions.

- [ ] **Step 9: Commit**

Commit message: `feat: rebuild homepage around photography and portfolio`

---

### Task 5: Interactive Editing Showcase

**Files:**
- Create: `assets/js/before-after.js`
- Create: `assets/js/before-after-utils.mjs`
- Create: `tests/js/before-after-utils.test.mjs`
- Create/use: `assets/img/editing/*`
- Modify: `index.html`
- Modify: `assets/css/site.css`

**Interfaces:**
- Produces: `clampPercent(value) -> number`.
- Produces: `keyboardDelta(key, current) -> number`.
- Produces: `initBeforeAfter(root)` for pointer, touch, and keyboard control.

- [ ] **Step 1: Write failing utility tests**

Assert clamping to 0–100 and ArrowLeft/ArrowRight keyboard behavior.

- [ ] **Step 2: Run JS tests and verify RED**

Run: `npm test`

Expected: FAIL.

- [ ] **Step 3: Implement pure utilities and verify GREEN**

Run: `npm test`

Expected: PASS.

- [ ] **Step 4: Build accessible before/after component**

Use a range-slider semantic model, visible `Before`/`After` labels, pointer/touch dragging, and keyboard support.

- [ ] **Step 5: Add a real paired editing example**

Use an approved existing image pair if available in the repository. If no real before/after pair exists, keep the component hidden behind a content-ready state rather than faking an edit.

- [ ] **Step 6: Commit**

Commit message: `feat: add accessible editing before-after showcase`

---

### Task 6: Progressive Booking Flow and Submission Adapter

**Files:**
- Replace: `booking.html`
- Create: `assets/css/booking.css`
- Create: `assets/js/booking.js`
- Create: `assets/js/booking-utils.mjs`
- Create: `tests/js/booking-utils.test.mjs`

**Interfaces:**
- Produces pure functions: `normalizeService(value)`, `validateStep(stepId, data)`, `buildSubmissionPayload(data)`.
- Produces: `submitBooking(payload) -> Promise<SubmissionResult>` adapter inside `booking.js`.
- Preserves valid `?service=` preselection.

- [ ] **Step 1: Write failing booking utility tests**

Cover valid service preselection, unknown service rejection, required fields by step, payload omission of analytics-sensitive values, and preservation of form state between steps.

- [ ] **Step 2: Run JS tests and verify RED**

Run: `npm test`

Expected: FAIL.

- [ ] **Step 3: Implement booking utilities and verify GREEN**

Run: `npm test`

Expected: PASS.

- [ ] **Step 4: Build the five-step booking UI**

Steps: Service; Date + location; Vision/references; Contact; Review + send. Back/forward navigation must preserve data.

- [ ] **Step 5: Isolate EmailJS submission**

Keep the current EmailJS public configuration but place provider-specific logic only inside `submitBooking()`. Add a honeypot, client-side timing guard, validation, success state, error state, and fallback email/contact link.

- [ ] **Step 6: Keep data after submission failure**

A failed provider call must not clear the form.

- [ ] **Step 7: Verify booking page structure**

Run: `npm test && python scripts/verify_site.py`

Expected: PASS.

- [ ] **Step 8: Commit**

Commit message: `feat: rebuild booking into progressive request flow`

---

### Task 7: Service Data, Packages, and Local SEO Landing Pages

**Files:**
- Create: `assets/data/services.json`
- Create: `nightlife-photographer-chicago.html`
- Create: `portrait-photographer-chicago.html`
- Create: `event-photographer-chicago.html`
- Create: `music-photographer-chicago.html`
- Create: `brand-photographer-chicago.html`
- Create: `photo-editing-retouching.html`
- Modify: `index.html`
- Modify: `assets/css/site.css`
- Modify: `tests/test_site_structure.py`

**Interfaces:**
- Produces shared service records with `slug`, `name`, `summary`, `image`, `bookingValue`, `pricingLabel`, `deliverables`, and `turnaroundLabel`.
- Landing pages consume the same shared nav/footer styles and use service-specific booking query parameters.

- [ ] **Step 1: Extend structural tests and verify RED**

Assert all six pages exist, each has a unique title/meta description/H1/canonical, and each links to booking with the expected service parameter.

- [ ] **Step 2: Run tests and verify RED**

Run: `python -m unittest tests/test_site_structure.py -v`

Expected: FAIL because pages do not exist.

- [ ] **Step 3: Create `services.json`**

Do not invent rates. Set `pricingLabel` to `Custom quote` until real rates are provided. Use only deliverables/turnaround statements that are already true; otherwise use consultation language.

- [ ] **Step 4: Build six unique landing pages**

Each page must contain unique service-specific useful copy, real relevant images where identifiable, one H1, service proof, process, FAQ, and direct booking CTA.

- [ ] **Step 5: Link service pages from homepage and footer where relevant**

- [ ] **Step 6: Run tests and verify GREEN**

Run: `python -m unittest tests/test_site_structure.py -v`

Expected: PASS for landing-page assertions.

- [ ] **Step 7: Commit**

Commit message: `feat: add Chicago photography service landing pages`

---

### Task 8: SEO Infrastructure, Structured Data, and Social Metadata

**Files:**
- Modify: `robots.txt`
- Replace: `sitemap.xml`
- Modify: all production HTML pages
- Modify: `site.webmanifest`
- Modify: `scripts/verify_site.py`
- Modify: `tests/test_site_structure.py`

**Interfaces:**
- `scripts/verify_site.py` verifies canonical domain, sitemap membership, one H1, unique titles/descriptions, OG title/image/url, Twitter card, JSON-LD parseability, and no `hynoegeshi.github.io` production URLs.

- [ ] **Step 1: Add failing SEO assertions**

Assert robots points to `https://hynoeflicks.com/sitemap.xml`, sitemap contains every production page, no production metadata references the GitHub Pages hostname, and every page has valid OG/Twitter metadata.

- [ ] **Step 2: Run tests and verify RED**

Run: `python -m unittest tests/test_site_structure.py -v`

Expected: FAIL against old robots/sitemap and missing metadata.

- [ ] **Step 3: Correct robots and sitemap**

Use the custom domain exclusively and include all production landing/booking pages that should be indexed.

- [ ] **Step 4: Add canonical, OG, Twitter, favicon, and manifest metadata to all pages**

- [ ] **Step 5: Add truthful JSON-LD**

Use `ProfessionalService`/`Service`/`BreadcrumbList` only with facts available from the site. Do not invent a street address, reviews, prices, awards, or operating hours.

- [ ] **Step 6: Run verifier and tests GREEN**

Run: `python scripts/verify_site.py && python -m unittest tests/test_site_structure.py -v`

Expected: PASS with zero audit errors.

- [ ] **Step 7: Commit**

Commit message: `seo: complete custom-domain metadata and local search foundation`

---

### Task 9: Analytics Event Layer, Accessibility, and Performance Hardening

**Files:**
- Create: `assets/js/analytics.js`
- Create: `assets/js/analytics-utils.mjs`
- Create: `tests/js/analytics-utils.test.mjs`
- Modify: `assets/js/site.js`
- Modify: `assets/js/gallery.js`
- Modify: `assets/js/booking.js`
- Modify: `assets/css/site.css`
- Modify: `scripts/verify_site.py`

**Interfaces:**
- Produces: `trackEvent(name, properties = {})`.
- Pure helper: `sanitizeAnalyticsProperties(properties)` must drop keys matching email, name, phone, details, message, reference URLs, and free-text form content.
- Event names: `portfolio_view`, `portfolio_category_click`, `lightbox_open`, `service_view`, `booking_start`, `booking_step_complete`, `booking_submit`, `booking_success`, `booking_error`, `instagram_click`, `email_click`.

- [ ] **Step 1: Write failing analytics privacy tests**

Assert safe categorical keys pass through while PII/free-text keys are stripped.

- [ ] **Step 2: Run JS tests and verify RED**

Run: `npm test`

Expected: FAIL.

- [ ] **Step 3: Implement analytics utility and no-op event adapter**

Until a concrete analytics provider is configured, emit to a safe no-op/custom-event layer rather than silently adding a third-party tracker.

- [ ] **Step 4: Wire funnel events into existing interactions**

Do not include form contents.

- [ ] **Step 5: Accessibility hardening**

Add visible focus rings, skip link, modal focus trap/restore, semantic labels, ARIA where needed, associated form errors, and reduced-motion overrides.

- [ ] **Step 6: Performance hardening**

Ensure hero uses eager/high-priority loading, lower images use lazy loading, scripts are deferred/modules, images have dimensions/aspect handling, and no original multi-megabyte image appears in homepage/landing-page `src`/`srcset`.

- [ ] **Step 7: Extend verifier for performance/accessibility invariants**

Static checks: image loading attributes, no original-path usage outside controlled source references, no empty meaningful alt attributes, reduced-motion CSS present, and forms have labels.

- [ ] **Step 8: Run full automated suite**

Run: `npm test && python -m unittest discover tests -v && python scripts/verify_site.py`

Expected: all PASS.

- [ ] **Step 9: Commit**

Commit message: `feat: add privacy-safe analytics and accessibility hardening`

---

### Task 10: Browser Verification, Visual QA, and Release Readiness

**Files:**
- Modify only files required by verified bugs.
- Create: `docs/qa/2026-10-05-hynoe-flicks-release-check.md`

**Interfaces:**
- Produces a documented QA result covering desktop/mobile, homepage, booking, landing pages, keyboard flow, console errors, and link integrity.

- [ ] **Step 1: Serve the branch locally**

Run a simple local static server from the repository root.

- [ ] **Step 2: Browser-check desktop homepage**

Verify real photography is above the fold, nav works, gallery opens/closes, arrows work, service links work, no console errors, no broken images, and sticky CTA behaves correctly.

- [ ] **Step 3: Browser-check mobile homepage**

Verify menu, photo-first hero, gallery swiping, readable sections, sticky booking CTA, no horizontal overflow, and reduced-motion behavior.

- [ ] **Step 4: Browser-check booking**

Exercise all steps, valid service preselection, invalid service query, back navigation, validation messages, submission failure behavior without clearing data, and fallback contact path.

- [ ] **Step 5: Browser-check each SEO landing page**

Verify correct H1, hero image, booking CTA/service preselection, canonical URL, and no broken assets.

- [ ] **Step 6: Run final automated suite**

Run: `npm test && python -m unittest discover tests -v && python scripts/verify_site.py`

Expected: all PASS.

- [ ] **Step 7: Record QA evidence**

Write `docs/qa/2026-10-05-hynoe-flicks-release-check.md` with pages checked, issues found/fixed, test commands, and final result.

- [ ] **Step 8: Commit**

Commit message: `test: complete Hynoe Flicks release verification`

---

## Plan Self-Review

- **Spec coverage:** visual redesign, branding, image optimization, homepage, portfolio, before/after editing, booking, landing pages, SEO, analytics, accessibility, performance, security constraints, and browser QA all map to explicit tasks.
- **Intentional deferral:** calendar availability, deposits/payments, CRM/client accounts, and full client gallery remain phase-two platform work exactly as the spec's non-goals require.
- **Type/interface consistency:** all cross-task JS utilities are explicitly named and later tasks consume those names without alternate aliases.
- **Risk coverage:** image failures, provider failures, invalid service query values, keyboard/reduced-motion behavior, and SEO drift are each covered by owning tests or QA steps.
- **Scope:** ten tasks produce one coherent static-site release; no framework migration or unrelated repository refactor is included.
