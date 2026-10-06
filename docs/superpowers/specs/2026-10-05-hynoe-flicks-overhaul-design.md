# Hynoe Flicks Full Site Overhaul — Design Spec

**Date:** 2026-10-05
**Domain:** https://hynoeflicks.com
**Repository:** `HynoeGeshi/hynoegeshi.github.io`

## 1. Purpose

Turn Hynoe Flicks from a stylish static photography page into a premium, photo-first Chicago photography brand site that immediately sells the quality of the work, loads quickly on phones, generates qualified booking leads, ranks for relevant local photography searches, and can grow into a client/booking platform without another full rewrite.

The primary user outcome is simple: within the first second of landing on the site, a visitor should see strong photography and understand what Hynoe Flicks shoots, where it operates, and how to book.

## 2. Success Criteria

- Real Hynoe Flicks photography is visible above the fold on desktop and mobile.
- The homepage feels photographic and editorial rather than like a text-heavy brochure.
- Core navigation is obvious: Portfolio, Services, Editing, About, Contact/Book.
- Booking works cleanly on mobile and minimizes form friction.
- Portfolio images do not require downloading multi-megabyte originals as thumbnails.
- The site has correct canonical, sitemap, robots, social preview, structured-data, and local SEO metadata for `hynoeflicks.com`.
- The design remains recognizably Hynoe: dark nightlife base, warm brass/gold accent, cinematic lighting, smooth motion, premium but not sterile.
- Visitors can understand service categories and starting expectations before contacting.
- Editing is demonstrated visually with before/after comparisons rather than explained only in copy.
- Analytics can measure portfolio engagement and booking funnel completion.
- The code remains simple enough for GitHub Pages deployment while keeping a clean path to a server-backed booking/client system later.

## 3. Current-State Problems to Fix

### Visual / UX

- The first viewport is dominated by copy and buttons before the user sees the photography.
- The current CSS-generated gold square is acting as the site logo instead of a real Hynoe Flicks identity.
- The visual system is attractive but too generic; the brand needs a distinct photography-specific mark and stronger editorial presentation.
- Portfolio presentation uses a large viewer plus thumbnails, but the overall experience does not feel like a high-end photography portfolio.
- Services are mostly text cards without visual proof.
- Editing is described with text but not shown with interactive before/after work.
- The booking page is a large single-step form.

### Performance

- Several portfolio JPG files are roughly 6–21+ MB each.
- Original images are reused for thumbnails, forcing visitors to download unnecessarily large files.
- The portfolio lacks an optimized image pipeline, `srcset`, AVIF/WebP derivatives, and selective preloading.

### SEO / discoverability

- `robots.txt` points to the GitHub Pages sitemap URL rather than `hynoeflicks.com`.
- `sitemap.xml` contains the GitHub Pages URL rather than the custom domain.
- The site lacks a proper branded OG image, favicon, canonical URLs, and richer structured data.
- The current single-page structure underuses local-intent search opportunities such as Chicago nightlife, portrait, event, music, and brand photography.

### Conversion

- Visitors see multiple CTAs before enough visual proof.
- No starting-price guidance or package expectations are shown.
- There is no testimonial/social-proof section.
- There is no simple “what happens next” booking explanation.
- There is no funnel analytics to tell which services or portfolio categories generate inquiries.

## 4. Information Architecture

### Homepage

1. Sticky translucent navigation
2. Full-screen photo-first hero
3. Featured work strip / editorial mosaic
4. Service categories
5. Category portfolio sections
6. Editing before/after demo
7. About Hynoe / shooting style
8. Testimonials / social proof
9. Process: how booking works
10. FAQ
11. Strong final booking CTA
12. Footer with contact and social links

### Supporting pages

- `/booking.html` — improved multi-step booking request flow
- `/nightlife-photographer-chicago.html`
- `/portrait-photographer-chicago.html`
- `/event-photographer-chicago.html`
- `/music-photographer-chicago.html`
- `/brand-photographer-chicago.html`
- `/photo-editing-retouching.html`

