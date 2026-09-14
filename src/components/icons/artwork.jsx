// Flat, code-native FamOS illustrations. Coordinates share a 24px grid.
// No gradients or raster effects: artwork remains crisp at navigation sizes.
const house = <><path fill="#37B989" d="M3 10 12 3l9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z"/><path fill="#087950" d="m1 10 10-8a2 2 0 0 1 2 0l10 8-2 2-9-7-9 7Z"/><rect x="9" y="14" width="6" height="7" rx="1" fill="#D9F6DD"/><rect x="5" y="10" width="4" height="4" rx="1" fill="#FFF6C8"/></>;
const calendar = <><rect x="3" y="4" width="18" height="18" rx="3" fill="#D8EEFF"/><path fill="#3989D8" d="M6 4h12a3 3 0 0 1 3 3v3H3V7a3 3 0 0 1 3-3Z"/><path d="M8 2v5m8-5v5" stroke="#18385B" strokeWidth="2" strokeLinecap="round"/><rect x="6" y="13" width="4" height="3" rx="1" fill="#3989D8"/><rect x="13" y="12" width="5" height="6" rx="1.5" fill="#08A774"/><circle cx="8" cy="19" r="1" fill="#F1954A"/></>;
const tasks = <><rect x="4" y="4" width="16" height="18" rx="3" fill="#BCEEDB"/><rect x="8" y="2" width="8" height="5" rx="2" fill="#079B6C"/><path d="m7 12 2 2 3-4m-5 8 2 2 3-4" stroke="#087653" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><path d="M14 12h3m-3 6h3" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round"/></>;
const cart = <><path d="M2 3h3l3 14h11" fill="none" stroke="#16694E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path fill="#23B982" d="M5 6h17l-3 9H7Z"/><path fill="#FFFFFF" d="M13 9c-2-2-4 1 0 4 4-3 2-6 0-4Z"/><circle cx="9" cy="21" r="2" fill="#F8BA45"/><circle cx="19" cy="21" r="2" fill="#F8BA45"/></>;
const chat = <><path fill="#CFC0FA" d="M20 7H9a3 3 0 0 0-3 3v7a3 3 0 0 0 3 3h8l4 3v-4a3 3 0 0 0 2-3v-6a3 3 0 0 0-3-3Z"/><path fill="#8656D8" d="M4 2h12a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H8l-6 4v-5a3 3 0 0 1-1-2V5a3 3 0 0 1 3-3Z"/><path d="M5 7h10M5 11h6" stroke="#FFF" strokeWidth="2" strokeLinecap="round"/></>;
const fridge = <><rect x="5" y="2" width="14" height="20" rx="3" fill="#BDA8F0"/><path d="M5 9h14" stroke="#7950C3" strokeWidth="2"/><path d="M8 5v2m0 5v4" stroke="#FFF" strokeWidth="2" strokeLinecap="round"/><rect x="12" y="12" width="5" height="5" rx="1" fill="#FFF0B3"/></>;
const pot = <><path fill="#FAAA40" d="M4 10h16v7a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5Z"/><path d="M2 11h20M2 15h2m16 0h2" stroke="#C66B28" strokeWidth="2" strokeLinecap="round"/><path d="M7 7c-3-2 2-3 0-5m5 5c-3-2 2-3 0-5m5 5c-3-2 2-3 0-5" fill="none" stroke="#F7C86B" strokeWidth="1.8" strokeLinecap="round"/></>;
const people = <><circle cx="7" cy="7" r="4" fill="#F9BA76"/><path d="M1 21v-5a6 6 0 0 1 12 0v5Z" fill="#428ED6"/><circle cx="17" cy="8" r="3.5" fill="#C98457"/><path d="M12 21v-5a5.5 5.5 0 0 1 11 0v5Z" fill="#EC8198"/><path d="M3 6a4 4 0 0 1 8 0L7 4Zm11 1a3 3 0 0 1 6 0l-3-2Z" fill="#533D43"/></>;
const bell = <><path fill="#F7BD43" d="M4 16c2-2 1-5 2-8a6 6 0 0 1 12 0c1 3 0 6 2 8Z"/><rect x="2" y="16" width="20" height="3" rx="1.5" fill="#E8992E"/><path d="M9 21a3 3 0 0 0 6 0" fill="#A66730"/><circle cx="17" cy="5" r="4" fill="#F16E76"/></>;
const shield = <><path fill="#31B890" d="m12 1 9 4v7c0 5-5 9-9 11-4-2-9-6-9-11V5Z"/><path fill="#C6F1DC" d="M12 4v16c4-3 6-5 6-9V7Z"/><path d="m7 11 3 3 6-6" stroke="#08654F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/></>;
const mail = <><rect x="2" y="5" width="20" height="15" rx="3" fill="#A4D9F4"/><path fill="#408DCF" d="m2 7 10 8L22 7V6L12 13 2 6Z"/><path d="m3 19 6-5m12 5-6-5" stroke="#69AFE0" strokeWidth="1.5"/></>;
const pin = <><path fill="#EC7A72" d="M12 1a9 9 0 0 0-9 9c0 6 9 13 9 13s9-7 9-13a9 9 0 0 0-9-9Z"/><circle cx="12" cy="10" r="4" fill="#FFE4B6"/><circle cx="12" cy="10" r="2" fill="#FFF"/></>;
const bot = <><path d="M12 2v4" stroke="#405A8E" strokeWidth="2"/><circle cx="12" cy="2" r="2" fill="#F4B943"/><rect x="2" y="7" width="20" height="15" rx="5" fill="#A2DDF4"/><rect x="5" y="10" width="14" height="8" rx="3" fill="#203A69"/><circle cx="9" cy="14" r="1.5" fill="#62E4CE"/><circle cx="15" cy="14" r="1.5" fill="#62E4CE"/><path d="M9 20h6" stroke="#FFF" strokeWidth="1.5" strokeLinecap="round"/></>;
const wallet = <><rect x="2" y="4" width="20" height="16" rx="3" fill="#F0B854"/><path d="M2 8h20" stroke="#D48B32" strokeWidth="2"/><rect x="14" y="11" width="9" height="6" rx="2" fill="#9C72DA"/><circle cx="17" cy="14" r="1" fill="#FFF"/></>;
const book = <><path fill="#9BBFEB" d="M2 3h6l4 3 4-3h6v17h-6l-4 3-4-3H2Z"/><path fill="#E3EFFF" d="M4 5h4l4 3 4-3h4v13h-4l-4 3-4-3H4Z"/><path d="M12 8v13" stroke="#508DD0" strokeWidth="1.5"/></>;
const sun = <><path d="M12 1v3m0 16v3M1 12h3m16 0h3M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2" stroke="#F2A43B" strokeWidth="2" strokeLinecap="round"/><circle cx="12" cy="12" r="6" fill="#FFD259"/></>;
const heart = <path fill="#EF8193" d="M12 22C-9 9 5-6 12 5c7-11 21 4 0 17Z"/>;
const star = <path fill="#F6BD43" stroke="#D99528" strokeWidth=".7" strokeLinejoin="round" d="m12 1 3.4 7 7.6 1-5.5 5.5 1.3 7.5-6.8-3.5L5.2 22l1.3-7.5L1 9l7.6-1Z"/>;
const leaf = <><path fill="#32B887" d="M22 2C5 0-3 10 7 18c8 8 16-3 15-16Z"/><path d="M2 23 17 8m-8 8v-6m0 6h6" fill="none" stroke="#087250" strokeWidth="1.8" strokeLinecap="round"/></>;
const clock = <><circle cx="12" cy="12" r="10" fill="#A4DDF1"/><circle cx="12" cy="12" r="7" fill="#F3FBFF"/><path d="M12 6v6l4 3" stroke="#3474B2" strokeWidth="2" strokeLinecap="round" fill="none"/><circle cx="12" cy="12" r="1.5" fill="#F3B84C"/></>;
const gear = <><path fill="#A68ADC" d="m9 1 6 0 1 3 3 1 3 4-2 3 2 3-3 4-3 1-1 3H9l-1-3-3-1-3-4 2-3-2-3 3-4 3-1Z"/><circle cx="12" cy="12" r="5" fill="#EDE2FF"/><circle cx="12" cy="12" r="2.5" fill="#7754B3"/></>;
const sparkle = <><path fill="#A574DF" d="m11 1 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z"/><path fill="#F6BE4A" d="m20 1 1 3 3 1-3 1-1 3-1-3-3-1 3-1Zm0 15 1 3 3 1-3 1-1 3-1-3-3-1 3-1Z"/></>;
const chef = <><path fill="#F9DCA8" d="M6 15a6 6 0 1 1 1-11 6 6 0 0 1 10 0 6 6 0 1 1 1 11v7H6Z"/><path d="M6 18h12" stroke="#DF973C" strokeWidth="2"/><path d="M10 12v4m4-4v4" stroke="#FFF" strokeWidth="2" strokeLinecap="round"/></>;
const trophy = <><path d="M5 5H2v4a5 5 0 0 0 5 5m12-9h3v4a5 5 0 0 1-5 5" fill="none" stroke="#DA9630" strokeWidth="2"/><path fill="#F5BD44" d="M5 2h14v7a7 7 0 0 1-14 0Z"/><path d="M12 15v5" stroke="#DA9630" strokeWidth="3"/><rect x="7" y="20" width="10" height="3" rx="1" fill="#F5BD44"/><path fill="#FFF5CB" d="m12 4 1.2 2.5 2.8.5-2 2 .4 2.8-2.4-1.3-2.4 1.3L10 9 8 7l2.8-.5Z"/></>;
const plusBadge = <><circle cx="18" cy="18" r="6" fill="#FFF"/><circle cx="18" cy="18" r="5" fill="#0AA976"/><path d="M18 15v6m-3-3h6" stroke="#FFF" strokeWidth="1.7" strokeLinecap="round"/></>;
export const artwork = {
  Home:house, House:house, Calendar:calendar, CalendarDays:calendar,
  CheckSquare:tasks, ListChecks:tasks, ListTodo:tasks, ClipboardList:tasks,
  ShoppingCart:cart, ShoppingBasket:cart, MessageCircle:chat, Refrigerator:fridge,
  CookingPot:pot, Soup:pot, Users:people, UsersRound:people, Bell:bell, BellRing:bell,
  Shield:shield, ShieldCheck:shield, Mail:mail, MapPin:pin, Bot:bot, WalletCards:wallet,
  BookOpen:book, Sun:sun, Heart:heart, Star:star, Leaf:leaf, Clock:clock, Clock3:clock,
  Settings:gear, Sparkles:sparkle, ChefHat:chef, Trophy:trophy,
  CalendarPlus:<>{calendar}{plusBadge}</>, MessageSquarePlus:<>{chat}{plusBadge}</>,
  ListPlus:<>{tasks}{plusBadge}</>,
};
