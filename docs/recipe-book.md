# Recipe Book

Meals → Recipe Book accepts recipe URLs, up to three JPEG/PNG/WebP photos (1 MB each), or manual entry. Extraction is always a draft; users review ingredients and instructions before saving. Unknown times/servings stay blank. Photos are sent to the configured xAI vision service only when Import and review is selected. Extraction consumes the existing premium API operation allowance.

Recipe records, including source photos, are stored privately in the household database (not public image hosting). Household members can read them; creators can update/delete their records through RLS. The first UI supports creation, search, reading originals, opening Cook Mode, and adding to an empty meal-plan slot. Catalogue editing/deletion UI and larger-image compression remain follow-ups. Original photos are stored inside the bounded JSON record for this first release; move them into private object storage before raising upload limits.

Planned recipes keep a structured snapshot, so cooking does not depend on searching the title again. Imported quantities remain verbatim ingredient lines. Grocery addition currently retains these lines as item names rather than parsing every fraction into numeric quantity/unit fields; review the shopping list.

URL extraction delegates public HTTPS URLs to Spoonacular rather than fetching arbitrary URLs from our server network. It requires `SPOONACULAR_API_KEY`. If unavailable or a site blocks extraction, users get an explicit message and can use photos/manual entry. Photo extraction uses `XAI_API_KEY` and `XAI_VISION_MODEL`/`XAI_MODEL`, consistent with the receipt-import service. No source-page instructions are trusted as model instructions.

Deployment requires `202609140005_recipe_book.sql` and the `import-recipe` Edge Function. Test imports with the configured providers and a signed-in household before claiming end-to-end extraction verified.

September 14 release: migration applied and function deployed. Both `SPOONACULAR_API_KEY` and `XAI_API_KEY` are configured. Provider extraction with a signed-in household still needs a live acceptance test; configuration alone is not proof of successful extraction.

Visual direction: warm cream #fff5df, ink #263729, sky #88b5d1, deep blue #2e607e, and small sun-yellow #f3cd59 accents. Georgia headings appear only inside Recipe Book; shared form typography and user-selected application colours remain unchanged. Inspired by ReciMe’s creators page, not a copy or global theme replacement.
