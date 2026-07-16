import { ArrowLeft, LockKeyhole } from "lucide-react";

const go = (route) => {
  const target = route === "landing" ? "/" : `/#${route}`;
  window.history.pushState(null, "", target);
  window.dispatchEvent(new PopStateEvent("popstate"));
};

export default function Privacy({ signedIn = false }) {
  return <div className="legal-page">
    <header className="legal-nav">
      <button className="landing-brand" onClick={()=>go("landing")}><img src="/brand/famos-icon-transparent.png" alt=""/><strong>Fam<span>OS</span></strong></button>
      <button className="legal-back" onClick={()=>go(signedIn?"settings":"landing")}><ArrowLeft/> {signedIn?"Back to settings":"Back to home"}</button>
    </header>
    <main className="legal-content">
      <div className="legal-heading"><span><LockKeyhole/> Privacy policy</span><h1>Your family life stays yours.</h1><p>Last updated July 16, 2026</p></div>

      <section><h2>Overview</h2><p>FamOS is a private family coordination service developed by the team at Astronaut Digital, part of Astronaut Ventures. This policy explains what information FamOS uses, why it is needed, and the choices available to you.</p></section>
      <section><h2>Information you provide</h2><p>We process account details, household and family-member profiles, invitations, calendars, tasks, meals, grocery items, rewards, messages, budgets, and other content you choose to add. We also receive support messages and feedback you send to us.</p></section>
      <section><h2>Connected services</h2><p>If you choose to connect Google Calendar or another calendar feed, FamOS accesses the calendars you select to display and synchronize events. Events you create in a writable connected calendar are sent back to that provider. You can disconnect calendar access in Settings.</p></section>
      <section><h2>Fam AI</h2><p>When you use Fam AI, your prompt and the relevant household context needed to answer it may be sent securely to our AI service provider. Fam AI proposes actions for your review and does not apply them until you approve. Avoid entering sensitive information that is not needed for your request.</p></section>
      <section><h2>How information is used</h2><ul><li>Provide and synchronize the features you request.</li><li>Authenticate accounts and deliver household invitations.</li><li>Maintain security, diagnose errors, and prevent misuse.</li><li>Improve reliability and the FamOS experience.</li></ul></section>
      <section><h2>Sharing and service providers</h2><p>We do not sell your personal information. Information may be processed by providers that support authentication, database hosting, email delivery, calendar connections, notifications, and AI features. They receive only the information needed to perform those services and are subject to their own privacy and security terms.</p></section>
      <section><h2>Household visibility</h2><p>Content in a FamOS household is visible to invited household members according to their role. Parents and administrators may manage household membership, assignments, rewards, and approvals. Review your household members regularly and remove access that is no longer appropriate.</p></section>
      <section><h2>Retention, security, and your choices</h2><p>We retain information while your account is active and as reasonably needed to operate, secure, or comply with legal obligations. We use reasonable safeguards, but no online service can guarantee absolute security. You can edit or clear many categories of content inside FamOS, disconnect integrations, and contact us about account or privacy requests.</p></section>
      <section><h2>Children</h2><p>Child profiles and access must be created or authorized by a parent or legal guardian. Parents are responsible for deciding what information is appropriate to add and for supervising a child’s use of FamOS.</p></section>
      <section><h2>Changes to this policy</h2><p>We may update this policy as FamOS evolves. The current version and effective date will remain available on this page. Material changes may also be communicated in the app.</p></section>
      <section><h2>Contact</h2><p>For privacy questions or requests, contact the development team at Astronaut Digital, part of Astronaut Ventures.</p></section>

      <aside className="legal-disclaimer"><h2>Copyright and product disclaimer</h2><p>© 2026 FamOS. All rights reserved. FamOS, its original interface, branding, copy, and associated assets are protected by applicable intellectual-property laws. Third-party names, trademarks, services, and content remain the property of their respective owners.</p><p>FamOS is a family-organization tool and does not provide legal, medical, financial, or professional advice. AI suggestions may be incomplete or inaccurate and should be reviewed before use.</p></aside>
    </main>
    <footer className="legal-footer"><p>Developed by the team at Astronaut Digital<br/>Part of Astronaut Ventures</p><small>© 2026 FamOS. All rights reserved.</small></footer>
  </div>;
}
