# FamOS icon system

Import UI symbols from this directory. All 186 symbols now use consistent Lucide outline geometry and inherit currentColor; there are no automatic per-path colours or fills. This replaces the previous multicolour treatment in response to readability feedback.

- Use size, strokeWidth, absoluteStrokeWidth, className and forwarded refs as before.
- Default stroke is 2.2 on a 24px grid. Colour comes from the readable parent label/control; explicit colour remains supported.
- Decorative icons are hidden from assistive technology. Label icon-only buttons.
- Grocery illustrations, photos, member colours and calendar-source identity colours remain separate content.
- Legacy artwork.jsx and colourArtwork.jsx are not imported by the UI renderer.
- Preview all symbols at 16/24/40px in tests/visual-regression/icon-library.html.

The functional light/dark palette lives in src/theme/contrast.css and has automated text contrast checks. Avoid introducing decorative module-specific text colours or multicolour navigation icons.
