# Cath-AI Integration Plan

## 1. Project Context & Objectives
- Introduce a dedicated "Cath-AI" experience on Catherine's site that matches the existing brand palette while delivering an elegant, feminine interface.
- Reuse the proven AI Zhida stack (HTML shell, `zhida.js`, document ingestion pipeline, provider proxy workers) supplied from the reference project (`fanwan-ai.github.io`), adapting it to Catherine's content and deployment environment.
- Ensure the AI assistant can route requests to both DeepSeek and GPT-4.1 models via Cloudflare Worker proxies, with optional Brave web search integration and document understanding.
- Maintain accessibility, responsiveness, and performance aligned with the current site standards.

## 2. Functional Requirements
1. **Navigation**
   - Add a top-level nav button labelled `Cath-AI` that routes to a dedicated page instead of scrolling the long landing page.
   - Preserve mobile navigation behaviour (hamburger + close-on-click logic).

2. **Cath-AI Page**
   - Serve as a standalone HTML page (`cath-ai.html`) with SEO meta tags consistent with the site.
   - Include a hero/header introducing Cath-AI, with quick access to the chat interface.
   - Embed the AI Zhida chat widget with:
     - Model selection across DeepSeek and GPT-4.1.
     - Streaming chat responses with graceful error states.
     - File upload (PDF/DOCX/XLSX/TXT/MD/CSV/JSON/HTML) powered by `doc_pipeline.js` for chunking and preview.
     - Toggleable web search (Brave API) using the proxy worker.
     - System prompts that default to English but allow language switching when user requests.
   - Provide a right-hand or bottom panel for tips, example prompts, and Catherine’s voice guidelines.

3. **Proxy Connectivity**
   - Configure fetch calls in `zhida.js` to point to Catherine's Cloudflare Worker endpoints for:
     - `openai-proxy-worker` (GPT-4.1).
     - `deepseek-proxy-worker` (DeepSeek Reasoner or Chat).
     - `websearch-proxy-worker` (Brave Search).
   - Respect CORS rules and origin allow-list settings for the production domain.

4. **Branding & UX**
   - Colour palette: reuse lavender/pastel tones from `style.css` (primary `#826aed` and complementary neutrals).
   - Typography: continue using Inter & Poppins.
   - Overall look: soft gradients, rounded cards, subtle shadows, gentle micro-interactions, ensuring it feels friendly and feminine.

5. **Service Worker & Manifest**
   - Update URLs or caching rules if the AI page requires assets (scripts/styles) to be precached.
   - Ensure offline behaviour gracefully informs users when AI features are unavailable.

## 3. Technical Design Overview

### 3.1 File Layout
- `cath-ai.html` – new page bootstrapping the AI interface; imports `style.css`, `ai/cath-ai.css` (new), `zhida.js`, `doc_pipeline.js`, and any supporting modules.
- `assets/ai/` – store Cath-AI specific icons/illustrations if required.
- `scripts/` (or reuse root) – include ported JS files:
  - `zhida.js` (front-end logic), adjusted for Catherine's branding and endpoints.
  - `doc_pipeline.js` (document processing helper).
  - Optional: `cath-ai-init.js` to configure runtime constants without modifying upstream `zhida.js` heavily.
- `styles/` – create `cath-ai.css` for page-specific styling layered over the existing global `style.css` foundation.
- `tools/workers/` – host Cloudflare Worker source files (`openai-proxy-worker.js`, `deepseek-proxy-worker.js`, `websearch-proxy-worker.js`) for deployment reference; include README notes for setting env vars.

### 3.2 Integration Points
- **Navigation**: extend `<ul class="nav-links">` with a new `<li><a href="cath-ai.html">Cath-AI</a></li>` and ensure script-driven closing works via existing listeners.
- **Theme**: share the global dark-mode toggle by preserving `data-theme` attribute handling and reusing CSS vars.
- **Script initialisation**: load `zhida.js` after DOM ready; if necessary, wrap with a guard so it only executes on pages with `.zhida-page` class (as in the source code) to avoid affecting other pages.
- **Environment config**: define a `window.ZHIDA_CONFIG` inline script in `cath-ai.html` specifying:
  - `endpoint` fallback (primary proxy URL).
  - `providers` map referencing named endpoints for DeepSeek and GPT-4.1.
  - `webSearch` configuration (endpoint URL, default enabled flag).
  - UI text overrides for Catherine.
