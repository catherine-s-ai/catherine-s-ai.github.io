# Catherine's Personal Website

This project contains the source code for Catherine's personal website. The site highlights her teaching philosophy, passions, goals and aspirations, and now includes a dedicated Cath-AI studio powered by DeepSeek and GPT-4.1.

## Structure

The site ships with a main landing page (`index.html`) styled by `style.css` and enhanced by `script.js`, plus a standalone Cath-AI experience (`cath-ai.html`) that loads additional assets (`cath-ai.css`, `cath-ai.js`) and optional Cloudflare Worker proxies in `tools/cath-ai/`.

**Sections include:**

| Section    | Purpose                                                                                  |
|-----------|-------------------------------------------------------------------------------------------|
| Hero      | Introduces Catherine with a short tagline and call‑to‑action.                             |
| About     | Shares her background, interests (reading, cooking, nature) and personal goals.           |
| Teaching  | Describes her teaching philosophy, focus areas and includes student testimonials.         |
| Finance   | Outlines her curiosity about finance and the stock market, with a live USD→ZAR rate card. |
| Travel    | Talks about her dream to teach English in Saudi Arabia, China and other countries.        |
| Gallery   | Photo grid with lightbox viewer.                                                          |
| Vocabulary| Daily English + Spanish word lists that rotate deterministically.                         |
| Contact   | Link to her Preply profile and a simple contact form with human check.                    |

The Cath-AI page introduces a second navigation entry that opens a dedicated chat experience with:

- Dual model switcher (DeepSeek Reasoner, GPT-4.1) via Cloudflare Worker proxies.
- Optional Brave-powered web search context.
- File upload support (PDF, DOCX, XLSX, TXT, etc.) with client-side extraction.
- A feminine UI that matches the site's lavender theme.

## Customizing

* **Images:**  Replace the photos in `assets/` with real imagery and update the `<img>` `src` values in `index.html`.
* **Colours and fonts:**  Tweak the design tokens at the top of `style.css`.  Cath-AI specific adjustments live in `cath-ai.css`.
* **Content:**  Landing page copy is inside `index.html`; Cath-AI copy lives in `cath-ai.html` and `cath-ai.js` (system prompt, quick prompts, status messages).
* **Gallery Lightbox:**  The gallery uses an accessible lightbox managed by `script.js`.
* **PWA:**  The site includes a basic Progressive Web App setup (`manifest.webmanifest`, `sw.js`) to cache core assets for offline viewing. Favicon is provided in `assets/favicon.svg`.
* **SEO:**  Basic meta description and Open Graph tags are included in the `<head>`.
* **Dark Mode:**  Click the moon button to toggle dark mode. Preference is saved to `localStorage`.
* **Contact (optional):**  If you use Formspree, set the `data-formspree-id` attribute on the `#contact-form` to your form ID (e.g., `xyzzabcd`). Otherwise a simple alert is shown.
* **Analytics (optional):**  To enable Plausible, set `data-plausible-domain` on the main `<script src="script.js">` tag to your domain (e.g., `example.com`).
* **Cath-AI configuration:**  Update `window.CATH_AI_CONFIG` inside `cath-ai.html` with your deployed Worker endpoints. Reference implementations live under `tools/cath-ai/`.

## Deploying to GitHub Pages

You can host this website for free using GitHub Pages:

1. **Create a repository:** Sign in to your GitHub account and create a new public repository (e.g. `catherine-site`).  Do **not** initialize it with any files.
2. **Upload files:**  Clone the repository locally or upload the contents of the `teacher_website` folder (including `index.html`, `style.css`, `script.js`, `README.md` and the `assets` folder) to the repository.
3. **Commit & push:**  Commit the files and push them to the `main` branch.
4. **Enable GitHub Pages:** Go to the repository’s **Settings** → **Pages**.  Under **Source**, choose the `main` branch and the `/ (root)` folder, then save.  GitHub will build and publish your site.
5. **Visit your site:**  After a minute or two, your website will be available at `https://<your‑username>.github.io/<repository‑name>/`.  Share this link with Catherine so she can access her new personal homepage!

If you prefer another hosting service (Netlify, Vercel, etc.), the site can be deployed there as well by following the provider’s instructions for static sites.

## Running locally

Open `index.html` or `cath-ai.html` directly in the browser for quick viewing. For full PWA behavior and service worker testing, serve with a local HTTP server:

```
powershell -Command "python -m http.server 5500"; # or use any static server
```

Then navigate to `http://localhost:5500/` (or the correct subpath if served from a different root).

## Notes

- Update pricing in the Pricing section to match your current rates or direct bookings to Preply.
- To add analytics later, replace the `data-analytics` placeholder on the script tag with your preferred snippet (e.g., Plausible or Umami) or inject their script as recommended.