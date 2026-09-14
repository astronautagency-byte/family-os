# FamOS icon system

Import UI icons from this directory, not directly from `lucide-react`.

The library covers all 186 symbols currently imported by the application. Core feature icons use original flat SVG artwork; secondary symbols retain recognizable Lucide geometry with semantic ink and pastel fills. Directional and small action controls inherit their container colour to remain legible on filled buttons. Grocery illustrations, third-party logos, user images and chart graphics retain their dedicated renderers.

- Use existing `size`, `className`, labels and handlers. The SVG ref is forwarded.
- Decorative icons are hidden from assistive technology. Label the surrounding button; use `aria-label` and `role="img"` for standalone meaningful graphics.
- Artwork uses a 24px grid, solid fills and rounded geometry. No gradients, shadows, or 3D effects.
- Add an export in `index.jsx` for a new symbol and a drawing in `artwork.jsx` for a new feature illustration.
- Preview all symbols at 16/24/40px at `/tests/visual-regression/icon-library.html` on the development server.

Colours: green `#217653`, blue `#286CAD`, purple `#9251BE`, coral `#B34E56`, amber `#926014`, teal `#267584`, with matching pastel fills. Warnings and destructive controls use coral; calendar/weather blue; checks/shopping green.
