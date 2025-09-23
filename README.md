# Catherine's Personal Website

This project contains the source code for a clean, modern personal website created as a gift for your English teacher.  The site highlights her teaching philosophy, passions, goals and aspirations in one cohesive design.

## Structure

The site is made up of a single HTML page (`index.html`) styled with CSS (`style.css`) and enhanced with a small amount of JavaScript (`script.js`).  All images live in the `assets` folder.  The navigation bar links to different sections within the same page.

**Sections include:**

| Section    | Purpose                                                                                  |
|-----------|-------------------------------------------------------------------------------------------|
| Hero      | Introduces Catherine with a short tagline and call‑to‑action.                             |
| About     | Shares her background, interests (reading, cooking, nature) and personal goals.           |
| Teaching  | Describes her teaching philosophy, focus areas and includes student testimonials.         |
| Finance   | Outlines her curiosity about finance and the stock market.                                |
| Travel    | Talks about her dream to teach English in Saudi Arabia, China and other countries.        |
| Gallery   | Placeholder grid for photos from her teaching journey and travels.                        |
| Contact   | Provides a link to her Preply profile and a simple contact form.                         |
| Pricing   | Shows example lesson options and prices with clear CTAs.                                 |

## Customizing

* **Images:**  The `assets/placeholder.jpg` file is used as a stand‑in for Catherine’s photos.  Replace the placeholder images with real photos by copying them into the `assets` folder and updating the `<img>` `src` attributes in `index.html`.
* **Colours and fonts:**  Feel free to tweak the colour palette defined at the top of `style.css`.  You can also change the Google Font imported in the `<head>` section of `index.html`.
* **Content:**  All text lives inside `index.html`.  Edit this file to update descriptions, add new sections or translate the page.  The contact form currently displays a simple alert on submission; you can wire it up to send emails using a third‑party service such as [Formspree](https://formspree.io/) or a backend of your choice.
* **Gallery Lightbox:**  Images in the Gallery open in a simple, accessible lightbox. Replace `assets/placeholder.jpg` with your own files and update `data-caption` for descriptions.
* **PWA:**  The site includes a basic Progressive Web App setup (`manifest.webmanifest`, `sw.js`) to cache core assets for offline viewing. Favicon is provided in `assets/favicon.svg`.
* **SEO:**  Basic meta description and Open Graph tags are included in the `<head>`.
* **Dark Mode:**  Click the moon button to toggle dark mode. Preference is saved to `localStorage`.
* **Contact (optional):**  If you use Formspree, set the `data-formspree-id` attribute on the `#contact-form` to your form ID (e.g., `xyzzabcd`). Otherwise a simple alert is shown.
* **Analytics (optional):**  To enable Plausible, set `data-plausible-domain` on the main `<script src="script.js">` tag to your domain (e.g., `example.com`).

## Deploying to GitHub Pages

You can host this website for free using GitHub Pages:

1. **Create a repository:** Sign in to your GitHub account and create a new public repository (e.g. `catherine-site`).  Do **not** initialize it with any files.
2. **Upload files:**  Clone the repository locally or upload the contents of the `teacher_website` folder (including `index.html`, `style.css`, `script.js`, `README.md` and the `assets` folder) to the repository.
3. **Commit & push:**  Commit the files and push them to the `main` branch.
4. **Enable GitHub Pages:** Go to the repository’s **Settings** → **Pages**.  Under **Source**, choose the `main` branch and the `/ (root)` folder, then save.  GitHub will build and publish your site.
5. **Visit your site:**  After a minute or two, your website will be available at `https://<your‑username>.github.io/<repository‑name>/`.  Share this link with Catherine so she can access her new personal homepage!

If you prefer another hosting service (Netlify, Vercel, etc.), the site can be deployed there as well by following the provider’s instructions for static sites.

## Running locally

Open `index.html` directly in the browser for quick viewing. For full PWA behavior and service worker testing, serve with a local HTTP server:

```
powershell -Command "python -m http.server 5500"; # or use any static server
```

Then navigate to http://localhost:5500/teacher_website_v1.1/teacher_website/

## Notes

- Update pricing in the Pricing section to match your current rates or direct bookings to Preply.
- To add analytics later, replace the `data-analytics` placeholder on the script tag with your preferred snippet (e.g., Plausible or Umami) or inject their script as recommended.