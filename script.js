// Toggle mobile navigation with ARIA and keyboard support
const hamburger = document.getElementById('hamburger');
const navLinks = document.getElementById('nav-links');
if (hamburger && navLinks) {
  const toggleMenu = () => {
    const isOpen = navLinks.classList.toggle('open');
    hamburger.setAttribute('aria-expanded', String(isOpen));
  };
  hamburger.addEventListener('click', toggleMenu);
  hamburger.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleMenu();
    }
  });
  // Close menu when a link is clicked (useful on mobile)
  navLinks.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => {
      if (navLinks.classList.contains('open')) {
        navLinks.classList.remove('open');
        hamburger.setAttribute('aria-expanded', 'false');
      }
    });
  });
}

// Set current year in footer
const yearSpan = document.getElementById('year');
if (yearSpan) {
  yearSpan.textContent = new Date().getFullYear();
}

// Contact form handler
const contactForm = document.getElementById('contact-form');
if (contactForm) {
  const hasNetlify = contactForm.hasAttribute('netlify');
  if (!hasNetlify) {
    contactForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formspreeId = contactForm.getAttribute('data-formspree-id');
      if (formspreeId) {
        try {
          const data = new FormData(contactForm);
          const res = await fetch(`https://formspree.io/f/${formspreeId}`, {
            method: 'POST',
            body: data,
            headers: { 'Accept': 'application/json' }
          });
          if (res.ok) {
            alert('Thanks! Your message has been sent.');
            contactForm.reset();
          } else {
            alert('Sorry, there was a problem sending your message. Please try again later.');
          }
        } catch {
          alert('Network error. Please try again later.');
        }
      } else {
        alert('Thank you for reaching out! I will respond as soon as possible.');
        contactForm.reset();
      }
    });
  }
}

