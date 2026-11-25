# Recipe dietary tags — November 24, 2026

Status: implemented in source and verified in the local app. No deployment, App Review resubmission or new native package was performed for this change. Mac 8 and iOS 1.0.0.14 do not include it.

Recipes support editable Vegan, Vegetarian, Gluten-free, Dairy-free, Nut-free, Egg-free, Pescatarian and High-protein tags. Source-provided additional tags are preserved and removable. The editor keeps tag selection in a collapsible section; recipe cards display wrapping badges. Search includes tags, accepts spaces/hyphens, and combines with a single tag filter. All recipes remain reachable after clearing an empty filter.

Tags are saved inside the existing recipe JSON and travel with meal-plan snapshots. No schema migration or permission change is required. Common labels are normalised and deduplicated; malformed or excessive imported labels are bounded. An explicit empty selection prevents removed tags from returning from old provider metadata. Ingredient lists alone never imply dietary suitability. Website import preserves provider metadata, while photo import requests only dietary labels explicitly printed in the source. Imported tags remain editable before saving; labels do not certify allergy safety.

Verification:

- 324 Node tests passed.
- 334 component/unit tests passed, including edit/save/remove, filter/search, round-trip normalisation and meal snapshot preservation.
- Mac and iOS web bundles built and passed the native-entry check. Existing bundle-size warnings remain; focused lint has no errors and one pre-existing unused sourcePhotos warning.
- Actual Recipe Book flow in the disposable Mac Review Deletion Test household: manually entered a synthetic recipe, selected Vegan and Gluten-free, saved, reloaded, filtered by Vegan and searched for gluten free. Tags survived reload; the 393px layout had no horizontal overflow.
- Direct authenticated API read independently verified the saved tags. The exact synthetic recipe was then deleted via the API and its absence confirmed. Real household recipes were untouched.

Local mobile browser proof: [recipe-tags-mobile-2026-11-24.jpg](recipe-tags-mobile-2026-11-24.jpg). This is not a native-device screenshot.
