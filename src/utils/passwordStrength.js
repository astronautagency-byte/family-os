// Password strength rules for FamOS signup, invite-link setup, and password
// reset flows. The policy follows NIST SP 800-63B guidance: length is the
// primary defense and the deny-list catches the worst offenders. Composition
// (upper / lower / digits / symbols) is intentionally NOT a gate — it
// historically pushes users toward predictable substitutions (Winter2024!,
// Pa$$w0rd) without meaningfully raising entropy.
//
// Tuning notes:
//   * MIN_PASSWORD_LENGTH = 10 (down from 12) is a user-friendly middle ground
//     between NIST's 8-char minimum and Bitwarden/1Password's 12-char default.
//   * Score collapses to 3 tiers — Too short / Weak / Good — instead of 4.
//   * passwordHint only nudges length; it never nags "add uppercase + a number"
//     because that's a composition rule we deliberately don't gate on.
//
// If you want true breach coverage, replace COMMON_PASSWORDS with a Bloom
// filter or a fetch to the HIBP k-anonymity API (https://haveibeenpwned.com/API/v3#PwnedPasswords).
// The offline list keeps the validator synchronous, deterministic, and free
// of a network dependency at signup time.

export const MIN_PASSWORD_LENGTH = 10;

// Curated top worst-passwords list (subset of SecLists top-1m, filtered to
// ≤14 chars and including common substitutions). 200+ entries keeps a
// trivial-strength gate against hobbyist attacks without bloating the bundle.
//
// IMPORTANT: every entry is lowercase before insertion. The runtime lookup
// (`COMMON_PASSWORDS.has(pw.toLowerCase())`) case-folds the candidate, but
// if the Set itself stores mixed-case literals, mixed-case entries silently
// fail to fire — e.g. "Passw0rd!" in the set but `.has("passw0rd!")` misses.
// Normalising once at construction is cheaper and clearer than per-entry
// invariant checking later.
const COMMON_PASSWORDS = new Set([    "password", "password1", "password2", "password3", "password4", "password5",
  "password!", "password@", "password#", "password123", "password1234", "password12345",
  "pa$$word", "passw0rd", "passwOrd", "p@ssw0rd", "p@ssword",
  "123456", "1234567", "12345678", "123456789", "1234567890",
  "0123456789", "12345678910", "123456789a",
  "qwerty", "qwerty123", "qwerty1234", "qwerty123456789", "qwertyuiop", "qazwsx", "q1w2e3r4",
  "abc123", "abcd1234", "abcdef", "abcdefg",
  "letmein", "letmein1", "trustno1",
  "iloveyou", "iloveyou1", "loveyou",
  "welcome", "welcome1", "welcome123",
  "admin", "admin1", "admin123", "admin1234", "admin12345", "administrator",
  "root", "root123", "toor",
  "user", "user1", "user123",
  "guest", "guest1", "guest123",
  "login", "login1", "login123",
  "secret", "secret1", "secret123",
  "default", "default1", "changeMe", "changeme",
  "111111", "11111111", "1111111111",
  "000000", "00000000", "0000000000",
  "123123", "123123123", "123321",
  "654321", "7654321", "987654321",
  "777777", "7777777", "888888", "88888888",
  "999999", "9999999", "99999999",
  "qwertyu", "asdfgh", "asdfghjkl", "asdfghjkl1", "zxcvbn",
  "zxcvbnm", "mnbvcxz", "qwerty1",
  "superman", "spiderman", "batman", "starwars", "football",
  "baseball", "basketball", "monkey", "dragon", "dragon1",
  "master", "master1", "master123", "michael", "jordan",
  "shadow", "shadow1", "sunshine", "princess", "football1",
  "charlie", "thomas", "ashley", "jessica", "robert",
  "daniel", "jennifer", "joshua", "maggie", "michelle",
  "qwerty12", "abcd1234", "Aa123456", "admin!",
  "1q2w3e4r", "1q2w3e", "1qaz2wsx", "zaq12wsx",
  "000000000", "98765432", "11223344", "12121212",
  "qweqwe", "qweasd", "qweasdzxc", "qWer1234",
  "Pa55word", "Pa55w0rd", "Passw0rd", "Passw0rd!",
  "Summer2024", "Winter2024", "Spring2024", "Fall2024",
  "Summer2025", "Winter2025", "Spring2025", "Fall2025",
  "Summer2026", "Winter2026", "Spring2026", "Fall2026",
  "summer2024hello", "winter2024hello", "summer2026hello", "winter2026hello",
  "CompanyName1", "Company123", "Test1234", "Test12345",
  "Admin12345678", "Admin12345Welcome", "admin12345seven", "Admin12345",
  "qwerty1234twelve", "qwerty1234abcd", "qwerty12345abc",
  "P@ssword1", "P@ssw0rd!", "qwerty!@#", "q1w2e3r4t5",
  "trustme", "trustme1", "trustme123",
  "recovery", "support", "support1", "support123",
  "family", "family1", "family123", "home", "home1",
  "love", "loveme", "lovely", "lovelove",
  "abc", "abcd", "abcde", "abcdef1",
  "abcdefg1", "1234", "12345", "1234abcd", "abcd12345",
].map((entry) => entry.toLowerCase()));

/**
 * Returns the first blocking error message for a candidate password, or null
 * if the password passes the floor (length + breach list). Composition rules
 * do not block — only `passwordScore` reflects them.
 */
export function passwordError(value) {
  const pw = String(value || "");
  if (!pw) return "Enter a password.";
  if (pw.length < MIN_PASSWORD_LENGTH) return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (COMMON_PASSWORDS.has(pw.toLowerCase())) {
    return "This password is widely used and unsafe. Pick a different one.";
  }
  return null;
}

/**
 * Returns a 0-3 strength score that drives the meter. Simpler than the previous
 * 4-tier model: just length breaks, with a small bonus for type variety inside
 * the "Good" band.
 *
 *   0 = empty
 *   1 = 8–9 chars (Weak — under the floor but close)
 *   2 = 10+ chars (Good — meets the policy)
 *   3 = 10+ chars with 4 character classes (Strong — comfortably above)
 */
export function passwordScore(value) {
  const pw = String(value || "");
  if (!pw) return 0;
  if (pw.length < 8) return 0;
  if (pw.length < MIN_PASSWORD_LENGTH) return 1;
  const classes = [
    /[a-z]/.test(pw),
    /[A-Z]/.test(pw),
    /\d/.test(pw),
    /[^a-zA-Z0-9]/.test(pw),
  ].filter(Boolean).length;
  return classes >= 4 ? 3 : 2;
}

const SCORE_LABELS = ["Too short", "Weak", "Good", "Strong"];

/** Human-readable label for a score value (0..3). */
export function passwordScoreLabel(value) {
  return SCORE_LABELS[Math.max(0, Math.min(3, passwordScore(value)))];
}

/**
 * Returns the single next nudge the meter can show. With composition rules
 * no longer nagging, the only nudge is "make it longer" — once the password
 * clears the floor, the meter reports it's good without piling on more rules.
 */
export function passwordHint(value) {
  const pw = String(value || "");
  if (!pw) return null;
  if (pw.length < MIN_PASSWORD_LENGTH) return `Push to ${MIN_PASSWORD_LENGTH}+ characters to meet the policy`;
  return null;
}
