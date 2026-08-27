import { useState } from "react";
import { ArrowLeft, Mail, MessageCircle, Send, ShieldCheck } from "lucide-react";
import MarketingFooter from "../components/MarketingFooter";
import { IS_MAC_APP_STORE } from "../lib/distribution";

const go = (route) => {
  const target = route === "landing" ? "/" : `/#${route}`;
  window.history.pushState(null, "", target);
  window.dispatchEvent(new PopStateEvent("popstate"));
};

export default function Contact({ signedIn = false }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) return;
    setBusy(true);
    try {
      // Use mailto as the delivery mechanism — no backend needed
      const body = encodeURIComponent(
        `Name: ${name}\nEmail: ${email}\nSubject: ${subject || "FamOS Support"}\n\n${message}`
      );
      window.open(`mailto:support@fam-os.app?subject=${encodeURIComponent(subject || "FamOS Support")}&body=${body}`, "_blank");
      setSubmitted(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="legal-page">
      <header className="legal-nav">
        <button className="landing-brand" onClick={() => go("landing")}><img src="/icons/famos-app-icon.png" alt="" /><strong>Fam<span>OS</span></strong></button>
        <button className="legal-back" onClick={() => go(signedIn ? "settings" : "landing")}><ArrowLeft /> {signedIn ? "Back to settings" : "Back to home"}</button>
      </header>
      <main className="legal-content">
        <div className="legal-heading">
          <span><Mail /> Contact us</span>
          <h1>We're here to help.</h1>
          <p>Got a question, a problem, or an idea? We'd love to hear from you.</p>
        </div>

        <section className="contact-channels">
          <div className="contact-channel">
            <div className="contact-channel-icon"><Mail size={20} /></div>
            <div>
              <h3>Email support</h3>
              <p>For account issues, billing questions, or general help — we respond within one business day.</p>
              <a href="mailto:support@fam-os.app" className="contact-channel-link">support@fam-os.app</a>
            </div>
          </div>
          <div className="contact-channel">
            <div className="contact-channel-icon"><MessageCircle size={20} /></div>
            <div>
              <h3>Feedback &amp; feature requests</h3>
              <p>Have an idea that would make FamOS better for your family? Tell us about it.</p>
              <a href="mailto:feedback@fam-os.app" className="contact-channel-link">feedback@fam-os.app</a>
            </div>
          </div>
        </section>

        <section className="contact-form-section">
          <h2>Send us a message</h2>
          <p className="contact-form-intro">Fill out the form below and we'll get back to you as soon as possible.</p>
          {submitted ? (
            <div className="contact-success">
              <ShieldCheck size={24} />
              <h3>Message ready to send</h3>
              <p>Your email client should open with the message pre-filled. If it didn't open automatically, send your message to <strong>support@fam-os.app</strong>.</p>
              <button type="button" className="contact-reset-btn" onClick={() => { setSubmitted(false); setName(""); setEmail(""); setSubject(""); setMessage(""); }}>Send another message</button>
            </div>
          ) : (
            <form className="contact-form" onSubmit={handleSubmit}>
              <div className="contact-form-row">
                <label className="contact-field">
                  <span>Name</span>
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" required />
                </label>
                <label className="contact-field">
                  <span>Email</span>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
                </label>
              </div>
              <label className="contact-field">
                <span>Subject</span>
                <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="What can we help with?" />
              </label>
              <label className="contact-field">
                <span>Message</span>
                <textarea rows={5} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Tell us what's going on…" required />
              </label>
              <button type="submit" className="contact-submit" disabled={busy || !name.trim() || !email.trim() || !message.trim()}>
                <Send size={15} />
                {busy ? "Opening email…" : "Send message"}
              </button>
            </form>
          )}
        </section>

        <section className="contact-faq">
          <h2>Common questions</h2>
          <div className="contact-faq-item">
            <h3>I can't sign in to my account</h3>
            <p>Try resetting your password from the <a href="/sign-in">sign-in page</a>. If that doesn't work, email us at <a href="mailto:support@fam-os.app">support@fam-os.app</a> with the email address linked to your account and we'll help you get back in.</p>
          </div>
          <div className="contact-faq-item">
            <h3>My Google Calendar isn't syncing</h3>
            <p>Open <strong>Settings → Calendar connections</strong> in FamOS and tap <strong>Reconnect</strong>. If the problem persists, disconnect and reconnect Google Calendar. For ongoing issues, email us the details.</p>
          </div>
          {!IS_MAC_APP_STORE && <div className="contact-faq-item">
            <h3>I want to cancel or change my plan</h3>
            <p>Open <strong>Settings → Plan &amp; billing</strong> to manage your subscription. You can upgrade, downgrade, or cancel at any time. If you need help, email <a href="mailto:support@fam-os.app">support@fam-os.app</a>.</p>
          </div>}
          <div className="contact-faq-item">
            <h3>How do I add or remove family members?</h3>
            <p>Open <strong>Settings → Family</strong> to invite new members or remove existing ones. Each person gets their own account with personalized preferences.</p>
          </div>
        </section>

        <aside className="legal-disclaimer">
          <p>We aim to respond to all support emails within one business day. For urgent account or billing issues, please include your account email and a description of the problem in your message.</p>
        </aside>
      </main>
      <MarketingFooter signedIn={signedIn} />
    </div>
  );
}
