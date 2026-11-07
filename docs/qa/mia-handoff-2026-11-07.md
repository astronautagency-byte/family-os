# Mia voice handoff and CTA — 2026-11-07

Issue: reported iPhone Safari stall on a follow-up turn. The UI replaced the AM/PM question with “I’m listening” and set listening true immediately after start(), before browser startup was confirmed. Restart also paused/reset/loaded the finished audio element, unnecessarily touching the media route during microphone handoff. These are confirmed code paths; physical iPhone causation remains unverified.

Changes: preserve follow-up text; show connecting until recognition onstart, with 3-second startup recovery; stop recognition on speechend to request final results sooner; keep fresh recognition instances and pause 350ms between ended speech and microphone restart; avoid resetting completed playback on restart. Protect the silent unlock promise from pausing newer audio. Cancel stale audio/AI fetches on close, add 8-second AI request cancellation, and keep a bounded 12-entry in-memory reply cache cleared when the panel closes. Interim recognition never writes data. Explicit confirmation remains required.

CTA: blue/violet moving light sweep, orbit effect and animated waveform with different active rhythms, hover response and reduced-motion fallback. Isolated headless desktop/mobile CTA fixtures reviewed; no attachment to the user's open browser.

Validation: 304 Node tests and 279 component tests pass; production build passes. Three existing effect lint warnings remain. New regressions cover the screenshot follow-up, no audio reset on restart, silent microphone startup, repeated-prompt cache and late unlock callback. Real iPhone voice interaction and measured end-to-end latency remain unverified. No claim of universal Safari recovery or measured latency gain.
