import { useCallback, useEffect, useRef, useState } from "react";

// Returns the browser's SpeechRecognition constructor (iOS Safari uses
// webkitSpeechRecognition; desktop Chrome uses SpeechRecognition). Returns
// null when the API is unavailable so callers can hide the toggle cleanly.
function getRecognitionCtor() {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

// Wraps navigator.wakeLock so the recipe screen stays on while the user
// is cooking. Falls back silently when the API isn't supported (Firefox,
// older Safari) — the page will sleep, but the rest of the bundle works.
export async function requestScreenWakeLock() {
  if (typeof navigator === "undefined" || !navigator.wakeLock?.request) return null;
  try {
    const sentinel = await navigator.wakeLock.request("screen");
    sentinel.addEventListener?.("release", () => {});
    return sentinel;
  } catch {
    return null;
  }
}

/**
 * Hands-free voice commands for surfaces like Cook Mode (`next`, `previous`,
 * `finish`). Owns the SpeechRecognition lifecycle, restarts on idle-end so
 * the user doesn't have to tap Listen between phrases, and exposes the last
 * transcript so the UI can show "I heard: 'next'" as a confidence pill.
 *
 * Usage:
 *   const { supported, listening, error, transcript, start, stop }
 *     = useVoiceCommands({
 *         commands: [
 *           { match: /\b(next|forward|continue)\b/i, action: "next" },
 *           { match: /\b(back|previous|prev)\b/i, action: "previous" },
 *           { match: /\b(finish|done|stop)\b/i, action: "finish" },
 *         ],
 *         onAction: (action) => { ... },
 *       });
 *
 * Important constraints (the hook enforces them, but worth knowing):
 *  – Microphone permission MUST be requested as a direct response to a user
 *    gesture. Always call `start` from a click handler, not an effect.
 *  – Browsers stop emitting `result` events when the recognizer goes idle,
 *    so we manually `recognition.start()` again to keep listening.
 *  – iOS Safari silently disables SpeechRecognition when the screen locks;
 *    pair this hook with `requestScreenWakeLock()` from the calling page.
 */
export default function useVoiceCommands({ commands = [], onAction, lang = "en-US" } = {}) {
  const ctor = getRecognitionCtor();
  const supported = !!ctor;
  const recognitionRef = useRef(null);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState("");
  const stopRequestedRef = useRef(false);
  const commandsRef = useRef(commands);
  const onActionRef = useRef(onAction);

  // Keep refs pointing at the freshest callbacks so the recognition instance
  // always sees the current action handler without us having to tear down +
  // restart on every render (which would interrupt the user mid-sentence).
  useEffect(() => { commandsRef.current = commands; }, [commands]);
  useEffect(() => { onActionRef.current = onAction; }, [onAction]);

  const matchAction = useCallback((text = "") => {
    const list = commandsRef.current || [];
    for (const entry of list) {
      if (entry?.match && entry.match.test(text)) return entry.action;
    }
    return null;
  }, []);

  const stop = useCallback(() => {
    stopRequestedRef.current = true;
    const rec = recognitionRef.current;
    if (!rec) { setListening(false); return; }
    try { rec.stop(); } catch { /* already stopped */ }
    setListening(false);
  }, []);

  const start = useCallback(() => {
    if (!ctor) { setError("Voice commands aren't supported in this browser."); return; }
    setError("");
    setTranscript("");
    stopRequestedRef.current = false;
    try {
      const rec = new ctor();
      rec.lang = lang;
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      rec.continuous = false;

      rec.onresult = (event) => {
        const result = event?.results?.[0]?.[0];
        const text = result?.transcript || "";
        setTranscript(text);
        const match = matchAction(text);
        if (match && onActionRef.current) {
          try { onActionRef.current(match, text); } catch { /* surface later */ }
        }
      };
      rec.onerror = (event) => {
        // 'no-speech' and 'aborted' are normal user-flow events; surface the rest.
        const code = event?.error || "speech-error";
        if (code !== "no-speech" && code !== "aborted") setError(`Voice: ${code}`);
        setListening(false);
      };
      rec.onend = () => {
        setListening(false);
        // Auto-restart unless the caller asked us to stop. iOS sometimes
        // ends the recognizer after a few seconds even mid-thought, so
        // the loop is critical for hands-free cooking.
        if (!stopRequestedRef.current && recognitionRef.current === rec) {
          try { rec.start(); setListening(true); }
          catch { /* permission race — second start may fail; surface via error */ }
        }
      };

      recognitionRef.current = rec;
      rec.start();
      setListening(true);
    } catch (startError) {
      setError(startError?.message || "Could not start voice commands.");
      setListening(false);
    }
  }, [ctor, lang, matchAction]);

  useEffect(() => () => {
    stopRequestedRef.current = true;
    try { recognitionRef.current?.stop(); } catch { /* noop */ }
    recognitionRef.current = null;
  }, []);

  return { supported, listening, transcript, error, start, stop };
}
