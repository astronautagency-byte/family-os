// Local mock data for Family OS.
// This is the seed state used before any real database is connected.
// Shape everything here exactly as you'd want it to arrive from an API,
// so swapping in a real backend later is a drop-in replacement.

export const FAMILY_COLORS = [
  { id: "coral", label: "Coral", value: "var(--color-fam-coral)" },
  { id: "marigold", label: "Marigold", value: "var(--color-fam-marigold)" },
  { id: "moss", label: "Moss", value: "var(--color-fam-moss)" },
  { id: "sky", label: "Sky", value: "var(--color-fam-sky)" },
  { id: "plum", label: "Plum", value: "var(--color-fam-plum)" },
  { id: "rose", label: "Rose", value: "var(--color-fam-rose)" },
];

export const initialFamilyMembers = [
  { id: "me", name: "Alex", role: "Partner", color: "coral", initials: "A" },
  { id: "partner", name: "My wife", role: "Partner", color: "sky", initials: "MW" },
];

// Dates are relative to "today" at import time, so the demo always looks alive.
const today = new Date();
const iso = (daysOffset, hour = 0, minute = 0) => {
  const d = new Date(today);
  d.setDate(d.getDate() + daysOffset);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
};
const dateOnly = (daysOffset) => {
  const d = new Date(today);
  d.setDate(d.getDate() + daysOffset);
  return d.toISOString().slice(0, 10);
};

export const initialEvents = [
  { id: "e1", title: "School drop-off", memberIds: ["me"], start: iso(0, 8, 0), end: iso(0, 8, 30), location: "Lincoln Elementary" },
  { id: "e2", title: "Team standup", memberIds: ["partner"], start: iso(0, 9, 30), end: iso(0, 10, 0), location: "" },
  { id: "e3", title: "Piano lesson", memberIds: ["partner"], start: iso(0, 16, 0), end: iso(0, 16, 45), location: "Mrs. Alvarez's studio" },
  { id: "e4", title: "Soccer practice", memberIds: ["me"], start: iso(0, 17, 30), end: iso(0, 18, 30), location: "Riverside Field" },
  { id: "e5", title: "Family dinner", memberIds: ["me", "partner", "me", "partner"], start: iso(0, 19, 0), end: iso(0, 19, 45), location: "Home" },
  { id: "e6", title: "Dentist — Milo", memberIds: ["me", "me"], start: iso(1, 10, 0), end: iso(1, 10, 45), location: "Bright Smiles Dental" },
  { id: "e7", title: "Grocery run", memberIds: ["partner"], start: iso(1, 18, 0), end: iso(1, 18, 45), location: "Trader Joe's" },
  { id: "e8", title: "Date night", memberIds: ["me", "partner"], start: iso(2, 19, 30), end: iso(2, 21, 30), location: "The Green Table" },
  { id: "e9", title: "Soccer game", memberIds: ["me", "partner"], start: iso(3, 9, 0), end: iso(3, 10, 30), location: "Riverside Field" },
  { id: "e10", title: "Birthday party — Nora invited", memberIds: ["partner", "me"], start: iso(4, 14, 0), end: iso(4, 16, 0), location: "Jump Zone" },
  { id: "e11", title: "Parent-teacher conf.", memberIds: ["me", "partner"], start: iso(5, 11, 0), end: iso(5, 11, 30), location: "Lincoln Elementary" },
  { id: "e12", title: "Family bike ride", memberIds: ["me", "partner", "me", "partner"], start: iso(6, 10, 0), end: iso(6, 11, 0), location: "Greenway Trail" },
];

export const MEAL_SLOTS = ["breakfast", "lunch", "dinner"];

export const initialMeals = [
  { id: "m0", date: dateOnly(0), slot: "dinner", title: "Sheet-pan chicken fajitas", notes: "Peppers + onions from the fridge", cookIds: ["partner"] },
  { id: "m1", date: dateOnly(1), slot: "dinner", title: "Turkey chili", notes: "Double batch — freeze half", cookIds: ["me"] },
  { id: "m2", date: dateOnly(2), slot: "dinner", title: "Date night — kids' pasta", notes: "Milo & Nora eat with sitter", cookIds: ["me"] },
  { id: "m3", date: dateOnly(3), slot: "dinner", title: "Baked salmon + rice", notes: "", cookIds: ["partner"] },
  { id: "m4", date: dateOnly(4), slot: "dinner", title: "Homemade pizza night", notes: "Let the kids build their own", cookIds: ["me", "partner"] },
  { id: "m5", date: dateOnly(5), slot: "dinner", title: "Leftovers / clean-out-the-fridge", notes: "", cookIds: [] },
  { id: "m6", date: dateOnly(6), slot: "dinner", title: "Sunday roast", notes: "Invite Grandma", cookIds: ["me", "partner"] },
];