These pages should reuse the same design system but focus copy, images, structured data, and CTA language on one search intent.

## 5. Visual Direction

### Brand personality

- Nightlife
- Cinematic
- Premium
- Confident
- Warm
- Human
- Chicago
- Movement / music energy

### Color system

Keep the current near-black nightlife foundation with warm brass/gold highlights, but reduce decorative gradients where they compete with photographs. Photography should be the strongest color on the page.

### Typography

Move from default system-only styling toward a more intentional editorial pairing while keeping performance acceptable. Use one display face for hero/section titles and a highly readable sans-serif for body/UI. Prefer self-hosted or performant web-safe delivery.

### Logo / mark

Create a real Hynoe Flicks brand mark, not a gradient square. It should work as:

- full wordmark
- compact icon/avatar
- favicon
- watermark
- social preview element

The mark should combine the Hynoe identity with photography/nightlife cues without resembling a generic camera clip-art logo.

## 6. Homepage Hero

Desktop and mobile must show real photography immediately.

Hero content:

- full-bleed selected photograph or lightweight rotating featured set
- small label: `CHICAGO • NIGHTLIFE • PORTRAITS • EVENTS`
- headline: concise, no more than two lines
- one primary CTA: `Book a Shoot`
- one secondary CTA: `View Portfolio`

Do not show three or four competing actions in the first viewport.

The hero image should have:

- optimized AVIF/WebP/JPEG fallbacks
- responsive source sizes
- explicit dimensions/aspect behavior to avoid layout shift
- preload only for the initially visible image
- gradient treatment only when necessary for legibility

## 7. Portfolio System

Replace the current sidebar-thumbnail carousel as the primary browsing experience with an editorial image layout.

Categories:

- Nightlife
- Portraits
- Music / Artists
- Events
- Brand / Lifestyle

Behavior:

- masonry/editorial responsive layout
- click/tap opens a lightbox
- keyboard navigation on desktop
- swipe navigation on mobile
- image caption/category metadata optional but supported
- lazy loading below the fold
- optimized thumbnail and full-view variants
- no broken-image placeholders in production

The homepage should feature a curated subset; category landing pages can show larger collections.

## 8. Image Optimization Pipeline

Existing originals remain source assets, but production should use derivatives.

For each portfolio source image generate approximately:

- thumbnail: 480–640 px wide
- card: 960–1280 px wide
- large/lightbox: 1600–2200 px wide
- AVIF where practical
- WebP fallback
- JPEG fallback only where needed

Targets:

- typical thumbnail under ~120 KB
- typical card image under ~300 KB
- large view preferably under ~700 KB unless visible quality requires more

Use loading priority intentionally:

- hero: eager / high priority
- first visible portfolio row: normal or selective preload
- all lower sections: lazy

## 9. Services and Packages

Service categories:

- Portraits
- Nightlife
- Music / Artist Content
- Events
- Brand / Lifestyle
- Editing / Retouching

Each service module should show:

- a representative image
- short benefit-driven description
- typical duration or scope
- approximate number/range of edited finals where appropriate
- turnaround expectation
- `Starting at` price or consultation language once rates are finalized
- preselected booking CTA

Avoid publishing invented rates. Until rates are explicitly set, the UI may say `Custom quote` while preserving the layout for future starting prices.

## 10. Editing Showcase

Add a draggable before/after comparison component.

Requirements:

- works with mouse and touch
- keyboard accessible
- labels `Before` and `After`
- optimized paired images
- no heavy third-party dependency unless clearly justified
- ability to include multiple examples later

Editing landing page should explain:

- skin retouching
- color grading
- cleanup/object removal where applicable
- tone matching
- social/web export
- how files are delivered

## 11. About / Trust

Add a short “Meet Hynoe” section that explains the shooting experience and what clients can expect.

Tone: relaxed, confident, not overly corporate.

Include:

- portrait of photographer when an approved image is available
- approach to direction/posing
- nightlife/low-light specialty
- Chicago service area
- turnaround expectations

