// Feature catalog for the public /features surface. One entry per real
// in-app module + a meta entry for cross-cutting "Family" features
// (invites, roles, dark mode, tablet kiosk, etc).
// Each module's `bullets` power the highlight grid on its dedicated page;
// `previewRows` power the small mock-UI panel so the page has visual
// product alongside the marketing copy.
import {
  BellRing, CalendarDays, CalendarPlus, Camera, ChefHat, ClipboardList,
  Coins, FileInput, ListChecks, MapPin, Megaphone, Mic, Palette, Refrigerator,
  ShoppingCart, Sparkles, Users,
} from "lucide-react";

// Single source of truth for the on-device screenshot shown on a feature
// hero. Today + Calendar have dedicated PNGs; the other five modules
// rotate through the user's onboarding captures. New MARKETING_FEATURE
// entries without a dedicated screenshot use this as a fallback.
export const ONBOARDING_FALLBACK = { src: "/features/app-shots/01-signin.png", alt: "FamOS onboarding — step one of five" };

// Per-feature hero metadata for /features and /features/<id>. The right
// column of every module hero is now a framed phone showing an actual
// FamOS screenshot (where we have one) with three floating product cards
// echoing the marketing-page pattern of "device on the right, benefit
// cards floating around it." The pills under the CTA are the headline
// benefits for that module — separate from the deeper bullet list.
export const FEATURE_HERO = {
  today: {
    pills: ["Day-first bento", "Kitchen reminders", "All daily meals", "Family broadcasts"],
    cards: [
      { emoji: "👋", title: "Evening, Alex",       subtitle: "Plan visible at a glance", accent: "lilac" },
      { emoji: "🌧️", title: "Rain · Newmarket",   subtitle: "26% · 23° · 8 km/h",      accent: "blue" },
      { emoji: "✅", title: "5 calendar · 0 open", subtitle: "Nothing due today",       accent: "mint" },
    ],
  },
  calendar: {
    pills: ["Multiple Google Calendars", "Two-way sync", "Quick capture", "Shared family views"],
    cards: [
      { emoji: "👨‍👩‍👧", title: "All family calendars", subtitle: "Shared view · privacy respected", accent: "blue" },
      { emoji: "🔄", title: "Google calendar · Connected", subtitle: "Two-way sync live",                accent: "amber" },
      { emoji: "🎟", title: "Family Fun at Bradley Museum", subtitle: "Saturday · Aug 1",                    accent: "peach" },
    ],
  },
  meals: {
    pills: ["Spoonacular recipes", "Hands-free Cook Mode", "Every daily meal", "Ingredients → shopping"],
    cards: [
      { emoji: "🍝", title: "Sheet-pan fajitas", subtitle: "Tonight · 35 min · 8 ingredients", accent: "rose" },
      { emoji: "🥗", title: "Weekly meal plan",  subtitle: "6/7 dinners planned",                  accent: "mint" },
      { emoji: "🎙", title: "Voice-next on step 3", subtitle: "Cook Mode is listening",             accent: "violet" },
    ],
  },
  shopping: {
    pills: ["Kitchen inventory", "Expiry reminders", "Photos + barcode brands", "Focus Shop"],
    cards: [
      { emoji: "🧊", title: "Kitchen inventory", subtitle: "Fridge · Freezer · Pantry", accent: "mint" },
      { emoji: "⏳", title: "Blueberries",       subtitle: "Use tomorrow",              accent: "lime" },
      { emoji: "📸", title: "Scan or add a photo", subtitle: "Brand stays on the card", accent: "blue" },
    ],
  },
  tasks: {
    pills: ["Custom task lists", "All-tasks view", "Review-first imports", "Recurring chores"],
    cards: [
      { emoji: "✅", title: "Feed the dog",        subtitle: "Daily · Lou · done",  accent: "mint" },
      { emoji: "📦", title: "Pack soccer bag",    subtitle: "Today · Mia",          accent: "sky" },
      { emoji: "🔥", title: "6-day streak",        subtitle: "Lou",                  accent: "amber" },
    ],
  },
  chat: {
    pills: ["Broadcasts · reactions", "Direct messages", "Smart shortcuts", "Quiet by default"],
    cards: [
      { emoji: "📣", title: "Running 10 min late", subtitle: "Family · 3 ❤️ reactions", accent: "amber" },
      { emoji: "💬", title: "Direct message",       subtitle: "Alex → Mia",              accent: "peach" },
      { emoji: "⚡", title: "Shortcut: 'butter'",   subtitle: "Echo into grocery",       accent: "blue" },
    ],
  },
  "fam-ai": {
    pills: ["Meal ideas · from groceries", "Calendar summary", "Weekly recap", "Stays quiet until asked"],
    cards: [
      { emoji: "🌮", title: "Avocado pasta",       subtitle: "Uses 4 grocery items", accent: "lime" },
      { emoji: "📊", title: "Weekly recap",         subtitle: "Done · Slipped · Up",  accent: "lilac" },
      { emoji: "🎙", title: "Voice in Cook Mode",   subtitle: "Hands-free next/back", accent: "violet" },
    ],
  },
  family: {
    pills: ["Optional onboarding", "Personal colour schemes", "Private/shared calendars", "Role-aware access"],
    cards: [
      { emoji: "🎨", title: "Feels like your FamOS", subtitle: "Colour scheme · light + dark", accent: "lilac" },
      { emoji: "🔒", title: "Work calendar", subtitle: "Private to Alex", accent: "blue" },
      { emoji: "👨‍👩‍👧", title: "Family calendar", subtitle: "Shared with household", accent: "mint" },
    ],
  },
};

