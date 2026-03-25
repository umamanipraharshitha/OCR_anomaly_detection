const API_BASE =
  import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "";

/** Backend compares this to DOCINTEL_ADMIN_EMAIL (default mpraharshitha2006@gmail.com). */
export function adminHeaders(userEmail) {
  if (!userEmail) return {};
  return { "X-DocIntel-User-Email": userEmail };
}

async function handleJson(res) {
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { detail: text || "Invalid response" };
  }
  if (!res.ok) {
    const msg =
      data.detail ??
      (typeof data === "object" && data.message) ??
      res.statusText;
    throw new Error(
      Array.isArray(msg) ? msg.map((m) => m.msg || m).join(", ") : String(msg)
    );
  }
  return data;
}

export async function analyzeDocument(docId, file) {
  const form = new FormData();
  form.append("doc_id", docId);
  form.append("file", file);

  const res = await fetch(`${API_BASE}/pipeline/analyze`, {
    method: "POST",
    body: form,
  });
  return handleJson(res);
}

export async function submitFeedback(payload) {
  const form = new FormData();
  form.append("doc_id", payload.doc_id);
  form.append("reviewer", payload.reviewer);
  form.append("corrected_name", payload.corrected_name || "");
  form.append("corrected_date", payload.corrected_date || "");
  form.append("corrected_amount", payload.corrected_amount || "");

  const res = await fetch(`${API_BASE}/pipeline/feedback`, {
    method: "POST",
    body: form,
  });
  return handleJson(res);
}

export async function fetchDashboard(userEmail) {
  const res = await fetch(`${API_BASE}/pipeline/dashboard`, {
    headers: { ...adminHeaders(userEmail) },
  });
  return handleJson(res);
}

export async function fetchMlEvaluation(userEmail) {
  const res = await fetch(`${API_BASE}/ml/evaluation`, {
    headers: { ...adminHeaders(userEmail) },
  });
  return handleJson(res);
}