Do not invent awards, client names, or testimonials.

## 12. Social Proof

Create a reusable testimonial component and section.

Until verified testimonials are provided, use a clearly marked empty/content-ready state rather than fabricated quotes.

Future support:

- client name/handle
- service type
- quote
- optional linked Instagram post

## 13. Booking Flow

Replace the long single-step experience with a progressive multi-step interface.

Suggested steps:

1. Service
2. Date + location
3. Vision / references
4. Contact details
5. Review + send

Required behavior:

- persist answers while moving between steps
- back button does not erase data
- service query parameter preselection remains supported
- input validation at each step
- clear submission success state
- clear failure state with fallback contact option
- accessible keyboard navigation
- mobile-first controls

### Submission architecture

Initial implementation may keep EmailJS only if needed to preserve GitHub Pages compatibility, but isolate it behind a small submission module so it can later be replaced by a serverless endpoint without rewriting the form UI.

Add abuse prevention that is compatible with static hosting where practical (honeypot, throttling UX, validation). A later server-backed version should add real rate limiting and server-side validation.

Never place private secrets in client code. EmailJS public identifiers may remain public by design, but must be treated as non-secret configuration.

## 14. Booking Process Explanation

Add a small visual process section:

1. Send request
2. Confirm scope/date
3. Deposit / booking confirmation
4. Shoot
5. Gallery delivery

Do not claim automatic deposits or calendar locking until they actually exist.

## 15. Future Deposits / Availability

Design the current interfaces so these can be added later without a redesign:

- availability calendar
- deposit/payment collection
- automated confirmation email
- reschedule/cancellation rules
- client gallery / download portal

These are phase-two platform capabilities, not required to block the initial visual/SEO/performance overhaul.

## 16. SEO

### Technical

- canonical URLs on every page
- `robots.txt` points to `https://hynoeflicks.com/sitemap.xml`
- sitemap contains all production custom-domain URLs
- favicon and web app icons
- Open Graph + Twitter metadata
- branded OG image
- descriptive titles and meta descriptions
- image `alt` text based on actual content, not keyword stuffing
- semantic headings with one clear H1 per page
- internal links between relevant service pages
- HTTPS-only links

### Structured data

Use JSON-LD where applicable:

- `ProfessionalService` or appropriate local photography business schema
- `Person` for photographer where useful
- `Service` for service pages
- `BreadcrumbList` for internal pages

Only include facts that are actually true and supplied/verified.

### Local search targets

Prioritize natural phrases such as:

- Chicago nightlife photographer
- Chicago portrait photographer
- Chicago event photographer
- Chicago music photographer
- Chicago brand photographer
- Chicago photo retouching / photo editing

Avoid creating thin doorway pages; each landing page must contain unique useful content and real work.

## 17. Analytics / Conversion Tracking

Use a lightweight privacy-conscious analytics setup or GA4 if the site owner chooses it.

Track at minimum:

- `portfolio_view`
- `portfolio_category_click`
- `lightbox_open`
- `service_view`
- `booking_start`
- `booking_step_complete`
- `booking_submit`
- `booking_success`
- `booking_error`
- outbound Instagram click
- email click

No sensitive form contents should be sent to analytics.

## 18. Accessibility

- semantic HTML
- visible focus states
- keyboard-operable menus/lightbox/slider/booking flow
- sufficient contrast
- `prefers-reduced-motion` support
- alt text for meaningful photography
- decorative visuals marked appropriately
- form errors associated with fields

## 19. Mobile UX

Mobile is a first-class target.

- hero image still dominates the first screen
- compact sticky nav
- optional sticky bottom `Book` CTA after initial scroll
- tap targets >= comfortable mobile size
- image layouts avoid horizontal overflow
- lightbox supports swipe
- booking steps fit without zooming
- no oversized background animation that harms battery/performance

## 20. Performance Targets

Aim for strong Core Web Vitals on a typical modern phone connection.

