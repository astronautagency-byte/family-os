const illustrations = {
  calendar: "/illustrations/family-v4/calendar.png",
  meals: "/illustrations/family-v4/meals.png",
  tasks: "/illustrations/family-v4/tasks.png",
  groceries: "/illustrations/family-v4/groceries.png",
  finance: "/illustrations/family-v4/finance.png",
  chat: "/illustrations/family-v4/chat.png",
  famai: "/illustrations/family-v4/famai.png",
  home: "/illustrations/family-v4/welcome.png",
  settings: "/illustrations/family-v4/family.png",
  rewards: "/illustrations/family-v4/rewards.png",
};

export default function PageSpotIllustration({ variant = "calendar" }) {
  return <span className={`page-spot-frame page-spot-frame-${variant}`} aria-hidden="true"><img className={`page-spot page-spot-${variant}`} src={illustrations[variant] || illustrations.calendar} alt="" /></span>;
}
