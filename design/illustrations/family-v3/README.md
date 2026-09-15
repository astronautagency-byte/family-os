# FamOS — family illustration direction

Status: second direction approved. Core app implementation is local, not deployed.

## Implemented

- Thirteen independent PNG assets in `public/illustrations/family-v3/`: welcome, calendar, tasks, rewards, groceries, meals, kitchen, chat, family, famai, finance, and two celebrations.
- Login artwork, step-specific owner onboarding artwork, supported desktop page headers, existing page spots, and task/shopping celebration replacements.
- Today summary rail uses household data and native touch scrolling, with equivalent arrow and action buttons. Respects household feature flags and personal hidden dashboard cards. Existing detailed dashboard remains available below.
- Local preview: `/tests/visual-regression/family-cards.html`.
- Generated through built-in ImageGen. Full continuation prompts: `planning-prompts.md`, `food-prompts.md`, `family-prompts.md`, `completion-prompts.md`.

## Remaining scope

Marketing landing/life-stage artwork, functional grocery icons, and user avatars are unchanged. Recipe discovery carousels and a redesigned onboarding flow are not included; existing onboarding forms and billing are preserved. Generated artwork retains some soft tonal variation from the approved reference. Assets are original PNGs; optimized delivery variants remain a performance follow-up.

Generated with built-in ImageGen. Selected draft: `welcome-concept.png`.
The revised draft is less cluttered and was selected by the user as the reference for the core library.

## Interaction direction

- Today: manually swipeable summary cards for schedule, chores, dinner, and tomorrow. Show a partial next card, position indicator, and previous/next buttons. No autoplay. Keep the actionable agenda visible below.
- Onboarding: skippable single-purpose steps, with illustration, one action, progress, Back and Next. Never require swiping or swipe away partially entered forms.
- Meals and recipes: swipeable discovery/saved-recipe collections; retain search and full list views.
- Tasks and shopping: retain scannable vertical lists. Do not make destructive actions gesture-only.
- Preserve household feature controls, child permissions, user-selected theme, dark mode and reduced-motion preferences.

## Library production inventory

Welcome/login; onboarding family invitation, routines, meals and groceries; Today; calendar; tasks; groceries; kitchen; meals/recipe book; rewards; chat; FamAI; settings/family; finance; task and shopping completion. Audit landing life-stage illustrations separately. Keep functional icons and real recipe photos distinct from editorial artwork; do not replace user avatars.

Use standalone image files rather than a sprite atlas. Match palette, character construction, framing, and detail density. Keep illustration colors separate from accessible UI control tokens.

## Generation prompts

### Original anchor

Use case: illustration-story. Asset type: original FamOS family organization app login and onboarding illustration, a style anchor for a coordinated brand library. Create a polished flat editorial illustration of a diverse family of two adults and two school-age children happily planning their week together around a rounded kitchen table. One adult holds a small calendar with simple blank squares, a child puts a star on a chore card, the other child holds an apple next to a grocery bag, a second adult looks at an open recipe book. Warm affectionate everyday teamwork, natural expressions, clear human anatomy, charming but not infantile. Clean vector-like solid color areas, simplified expressive faces, thoughtful small details, rounded organic shapes, sparse fine deep-forest linework for faces and object details. NO 3D, NO photorealism, NO gradients, NO fuzzy texture, NO glossy rendering, NO exaggerated giant heads. Palette: deep forest #173C32, FamOS green #16865D, peach #F6AE96, sunny yellow #F4D15B, sky blue #9DD7EB, warm ivory #FFFDF7, varied natural skin tones. Landscape composition approximately 3:2, whole vignette centered with generous empty margin on all four sides, soft ivory solid background, no bounding frame, no cropped limbs, no text, no letters, no branding or watermark, no interface mockup, no collage. Visually engaging enough for a consumer app welcome screen; harmonious limited palette with green leading.

### Simplification pass

Edit this FamOS illustration into a much simpler FLAT VECTOR-STYLE editorial brand illustration. Preserve the family of four planning together, their skin tones, clothing palette, calendar, recipe book, grocery bag, and child earning a star. Remove pets, hanging lamp, window, wall art, rug, and all background clutter. Keep just the four people around a simplified small table and one simple plant. Pure solid flat color fills, absolutely NO shading, NO grain, NO watercolor or paper texture, NO gradients. Simplify hair to two or three solid shapes each, faces to minimal charming linework, clothes to clean flat silhouettes. Forest green, mint green, peach, sky blue and sunny yellow with natural skin tones. Warm ivory solid background #FFFDF7. Keep all figures and objects entirely within frame with at least 12 percent clear margin on every side. A clean compact centered vignette for a mobile family app, friendly and sophisticated, not a detailed storybook scene. No text, no logos.
