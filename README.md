# Job Card Generator

Standalone UI to search by job number and download a multi-page PDF job card. Supports **packaging** and **commercial** job cards (same design as your reference PDFs).

## How to run

- Open `index.html` in a browser (double-click or via a local server).
- Or serve the folder with any static server, e.g. `npx serve "Job Card Generator"` from the repo root.

## Sample search

| Job Number | Card Type   |
|------------|-------------|
| `00001`    | Packaging   |
| `00002`    | Commercial  |

1. Enter job number and click **Search**.
2. All fields that go into the PDF are collected into a single JSON (you can click **View JSON**).
3. Click **Download Job Card (PDF)** to get a single PDF with multiple pages in the same design.

## Data source (API later)

- Data is **not** tied to any other tool in this repo.
- Same DB will be used via a **different SQL procedure/query** when you add the backend.
- In `script.js`, set `CONFIG.apiBaseUrl` to your API base and `CONFIG.useApi = true` when ready.
- The app will call:  
  `GET {apiBaseUrl}/job-card?jobNumber=...&type=packaging|commercial`  
  and expect the response to match the existing JSON shape (packaging or commercial) so the PDF builder can run unchanged.

## QR code

- QR is a **placeholder** in the PDF for now (e.g. “[QR]” or “(QR)”).
- When the value comes from the DB, you can pass it in the JSON (e.g. `header.refProductMasterCode` or a QR URL) and the PDF code can be extended to render the image.

## Files

- `index.html` – Search UI and result area with Download / View JSON.
- `script.js` – Search logic, sample data, JSON build, API placeholder, packaging PDF (2 pages), commercial PDF (multi-page).
- `styles.css` – Layout and styling for the generator UI.
