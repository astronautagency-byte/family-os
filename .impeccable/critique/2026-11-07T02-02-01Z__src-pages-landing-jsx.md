---
target: FamOS website and app visual consistency
total_score: 20
max_score: 32
na_heuristics: 7,10
p0_count: 0
p1_count: 2
target_identity: "file:/Users/alexvorobiev/Project Vibe/FamOS/famOS/src/pages/Landing.jsx"
target_fingerprint: "sha256:02ad6e45f9f5b945d389f36d9ff50c90bdcfc8d085c0af960bffe56220f0c6b0"
target_path: /Users/alexvorobiev/Project Vibe/FamOS/famOS/src/pages/Landing.jsx
timestamp: 2026-11-07T02-02-01Z
slug: src-pages-landing-jsx
---
# FamOS website and app visual audit — November 6, 2026

Method: independent Designly/Impeccable assessments A (design_review) and B (technical_review), synthesized with parent inspection of the live homepage and sign-in screenshots. Website DOM and current source/assets inspected. Authenticated app, mobile rendering, keyboard flows and dark-mode rendering were not verified. No production changes made.

## Verdict

FamOS has specific household language and useful shared component foundations, but imagery comes from several different visual systems. Preserve the warm, flat, minimal direction. Use photography to show family life, actual UI to prove product value, and illustrations for orientation and empty states.

## Priority findings

1. P1: Illustration mismatch. Landing.jsx:439 loads purple, heavily outlined editorial assets; FamilyIllustration.jsx uses softly shaded green/blue family-v4; CompletionScreen.jsx still references family-v3. Consolidate through a shared semantic asset registry with documented framing, palette, character proportions and shading. Preserve the logo and inclusive profile-avatar selection.
2. P1: Product proof is obscured. The live homepage darkens the lifestyle tablet/photo and overlays seven floating labels. The photograph contains a different-looking dashboard; marketing ProductPreview is separately authored demonstration UI. Use current synthetic-data app captures and retain a readable standalone product view beside photography. Do not generate UI text into a photograph.
3. P2: Image delivery is inefficient. Hero and devices are 1536x1024 PNGs, ~2.07 MB and ~1.61 MB respectively. Twelve unique large landing assets total 12,564,871 source bytes (not measured transfer). All 24 inspected landing image nodes lacked srcset and used default loading. Portraits of 724x724/~0.7 MB display near 60 px. Family-v4 files ~1 MB also serve 88x72 app headers. Add responsive derivatives, lazy loading below the fold, intrinsic sizes and an eagerly loaded hero.
4. P2: Styling has competing authorities. famos-tokens.css uses 6px controls/20px cards; illustrated-ui.css overrides 12px/18px. Landing tokens retain lavender while live buttons are coral. Consolidate semantic tokens after documenting the currently rendered design. User-selected palettes should retain their customization while component anatomy stays consistent.
5. P2: Landing hierarchy repeats feature inventories. Reduce repeated feature and AI sections; put one workflow near the top. Choose a plan currently routes to signup: align label/destination. Keep pricing changes separate from this visual audit; current live copy says paid plans charge immediately, so historical trial assumptions are not current proof.

## Proposed asset production brief

| Asset | Direction | Master / delivery |
|---|---|---|
| Homepage hero | Candid family planning in a warm daylight kitchen; screen unobstructed; calm space for headline | 3000–4000px wide master; 640/960/1440/1920/2560 responsive variants, AVIF/WebP |
| Meals story | Parent preparing dinner with tablet showing real Meal Plan or Recipe Book | Separate desktop landscape and mobile portrait crops |
| Shopping story | Phone used while shopping; a legible current shared list | Current UI composited after photographic production |
| Tasks/rewards story | Family completing a chore; actual stars/reward interface beside scene | Match lighting, colour grading and device treatment to hero |
| Product captures | Today, Calendar, Meals, Shopping, Tasks, Rewards and Chat; synthetic household data only | At least 2x intended display size, no private household information; sharp full-screen and detail crops |
| Illustration family | Existing minimal family direction; consistent contours, shadows, palette and backgrounds | Shared registry; header 176–264px, card 640px, large 1024–1536px variants |

Photography should look lived-in and natural, with realistic hands/devices, warm neutral surroundings and restrained brand accents. High resolution alone is insufficient: screen legibility, current product fidelity and mobile cropping are acceptance criteria. Avoid enlarging existing small masters and calling them new high-resolution originals.

## Component acceptance criteria

- Shared page-header, tab, button, field, avatar, card and empty-state anatomy across product screens.
- Semantic surface/text/border tokens in both themes; do not force a single accent across user-selected palettes.
- Illustrations retain a defined role and scale. Existing mobile header-art suppression can remain intentional.
- Desktop and phone screenshots reviewed together; real iOS keyboard/safe-area behavior requires device validation.
- Product captures match actual shipped controls, names and navigation; scripted demonstrations labeled appropriately.
- Reduced-motion behavior retained. No content is accessible only through decorative image text.

## Provisional website heuristic assessment

| Heuristic | Score / 4 |
|---|---:|
| Status visibility | 3 |
| Real-world match | 3 |
| User control | 3 |
| Consistency | 1 |
| Error prevention | 3 |
| Recognition | 3 |
| Efficiency | N/A — marketing scope |
| Minimalism | 2 |
| Error recovery | 2 |
| Help | N/A — not assessed |
| Total | 20/32 |

This is a provisional design assessment, not an authenticated app quality score or accessibility certification. Strengths: concrete household copy, clear sign-in, shared components and reduced-motion support. First-time visitors need clearer product proof; mobile visitors need less visual competition; low-vision users need rendered contrast/zoom validation.

Detector scanned 104 markup files, returned two side-tab warnings: ProductUpdateBanner.jsx:93 and RewardBank.css:10. These are low-priority contextual accent treatments, not evidence of blocking usability defects. The detector does not measure all visual inconsistency or image delivery. Output retained at /tmp/famos-design-detector.json. No overlay injected because browser evaluation is read-only. No local server started.
