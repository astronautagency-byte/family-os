# FamOS icon system

Import UI icons from this directory, not directly from `lucide-react`.

The library covers all 186 symbols currently imported by the application. Core feature icons use original colour-outline SVG artwork based on the approved sample; secondary symbols retain recognizable Lucide geometry with coordinated coloured strokes and selective circle fills. Directional and small action controls inherit their container colour to remain legible on filled buttons. Grocery illustrations, third-party logos, user images and chart graphics retain their dedicated renderers.

- Use existing `size`, `className`, labels and handlers. The SVG ref is forwarded.
- Decorative icons are hidden from assistive technology. Label the surrounding button; use `aria-label` and `role="img"` for standalone meaningful graphics.
- Artwork uses a 24px grid, solid fills and rounded geometry. No gradients, shadows, or 3D effects.
- Add an export in `index.jsx` for a new symbol and a drawing in `colourArtwork.jsx` for a new feature illustration. The former `artwork.jsx` is legacy and not imported by the current renderer.
- Default stroke is 2.2 on a 24px grid, with rounded caps and joins. Explicit `color` opts into monochrome for contrast-sensitive controls; `absoluteStrokeWidth` is supported.
- Preview all symbols at 16/24/40px at `/tests/visual-regression/icon-library.html` on the development server.

Colours: cyan `#20B4C9`, mint `#2DCD99`, yellow `#FFC43B`, coral `#FF6D5C`, purple `#9279F6`. The preview includes a light/dark toggle and the twelve core icons at 56px. Do not add background washes, gradients or 3D effects. Keep labels alongside small feature icons; colour alone must not convey state.
