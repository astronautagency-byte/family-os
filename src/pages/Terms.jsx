import { ArrowLeft, FileText } from "lucide-react";

const go = (route) => { window.location.hash = route; };

export default function Terms({ signedIn = false }) {
  return <div className="legal-page">
    <header className="legal-nav">
      <button className="landing-brand" onClick={()=>go("landing")}><img src="/brand/famos-icon-transparent.png" alt=""/><strong>Fam<span>OS</span></strong></button>
      <button className="legal-back" onClick={()=>go(signedIn?"settings":"landing")}><ArrowLeft/> {signedIn?"Back to settings":"Back to home"}</button>
    </header>
    <main className="legal-content">
      <div className="legal-heading"><span><FileText/> Terms of service</span><h1>Simple terms for keeping families in sync.</h1><p>Last updated July 16, 2026</p></div>

      <section><h2>Agreement to these terms</h2><p>These Terms of Service govern your access to and use of FamOS, a family coordination app developed by the team at Astronaut Digital, part of Astronaut Ventures. By creating an account, starting a trial, subscribing, inviting household members, or using FamOS, you agree to these terms.</p></section>
      <section><h2>Accounts and households</h2><p>You are responsible for the accuracy of account information, household membership, invitations, and activity under your account. Household owners or administrators may invite and remove members, manage shared content, and configure household features. Do not invite people who should not have access to your family information.</p></section>
      <section><h2>Subscription plans and trial</h2><p>FamOS may offer a free 30-day trial. Unless cancelled before the trial ends, the selected subscription begins automatically at the then-current price shown at checkout. The base family plan starts at $14.99/month and includes up to 3 family members. Additional members are charged at $3.99/month per member unless a different price is shown at checkout.</p></section>
      <section><h2>Annual billing and discounts</h2><p>If you choose annual billing, the annual price reflects a 20% discount from the comparable monthly plan and is charged upfront after the free trial. Annual subscriptions renew automatically each year unless cancelled before the renewal date.</p></section>
      <section><h2>Add-ons</h2><p>Optional add-ons may be billed in addition to the base plan. Fam AI is currently priced at $14.99/month. Rewards & points is currently priced at $4.99/month. Add-ons may be enabled, disabled, or repriced as described at checkout or in your account settings. If annual billing is selected, eligible add-ons may also be billed annually with the same displayed discount unless otherwise stated.</p></section>
      <section><h2>Charges, taxes, and payment method</h2><p>You authorize FamOS and its payment processor to charge your selected payment method for subscription fees, add-ons, additional members, taxes, and any other charges you approve. Prices are shown before purchase and may vary by region, currency, taxes, promotions, or plan changes.</p></section>
      <section><h2>Cancellation and renewals</h2><p>You may cancel before the end of the trial to avoid charges. After billing begins, cancellation stops future renewals but does not automatically refund the current billing period. Your access may continue until the end of the paid term unless otherwise stated in your account or required by law.</p></section>
      <section><h2>Refunds</h2><p>Unless required by applicable law or expressly stated at checkout, fees are non-refundable. If you believe you were charged in error, contact us promptly so we can review the issue.</p></section>
      <section><h2>Acceptable use</h2><p>Use FamOS only for lawful household coordination. Do not misuse the service, attempt to access another household without permission, interfere with security or availability, upload malicious content, or use FamOS to harass, exploit, or harm others.</p></section>
      <section><h2>Fam AI and suggestions</h2><p>Fam AI may analyze household context and propose actions such as tasks, grocery items, events, or meal plans. AI outputs can be incomplete or inaccurate. You are responsible for reviewing suggestions before approving or relying on them. Fam AI is not a substitute for professional, medical, legal, financial, or emergency advice.</p></section>
      <section><h2>Integrations and third-party services</h2><p>FamOS may connect with services such as Google Calendar, Supabase, email delivery, payments, notifications, and AI providers. Your use of third-party services may be subject to their own terms and privacy policies. FamOS is not responsible for third-party outages, changes, or errors.</p></section>
      <section><h2>Changes to FamOS or these terms</h2><p>FamOS will evolve. We may add, modify, suspend, or discontinue features, plans, prices, or add-ons. If we make material changes to these terms, we will update this page and may provide additional notice in the app or by email.</p></section>
      <section><h2>Termination</h2><p>We may suspend or terminate access if you violate these terms, create risk for FamOS or other users, fail to pay charges when due, or use the service unlawfully. You may stop using FamOS at any time and may request account deletion where supported.</p></section>
      <section><h2>Disclaimers and limitation of liability</h2><p>FamOS is provided on an “as is” and “as available” basis. We do not guarantee uninterrupted or error-free operation. To the fullest extent permitted by law, FamOS and its developers are not liable for indirect, incidental, special, consequential, or punitive damages, or for lost data, profits, goodwill, or household disruptions arising from use of the service.</p></section>
      <section><h2>Contact</h2><p>For terms, billing, or subscription questions, contact the development team at Astronaut Digital, part of Astronaut Ventures.</p></section>

      <aside className="legal-disclaimer"><h2>Copyright and product disclaimer</h2><p>© 2026 FamOS. All rights reserved. FamOS, its original interface, branding, copy, and associated assets are protected by applicable intellectual-property laws. Third-party names, trademarks, services, and content remain the property of their respective owners.</p><p>These terms are provided for product launch readiness and should be reviewed by qualified counsel before relying on them for legal compliance.</p></aside>
    </main>
    <footer className="legal-footer"><p>Developed by the team at Astronaut Digital<br/>Part of Astronaut Ventures</p><small>© 2026 FamOS. All rights reserved.</small></footer>
  </div>;
}
