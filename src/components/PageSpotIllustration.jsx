const illustrations = {
  calendar: "/illustrations/calendar-editorial.png",
  meals: "/illustrations/meals-editorial.png",
  tasks: "/illustrations/tasks-editorial.png",
  groceries: "/illustrations/groceries-editorial.png",
  finance: "/illustrations/finance-editorial.png",
  chat: "/illustrations/chat-editorial.png",
  settings: "/illustrations/settings-editorial.png",
  rewards: "/illustrations/rewards-editorial.png",
};

export default function PageSpotIllustration({ variant = "calendar" }) {
  return <span className={`page-spot-frame page-spot-frame-${variant}`} aria-hidden="true"><img className={`page-spot page-spot-${variant}`} src={illustrations[variant] || illustrations.calendar} alt="" /></span>;
}
