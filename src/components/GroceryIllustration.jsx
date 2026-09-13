// Original SVG artwork: one rounded, outlined illustration family for food.
const drawings = {
  carrot: <><path fill="#F6A34D" d="M23 21q18-9 19 5L18 49q-5 4-4-3Z"/><path fill="#78AF78" d="M32 21Q24 4 34 8l3 11Q39 3 46 9l-7 13Q53 12 52 22l-13 6"/><path d="m22 29 6 3m-10 6 5 2"/></>,
  apple: <><path fill="#EC7C82" d="M32 23C8 10 9 46 24 50q8-4 16 0C56 41 54 12 32 23Z"/><path fill="#83B985" d="M33 18Q35 6 46 10q-2 11-13 8Z"/><path d="m31 23-2-11"/><path stroke="#FFF2E8" d="M21 28q-4 5-2 10"/></>,
  banana: <><path fill="#F7D36B" d="M15 17q0 27 32 20l4-7q-7 26-29 18Q8 42 12 20Z"/><path d="M18 24q0 21 25 18m-31-22 3-7m32 24 5-9"/></>,
  milk: <><path fill="#F7F5ED" d="m20 19 7-10h15l4 10v33H20Z"/><path fill="#98C6DF" d="M20 29h26v16H20Z"/><path fill="#BEDDEA" d="m20 19 7-10 5 10v33H20Z"/><path d="M20 19h26M32 19l10-10"/><path fill="#FFF" d="M39 31q-8 10 0 10t0-10Z"/></>,
  eggs: <><path fill="#F5E3C4" d="M31 35c0 17-22 17-22 0 0-10 11-24 11-24s11 14 11 24Z"/><path fill="#FFF5DF" d="M53 39c0 16-25 16-25 0 0-11 12-26 12-26s13 15 13 26Z"/></>,
  bread: <><path fill="#DEAC72" d="M15 48V30C2 18 21 6 32 14 45 6 61 20 49 30v18q-17 7-34 0Z"/><path fill="#F4D7A4" d="M21 43V28C11 20 23 15 32 21c10-6 20 1 11 7v15Z"/><path d="M25 30v7m8-9v9"/></>,
  fish: <><path fill="#9CCECE" d="M43 24 55 16v31L43 39C22 60 7 33 9 32c9-16 23-21 34-8Z"/><path d="M25 20q10 12 0 24"/><circle cx="18" cy="30" r="2" fill="#394649" stroke="none"/></>,
  cheese: <><path fill="#F8D273" d="m11 29 27-16 16 19v18H11Z"/><path fill="#FFE5A0" d="m11 29 27-16 16 19Z"/><circle cx="23" cy="39" r="4" fill="#E9B54F"/><circle cx="43" cy="42" r="3" fill="#E9B54F"/></>,
  jar: <><rect x="20" y="9" width="25" height="8" rx="3" fill="#9DB58D"/><rect x="17" y="17" width="31" height="36" rx="9" fill="#E9BB8E"/><path fill="#FFF3DA" d="M17 28h31v15H17Z"/><path fill="#9DB58D" d="M32 39q-10-9 0-9t0 9Z"/></>,
  box: <><path fill="#C7B8E5" d="m13 22 19-9 20 9v26l-20 7-19-7Z"/><path fill="#E6DCF4" d="m13 22 19-9 20 9-20 8Z"/><path d="M32 30v25m-10-37 20 9v8"/></>,
};
export function groceryIllustrationKind(name = "", category = "") {
  const text = String(name || "").toLowerCase();
  for (const [pattern, kind] of [[/\b(banana|bananas)\b/, "banana"], [/\b(apple|apples|pear|pears)\b/, "apple"], [/\b(egg|eggs)\b/, "eggs"], [/\b(cheese|cheddar|mozzarella)\b/, "cheese"], [/\b(milk|yogurt|yoghurt|cream)\b/, "milk"], [/\b(bread|bagel|toast|croissant|bun|buns)\b/, "bread"], [/\b(fish|salmon|tuna|shrimp)\b/, "fish"]]) if (pattern.test(text)) return kind;
  return ({ Produce: "carrot", Bakery: "bread", "Dairy & Eggs": "milk", "Meat & Seafood": "fish", Pantry: "jar", "Canned & Jarred": "jar", "Condiments & Sauces": "jar", "Spices & Baking": "jar", Beverages: "milk" })[category] || "box";
}
export default function GroceryIllustration({ name, category, size = 36 }) {
  return <span className="grocery-illustration" style={{ width: size, height: size }} aria-hidden="true"><svg viewBox="0 0 64 64" fill="none" stroke="#514D49" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{drawings[groceryIllustrationKind(name, category)]}</svg></span>;
}
