# Mia listening, header launcher and reviewed actions

7 November 2026

## Changes

- Replace the fixed 15-second recognition cutoff with a 30-second inactivity limit that resets on interim/final speech. Start that timer only after microphone startup; give startup eight seconds. Brief browser no-speech/end interruptions reconnect at most twice in continuous mode, retaining the pending confirmation mode. Pauses, backgrounding, closing and explicit stop still release the microphone.
- Use the Mia avatar in a 44px in-flow header button rather than a floating pill over page content. Retain the dark FamAI styling. Limit lengthy responses to a scrollable conversation region.
- Convert validated single AI meal and task proposals into reviewable drafts. Keep grocery quantity/unit, meal notes, task due dates and parsed event date/time ambiguity. All additions still use the existing household-scoped context methods and explicit confirmation.
- Refuse unsupported action types, multi-action proposals, assignments, invalid dates and ambiguous named-list redirection. Explain the limitation and that nothing was saved. Suppress model-only completion claims; announce success only after the save promise resolves. Retain drafts on failure.
- Allow twenty seconds for a text AI response instead of aborting at eight; this changes the deadline, not provider speed. No new voice provider or real-time model is claimed.

## Verification

- Voice component: 33 tests; marketing regression: 3 tests. All 36 passed.
- Parser/AI proposal validation: 15 tests passed.
- Focused lint: no errors, three existing hook warnings. Production build and marketing checks completed (existing build/chunk warnings remain).
- Isolated headless Chrome against the built app, authenticated as a newly created synthetic household: grocery (quantity 3), dinner meal, task with due date, family calendar event. Confirmed zero records before approval and exactly one record after approval for each in Supabase using that household's user token.
- Header geometry: relative positioning, 44x44, avatar image present, no horizontal overflow at 320, 390 and 1440px. No attachment to the user's browser.
- Deleted the temporary QA account and household through delete_own_account after verification. No customer data modified.

## Device boundary

Speech-recognition events and audio lifecycle are regression-tested with controlled browser mocks. Native iPhone Safari microphone, interruption and audio handoff behaviour require a real-device conversation check. No sub-second latency or uninterrupted real-time voice guarantee is made.
