// SEO landing page configurations — each page targets a specific search intent
const PAGES = {
  "family-calendar": {
    title: "Shared Family Calendar App | FamOS",
    eyebrow: "Shared family calendar",
    h1: "One calendar for the whole family.",
    subtitle: "FamOS gives your family a shared calendar that syncs with Google Calendar, shows everyone's events in one place, and helps you spot conflicts before they happen.",
    heroDescription: "FamOS is the shared family calendar app that syncs with Google Calendar and shows everyone's schedule in one place. Plan the week, avoid conflicts, and keep your family organized.",
    canonical: "https://fam-os.app/family-calendar",
    features: [
      { icon: "calendar", title: "Google Calendar sync", description: "Connect your existing Google Calendars and see everything in one unified view. Two-way sync keeps both sides updated.", bullets: ["Two-way Google Calendar sync", "Multiple calendar support", "Custom calendar colors and names", "Public and private calendar visibility"] },
      { icon: "users", title: "Family-wide visibility", description: "See what every family member has going on. Know who's free, who's busy, and who needs a ride.", bullets: ["Color-coded by family member", "Availability at a glance", "Shared event creation", "Conflict detection"] },
      { icon: "zap", title: "Quick event creation", description: "Add events in seconds. Type what you need, assign it to a family member, and it's on the calendar.", bullets: ["Natural language input", "Recurring events", "Location and time details", "Reminder notifications"] },
    ],
    howItWorks: [
      { title: "Connect your calendars", description: "Link your Google Calendar in one tap. FamOS imports your existing events automatically." },
      { title: "Invite your family", description: "Send invites to family members. Everyone gets their own view of the shared calendar." },
      { title: "Plan together", description: "Add events, spot conflicts, and coordinate schedules. The whole family stays in sync." },
    ],
    faqs: [
      { q: "Does FamOS sync with Google Calendar?", a: "Yes. FamOS offers two-way Google Calendar sync. Events you create in FamOS appear in Google Calendar, and vice versa. You can connect multiple Google Calendars." },
      { q: "Can my kids see the family calendar?", a: "Yes. Each family member sees the shared calendar. You can control visibility — some events can be private or shared with specific members only." },
      { q: "Is there a limit to how many events I can add?", a: "No. FamOS Core includes unlimited events. The shared calendar is free for all household members." },
      { q: "Can I use FamOS on my iPad?", a: "Yes. FamOS works on iPad, Android tablets, phones, laptops, and desktops. There's also a dedicated tablet mode for kitchen or living room displays." },
    ],
    ctaTitle: "Your family, finally in sync.",
    ctaSubtitle: "Start with the free plan. Upgrade when your family wants more.",
  },

  "family-dashboard": {
    title: "Family Dashboard for Any Device | FamOS",
    eyebrow: "No special hardware required",
    h1: "Your family dashboard on any screen.",
    subtitle: "Turn the tablet you already own into a family command center. FamOS works on iPad, Android, phones, laptops, and desktops — no $500 wall display needed.",
    heroDescription: "FamOS is the family dashboard that works on any device. Turn your iPad or tablet into a family command center. No special hardware required.",
    canonical: "https://fam-os.app/family-dashboard",
    features: [
      { icon: "tablet", title: "Tablet mode", description: "Dedicated full-screen layout designed for kitchen counters, living rooms, and family spaces.", bullets: ["Optimized for touch", "Large, readable text", "Always-on display mode", "Works on any tablet size"] },
      { icon: "calendar", title: "Today's overview", description: "See the day at a glance — weather, schedule, meals, tasks, and what needs attention.", bullets: ["Weather and alerts", "Upcoming events", "Meal plan", "Open tasks and shopping"] },
      { icon: "users", title: "Multi-device sync", description: "Every family member sees the same information, whether they're on a phone, tablet, or laptop.", bullets: ["Real-time sync across devices", "Same data everywhere", "No app to install on each device", "Works in any browser"] },
    ],
    howItWorks: [
      { title: "Open FamOS on your tablet", description: "Visit home.fam-os.app in Safari or Chrome. Add it to your home screen for a full-screen experience." },
      { title: "Set up your family", description: "Add family members, connect calendars, and set up your household. Takes about 5 minutes." },
      { title: "Place it in your family space", description: "Put the tablet on the kitchen counter or living room shelf. Your family dashboard is ready." },
    ],
    faqs: [
      { q: "Do I need to buy special hardware?", a: "No. FamOS works on the iPad, Android tablet, phone, or computer you already own. There's no need for a dedicated wall display." },
      { q: "Which tablets work with FamOS?", a: "FamOS works on any tablet with a modern web browser — iPad (Safari), Android tablets (Chrome), and more. It also works as a native app on iOS and macOS." },
      { q: "Can I use FamOS as a kitchen display?", a: "Yes. FamOS has a dedicated tablet mode optimized for shared family spaces. Open it in your browser, add to home screen, and place it on the counter." },
      { q: "Is FamOS free?", a: "FamOS Core is free and includes the shared calendar, tasks, shopping lists, chat, and kitchen watch. Optional Plus and Pro plans unlock advanced features." },
    ],
    ctaTitle: "No hardware needed. Just your family.",
    ctaSubtitle: "Turn any device into your family command center.",
  },

  "fam-ai": {
    title: "AI Family Assistant — Fam AI | FamOS",
    eyebrow: "AI that knows your household",
    h1: "Meet Fam AI. Your family's helper.",
    subtitle: "Fam AI understands your family's schedule, meals, tasks, and groceries. It suggests next steps, finds conflicts, and helps you plan — all with your approval before anything changes.",
    heroDescription: "Fam AI is the AI family assistant in FamOS. It helps with meal planning, grocery lists, schedule coordination, and household tasks. Never acts without your approval.",
    canonical: "https://fam-os.app/fam-ai",
    features: [
      { icon: "brain", title: "Understands your household", description: "Fam AI reads your calendar, tasks, meals, and kitchen inventory to give relevant suggestions.", bullets: ["Calendar awareness", "Task and list context", "Meal plan knowledge", "Kitchen inventory tracking"] },
      { icon: "sparkles", title: "Suggests actions", description: "Ask questions or request actions. Fam AI proposes changes and waits for your approval.", bullets: ["Add items to lists", "Suggest meal ideas", "Find schedule conflicts", "Plan the week"] },
      { icon: "shield", title: "Private and safe", description: "Fam AI never acts without your approval. Your family's data stays in your household.", bullets: ["Requires approval for changes", "No data sold to third parties", "Household-scoped context", "Transparent about what it sees"] },
    ],
    howItWorks: [
      { title: "Ask a question", description: "Type or speak your request. Fam AI understands natural language about your family's life." },
      { title: "Review the suggestion", description: "Fam AI proposes an action — adding an item, creating an event, or suggesting a meal plan." },
      { title: "Approve or edit", description: "You decide. Approve the action as-is, edit it, or dismiss it. Fam AI learns your preferences over time." },
    ],
    faqs: [
      { q: "What can Fam AI do?", a: "Fam AI can answer questions about your family's schedule, suggest meals based on what you have, add items to shopping lists, help plan the week, and coordinate activities. It proposes actions and waits for your approval." },
      { q: "Does Fam AI act on its own?", a: "No. Fam AI always proposes actions and requires your approval before making any changes to your calendar, tasks, or lists. You stay in control." },
      { q: "Is my family's data safe with Fam AI?", a: "Yes. Fam AI only accesses information within your household. It never shares data with third parties, and it can't act without your explicit approval." },
      { q: "Is Fam AI included in the free plan?", a: "Fam AI is a premium feature. You can try it free for 30 days with FamOS Pro. After the trial, it's included in FamOS Plus and Pro plans." },
    ],
    ctaTitle: "Your family, powered by AI.",
    ctaSubtitle: "Try Fam AI free for 30 days. No credit card required for the core plan.",
  },

  "meal-planner": {
    title: "Family Meal Planner & Recipe Ideas | FamOS",
    eyebrow: "Meal planning made simple",
    h1: "Plan meals without the group chat.",
    subtitle: "FamOS helps your family plan breakfast, lunch, and dinner for the week. Get recipe ideas, manage dietary preferences, and use Cook Mode for hands-free step-by-step instructions.",
    heroDescription: "FamOS is the family meal planner with recipe suggestions, dietary preference tracking, and Cook Mode for hands-free cooking. Plan the week's meals together.",
    canonical: "https://fam-os.app/meal-planner",
    features: [
      { icon: "chef", title: "Weekly meal planning", description: "Plan breakfast, lunch, and dinner for the whole week. See what's planned at a glance.", bullets: ["Breakfast, lunch, dinner slots", "Drag and drop planning", "Recipe suggestions from Spoonacular", "Dietary preference filtering"] },
      { icon: "sparkles", title: "Recipe discovery", description: "Get meal ideas based on your family's preferences, dietary needs, and what's already in your kitchen.", bullets: ["AI-powered suggestions", "Dietary restriction support", "Cost estimates", "Nutrition information"] },
      { icon: "zap", title: "Cook Mode", description: "Step-by-step cooking instructions you can follow hands-free. Perfect for busy weeknight dinners.", bullets: ["Hands-free voice control", "Step-by-step instructions", "Timer integration", "Ingredient check-off"] },
    ],
    howItWorks: [
      { title: "Set dietary preferences", description: "Tell FamOS about allergies, preferences, and restrictions. Meals are filtered automatically." },
      { title: "Plan the week", description: "Choose meals for each day. Get suggestions based on what you have and what your family likes." },
      { title: "Cook with confidence", description: "Open Cook Mode when it's time to make dinner. Follow step-by-step instructions hands-free." },
    ],
    faqs: [
      { q: "Does FamOS suggest recipes?", a: "Yes. FamOS integrates with Spoonacular to suggest recipes based on your dietary preferences, available ingredients, and family tastes." },
      { q: "Can I track dietary restrictions?", a: "Yes. Set dietary preferences for each family member — allergies, vegetarian, gluten-free, and more. Meal suggestions respect these preferences." },
      { q: "What is Cook Mode?", a: "Cook Mode provides step-by-step cooking instructions with hands-free voice control. It's designed for busy weeknight cooking when your hands are full." },
      { q: "Is meal planning free?", a: "Manual meal planning is free in FamOS Core. Recipe suggestions and Cook Mode are premium features available with FamOS Plus or Pro." },
    ],
    ctaTitle: "Dinner, decided.",
    ctaSubtitle: "Start planning meals with your family today.",
  },

  "grocery-list": {
    title: "Shared Family Grocery List | FamOS",
    eyebrow: "Never forget the milk again",
    h1: "A grocery list everyone can update.",
    subtitle: "FamOS gives your family a shared shopping list that syncs in real time. Add items from meal plans, organize by store aisle, and check things off as you shop.",
    heroDescription: "FamOS is the shared family grocery list app. Real-time sync, category organization, and meal plan integration. Never forget the milk again.",
    canonical: "https://fam-os.app/grocery-list",
    features: [
      { icon: "shopping", title: "Real-time sync", description: "Everyone in the family can add, check, and remove items. Changes appear instantly on every device.", bullets: ["Instant sync across devices", "Multiple lists support", "Category organization", "Quantity and unit tracking"] },
      { icon: "chef", title: "Meal plan integration", description: "Missing ingredients from your meal plan are automatically added to the grocery list.", bullets: ["Auto-add from recipes", "Ingredient matching", "Missing items highlight", "Smart categorization"] },
      { icon: "sparkles", title: "Smart suggestions", description: "FamOS learns your shopping habits and suggests items you might need.", bullets: ["Reorder suggestions", "Expiry date tracking", "Kitchen inventory link", "Store aisle organization"] },
    ],
    howItWorks: [
      { title: "Add items", description: "Type items or add them from meal plans. FamOS categorizes them automatically." },
      { title: "Share with family", description: "Everyone sees the same list. Anyone can add or check off items in real time." },
      { title: "Shop and check off", description: "Check items off as you put them in your cart. The list updates for everyone instantly." },
    ],
    faqs: [
      { q: "Can multiple family members use the same list?", a: "Yes. The grocery list is shared across all household members. Everyone can add, edit, and check off items in real time." },
      { q: "Does it integrate with meal plans?", a: "Yes. When you plan meals in FamOS, missing ingredients are automatically suggested for your grocery list." },
      { q: "Can I organize items by category?", a: "Yes. Items are automatically sorted by category (produce, dairy, meat, etc.). You can also create custom lists for different stores or purposes." },
      { q: "Is the grocery list free?", a: "Yes. Shared grocery lists are included in FamOS Core at no cost." },
    ],
    ctaTitle: "Never forget the milk again.",
    ctaSubtitle: "Start your shared grocery list today.",
  },

  "family-tasks": {
    title: "Family Chore & Task Manager | FamOS",
    eyebrow: "Clear owners, fewer mysterious piles",
    h1: "Tasks everyone can actually see.",
    subtitle: "FamOS gives your family a shared task board with clear owners, due dates, and progress tracking. Assign chores, track homework, and celebrate completions together.",
    heroDescription: "FamOS is the family task manager with clear ownership, due dates, and progress tracking. Assign chores, track homework, and keep the household running smoothly.",
    canonical: "https://fam-os.app/family-tasks",
    features: [
      { icon: "tasks", title: "Clear ownership", description: "Every task has an owner. No more \"I thought you were doing that\" conversations.", bullets: ["Assign to family members", "Multiple assignees support", "Due date tracking", "Progress visibility"] },
      { icon: "list", title: "Organized lists", description: "Group tasks by category — housework, school, errands, family activities. Keep everything organized.", bullets: ["Custom task lists", "Color-coded categories", "Drag and drop ordering", "Share lists with family"] },
      { icon: "sparkles", title: "Completion celebrations", description: "Mark tasks done and see your family's progress. Positive reinforcement keeps everyone motivated.", bullets: ["Completion tracking", "Weekly progress reports", "Confetti celebrations", "Achievement streaks"] },
    ],
    howItWorks: [
      { title: "Create tasks", description: "Add tasks with titles, due dates, and assignees. Organize by list or category." },
      { title: "Assign to family", description: "Give each task a clear owner. Everyone knows what they're responsible for." },
      { title: "Track and celebrate", description: "Check off tasks as they're completed. See your family's progress over time." },
    ],
    faqs: [
      { q: "Can I assign tasks to specific family members?", a: "Yes. Every task can be assigned to one or more family members. Everyone sees their own tasks and the shared list." },
      { q: "Can I create custom task lists?", a: "Yes. Create lists for different purposes — housework, school, errands, trips, or anything else your family needs." },
      { q: "Is there a weekly progress view?", a: "Yes. The Today page shows a weekly progress summary so your family can see how much has been accomplished." },
      { q: "Are tasks free?", a: "Yes. Task management is included in FamOS Core at no cost." },
    ],
    ctaTitle: "Fewer mysterious piles. More done.",
    ctaSubtitle: "Start organizing your family's tasks today.",
  },

  "family-chat": {
    title: "Family Communication App | FamOS",
    eyebrow: "Keep family conversations close to the plans",
    h1: "Family chat that stays with the plans.",
    subtitle: "FamOS chat is built into your family's dashboard. Talk about schedules, share updates, and coordinate plans — all in context with your calendar, tasks, and meals.",
    heroDescription: "FamOS includes family chat built into your household dashboard. Discuss plans, share updates, and coordinate schedules in context.",
    canonical: "https://fam-os.app/family-chat",
    features: [
      { icon: "chat", title: "Built-in messaging", description: "Family chat is part of FamOS, not a separate app. Messages live alongside your plans.", bullets: ["Real-time messaging", "Family-wide broadcasts", "Message reactions", "Read receipts"] },
      { icon: "calendar", title: "Plan in context", description: "Discuss events, tasks, and meals right where they live. No more switching between apps.", bullets: ["Reference events in chat", "Share task updates", "Discuss meal plans", "Coordinate schedules"] },
      { icon: "users", title: "Everyone's included", description: "All family members can participate. Teenagers can have private conversations with specific members.", bullets: ["Group and direct messages", "Private conversations", "Family broadcast channel", "Notification controls"] },
    ],
    howItWorks: [
      { title: "Open the chat tab", description: "Access family chat from the bottom navigation. It's always one tap away." },
      { title: "Send a message", description: "Type your message and send it. Everyone in the household sees it instantly." },
      { title: "Coordinate plans", description: "Discuss schedule changes, share updates, and make decisions together." },
    ],
    faqs: [
      { q: "Is family chat free?", a: "Yes. Family chat is included in FamOS Core at no cost." },
      { q: "Can teenagers have private messages?", a: "Yes. FamOS supports direct messages between specific family members, as well as group conversations." },
      { q: "Can I send broadcasts to the whole family?", a: "Yes. The broadcast feature sends a message to every family member, perfect for important announcements." },
      { q: "Does chat work on all devices?", a: "Yes. Chat syncs across all devices — phones, tablets, laptops, and desktops." },
    ],
    ctaTitle: "Talk about plans, in the plans.",
    ctaSubtitle: "Start your family's conversation hub today.",
  },

  "tablet-mode": {
    title: "Family Dashboard for iPad & Tablets | FamOS",
    eyebrow: "Kitchen counter ready",
    h1: "Turn your tablet into a family command center.",
    subtitle: "FamOS Tablet Mode transforms your iPad or Android tablet into a shared family dashboard. See today's schedule, meals, tasks, and weather at a glance.",
    heroDescription: "FamOS Tablet Mode turns your iPad or Android tablet into a shared family dashboard. See schedules, meals, tasks, and weather at a glance.",
    canonical: "https://fam-os.app/tablet-mode",
    features: [
      { icon: "tablet", title: "Optimized for shared spaces", description: "Designed for kitchen counters, living rooms, and family areas. Large text, clear layout, touch-friendly.", bullets: ["Large, readable typography", "Touch-optimized controls", "Always-on display", "Ambient mode"] },
      { icon: "calendar", title: "Today at a glance", description: "See everything happening today — weather, schedule, meals, tasks, and what needs attention.", bullets: ["Weather and alerts", "Schedule overview", "Meal plan", "Task progress"] },
      { icon: "sparkles", title: "Family broadcast", description: "Send quick messages to the whole family from the tablet. Perfect for \"Dinner's ready!\" moments.", bullets: ["One-tap broadcasts", "Voice messages", "Family reactions", "Notification badges"] },
    ],
    howItWorks: [
      { title: "Open in browser", description: "Visit home.fam-os.app in Safari or Chrome on your tablet." },
      { title: "Add to home screen", description: "Tap \"Add to Home Screen\" for a full-screen, app-like experience." },
      { title: "Place in family space", description: "Put the tablet on the counter or shelf. Your family dashboard is always on." },
    ],
    faqs: [
      { q: "Which tablets support FamOS Tablet Mode?", a: "Any tablet with a modern web browser — iPad (Safari), Android tablets (Chrome), and more. There's also a native iOS app." },
      { q: "Do I need to install anything?", a: "No. Open FamOS in your browser and add it to your home screen. No app download required (though native apps are available)." },
      { q: "Can I use it as a kitchen display?", a: "Yes. FamOS Tablet Mode is designed for exactly that. Place it on your kitchen counter and see your family's day at a glance." },
      { q: "Is Tablet Mode free?", a: "Yes. Tablet Mode is included in FamOS Core at no cost." },
    ],
    ctaTitle: "Your kitchen command center.",
    ctaSubtitle: "Turn any tablet into your family's hub.",
  },
};

export default PAGES;