// Tones mirror the pastel-strengths used across landing.css so the
// gradient surfaces look like they belong on the same site.
export const TONES = {
  lilac:  { from: "#faf8ff", to: "#f4efff", tint: "var(--landing-color-lavender-soft)", iconBg: "var(--landing-color-lavender-mid)", iconFg: "var(--landing-color-primary)" },
  yellow: { from: "#fffdf1", to: "#fff7d2", tint: "#fff9dd",                                          iconBg: "#fff6cf",                         iconFg: "#85610d" },
  pink:   { from: "#fff8fb", to: "#ffeef5", tint: "#fff1f6",                                          iconBg: "#fff1f6",                         iconFg: "#a44e68" },
  mint:   { from: "#f8fffb", to: "#eaf9f2", tint: "#eefaf5",                                          iconBg: "#eefaf5",                         iconFg: "#31735e" },
  blue:   { from: "#f8fcff", to: "#eaf5ff", tint: "#edf6ff",                                          iconBg: "#edf6ff",                         iconFg: "#3c74a0" },
  peach:  { from: "#fffaf6", to: "#ffeddd", tint: "#fff1e6",                                          iconBg: "#fff1e6",                         iconFg: "#a05e1f" },
};

export const FEATURES = [
  {
    id: "today",
    name: "Today",
    eyebrow: "HOME DASHBOARD",
    title: "Your day at a glance. Whole household, one screen.",
    lede: "The calm, organized home base. Broadcasts, weather, every meal, open tasks, and kitchen items that need attention — so everyone stays on the same page without the back-and-forth.",
    icon: Sparkles,
    tone: "lilac",
    pill: "Home",
    bullets: [
      { icon: Megaphone,  title: "Household updates",       copy: "Tap, type, send. Everyone sees a celebration banner with one-tap emoji reactions — perfect for quick updates that don't need a notification storm." },
      { icon: BellRing,   title: "Instant sync",            copy: "Anything anyone changes — update, task, meal, list — shows up on every phone in under a second. No refresh needed." },
      { icon: ChefHat,    title: "One-tap dinner",          copy: "If dinner is planned, the home screen jumps you straight into Cook Mode with hands-free voice navigation. No menu hunting." },
      { icon: Refrigerator, title: "Kitchen watch",          copy: "See what's expired or needs using soon, then put a replacement back on the shopping list in one tap." },
    ],
    preview: {
      title: "Today",
      kicker: "EVENING · 7:42 PM",
      pills: ["🍝 Pasta night", "3 tasks left", "10 groceries"],
      rows: [
        { avatar: "A", name: "Alex",       meta: "2 events · 3 open tasks",  accent: "coral" },
        { avatar: "M", name: "Mia",        meta: "4 events · 2 open tasks",  accent: "sky" },
        { avatar: "L", name: "Lou (kid)",  meta: "1 event · 0 open tasks",  accent: "mint" },
      ],
    },
    tips: [
      { headline: "Pin to your morning routine", copy: "Set it to show your evening plans first. A gentle nudge when things change — better than a busy chat." },
      { headline: "Use reactions to keep chat quiet", copy: "Tap a heart instead of replying. The conversation stays in the chat, not on every lock screen." },
      { headline: "One-tap dinner", copy: "Dinner planned? The hero CTA jumps straight into Cook Mode. One tap. No friction." },
    ],
    ctaHeadline: "Your day at a glance. Whole household, one screen.",
    ctaCopy: "Start your free trial and try the Today dashboard — broadcasts, weather, today's schedule, every meal, tasks, and kitchen reminders on one page.",
  },
  {
    id: "calendar",
    name: "Calendar",
    eyebrow: "SHARED FAMILY CALENDAR",
    title: "Every calendar in one calm view. No more double-booked dinners.",
    lede: "Connect up to five calendars your family already uses — Google, Apple, school, sports. Choose what stays private and what's shared, and see the whole week together.",
    icon: CalendarDays,
    tone: "blue",
    pill: "Calendar",
    bullets: [
      { icon: CalendarDays, title: "Up to five calendars", copy: "Google, Apple, Outlook, school, sports — bring them all in. Choose private or shared for each." },
      { icon: CalendarPlus, title: "Quick capture",             copy: "Type 'dentist 3pm Wed'. FamOS parses it, prefills everything, saves in two taps." },
      { icon: MapPin,       title: "Real places and directions", copy: "Pick a real place when creating an event, keep the address with the plan, and open directions when it's time to leave." },
      { icon: BellRing,     title: "Two-way Google sync",       copy: "Add it in FamOS — it shows up in Google Calendar. Delete it here — it's gone there. Owner-only events get a delete button right on the card." },
    ],
    preview: {
      title: "This week",
      kicker: "MAY · WEEK 21",
      pills: ["🇨🇦 Toronto weather · 19°", "5 calendar limit", "Private + shared"],
      rows: [
        { avatar: "A", name: "Soccer practice",  meta: "Today · 5:30 PM · Riverside",      accent: "sky" },
        { avatar: "M", name: "Piano lesson",     meta: "Today · 4:00 PM · Studio",         accent: "violet" },
        { avatar: "L", name: "Family dinner",    meta: "Today · 7:00 PM · Home",           accent: "peach" },
      ],
    },
    tips: [
      { headline: "Color-code every calendar", copy: "One tint for school, one for work, one for family. At a glance, you know whose event is whose." },
      { headline: "Weather built in", copy: "Outdoor events pull the forecast automatically, so 'soccer practice' comes with a rain badge when it matters." },
      { headline: "Choose what the household sees", copy: "Keep a work feed private, share the school calendar, and switch between one calendar or the combined family view." },
    ],
    ctaHeadline: "Every calendar. One calm week.",
    ctaCopy: "Try Calendar free for 30 days — connect up to five feeds, set private or shared visibility, and use two-way Google sync.",
  },
  {
    id: "meals",
    name: "Meals",
    eyebrow: "MEAL PLANNING & COOK MODE",
    title: "From 'what's for dinner?' to done.",
    lede: "Plan breakfast, lunch, dinner, or snacks with real recipes and step-by-step instructions, then let Cook Mode walk you through each stage hands-free.",
    icon: ChefHat,
    tone: "pink",
    pill: "Meals",
    bullets: [
      { icon: ChefHat,       title: "Cook Mode, hands-free",   copy: "Big step-by-step screen. Voice commands. Flour-covered hands never touch the phone." },
      { icon: Sparkles,      title: "Meal ideas by meal type",  copy: "Recipes that match what you actually want tonight. Not generic suggestions." },
      { icon: ListChecks,    title: "Recipes you can come back to", copy: "Save recipes with their picture, ingredients, nutrition, and cooking steps so the whole family can find them again." },
      { icon: ShoppingCart,  title: "Missing ingredients, one tap",  copy: "One tap. Every missing ingredient lands in the shopping list." },
    ],
    preview: {
      title: "Dinner plan",
      kicker: "MON–SUN",
      pills: ["6/7 dinners planned", "🍝 Pasta night · 35 min", "Vegetarian-friendly"],
      rows: [
        { avatar: "🍝", name: "Sheet-pan fajitas", meta: "Mon · 35 min · 8 ingredients",   accent: "rose" },
        { avatar: "🌶", name: "Turkey chili",     meta: "Tue · 45 min · 6 ingredients",   accent: "orange" },
        { avatar: "🐟", name: "Baked salmon",     meta: "Sun · 30 min · 7 ingredients",   accent: "mint" },
      ],
    },
    tips: [
      { headline: "Use what's already home", copy: "Cook with what you already have. Cook Mode asks before using tracked ingredients." },
      { headline: "Cook Mode is hands-free. Say next, back, or finish from across the kitchen." },
      { headline: "One-tap missing ingredients", copy: "Every meal card has a grocery badge — tap it and every missing ingredient pushes straight into the shopping list." },
    ],
    ctaHeadline: "From 'what's for dinner?' to done.",
    ctaCopy: "Try Meals free for 30 days — plan every meal type, save recipes with pictures, add what's missing, then cook step by step.",
  },
  {
    id: "shopping",
    name: "Shopping",
    eyebrow: "SHARED SHOPPING LIST",
    title: "The list that follows you home.",
    lede: "Add from chat, a recipe, a photo, or a barcode scan. Focus Shop handles the aisle; Kitchen Inventory tracks what came home and what needs using soon.",
    icon: ShoppingCart,
    tone: "mint",
    pill: "Shopping",
    bullets: [
      { icon: ShoppingCart, title: "Shared, with attribution", copy: "Every item shows who added it. A quiet avatar dot keeps the list clean — and you still know whose idea that fancy cheese was." },
      { icon: Camera,       title: "Photos, brands, and barcodes", copy: "Attach a private household photo or scan a product so its image and brand stay visible on the grocery card." },
      { icon: Sparkles,     title: "Missing-ingredient add",  copy: "On any meal card, the grocery badge shows what's still needed. Tap to push all missing ingredients straight to the list." },
      { icon: Refrigerator, title: "Fridge, freezer, and pantry", copy: "Move purchased items into Kitchen Inventory, add a use-by date, and get reminders before food is forgotten." },
    ],
    preview: {
      title: "Shopping list",
      kicker: "11 ITEMS · 3 CATEGORIES",
      pills: ["Produce · 4", "Dairy · 3", "Pantry · 4"],
      rows: [
        { avatar: "🥑", name: "Avocados",       meta: "Produce · 4", accent: "lime" },
        { avatar: "🧀", name: "Shredded cheddar", meta: "Dairy · 1 bag", accent: "amber" },
        { avatar: "🌮", name: "Tortillas",      meta: "Pantry · 1 pack", accent: "rose" },
      ],
    },
    tips: [
      { headline: "Scan in-store", copy: "Tap the camera. Point. Scan. The item lands in the right category automatically." },
      { headline: "Cook Mode ingredients to list", copy: "One tap from any meal card. Every missing ingredient pushes to the list." },
      { headline: "Use it, then replace it", copy: "Expiry reminders land on Today. One tap to restock." },
    ],
    ctaHeadline: "The list that follows you home.",
    ctaCopy: "Try Shopping free for 30 days — share the list, scan products, focus in the aisle, then track what reaches the kitchen.",
  },
  {
    id: "tasks",
    name: "Tasks",
    eyebrow: "TASKS & CHORES",
    title: "Everyone knows what's theirs. Recurring without nagging.",
    lede: "Type a task once, repeat it forever. Assign to anyone in the household, watch the streaks build, and let the points be the carrot.",
    icon: ClipboardList,
    tone: "yellow",
    pill: "Tasks",
    bullets: [
      { icon: ListChecks,   title: "Custom lists or everything", copy: "Create colour-coded task lists, switch between them, or use All Tasks when the whole household needs one view." },
      { icon: Users,        title: "Clear owners",             copy: "Tap a household member to assign the task. Their color shows up everywhere — list, dashboard, weekly view." },
      { icon: BellRing,     title: "Instant sync",             copy: "Mark done on the porch, see the parent's screen update in the kitchen. No refresh, no manual sync." },
      { icon: FileInput,    title: "Imports you approve",       copy: "Paste from Apple, Google, or Microsoft. Confirm before anything lands." },
    ],
    preview: {
      title: "Today's tasks",
      kicker: "4 OPEN · 1 DONE",
      pills: ["Daily · 2 tasks", "Weekly · 1 task", "+1 extra"],
      rows: [
        { avatar: "L", name: "Feed the dog",  meta: "Daily · Lou · done", accent: "mint" },
        { avatar: "M", name: "Pack soccer bag", meta: "Today · Mia", accent: "sky" },
        { avatar: "A", name: "Pay tuition", meta: "This week · Alex", accent: "amber" },
      ],
    },
    tips: [
      { headline: "Quick-add like iPhone Notes", copy: "Type the task. Hit Enter. Edit the details after. Nothing blocks the first keystroke." },
      { headline: "Streaks beat nagging", copy: "Tap a household member to assign the task — their color shows up everywhere without anyone asking twice." },
      { headline: "Live across every phone", copy: "Mark a task done on the porch, see the parent's screen update in the kitchen. Mark it deleted from one phone — it's gone from every other in under a second." },
    ],
    ctaHeadline: "Everyone knows what's theirs.",
    ctaCopy: "Try Tasks free for 30 days — type a task, assign it, set the cadence, watch the streaks build. Live across every phone in the family.",
  },
  {
    id: "chat",
    name: "Chat",
    eyebrow: "FAMILY CHAT",
    title: "Keep the conversation and the plan together.",
    lede: "Family chat, direct messages, and quick updates that don't ring the whole house. Smart suggestions turn 'we need butter' into a one-tap grocery add.",
    icon: Megaphone,
    tone: "peach",
    pill: "Chat",
    bullets: [
      { icon: Megaphone,   title: "Household updates",       copy: "A quick heads-up on everyone's dashboard. No notification storm." },
      { icon: Users,       title: "Direct messages",  copy: "Talk to one partner without the kids group-chat ping. Reactions, attachments, and read receipts still work the same way." },
      { icon: ShoppingCart, title: "Smart suggestions", copy: "Mention 'we need butter' (or any grocery, task, or event) and FamOS suggests the right shortcut — tap to push it straight into the right list." },
      { icon: BellRing,    title: "Quiet by default", copy: "Notifications fire only for things that matter: a direct message to you, a household update, or a deadline. The rest stays in the chat." },
    ],
    preview: {
      title: "Family chat",
      kicker: "3 UNREAD · 1 BROADCAST",
      pills: ["⚡ Suggestion: 'butter' → grocery", "2 active threads"],
      rows: [
        { avatar: "M", name: "Mia",      meta: "Can you grab milk?",        accent: "sky" },
        { avatar: "A", name: "Alex",     meta: "Added to list ✅",           accent: "coral" },
        { avatar: "📣", name: "Family",  meta: "Running 10 min late ❤️",     accent: "amber" },
      ],
    },
    tips: [
      { headline: "Smart suggestions turn chat into action", copy: "Type 'we need butter'. Chat suggests the right shortcut. One tap to the list." },
      { headline: "Household updates without thread noise", copy: "'Running 10 min late' doesn't deserve a notification storm — send an update and everyone sees the banner with one-tap reactions." },
      { headline: "Direct messages without the group ping", copy: "Talk to one partner without pinging the kids group chat — reactions, attachments, read receipts still work the same way." },
    ],
    ctaHeadline: "Keep the plan in the chat.",
    ctaCopy: "Try FamOS Chat free for 30 days — household updates, direct messages, and smart suggestions that turn chat into the right kind of action.",
  },
  {
    id: "fam-ai",
    name: "Fam AI",
    eyebrow: "YOUR FAMILY ASSISTANT",
    title: "Your family's quiet helper.",
    lede: "Fam AI reads what's on the calendar, the list, and the meal plan — and answers in plain words. Always asks before changing anything, so you stay in control.",
    icon: Sparkles,
    tone: "lilac",
    pill: "Fam AI",
    bullets: [
      { icon: ChefHat,       title: "Meal ideas from your groceries", copy: "Based on ingredients you already have, fresh recipes show up on the dashboard with what's required vs. what's optional." },
      { icon: ListChecks,    title: "Plan tonight in one sentence",   copy: "Type 'help me plan dinner tonight' and you get a recipe that matches the slot, the person, and the weather." },
      { icon: Coins,         title: "Weekly recap",                   copy: "A Sunday summary of what got done, what slipped, and what's coming up. Send it to the family chat with one tap." },
      { icon: Mic,           title: "Stays quiet until asked",        copy: "Hands-free voice inside Cook Mode. Fam AI never edits the calendar or list without your explicit say-so." },
    ],
    preview: {
      title: "Fam AI",
      kicker: "100 SMART REQUESTS / MONTH",
      pills: ["Meal suggestions", "Calendar summaries", "Tasks recap"],
      rows: [
        { avatar: "🌮", name: "Avocado pasta",     meta: "Uses 4 grocery items",        accent: "lime" },
        { avatar: "🍝", name: "One-pot lentil soup", meta: "35 min · dietary-friendly",   accent: "mint" },
        { avatar: "🥗", name: "Sheet-pan salmon",   meta: "30 min · gluten-free",         accent: "sky" },
      ],
    },
    tips: [
      { headline: "Cook with what's in the kitchen", copy: "Type what you have. Fam AI finds meals you can cook right now." },
      { headline: "Plan tonight in one sentence", copy: "Type 'help me plan dinner tonight' and you get a recipe that matches the slot, the person, and the day's weather — confirmed, not silently changed." },
      { headline: "Stays quiet until asked", copy: "Fam AI never edits the calendar or shopping list without your confirmation — you're always in control, never silently overwritten." },
    ],
    ctaHeadline: "Your family's quiet helper.",
    ctaCopy: "Try Fam AI free for 30 days — meal ideas from your groceries, calendar summaries, and weekly recaps that respect the family plan.",
  },
  {
    id: "rewards",
    name: "Rewards",
    eyebrow: "FAMILY REWARDS",
    title: "Turn 'chore' into 'I did it first'.",
    lede: "A point system that's lightweight enough not to feel like homework. Each completed task ticks up points; redeem them with the family, not against the family.",
    icon: Coins,
    tone: "yellow",
    pill: "Rewards",
    bullets: [
      { icon: Coins,        title: "Per-task point values",    copy: "You decide what's worth what — daily chores 1pt, school-night meal 2pt, big grocery run 5pt. Customise per task." },
      { icon: Users,        title: "Family-wide leaderboard",  copy: "Healthy, friendly, opt-in. Kids see themselves climbing. Parents see the load balance." },
      { icon: Sparkles,     title: "Redemptions you choose",   copy: "Screen time, ice cream pick, allowance top-up — define them once and the system does the math when someone hits their goal." },
      { icon: BellRing,     title: "Quiet praise, no shame",   copy: "Misses don't subtract; they just don't add. Always opt-in per household." },
    ],
    preview: {
      title: "Rewards",
      kicker: "MAY · LIVE LEADERBOARD",
      pills: ["Lou · 12 pts", "Mia · 9 pts", "Alex · 4 pts"],
      rows: [
        { avatar: "L", name: "Lou · fed the dog",   meta: "+1 · streak 6 days",       accent: "mint" },
        { avatar: "M", name: "Mia · packed lunch",  meta: "+1 · first of the day",    accent: "sky" },
        { avatar: "A", name: "Alex · groceries",    meta: "+5 · on time",             accent: "amber" },
      ],
    },
    tips: [
      { headline: "You decide what each task is worth", copy: "Daily chores 1pt, school-night meal 2pt, big grocery run 5pt — customise point values per task so the carrot matches the effort." },
      { headline: "Family-wide leaderboard, opt-in", copy: "Healthy, friendly, never forced. Kids see themselves climbing, parents see the load balance — no shame, no subtraction." },
      { headline: "Redemptions you define", copy: "Screen time, ice cream pick, allowance top-up — set them once and the system does the math when someone hits their goal." },
    ],
    ctaHeadline: "Turn 'chore' into 'I did it first.'",
    ctaCopy: "Try Rewards free for 30 days — points per task, a family-wide leaderboard, opt-in redemptions with no shame.",
  },
  {
    id: "family",
    name: "Family & Settings",
    eyebrow: "HOUSEHOLD SETTINGS",
    title: "A private home that feels like yours.",
    lede: "Invite each person securely, keep onboarding optional, choose a personal colour scheme, and control what every connected calendar shares.",
    icon: Users,
    tone: "mint",
    bullets: [
      { icon: Users,        title: "Invite by email or text",       copy: "Send an invite by email or SMS. The receiver picks their own password and lands in the household — no shared passwords in your group chat." },
      { icon: ChefHat,      title: "Optional personal profile", copy: "Add family role, birthday, age, calendar, and dietary needs only when useful. Existing members skip setup." },
      { icon: Palette,      title: "Personal colour schemes", copy: "Each member can choose a subtle palette during onboarding or later in Settings, with matching light and dark modes." },
      { icon: CalendarDays, title: "Calendar privacy per feed", copy: "See every connected calendar and mark each one private or shared with the household, up to five feeds." },
    ],
    preview: {
      title: "Settings",
      kicker: "3 MEMBERS · 2 ROLES",
      pills: ["Vegetarian", "Low sugar", "Toronto, ON"],
      rows: [
        { avatar: "A", name: "Alex",     meta: "Partner · owner",               accent: "coral" },
        { avatar: "M", name: "Mia",      meta: "Partner · co-owner",            accent: "sky" },
        { avatar: "L", name: "Lou",      meta: "Kid · view-only",               accent: "mint" },
      ],
    },
    tips: [
      { headline: "Invite by email or SMS", copy: "No shared credentials texted across the family. The invite arrives with a secure link, the new member picks their own password, and they're in." },
      { headline: "Profiles stay optional", copy: "Role, birthday, age, calendar, and dietary details help tailor FamOS, but none blocks a family member from getting into the app." },
      { headline: "Make the palette personal", copy: "Every member can choose a calmer colour profile without changing the rest of the household's experience." },
    ],
    ctaHeadline: "A private home that feels like yours.",
    ctaCopy: "Try FamOS free for 30 days — secure invites, optional profiles, personal colour schemes, and visibility controls for every connected calendar.",
  },
];

export const FEATURE_BY_ID = (id) => FEATURES.find((feature) => feature.id === id);

// Optional: build a cross-feature highlight for the index page footer.
export const SITE_WIDE_FEATURES = [
  { icon: BellRing, label: "Live across every phone" },
  { icon: Sparkles, label: "No shared passwords in your group chat" },
  { icon: ChefHat,  label: "Cook Mode with hands-free voice" },
];

// The current product surfaces highlighted across the public nav, footer,
// and feature index. Rewards remains a supporting Tasks capability until it
// is ready to stand alone in the primary app navigation.
export const MARKETING_FEATURE_IDS = [
  "today",
  "meals",
  "calendar",
  "fam-ai",
  "tasks",
  "chat",
  "shopping",
  "family",
];

export const MARKETING_FEATURES = MARKETING_FEATURE_IDS
  .map((id) => FEATURES.find((feature) => feature.id === id))
  .filter(Boolean);
