// Feature catalog for the public /features surface. One entry per real
// in-app module + a meta entry for cross-cutting "Family" features
// (invites, roles, dark mode, tablet kiosk, etc).
// Each module's `bullets` power the highlight grid on its dedicated page;
// `previewRows` power the small mock-UI panel so the page has visual
// product alongside the marketing copy.
import {
  BellRing, CalendarDays, CalendarPlus, Camera, ChefHat, ClipboardList,
  Coins, ListChecks, MapPin, Megaphone, Mic, ShoppingCart, Sparkles, Users,
} from "lucide-react";

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
    title: "One screen for the whole household.",
    lede: "Today is the calm, glance-and-go hub: a family broadcast, today's weather, upcoming events, tasks still open, and what's for dinner — all on one screen, with everyone synced in real time.",
    icon: Sparkles,
    tone: "lilac",
    pill: "Home",
    bullets: [
      { icon: Megaphone,  title: "Family broadcast",       copy: "Tap, type, send. Everyone in the household sees a celebration banner with one-tap emoji reactions (❤️ / 👍 / 😄 / 🎉)." },
      { icon: BellRing,   title: "Real-time sync",         copy: "Anything any member changes — broadcast, task, meal, list — appears on every phone in under a second via Supabase realtime." },
      { icon: ChefHat,    title: "Cook tonight, one tap",  copy: "If dinner is planned, the hero CTA deep-links straight into Cook Mode with hands-free voice navigation." },
      { icon: Users,      title: "Family load",            copy: "A live view of who has the most on their plate this week, so you can spread the work without asking." },
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
  },
  {
    id: "calendar",
    name: "Calendar",
    eyebrow: "SHARED FAMILY CALENDAR",
    title: "Sync every calendar. Stop double-booking dinner.",
    lede: "Bring in multiple Google Calendars, color-coded per source, share only what each person needs, and let FamOS surface the weather forecast for outdoor events automatically.",
    icon: CalendarDays,
    tone: "blue",
    pill: "Calendar",
    bullets: [
      { icon: CalendarDays, title: "Multiple Google Calendars", copy: "Connect personal, work, kids' school, and shared family calendars — pick which to display and which are private to you." },
      { icon: CalendarPlus, title: "Quick capture",             copy: "Type 'dentist 3pm Wed' — FamOS parses, prefill, save in two taps. The full form stays one tap away." },
      { icon: MapPin,       title: "Local event discovery",     copy: "Tired of scrolling Facebook? FamOS pulls family-friendly events nearby from SerpApi, Ticketmaster and Eventbrite, with a 'nearby area' fallback when nothing's local." },
      { icon: BellRing,     title: "Two-way Google sync",       copy: "Add it in FamOS — it shows up in Google. Delete it here — it's gone there. Owner-only Google events get a delete button on the card." },
    ],
    preview: {
      title: "This week",
      kicker: "MAY · WEEK 21",
      pills: ["🇨🇦 Toronto weather · 19°", "2 Google calendars", "+8 discovered"],
      rows: [
        { avatar: "A", name: "Soccer practice",  meta: "Today · 5:30 PM · Riverside",      accent: "sky" },
        { avatar: "M", name: "Piano lesson",     meta: "Today · 4:00 PM · Studio",         accent: "violet" },
        { avatar: "L", name: "Family dinner",    meta: "Today · 7:00 PM · Home",           accent: "peach" },
      ],
    },
  },
  {
    id: "meals",
    name: "Meals",
    eyebrow: "MEAL PLANNING & COOK MODE",
    title: "From 'what's for dinner?' to plated in four taps.",
    lede: "Plan a week of meals in seconds, let the roulette pick a recipe from your cuisine preferences, then Cook Mode walks you through it hands-free — even from the grocery aisle.",
    icon: ChefHat,
    tone: "pink",
    pill: "Meals",
    bullets: [
      { icon: ChefHat,       title: "Cook Mode, hands-free",   copy: "Big step-by-step screen with voice commands — say 'next', 'back', or 'finish' so a flour-covered hand never has to tap the phone." },
      { icon: Sparkles,      title: "Meal roulette",            copy: "Three recipe picks from TheMealDB (free) or API Ninjas (fallback), filtered by meal type (breakfast / lunch / dinner) and the cuisine you pinned." },
      { icon: ListChecks,    title: "Save & re-use recipes",    copy: "Built-in browser for thousands of recipes by ingredient. One-tap save into your family library; ingredients cache for instant grocery badges next time." },
      { icon: ShoppingCart,  title: "Ingredients → groceries",  copy: "Each meal card shows a tap-to-add badge. Tap and every missing ingredient pushes into the shopping list — no editing required." },
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
  },
  {
    id: "shopping",
    name: "Shopping",
    eyebrow: "SHARED SHOPPING LIST",
    title: "One list, everyone's hands contribute.",
    lede: "Add from anywhere — chat shortcuts, recipe Cook Mode, manual input, or a camera barcode scan. Focus-shopping mode keeps one item on screen at a time so you never lose your place in aisle 7.",
    icon: ShoppingCart,
    tone: "mint",
    pill: "Shopping",
    bullets: [
      { icon: ShoppingCart, title: "Shared, with attribution", copy: "Every item shows who added it. The avatar-only chip keeps the UI quiet while you still know whose idea that fancy cheese was." },
      { icon: Camera,       title: "Barcode scanner",         copy: "Tap the camera icon — point, scan, save. The item name lands in the right category automatically, then in focus-shopping mode." },
      { icon: Sparkles,     title: "Missing-ingredient add",  copy: "On any meal card, the grocery badge shows what's still needed. Tap to push all missing ingredients straight to the list." },
      { icon: ListChecks,   title: "Focus-shopping mode",     copy: "One item, full-screen. Tap to check, swipe to next. Auto-arrives when you have one item left and need to find the shortest checkout line." },
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
  },
  {
    id: "tasks",
    name: "Tasks",
    eyebrow: "TASKS & CHORES",
    title: "Recurring chores with rewards for the kid who never forgets.",
    lede: "Daily, weekly, monthly — type the task once, repeat forever. Assign to anyone in the household, watch the streaks build, and let points be the carrot without nagging.",
    icon: ClipboardList,
    tone: "yellow",
    pill: "Tasks",
    bullets: [
      { icon: ListChecks,   title: "Quick-add, like Notes",    copy: "Type a task, hit Enter. Then tap to edit the assignee, due date, category and recurring cadence — nothing blocking the first keystroke." },
      { icon: Users,        title: "Assign any member",        copy: "Tap a household member to put them on the hook. The color shows up everywhere — list, dashboard, weekly pulse." },
      { icon: BellRing,     title: "Realtime across phones",   copy: "Mark done on the porch, see the parent's screen update in the kitchen. No refresh, no manual sync." },
      { icon: Coins,        title: "Earn points, redeem rewards", copy: "Opt-in rewards: completed tasks tick up points for each kid or partner. Top the leaderboard, redeem for screen time, allowance, the next family vote." },
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
  },
  {
    id: "chat",
    name: "Chat",
    eyebrow: "FAMILY CHAT",
    title: "Less shouting across the house. More typing it once.",
    lede: "Family chat, direct messages, and broadcasts that don't ring in the live conversation. Smart shortcut suggestions turn 'we need butter' into a one-tap grocery add.",
    icon: Megaphone,
    tone: "peach",
    pill: "Chat",
    bullets: [
      { icon: Megaphone,   title: "Broadcasts",       copy: "Send a heads-up that lives on everyone's home dashboard with reactions — perfect for 'running 10 minutes late' that's loud but doesn't deserve a notification storm." },
      { icon: Users,       title: "Direct messages",  copy: "Talk to one partner without the kids group-chat ping. Reactions, attachments, and read receipts." },
      { icon: ShoppingCart, title: "Smart shortcuts", copy: "Mention 'we need butter' (or any grocery / task / event) and FamOS suggests the right shortcut — tap to push it straight into the right list." },
      { icon: BellRing,    title: "Quiet by default", copy: "Notifications only for things that matter: a direct message to you, a broadcast, or a deadline. The kitchen conversation stays in the chat, not on your lock screen." },
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
  },
  {
    id: "fam-ai",
    name: "Fam AI",
    eyebrow: "YOUR FAMILY ASSISTANT",
    title: "The household's quiet chief of staff.",
    lede: "Fam AI reads what's on the calendar, on the list, and in the meal plan — and answers in plain English. Always asks before changing anything, so you stay in control.",
    icon: Sparkles,
    tone: "lilac",
    pill: "Fam AI",
    bullets: [
      { icon: ChefHat,       title: "Meal ideas from your groceries", copy: "Based on ingredients you already have on the shopping list, fresh recipes show up on the dashboard with required vs. optional ingredients." },
      { icon: ListChecks,    title: "Plan tonight in one sentence",   copy: "Type 'help me plan dinner tonight' and you get a recipe that matches the slot, the assignee, and the weather." },
      { icon: Coins,         title: "Weekly recap",                   copy: "Sunday summary of what got done, what slipped, and what's coming up. Send it to the family chat with one tap." },
      { icon: Mic,           title: "Stays quiet until asked",        copy: "Hands-free voice access from Cook Mode. Fam AI never edits the family calendar or list without an explicit confirmation step." },
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
  },
  {
    id: "family",
    name: "Family & Settings",
    eyebrow: "HOUSEHOLD SETTINGS",
    title: "Roles, dietary preferences, dark mode, every member welcome.",
    lede: "A small admin surface that respects the household. Invite by email or SMS, set roles, drop in everyone's dietary preferences, and the app remembers — for everyone, in real time.",
    icon: Users,
    tone: "mint",
    bullets: [
      { icon: Users,        title: "Invite by email or SMS",       copy: "Email via Resend (with a fallback chain), SMS via AWS End User Messaging. The receiver picks a password, lands in the household — no shared password text." },
      { icon: ChefHat,      title: "Household dietary preferences", copy: "Vegetarian, gluten-free, peanut allergy — saved once, applied across meal roulette, recipe search, and grocery suggestions." },
      { icon: MapPin,       title: "Home location + weather",       copy: "Your address powers weather, disruption alerts, and 'local events nearby'. Set it once; forget it lives there." },
      { icon: Sparkles,     title: "Tablet kiosk mode",            copy: "Stick an iPad to the fridge. FamOS turns into a one-screen always-on display without locking the device." },
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
  },
];

export const FEATURE_BY_ID = (id) => FEATURES.find((feature) => feature.id === id);

// Optional: build a cross-feature highlight for the index page footer.
export const SITE_WIDE_FEATURES = [
  { icon: BellRing, label: "Real-time across phones" },
  { icon: Sparkles, label: "No login required for household members you invite" },
  { icon: ChefHat,  label: "Cook Mode with hands-free voice commands" },
];
