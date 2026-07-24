import { Check, Lock } from "lucide-react";
import { MIN_PASSWORD_LENGTH, passwordError, passwordHint, passwordScore, passwordScoreLabel } from "../utils/passwordStrength";

/**
 * Visual password strength meter. Renders a labelled 3-segment bar that fills
 * from amber→accent→good as the score climbs, plus a single inline hint with
 * the next recommendation. Purely presentational — every decision lives in
 * src/utils/passwordStrength.
 *
 * Props:
 *   - value (string): the current password input
 *   - id (string, optional): id for the live-region announcement
 *   - compact (boolean): render a denser version for tight layouts
 */
export default function PasswordStrengthMeter({ value, id, compact = false }) {
  const score = passwordScore(value);
  const label = passwordScoreLabel(value);
  const error = passwordError(value);
  const hint = passwordHint(value);
  // 3-tier tone ladder. The "amber" / score=1 branch is dormant while
  // MIN_PASSWORD_LENGTH is 10 (any 8–9 char password trips the length error
  // first, so the meter renders "Password needs work" instead of "Weak").
  // It wakes up automatically if the policy floor is raised to 12+.
  const tone = error ? "warn" : score >= 3 ? "good" : score >= 2 ? "accent" : score >= 1 ? "amber" : "faint";

  return (
    <div className={`password-strength ${compact ? "password-strength-compact" : ""}`} id={id} aria-live="polite">
      <div className="password-strength-head">
        <span className="password-strength-label">
          {error ? <Lock size={12} /> : score >= 3 ? <Check size={12} /> : <Lock size={12} />}
          <span>{error ? "Password needs work" : label}</span>
        </span>
        <span className={`password-strength-rule ${String(value || "").length >= MIN_PASSWORD_LENGTH ? "met" : ""}`}>
          {String(value || "").length}/{MIN_PASSWORD_LENGTH}+ chars
        </span>
      </div>
      <div className="password-strength-bar" role="meter" aria-valuemin={0} aria-valuemax={3} aria-valuenow={score} aria-label={`Password strength: ${error ? "needs work" : label}`}>
        {[0, 1, 2].map((segment) => (
          <span
            key={segment}
            className={`password-strength-segment ${score > segment ? `filled ${tone}` : ""}`}
          />
        ))}
      </div>
      <p className={`password-strength-hint ${error ? "is-error" : ""}`}>
        {error || hint || "Meets the policy. Mix character types to keep it strong."}
      </p>
    </div>
  );
}
