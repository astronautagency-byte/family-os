# Native UI compatibility correction — November 24, 2026

Status: local corrections tested; not uploaded or submitted. Existing App Store review entries are unchanged.

## Preserved design

Keep the existing app-simple/app-personality palettes, typography, avatar, cards and navigation. No new visual direction was introduced. The mobile header now reserves its safe-area inset instead of replacing it with fixed padding. Desktop geometry is unchanged.

The native bundle disables PWA registration and foreground auto-reloads. Native sign-out remains on its packaged origin instead of navigating to the public website. This prevents that known route from switching native users onto an independently deployed web design.

Local browser captures, using synthetic household data:

- [Tasks, 393px](native-ui-2026-11-24/tasks-mobile.jpg)
- [Calendar, 393px](native-ui-2026-11-24/calendar-mobile.jpg)

These are browser captures, not TestFlight or iPhone simulator evidence.

## Interaction corrections

- Pull-to-refresh starts only within its own page and ignores buttons, their nested icons, links, fields, summaries and portal dialogs. Mouse interactions do not trigger a mobile refresh gesture.
- The calendar floating button is below modal dialogs, rather than using z-index 99999.
- Task deletion and calendar edits/deletion require a server-returned id before changing client state. Errors and zero-row RLS/stale-record responses are surfaced. Confirmation dialogs show failures, remain open for retry, and disable duplicate submission while pending.

## Verification

- 324 Node tests passed; 327 component tests passed, including new gesture, native update, failed-mutation and confirmation regressions.
- Focused lint: no errors; existing warnings remain.
- Mac and iOS web bundles built; native entry verifier confirms no PWA registration injection.
- Direct authenticated production API test in the disposable Mac Review Deletion Test household created synthetic task/event rows, verified event update and returned ids for deletions, read back their absence and verified a repeated deletion returns zero rows. Test rows cleaned up; real households untouched.
- Local browser checks at 320px and 393px: no horizontal overflow and visible header controls passed centre-point hit tests. Calendar form fields and enabled save button were reachable. Task deletion confirmation opened correctly. Desktop at 1440px retained its 64px header and no horizontal overflow.
- Native iOS simulator target compiled successfully with xcodebuild using the live Tauri helper after the standard command refused the installed simulator SDK/runtime combination. Simulator GUI is absent from this Xcode installation; installation/launch did not complete. No native iPhone visual or touch verification is claimed.
- User tested the installed Mac TestFlight build 7: Mia heard the grocery request and subsequent confirmation. User reported excessive latency and a microphone ping. These audio complaints remain unresolved by this UI correction.
- Two authenticated speech requests measured 2.38s and 1.95s and returned Hannah WAV audio. The audio-unlock WAV decoded to 400 samples of exact unsigned PCM silence (128), with no added chime. The speech-recognition lifecycle aborts/restarts between turns; system microphone feedback is suspected, not proven. Do not promise removal of system feedback or enable a microphone during replies merely to hide it.

## Release gates

Build Mac and iOS from the same reviewed source. Verify the exact new TestFlight builds on physical devices: header under the status bar, Mia launcher, a two-turn request, calendar create/edit/delete, task deletion including offline failure, keyboard/dialog scrolling and sign-out/sign-in without a design change. Compare these captures before any further style edit. Resolve or explicitly scope the voice latency/ping limitation before representing Mia as a seamless native conversation experience. Do not resubmit build 7 as if it contains these corrections.
