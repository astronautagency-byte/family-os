# FamOS family v4 and profile avatars

Local implementation, not deployed.

Main artwork: 11 revised scenes in `public/illustrations/family-v4/`, using the requested fair-skinned family with chestnut/auburn hair. Flat, minimal reference retained. Previous v3 files preserved; object-only celebrations unchanged.

Optional avatar library: 10 independent images in `public/avatars/flat-v1/`, spanning children, teens, adults and older adults with varied skin tones, hair and cultural headwear. Shared picker in Settings family-member editor and personal onboarding. Users choose explicitly; uploaded photos and existing stored avatar URLs are never migrated or overwritten automatically. Existing profile Save/Continue persists the selected URL through the existing avatar_url flow.

Generated using built-in ImageGen. Exact prompts are recorded in planning-prompts.md, food-prompts.md, family-prompts.md, avatar-core-prompts.md, avatar-extra-prompts.md and avatar-additional-prompts.md. Each asset is standalone, avoiding sprite crop bleed. Original PNGs retained; some soft shading remains from the selected reference.

Preview: `/tests/visual-regression/family-cards.html` (includes interactive avatar picker).