export const GROCERY_CATEGORIES = [
  "Produce",
  "Bakery",
  "Deli & Prepared Foods",
  "Dairy & Eggs",
  "Meat & Seafood",
  "Breakfast & Cereal",
  "Pantry",
  "Canned & Jarred",
  "Pasta, Rice & Grains",
  "Condiments & Sauces",
  "Spices & Baking",
  "Snacks & Candy",
  "Beverages",
  "International Foods",
  "Frozen",
  "Beer, Wine & Spirits",
  "Health & Personal Care",
  "Baby",
  "Pet Supplies",
  "Household & Cleaning",
  "Paper & Disposable",
  "Other",
];

export const initialGroceries = [
  { id: "g1", name: "Bell peppers", category: "Produce", checked: false, addedBy: "partner", quantity: 3, unit: "" },
  { id: "g2", name: "Yellow onions", category: "Produce", checked: false, addedBy: "partner", quantity: 2, unit: "" },
  { id: "g3", name: "Bananas", category: "Produce", checked: true, addedBy: "partner", quantity: 1, unit: "bunch" },
  { id: "g4", name: "Avocados", category: "Produce", checked: false, addedBy: "me", quantity: 4, unit: "" },
  { id: "g5", name: "Whole milk", category: "Dairy & Eggs", checked: false, addedBy: "me", quantity: 1, unit: "gallon" },
  { id: "g6", name: "Eggs", category: "Dairy & Eggs", checked: false, addedBy: "me", quantity: 1, unit: "dozen" },
  { id: "g7", name: "Shredded cheddar", category: "Dairy & Eggs", checked: true, addedBy: "partner", quantity: 1, unit: "bag" },
  { id: "g8", name: "Ground turkey", category: "Meat & Seafood", checked: false, addedBy: "me", quantity: 2, unit: "lb" },
  { id: "g9", name: "Salmon fillets", category: "Meat & Seafood", checked: false, addedBy: "partner", quantity: 4, unit: "" },
  { id: "g10", name: "Black beans", category: "Pantry", checked: false, addedBy: "me", quantity: 2, unit: "cans" },
  { id: "g11", name: "Tortillas", category: "Pantry", checked: false, addedBy: "partner", quantity: 1, unit: "pack" },
  { id: "g12", name: "Pizza dough flour", category: "Pantry", checked: false, addedBy: "partner", quantity: 1, unit: "bag" },
  { id: "g13", name: "Frozen peas", category: "Frozen", checked: false, addedBy: "me", quantity: 1, unit: "bag" },
  { id: "g14", name: "Dish soap", category: "Household", checked: false, addedBy: "partner", quantity: 1, unit: "" },
  { id: "g15", name: "Paper towels", category: "Household", checked: true, addedBy: "me", quantity: 1, unit: "pack" },
];

export const initialTasks = [
  { id: "t1", title: "Take out recycling", assigneeId: "me", due: dateOnly(0), done: false, recurring: "Weekly", taskType: "home" },
  { id: "t2", title: "Pack soccer bag", assigneeId: "me", due: dateOnly(0), done: false, recurring: "", taskType: "family" },
  { id: "t3", title: "Sign field trip form", assigneeId: "me", due: dateOnly(0), done: false, recurring: "", taskType: "family" },
  { id: "t4", title: "Feed the dog", assigneeId: "partner", due: dateOnly(0), done: true, recurring: "Daily", taskType: "home" },
  { id: "t5", title: "Water the plants", assigneeId: "partner", due: dateOnly(1), done: false, recurring: "Weekly", taskType: "home" },
  { id: "t6", title: "Book dentist follow-up", assigneeId: "me", due: dateOnly(1), done: false, recurring: "", taskType: "personal" },
  { id: "t7", title: "Clean out car", assigneeId: "partner", due: dateOnly(2), done: false, recurring: "", taskType: "errand" },
  { id: "t8", title: "Laundry — towels", assigneeId: "partner", due: dateOnly(2), done: false, recurring: "Weekly", taskType: "home" },
  { id: "t9", title: "Pay piano tuition", assigneeId: "me", due: dateOnly(3), done: false, recurring: "Monthly", taskType: "errand" },
  { id: "t10", title: "Tidy playroom", assigneeId: "me", due: dateOnly(3), done: false, recurring: "Weekly", taskType: "home" },
];

export const initialMessages = [
  { id: "msg1", senderId: "partner", text: "Can you grab milk on the way home?", sentAt: iso(0, 9, 12) },
  { id: "msg2", senderId: "me", text: "Yep — I added it to the shopping list.", sentAt: iso(0, 9, 14) },
];