// Section reveal on scroll using IntersectionObserver
document.addEventListener('DOMContentLoaded', () => {
  const sections = document.querySelectorAll('.section');
  const observerOptions = {
    threshold: 0.15
  };
  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        entry.target.classList.remove('hidden');
        // Stop observing once the element is visible
        obs.unobserve(entry.target);
      }
    });
  }, observerOptions);
  sections.forEach(section => {
    // Add hidden class to enable animation
    section.classList.add('hidden');
    observer.observe(section);
  });

  // Simple accessible lightbox for gallery
  const galleryLinks = document.querySelectorAll('a.lightbox');
  if (galleryLinks.length) {
    const createLightbox = (href, caption) => {
      const overlay = document.createElement('div');
      overlay.className = 'lightbox-overlay';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.tabIndex = -1;

      const dialog = document.createElement('div');
      dialog.className = 'lightbox-dialog';

      const img = document.createElement('img');
      img.src = href;
      img.alt = caption || 'Image preview';
      img.className = 'lightbox-img';

      const cap = document.createElement('div');
      cap.className = 'lightbox-caption';
      cap.textContent = caption || '';

      dialog.appendChild(img);
      dialog.appendChild(cap);
      overlay.appendChild(dialog);
      document.body.appendChild(overlay);

      const close = () => {
        overlay.remove();
        lastActive && lastActive.focus();
        document.removeEventListener('keydown', onKey);
        overlay.removeEventListener('click', onClick);
      };

      const onKey = (e) => {
        if (e.key === 'Escape') close();
        if (e.key === 'Tab') {
          // trap focus
          e.preventDefault();
          dialog.focus();
        }
      };
      const onClick = (e) => { if (e.target === overlay) close(); };

      let lastActive = document.activeElement;
      dialog.tabIndex = 0;
      dialog.focus();

      document.addEventListener('keydown', onKey);
      overlay.addEventListener('click', onClick);
    };

    galleryLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const href = link.getAttribute('href');
        const caption = link.getAttribute('data-caption');
        createLightbox(href, caption);
      });
    });
  }

  // Theme toggle with persistence
  const root = document.documentElement;
  const themeToggle = document.getElementById('theme-toggle');
  const storedTheme = localStorage.getItem('theme');
  if (storedTheme) root.setAttribute('data-theme', storedTheme);
  const setPressed = () => {
    const isDark = root.getAttribute('data-theme') === 'dark';
    if (themeToggle) themeToggle.setAttribute('aria-pressed', String(isDark));
  };
  setPressed();
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const curr = root.getAttribute('data-theme');
      const next = curr === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      localStorage.setItem('theme', next);
      setPressed();
    });
  }

  // Optional Plausible analytics loader
  const domain = (document.currentScript && document.currentScript.dataset && document.currentScript.dataset.plausibleDomain) || document.querySelector('script[data-plausible-domain]')?.dataset?.plausibleDomain;
  if (domain) {
    const s = document.createElement('script');
    s.defer = true;
    s.setAttribute('data-domain', domain);
    s.src = 'https://plausible.io/js/script.js';
    document.head.appendChild(s);
  }

  // Simple math verification for contact form
  const form = document.getElementById('contact-form');
  if (form) {
    const qa = document.getElementById('q-a');
    const humanInput = document.getElementById('human');
    const humanError = document.getElementById('human-error');
    const humanAnswerHidden = document.getElementById('human_answer');
    if (qa && humanInput && humanAnswerHidden) {
      const a = Math.floor(Math.random() * 9) + 1; // 1..10-1
      const b = Math.floor(Math.random() * 9) + 1;
      const op = Math.random() < 0.5 ? '+' : '−';
      const correct = op === '+' ? a + b : a - b;
      qa.textContent = `${a} ${op} ${b}`;
      humanAnswerHidden.value = String(correct);

      form.addEventListener('submit', (e) => {
        const user = parseInt(humanInput.value, 10);
        const answer = parseInt(humanAnswerHidden.value, 10);
        if (Number.isNaN(user) || user !== answer) {
          e.preventDefault();
          humanError.style.display = 'block';
          humanInput.setAttribute('aria-invalid', 'true');
          humanInput.focus();
        } else {
          humanError.style.display = 'none';
          humanInput.removeAttribute('aria-invalid');
        }
      });
    }
  }

  // Finance: fetch USD→ZAR exchange rate and render below description
  const rateEl = document.getElementById('usd-zar-rate');
  const updatedEl = document.getElementById('fx-updated');
  const fxCard = document.getElementById('fx-card');
  if (rateEl && updatedEl && fxCard) {
    const LS_KEY = 'fx_usd_zar_cache_v1';
    const formatRate = (n) => {
      if (typeof n !== 'number' || !isFinite(n)) return '—';
      // 2-4 decimals depending on magnitude
      const decimals = n >= 100 ? 2 : n >= 10 ? 3 : 4;
      return n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    };
    const setUI = (rate, when, source) => {
      rateEl.textContent = rate !== null ? `${formatRate(rate)} ZAR` : 'Unavailable';
      const dt = when ? new Date(when) : new Date();
      const ts = isNaN(dt.getTime()) ? '' : ` · ${dt.toLocaleString()}`;
      updatedEl.textContent = (rate !== null ? `Updated${ts}` : 'Could not fetch latest rate') + (source ? ` (${source})` : '');
    };
    const saveCache = (rate, fetchedAt) => {
      try { localStorage.setItem(LS_KEY, JSON.stringify({ rate, fetchedAt })); } catch {}
    };
    const readCache = () => {
      try {
        const raw = localStorage.getItem(LS_KEY);
        if (!raw) return null;
        const obj = JSON.parse(raw);
        if (!obj || typeof obj.rate !== 'number') return null;
        return obj;
      } catch { return null; }
    };

    // Show cached quickly if fresh (< 1h), then refresh in background
    const cached = readCache();
    if (cached) setUI(cached.rate, cached.fetchedAt, 'cached');

    const tryEndpoints = async () => {
      // 1) exchangerate.host (no key)
      try {
        const r = await fetch('https://api.exchangerate.host/latest?base=USD&symbols=ZAR');
        if (r.ok) {
          const j = await r.json();
          const rate = j && j.rates && typeof j.rates.ZAR === 'number' ? j.rates.ZAR : null;
          if (rate) return { rate, source: 'exchangerate.host' };
        }
      } catch {}
      // 2) frankfurter.app (no key)
      try {
        const r2 = await fetch('https://api.frankfurter.app/latest?from=USD&to=ZAR');
        if (r2.ok) {
          const j2 = await r2.json();
          const rate2 = j2 && j2.rates && typeof j2.rates.ZAR === 'number' ? j2.rates.ZAR : null;
          if (rate2) return { rate: rate2, source: 'frankfurter.app' };
        }
      } catch {}
      // 3) open.er-api.com (no key)
      try {
        const r3 = await fetch('https://open.er-api.com/v6/latest/USD');
        if (r3.ok) {
          const j3 = await r3.json();
          const rate3 = j3 && j3.rates && typeof j3.rates.ZAR === 'number' ? j3.rates.ZAR : null;
          if (rate3) return { rate: rate3, source: 'open.er-api.com' };
        }
      } catch {}
      return { rate: null, source: null };
    };

    const refresh = async () => {
      setUI(cached?.rate ?? null, cached?.fetchedAt ?? null, cached ? 'cached' : '');
      const { rate, source } = await tryEndpoints();
      if (typeof rate === 'number' && isFinite(rate)) {
        const now = new Date().toISOString();
        saveCache(rate, now);
        setUI(rate, now, source);
      } else {
        // Graceful degradation: keep cached if present, else show error
        if (!cached) setUI(null, null, null);
      }
    };

    refresh();

    // Periodically refresh the rate every 15 minutes while the page is open
    const FX_REFRESH_MS = 15 * 60 * 1000;
    setInterval(() => { refresh(); }, FX_REFRESH_MS);

    // Refresh when returning to the tab (in case user left it open)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') refresh();
    });
  }

  // Daily Vocabulary: 5 IELTS English words and 5 beginner Spanish words (rotates daily)
  const enListEl = document.getElementById('vocab-en-list');
  const esListEl = document.getElementById('vocab-es-list');
  const vocabDateEl = document.getElementById('vocab-date');
  if (enListEl && esListEl && vocabDateEl) {
    // Minimal word banks. English: higher-level; Spanish: beginner.
    const EN_WORDS = [
      { w: 'ameliorate', d: 'to make something better or less severe' },
      { w: 'ubiquitous', d: 'present, appearing, or found everywhere' },
      { w: 'capricious', d: 'given to sudden changes of mood or behavior' },
      { w: 'perfunctory', d: 'carried out with minimum effort or reflection' },
      { w: 'equivocal', d: 'open to more than one interpretation; ambiguous' },
      { w: 'obfuscate', d: 'to make unclear or unintelligible' },
      { w: 'meticulous', d: 'showing great attention to detail' },
      { w: 'ephemeral', d: 'lasting for a very short time' },
      { w: 'didactic', d: 'intended to teach, particularly having moral instruction' },
      { w: 'magnanimous', d: 'very generous or forgiving' },
      { w: 'pragmatic', d: 'dealing with things sensibly and realistically' },
      { w: 'tenacious', d: 'tending to keep a firm hold; persistent' },
      { w: 'alacrity', d: 'brisk and cheerful readiness' },
      { w: 'conundrum', d: 'a confusing and difficult problem or question' },
      { w: 'prolific', d: 'producing many works, results, or offspring' },
      { w: 'scrutinize', d: 'to examine or inspect closely' },
      { w: 'aberration', d: 'a departure from what is normal or expected' },
      { w: 'fastidious', d: 'very attentive to accuracy and detail' },
      { w: 'salient', d: 'most noticeable or important' },
      { w: 'paradigm', d: 'a typical example or pattern' }
    ];
    const ES_WORDS = [
      { w: 'hola', d: 'hello' },
      { w: 'gracias', d: 'thank you' },
      { w: 'por favor', d: 'please' },
      { w: 'perdón', d: 'sorry / excuse me' },
      { w: 'sí', d: 'yes' },
      { w: 'no', d: 'no' },
      { w: 'buenos días', d: 'good morning' },
      { w: 'buenas noches', d: 'good night' },
      { w: '¿cómo estás?', d: 'how are you?' },
      { w: 'bien', d: 'fine / well' },
      { w: 'por qué', d: 'why' },
      { w: 'porque', d: 'because' },
      { w: 'libro', d: 'book' },
      { w: 'agua', d: 'water' },
      { w: 'comida', d: 'food' },
      { w: 'amigo', d: 'friend (m.)' },
      { w: 'amiga', d: 'friend (f.)' },
      { w: 'familia', d: 'family' },
      { w: 'casa', d: 'house' },
      { w: 'escuela', d: 'school' }
    ];

    // Deterministic daily selection based on YYYY-MM-DD
    const today = new Date();
    const y = today.getFullYear();
    const m = today.getMonth() + 1;
    const d = today.getDate();
    const key = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  vocabDateEl.textContent = key;

    // Simple seeded RNG (Mulberry32)
    const mulberry32 = (seed) => {
      return function() {
        let t = seed += 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
      };
    };
    let seed = 0;
    for (let i = 0; i < key.length; i++) seed = (seed * 31 + key.charCodeAt(i)) >>> 0;
    const rand = mulberry32(seed);

    const pickN = (arr, n) => {
      const copy = arr.slice();
      // Fisher–Yates shuffle with seeded RNG
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy.slice(0, n);
    };

    const renderList = (el, items) => {
      el.innerHTML = '';
      items.forEach(({ w, d }) => {
        const li = document.createElement('li');
        const strong = document.createElement('strong');
        strong.textContent = w;
        const small = document.createElement('small');
        small.textContent = ` — ${d}`;
        li.appendChild(strong);
        li.appendChild(document.createTextNode(' '));
        li.appendChild(small);
        el.appendChild(li);
      });
    };

    const renderForDateKey = (dateKey) => {
      // reseed RNG with new key
      let s = 0;
      for (let i = 0; i < dateKey.length; i++) s = (s * 31 + dateKey.charCodeAt(i)) >>> 0;
      const r = mulberry32(s);
      const pickNSeeded = (arr, n) => {
        const copy = arr.slice();
        for (let i = copy.length - 1; i > 0; i--) {
          const j = Math.floor(r() * (i + 1));
          [copy[i], copy[j]] = [copy[j], copy[i]];
        }
        return copy.slice(0, n);
      };
      vocabDateEl.textContent = dateKey;
      renderList(enListEl, pickNSeeded(EN_WORDS, 5));
      renderList(esListEl, pickNSeeded(ES_WORDS, 5));
    };

    // Initial render
    renderForDateKey(key);

    // Update automatically at local midnight without reload
    const scheduleMidnightUpdate = () => {
      const now = new Date();
      const next = new Date(now);
      next.setHours(24, 0, 0, 0); // next local midnight
      const ms = next.getTime() - now.getTime();
      setTimeout(() => {
        const ny = next.getFullYear();
        const nm = String(next.getMonth() + 1).padStart(2, '0');
        const nd = String(next.getDate()).padStart(2, '0');
        const newKey = `${ny}-${nm}-${nd}`;
        renderForDateKey(newKey);
        scheduleMidnightUpdate();
      }, Math.max(1000, ms));
    };
    scheduleMidnightUpdate();

    // If user switches back to the tab and the date changed, refresh the list
    let lastKey = key;
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        const t = new Date();
        const ky = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
        if (ky !== lastKey) {
          lastKey = ky;
          renderForDateKey(ky);
        }
      }
    });
  }
});