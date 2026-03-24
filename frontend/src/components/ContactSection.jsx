import { useState, useEffect, forwardRef } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase.js";
import { useAuth } from "../context/AuthContext.jsx";
import "./ContactSection.css";

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
    try {
      await addDoc(collection(db, COLLECTION), {
        name: trimmedName,
        email: trimmedEmail,
        topic,
        message: trimmedMessage,
        source: "docintel_web",
        userId: user?.uid ?? null,
        createdAt: serverTimestamp(),
      });
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
        setErrorDetail(err?.message?.replace?.(/^Firebase:\s*/i, "") || "Something went wrong. Try again later.");
      }
    }
  }

  return (
    <section ref={ref} className="di-contact" id="contact" aria-labelledby="contact-heading">
      <div className="section-container">
        <div className="di-contact-grid">
          <div className="di-contact-copy">
            <p className="di-contact-tag">Get in touch</p>
            <h2 id="contact-heading" className="di-contact-title">
              Questions about <span className="di-accent-gradient">DocIntel</span>?
            </h2>
            <p className="di-contact-lead">
              Send a message through the form — your note is stored securely in your Firebase project (Firestore). No
              outbound email is sent from this page by default; your team can review submissions in the console or wire
              Cloud Functions later.
            </p>
            <ul className="di-contact-points">
              <li>
                <span className="di-contact-point-ic" aria-hidden>
                  ✓
                </span>
                Pilot programmes &amp; SOC workflows
              </li>
              <li>
                <span className="di-contact-point-ic" aria-hidden>
                  ✓
                </span>
                On‑prem API &amp; data residency questions
              </li>
              <li>
                <span className="di-contact-point-ic" aria-hidden>
                  ✓
                </span>
                Custom validation rules &amp; model retraining
              </li>
            </ul>
          </div>

          <div className="di-contact-card-wrap">
            <div className="di-contact-card">
              <div className="di-contact-card-head">
                <h3>Message us</h3>
                <p>We typically review new threads within one business day.</p>
              </div>

              {status === "success" ? (
                <div className="di-contact-success" role="status">
                  <strong>Received</strong>
                  <p>Thanks — your message was saved. You can follow up from the same email you provided if needed.</p>
                </div>
              ) : (
                <form className="di-contact-form" onSubmit={onSubmit}>
                  <label className="di-contact-field">
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
                  <label className="di-contact-field">
                    <span>Your email</span>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                      placeholder="Best address for a reply"
                      required
                    />
                  </label>
                  <label className="di-contact-field">
                    <span>Topic</span>
                    <select value={topic} onChange={(e) => setTopic(e.target.value)}>
                      {TOPICS.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="di-contact-field">
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

                  <button type="submit" className="di-contact-submit" disabled={status === "submitting"}>
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
      </div>
    </section>
  );
});

export default ContactSection;
