# Document Intelligence Pipeline (Hackathon MVP) .

## Run the API

From the project root (`ctf/`):

```bash
python -m pip install -r requirements.txt
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

- **Interactive API docs (try uploads here):** [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- **Health / route list:** [http://127.0.0.1:8000/](http://127.0.0.1:8000/)

### Quick test without the React app

1. Open **Swagger** at `/docs`.
2. Expand **POST** `/pipeline/analyze` → **Try it out**.
3. Set `doc_id` (e.g. `test-001`) and choose a file → **Execute**.
4. Call **GET** `/pipeline/dashboard` to see aggregated stats.
5. Use **POST** `/pipeline/feedback` to append reviewer corrections.

## Run the React dashboard

In a **second** terminal:

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The dev server **proxies** `/pipeline/*` to `http://127.0.0.1:8000`, so keep the API running on port 8000.

### Routes (marketing + auth + console)

- **`/`** — Landing (hero, pipeline, CTAs)
- **`/login`** / **`/signup`** — Firebase email/password + Google (Aplora-style split panel)
- **`/app`** — Document console (ingest, dashboard, feedback) — **requires sign-in**

Firebase config defaults live in `frontend/src/firebase.js`. Override with `VITE_FIREBASE_*` in `frontend/.env` if needed.

In the [Firebase Console](https://console.firebase.google.com/) for your project, enable **Authentication → Sign-in method**: Email/Password and Google, and add **Authorized domains** (e.g. `localhost`) for web sign-in.

**Contact form:** By default the app sends mail through **EmailJS** using the same pattern as Aplora (`emailjs.send(serviceId, templateId, { name, email, message }, publicKey)`). Your EmailJS template should define **`{{name}}`**, **`{{email}}`**, and **`{{message}}`**. Optional env overrides in `frontend/.env`: `VITE_EMAILJS_SERVICE_ID`, `VITE_EMAILJS_TEMPLATE_ID`, `VITE_EMAILJS_PUBLIC_KEY`. Set **`VITE_EMAILJS_DISABLED=1`** to use **Firestore** only instead of EmailJS.

If you use the Firestore fallback, enable **Firestore** and the collection `docintel_contact_messages`. Example rules:

```text
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /docintel_contact_messages/{id} {
      allow create: if request.resource.data.keys().hasAll(
        ['name', 'email', 'topic', 'message', 'source', 'createdAt']
      )
        && request.resource.data.message is string
        && request.resource.data.message.size() <= 4000;
      allow read, update, delete: if false;
    }
  }
}
```

Tighten `create` as needed (e.g. require auth, validate `topic`, or restrict `source`). Admins can read documents in the Firebase Console or via the Admin SDK.

### Production-style API URL

If you build the UI and serve it separately, set:

```bash
# frontend/.env.production (example)
VITE_API_URL=http://127.0.0.1:8000
```

Then `npm run build` and serve the `frontend/dist` folder with any static host; requests go directly to the API (CORS is enabled in `main.py` for common dev ports).

## Endpoints

- `POST /pipeline/analyze`
  - form-data: `doc_id`, `file`
- `POST /pipeline/feedback`
  - form-data: `doc_id`, `reviewer`, `corrected_name`, `corrected_date`, `corrected_amount`
- `GET /pipeline/dashboard`
  - summary of processed documents and confidence metrics

## Optional Azure OCR

Set environment variables:

- `AZURE_OCR_ENDPOINT`
- `AZURE_OCR_KEY`

If Azure config is missing, pipeline falls back to Pytesseract.

For local Pytesseract OCR, install the **Tesseract** binary (not only the Python package):

- **Windows:** [UB Mannheim installer](https://github.com/UB-Mannheim/tesseract/wiki) — default path `C:\Program Files\Tesseract-OCR\tesseract.exe` is auto-detected.
- Or add `tesseract` to PATH, or set **`TESSERACT_CMD`** to the full path of `tesseract.exe` before starting uvicorn.

## Notes

- `uploads/` stores incoming files.
- `output/<doc_id>.json` stores analysis results.
- `output/feedback.jsonl` stores reviewer corrections for retraining workflows.