Key constraints:

- dramatically reduce image transfer size from current originals
- avoid loading all portfolio originals on first page load
- defer non-critical scripts
- minimize third-party dependencies
- prevent cumulative layout shift with explicit media sizing
- respect reduced motion

## 21. Security / Reliability

- no passwords/private API keys in GitHub or client JS
- validate and sanitize form values before submission
- avoid injecting raw user input into HTML
- restrict third-party scripts to what is necessary
- use HTTPS links only
- add Content Security Policy only if it can be maintained without breaking required static resources
- preserve fallback contact path if form submission provider fails

## 22. Code Organization

The current site duplicates large CSS blocks inside HTML while also carrying separate CSS/JS assets. Consolidate into focused reusable files.

Proposed structure:

```text
/
  index.html
  booking.html
  nightlife-photographer-chicago.html
  portrait-photographer-chicago.html
  event-photographer-chicago.html
  music-photographer-chicago.html
  brand-photographer-chicago.html
  photo-editing-retouching.html
  robots.txt
  sitemap.xml
  site.webmanifest
  assets/
    css/
      site.css
      booking.css
    js/
      site.js
      gallery.js
      before-after.js
      booking.js
      analytics.js
    img/
      brand/
      portfolio/
        originals/
        thumbs/
        cards/
        large/
      editing/
      about/
    data/
      portfolio.json
      services.json
```

Keep the implementation static-first and dependency-light. Do not introduce a framework unless it solves a demonstrated problem that cannot be handled cleanly in the existing static site.

## 23. Content Rules

- Use real Hynoe Flicks photographs as visual proof.
- Do not fabricate pricing, availability, awards, testimonials, clients, or turnaround promises.
- Keep copy concise and conversational.
- Avoid generic “capturing memories” photography clichés.
- Chicago should be clear without stuffing the city name into every sentence.
- CTAs should use direct language: `Book a Shoot`, `View Portfolio`, `Start an Editing Request`.

## 24. Rollout Sequence

### Phase 1 — Foundation

- consolidate CSS/JS structure
- correct robots/sitemap/canonical metadata
- add favicon/OG scaffolding
- optimize all portfolio image derivatives
- build shared responsive navigation/footer

### Phase 2 — Main conversion experience

- photo-first hero
- editorial portfolio + lightbox
- service modules
- before/after editing module
- About / process / FAQ / social-proof-ready sections
- mobile sticky booking behavior

### Phase 3 — Booking

- progressive multi-step booking UI
- preserve EmailJS compatibility behind submission module
- validation, fallback, success/failure states
- service preselection

### Phase 4 — Search landing pages

- nightlife
- portraits
- events
- music
- brands
- editing
- unique copy, imagery, metadata, schema, and internal linking

### Phase 5 — Measurement and polish

- analytics event layer
- accessibility pass
- reduced-motion pass
- performance pass
- cross-device/browser verification
- broken-link and metadata verification

### Phase 6 — Platform expansion (after static overhaul is proven)

- server-backed lead endpoint
- calendar/availability
- deposits/payments
- automatic confirmations
- client portal/gallery

## 25. Acceptance Checklist

The overhaul is ready to publish when:

- hero shows real photography immediately
- no multi-megabyte original is used as a thumbnail
- booking works on mobile and desktop
- all service CTAs preselect the right service
- editing before/after works with mouse, keyboard, and touch
- main galleries lazy-load appropriately
- no visible broken images or dead links
- robots and sitemap use `hynoeflicks.com`
- canonical/OG/Twitter metadata is valid
- favicon and brand mark exist
- landing pages are linked and in the sitemap
- accessibility basics pass
- reduced-motion mode works
- analytics does not capture form PII
- site remains deployable through the current GitHub Pages setup

## 26. Non-Goals for the First Publish

Do not block the initial launch on:

- a full CRM
- user accounts
- a custom payment backend
- a complex CMS
- an admin dashboard

Those can be added after the faster, photo-first, conversion-ready site is live and measured.
