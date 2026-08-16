import { ArrowLeft, FileText } from "lucide-react";
import { formatMoney } from "../data/pricingPlan";
import MarketingFooter from "../components/MarketingFooter";

const go = (route) => {
  const target = route === "landing" ? "/" : `/#${route}`;
  window.history.pushState(null, "", target);
  window.dispatchEvent(new PopStateEvent("popstate"));
};

export default function Terms({ signedIn = false }) {
  return <div className="legal-page">
    <header className="legal-nav">
      <button className="landing-brand" onClick={()=>go("landing")}><img src="/icons/icon-512.png" alt=""/><strong>Fam<span>OS</span></strong></button>
      <button className="legal-back" onClick={()=>go(signedIn?"settings":"landing")}><ArrowLeft/> {signedIn?"Back to settings":"Back to home"}</button>
    </header>
    <main className="legal-content">
      <div className="legal-heading"><span><FileText/> Terms of service</span><h1>Simple terms for keeping families in sync.</h1><p>Last updated July 16, 2026</p></div>

      <section><h2>Agreement to these terms</h2><p>These Terms of Service govern your access to and use of FamOS, a family coordination app. By creating an account, starting a trial, subscribing, inviting household members, or using FamOS, you agree to these terms.</p></section>
      <section><h2>Accounts and households</h2><p>You are responsible for the accuracy of account information, household membership, invitations, and activity under your account. Household owners or administrators may invite and remove members, manage shared content, and configure household features. Do not invite people who should not have access to your family information.</p></section>
      <section><h2>Free features</h2><p>FamOS Calendar, Tasks, Shopping Lists, Family Chat, and Kitchen Watch are available without a subscription. No payment card is required to use these free household tools.</p></section>
      <section><h2>Optional paid features</h2><p>Meal Planning, FamAI, and Family Tools are offered separately at {formatMoney(4.99)} CAD per feature per month, unless a different price is clearly shown at checkout. A purchased feature is shared with the subscribing household.</p></section>
      <section><h2>Billing and cancellation</h2><p>Optional features renew monthly through Chargebee until cancelled. The household owner can manage features, payment details, invoices, and cancellation from the billing portal. Cancellation takes effect according to the date shown there.</p></section>
      <section><h2>Charges, taxes, and payment method</h2><p>You authorize FamOS and its payment processor to charge your selected payment method for subscription fees, add-ons, additional members, taxes, and any other charges you approve. Prices are shown before purchase and may vary by region, currency, taxes, promotions, or plan changes.</p></section>
      <section><h2>Cancellation and renewals</h2><p>You may cancel before the end of the trial to avoid charges. After billing begins, cancellation stops future renewals but does not automatically refund the current billing period. Your access may continue until the end of the paid term unless otherwise stated in your account or required by law.</p></section>
      <section><h2>Refunds</h2><p>Unless required by applicable law or expressly stated at checkout, fees are non-refundable. If you believe you were charged in error, contact us promptly so we can review the issue.</p></section>
      <section><h2>Acceptable use</h2><p>Use FamOS only for lawful household coordination. Do not misuse the service, attempt to access another household without permission, interfere with security or availability, upload malicious content, or use FamOS to harass, exploit, or harm others.</p></section>
      <section><h2>Fam AI and suggestions</h2><p>Fam AI may analyze household context and propose actions such as tasks, grocery items, events, or meal plans. AI outputs can be incomplete or inaccurate. You are responsible for reviewing suggestions before approving or relying on them. Fam AI is not a substitute for professional, medical, legal, financial, or emergency advice.</p></section>
      <section><h2>Integrations and third-party services</h2><p>FamOS connects with services that help it work — your calendar, secure email and SMS delivery, payments, push notifications, and the AI that powers Fam AI. Your use of these services may be subject to their own terms and privacy policies. FamOS is not responsible for third-party outages, changes, or errors.</p></section>
      <section><h2>Changes to FamOS or these terms</h2><p>FamOS will evolve. We may add, modify, suspend, or discontinue features, plans, prices, or add-ons. If we make material changes to these terms, we will update this page and may provide additional notice in the app or by email.</p></section>
      <section><h2>Termination</h2><p>We may suspend or terminate access if you violate these terms, create risk for FamOS or other users, fail to pay charges when due, or use the service unlawfully. You may stop using FamOS at any time and may request account deletion where supported.</p></section>
      <section><h2>Disclaimers and limitation of liability</h2><p>FamOS is provided on an “as is” and “as available” basis. We do not guarantee uninterrupted or error-free operation. To the fullest extent permitted by law, FamOS and its developers are not liable for indirect, incidental, special, consequential, or punitive damages, or for lost data, profits, goodwill, or household disruptions arising from use of the service.</p></section>
      <section><h2>Contact</h2><p>For terms, billing, or subscription questions, contact the FamOS team. We respond within one business day.</p></section>

      <aside className="legal-disclaimer"><h2>Copyright and product disclaimer</h2><p>© 2026 FamOS. All rights reserved. FamOS, its original interface, branding, copy, and associated assets are protected by applicable intellectual-property laws. Third-party names, trademarks, services, and content remain the property of their respective owners.</p><p>These terms are provided for product launch readiness and should be reviewed by qualified counsel before relying on them for legal compliance.</p></aside>
    </main>
    <MarketingFooter />
  </div>;
}
