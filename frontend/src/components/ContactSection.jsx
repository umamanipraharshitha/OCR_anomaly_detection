import { useState, useEffect, forwardRef } from "react";
import { Link } from "react-router-dom";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase.js";
import { useAuth } from "../context/AuthContext.jsx";
import { isEmailJsConfigured, sendContactEmail } from "../emailjsContact.js";
import "./ContactSection.css";

const SUPPORT_EMAIL = "mpraharshitha2006@gmail.com";

const TOPICS = [
  { value: "general", label: "General inquiry" },
  { value: "demo", label: "Product demo" },
  { value: "enterprise", label: "Enterprise / volume" },
  { value: "integration", label: "API & integration" },
  { value: "other", label: "Other" },
];

const COLLECTION = "docintel_contact_messages";

const ContactSection = forwardRef(function ContactSection(_, ref) {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [topic, setTopic] = useState("general");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("idle");
  const [errorDetail, setErrorDetail] = useState("");

  useEffect(() => {
    if (user?.email) setEmail((prev) => prev || user.email);
    if (user?.displayName) setName((prev) => prev || user.displayName);
  }, [user]);

  async function onSubmit(e) {
    e.preventDefault();
    setErrorDetail("");
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const trimmedMessage = message.trim();
    if (!trimmedName || !trimmedEmail || !trimmedMessage) {
      setStatus("error");
      setErrorDetail("Please fill in all fields.");
      return;
    }
    if (trimmedMessage.length > 4000) {
      setStatus("error");
      setErrorDetail("Message is too long (max 4000 characters).");
      return;
    }

    setStatus("submitting");
    const topicLabel = TOPICS.find((t) => t.value === topic)?.label ?? topic;
    const composedMessage = `Topic: ${topicLabel}\n\n${trimmedMessage}`;

    try {
      if (isEmailJsConfigured()) {
        await sendContactEmail({
          name: trimmedName,
          email: trimmedEmail,
          message: composedMessage,
        });
      } else {
        await addDoc(collection(db, COLLECTION), {
          name: trimmedName,
          email: trimmedEmail,
          topic,
          message: trimmedMessage,
          source: "docintel_web",
          userId: user?.uid ?? null,
          createdAt: serverTimestamp(),
        });
      }
      setStatus("success");
      setMessage("");
    } catch (err) {
      console.error(err);
      setStatus("error");
      if (err?.code === "permission-denied") {
        setErrorDetail(
          "Firestore blocked this write. In Firebase Console, enable Firestore and add rules that allow creating documents in this collection (see project README)."
        );
      } else {
        setErrorDetail(
          err?.text || err?.message?.replace?.(/^Firebase:\s*/i, "") || "Failed to send message. Please try again."
        );
      }
    }
  }

  return (
    <section ref={ref} className="di-contact" id="contact" aria-labelledby="contact-heading">
      <div className="section-container di-contact-inner">
        <div className="di-contact-flex">
          <div className="di-contact-intro">
            <p className="di-contact-eyebrow">Contact us</p>
            <h2 id="contact-heading" className="di-contact-headline">
              Talk to us about <span className="di-contact-highlight">DocIntel</span>
            </h2>
            <p className="di-contact-desc">
              Pilot programmes, clearing workflows, or technical questions — send a note and we will respond as soon as
              we can.
            </p>
            <div className="di-contact-direct">
              <a href={`mailto:${SUPPORT_EMAIL}`} className="di-contact-mail">
                {SUPPORT_EMAIL}
              </a>
              <div className="di-contact-quick-links">
                <Link to={{ pathname: "/", hash: "pipeline" }} className="di-contact-quick-link">
                  View pipeline
                </Link>
                <span className="di-contact-quick-sep" aria-hidden>
                  ·
                </span>
                <span className="di-contact-quick-note">
                  {isEmailJsConfigured()
                    ? "Form sends via EmailJS (same fields as Aplora: name, email, message)."
                    : "Form saves to Firestore. Set VITE_EMAILJS_* to send email instead."}
                </span>
              </div>
            </div>
          </div>

          <div className="di-contact-form-card">
            {status === "success" ? (
              <div className="di-contact-success" role="status">
                <strong>Message received</strong>
                <p>
                  {isEmailJsConfigured()
                    ? "Thanks — your message was sent. We will get back to you soon."
                    : "Thanks — your message was saved. You can follow up from the same email you provided if needed."}
                </p>
              </div>
            ) : (
              <form className="di-minimal-form" onSubmit={onSubmit}>
                <div className="di-minimal-form-head">
                  <h3 className="di-minimal-form-title">Send a message</h3>
                  <p className="di-minimal-form-sub">We typically reply within one business day.</p>
                </div>

                <label className="di-minimal-field">
                  <span>Name</span>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                    placeholder="Your name"
                    required
                  />
                </label>
                <label className="di-minimal-field">
                  <span>Email</span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    placeholder="you@company.com"
                    required
                  />
                </label>
                <label className="di-minimal-field">
                  <span>Topic</span>
                  <select value={topic} onChange={(e) => setTopic(e.target.value)} aria-label="Topic">
                    {TOPICS.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="di-minimal-field">
                  <span>Message</span>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={5}
                    placeholder="How can we help?"
                    required
                    maxLength={4000}
                  />
                </label>

                {status === "error" && errorDetail ? (
                  <div className="di-contact-error" role="alert">
                    {errorDetail}
                  </div>
                ) : null}

                <button type="submit" className="di-minimal-submit" disabled={status === "submitting"}>
                  {status === "submitting" ? "Sending…" : "Send message"}
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
                    <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
});

export default ContactSection;
