# Recipe Book import and deletion

- The previous browser uploader rejected files over 1 MB before extraction. It now accepts up to three JPEG/PNG/WebP files of 20 MB each, decodes and resizes them in the browser, and sends JPEG copies below the existing backend payload limit. A real Chrome test compressed a 5.5 MB sample PNG successfully.
- HEIC/HEIF is not decoded: the UI asks for a JPEG export or screenshot. No file is sent to AI until Import and review is selected. Resized copies, not original files, are saved.
- URL imports retain the provider's thumbnail and source name plus the submitted source URL. Missing/broken thumbnails fall back to a book icon; uploaded recipes can use their first source photo. Image fetches omit the referrer. Old recipes without image metadata are not automatically refetched.
- The vision model uses XAI_VISION_MODEL or the documented grok-4.6 default, not an arbitrary text-model setting. Provider failures, malformed responses, and missing recipe content get explicit errors. Reference: https://docs.x.ai/developers/model-capabilities/images/understanding
- Recipe creators can delete their own recipes after confirmation. Database policies already enforce this; no new deletion permissions were granted. Meal snapshots remain intact. Failed/unauthorized deletions do not remove the card locally.

Tests cover metadata preservation, unsafe URLs, deletion confirmation/errors, and photo selection → mocked extraction → review → save. tests/recipe-photo.browser.mjs exercises actual Chrome decoding/compression against a running local Vite server. No real provider extraction or the user's specific failing photo has been verified in this change. Deploy import-recipe and the web app to release the fix.