- **Document assets**: confirm `doc_pipeline.js` loads dependencies (pdf.js, mammoth, xlsx) via CDN; update CDN versions if necessary, ensuring integrity attributes and lazy loading for performance.

### 3.3 Styling Strategy
- Build a dedicated SCSS/CSS file leveraging existing CSS variables (`--primary`, `--surface`, etc.).
- Layout concept:
  - Responsive two-column layout (chat on left, context panel on right) for desktops; stack sections for mobile.
  - Decorative gradient header with Cath-AI mascot or avatar (optional).
  - Buttons and chips styled with soft corners, focus outlines aligned with accessibility guidelines.

### 3.4 Accessibility & i18n
- Ensure ARIA roles for chat log, message input, streaming indicators.
- Provide keyboard navigation for file upload and model selection.
- Keep text strings translatable; leverage existing `DEFAULT_PROMPTS` logic in `zhida.js` for multilingual responses.

## 4. Implementation Plan
1. **Planning & Environment Prep**
   - Copy reference worker scripts into `tools/workers/` and document deployment instructions.
   - Identify production URLs (e.g., `https://catherine-s-ai.github.io/tools/...`) for worker endpoints.

2. **Navigation Update**
   - Edit `index.html` and `script.js` if needed to add the `Cath-AI` menu item and ensure mobile nav closes after navigation.

3. **Cath-AI Page Skeleton**
   - Create `cath-ai.html` with shared `<head>` assets, hero section, chat container, and inline `ZHIDA_CONFIG` bootstrap.
   - Reference new CSS/JS bundles.

4. **Asset Migration**
   - Port `zhida.js` and `doc_pipeline.js`, adapting branding constants, default prompts, and endpoint URLs.
   - Add Catherine-specific copy (welcome message, tooltips, example prompts) within config or page markup.

5. **Styling**
   - Implement `cath-ai.css` for page-specific styling, ensuring alignment with site theme and feminine aesthetic.
   - Validate responsive behaviour across breakpoints.

6. **Backend/Proxy Alignment**
   - Update fetch URLs to match deployed workers; include environment instructions in README if self-hosted.
   - Verify CORS allow-list includes `https://catherine-s-ai.github.io`.

7. **Testing & QA**
   - Manual tests: navigation flow, chat interactions (DeepSeek & GPT-4.1), file uploads, web search toggle, dark mode.
   - Performance checks: ensure lazy loading of heavy libraries, streaming responsiveness, no blocking scripts.
   - Accessibility audit: keyboard navigation, screen reader labels, focus states.

8. **Docs & Handover**
   - Update README with Cath-AI usage notes, environment secrets, and deployment checklist.
   - Provide guidance snippet for Cloudflare Wrangler deployment of the worker scripts.

## 5. Risks & Mitigations
- **CORS/Origin mismatches** – double-check worker allow lists; add dev toggle for localhost testing.
- **Asset footprint** – dynamic import heavy libraries only when needed; compress assets.
- **Proxy latency** – implement optimistic UI states and streaming fallback messaging.
- **Browser compatibility** – rely on modern APIs but provide graceful degradation for unsupported features (e.g., File System Access).

## 6. Validation Checklist
- [ ] Nav button visible on all viewports, links to `cath-ai.html`.
- [ ] Cath-AI page loads without console errors in light/dark mode.
- [ ] Chat works with both AI providers; streaming text renders smoothly.
- [ ] File upload + document summarisation works for PDFs and DOCX.
- [ ] Web search toggle executes Brave-powered results when enabled.
- [ ] UI matches Catherine’s colour palette and maintains feminine aesthetic.
- [ ] Accessibility checks pass (manual keyboard test + Lighthouse audit).
- [ ] README/tool docs updated with deployment instructions.
