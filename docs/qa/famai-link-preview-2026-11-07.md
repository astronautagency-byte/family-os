# FamAI link-preview refresh — 2026-11-07

Replaced the generic cream/lifestyle FamAI preview with a dedicated near-black 1200x630 JPEG rendered from the page's actual illustrative Mia Voice and AI Chat phone mockups. The headline and subhead fit within explicit safe areas. Image size 63,389 bytes. Versioned URL: /marketing/social/fam-ai-v3.jpg.

Shortened the title to “Meet Mia — Your AI Home Assistant | FamOS”; Open Graph, secure image, Twitter metadata and image alt text all use the new asset through publicMeta. Alt text accurately describes dark phone previews rather than a family photo. The generic social generator validates this committed asset instead of replacing it with the cream template. scripts/capture-famai-social.mjs documents reproducible isolated-browser rendering.

Improved explanatory font sizes on phone and desktop, and preserved spaces around the scroll-story copy when mobile line breaks are hidden. Production build verifies metadata, image dimensions and descriptions across 28 public routes. Six focused marketing/page tests pass. Headless production-build checks cover desktop and phone dark styling, scroll pinning, preview selection, no runtime errors and no horizontal overflow. Existing chat-app previews can retain cached page metadata after publication; a changed image URL helps refresh but cannot edit already-sent messages.
