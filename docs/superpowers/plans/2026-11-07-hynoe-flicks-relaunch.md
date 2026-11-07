# Hynoe Flicks Repair and Relaunch Plan

> **For agentic workers:** Use superpowers:executing-plans for the coordinated repair, with narrowly scoped independent source reviews.

**Goal:** Restore the existing Hynoe Flicks photography site, repair reproduced interaction failures, and verify its public relaunch.

**Architecture:** Preserve the static GitHub Pages site and its existing photography, custom-quote services, contact destination, and EmailJS integration. Restore the eleven files changed by the October 6 offline commits from full-site commit `314d82c`, then make targeted interaction repairs on top of current main.

**Tech Stack:** HTML, CSS, browser ES modules, Python/Pillow checks, Node tests, Playwright browser checks.

**Spec:** `docs/superpowers/specs/2026-10-05-hynoe-flicks-overhaul-design.md`, plus the user's request to check errors and all buttons before relaunch.

## Constraints

- Preserve real portfolio assets, existing services, custom quotes, and the established domain `hynoeflicks.com`.
- Keep existing EmailJS configuration. Simulate provider outcomes during automated browser tests; do not send test inquiries to third parties.
- No invented testimonials, before/after images, new paid services, or unrelated redesign.
- Publish only after local tests, static audits, and desktop/mobile interaction checks pass.
- Use an expected-SHA lease when updating main; verify the exact deployed commit and live domains afterward.

## Repair and verification checklist

- [x] Identify repository, current offline commit, last full-site commit, DNS, and deployment workflow.
- [x] Run baseline helper tests and reproduce structural failures caused by the offline pages.
- [x] Restore full pages, CNAME, robots, and sitemap in a separate local branch.
- [x] Reproduce booking Enter, review-budget, validation focus, tracking, and mobile-resize failures in a background browser.
- [x] Repair those failures and rerun the same browser checks.
- [x] Inspect all eight pages for internal links, assets, console errors, overflow, and mobile navigation.
- [x] Exercise every gallery filter, image viewer control, FAQ, and booking service route.
- [x] Verify simulated successful sends, failed sends, retained answers, fallback email, and duplicate-send prevention.
- [x] Run complete Node/Python tests, image budget checks, and static site verification.
- [x] Obtain an independent final diff review and resolve material findings.
- [ ] Publish the verified changes atomically to main and verify CI, Pages, HTTPS, redirects, and live interactions.

## Review focus

- Keyboard Enter must never send from an intermediate booking step.
- Missing service, schedule, and contact information must show errors on the correct visible step and focus its first invalid control.
- Opening the mobile menu then changing viewport size must restore scrolling.
- Network/provider failure must preserve all booking values and offer an honest retry/fallback.
- A restored custom domain must serve the repaired site rather than the old offline notice or a GitHub 404.

## Verification record

- Baseline Node helpers: 10 passed. Offline HTML caused the expected metadata/robots/sitemap failures.
- Restored site: six Python tests, ten Node tests, static audit, and derivative budgets passed.
- Six browser reproductions failed before the booking/mobile repairs and passed afterward; the full audit passed 38 cases at 1280px, 390px, and 320px, checking 30 distinct links.
- Independent review found a gallery resize scroll-lock interaction. Added a seventh regression, observed it fail, and guarded menu closing by the menu's actual open state.
- Browser regressions are now repository scripts using pinned Playwright 1.62.1 and run in GitHub Site Verify. All provider sends in those scripts are intercepted.
- Ruling: restore the existing custom domain because its DNS still points to GitHub Pages and it is the domain in the accepted site specification; no DNS-provider changes or purchases are required.
- Real email delivery needs separate approval; no test inquiries have been sent.
