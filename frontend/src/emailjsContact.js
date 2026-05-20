/**
 * EmailJS — same pattern as aplora-deploy2 Contact.jsx:
 * emailjs.send(serviceID, templateID, { name, email, message }, publicKey)
 *
 * Template in EmailJS dashboard should use {{name}}, {{email}}, {{message}}.
 * Override via VITE_EMAILJS_* in .env.local if needed.
 */
import emailjs from "@emailjs/browser";

const SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID ;
const TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID  ;
const PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY ;

const emailJsDisabled =
  import.meta.env.VITE_EMAILJS_DISABLED === "1" || import.meta.env.VITE_EMAILJS_DISABLED === "true";

export function isEmailJsConfigured() {
  if (emailJsDisabled) return false;
  return Boolean(String(SERVICE_ID).trim() && String(TEMPLATE_ID).trim() && String(PUBLIC_KEY).trim());
}

/**
 * @param {{ name: string, email: string, message: string }} params — keys must match EmailJS template fields
 */
export function sendContactEmail(params) {
  return emailjs.send(SERVICE_ID, TEMPLATE_ID, params, PUBLIC_KEY);
}
