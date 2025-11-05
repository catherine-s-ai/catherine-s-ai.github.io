const config = window.CATH_AI_CONFIG || {};
const providers = config.providers || {};
const providerKeys = Object.keys(providers);
const defaultModel = providerKeys.includes(config.defaultModel) ? config.defaultModel : providerKeys[0];

const BASE_PROMPT = `You are Cath-AI, a warm, encouraging teaching assistant who represents Catherine. You respond in clear, friendly English unless the user explicitly requests another language. You:
- guide learners patiently and celebrate progress;
- give practical tips for English lessons, personal finance, and travel adventures;
- cite web search findings clearly when available; and
- invite follow-up questions in a gentle tone.`;

const elements = {
  messages: document.getElementById('chat-messages'),
  form: document.getElementById('chat-form'),
  input: document.getElementById('chat-input'),
  send: document.getElementById('send-btn'),
  model: document.getElementById('model-select'),
  clear: document.getElementById('clear-chat'),
  status: document.getElementById('chat-status'),
  attachments: document.getElementById('attachments'),
  fileInput: document.getElementById('file-input'),
  webSearch: document.getElementById('web-search-toggle'),
  promptList: document.getElementById('prompt-list')
};

const state = {
  history: [],
  attachments: [],
  streaming: false,
  abortController: null,
  webSearchEnabled: Boolean(config.webSearch && config.webSearch.defaultEnabled),
  lastAssistantMessage: null
};

if (elements.webSearch) {
  elements.webSearch.checked = state.webSearchEnabled;
}

if (elements.model && defaultModel) {
  elements.model.value = defaultModel;
}

const MAX_FILES = typeof config.maxFiles === 'number' ? config.maxFiles : 6;
const MAX_FILE_SIZE = typeof config.maxFileSize === 'number' ? config.maxFileSize : 10 * 1024 * 1024;
const SUPPORTED_EXTENSIONS = ['pdf', 'doc', 'docx', 'txt', 'md', 'csv', 'json', 'html', 'xls', 'xlsx'];

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return 'unknown size';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(size >= 10 || size < 1 ? 1 : 2)} ${units[unit]}`;
}

function setStatus(message, tone = 'info') {
  if (!elements.status) return;
  const text = typeof message === 'string' ? message : '';
  elements.status.textContent = text;
  if (tone) {
    elements.status.dataset.tone = tone;
  } else {
    delete elements.status.dataset.tone;
  }
  elements.status.classList.toggle('has-message', Boolean(text));
}

function scrollMessages() {
  if (!elements.messages) return;
  elements.messages.scrollTop = elements.messages.scrollHeight;
}

function createMessageElement(role, content, { streaming = false } = {}) {
  const li = document.createElement('li');
  li.className = `message message-${role === 'assistant' ? 'assistant' : 'user'}`;
  if (role === 'assistant' && streaming) {
    li.classList.add('assistant-streaming');
  }
  const body = document.createElement('div');
  body.className = 'message-body';
  body.textContent = content;
  li.appendChild(body);
  return li;
}

function addMessage(role, content, options = {}) {
  if (!elements.messages) return null;
  const el = createMessageElement(role, content, options);
  elements.messages.appendChild(el);
  scrollMessages();
  return el;
}

function resetChat() {
  if (elements.messages) {
    elements.messages.innerHTML = '';
  }
  state.history = [{ role: 'system', content: BASE_PROMPT }];
  const greeting = "Hi there! I'm Cath-AI. Share a question, upload a document, and let me lend a hand.";
  addMessage('assistant', greeting);
  state.history.push({ role: 'assistant', content: greeting });
  state.attachments = [];
  renderAttachments();
  setStatus('Ready to chat ✨', 'success');
}

function ensureProviderConfigured(key) {
  const provider = providers[key];
  return provider && typeof provider.endpoint === 'string' && provider.endpoint.trim().length > 0;
}

function autoResize() {
  if (!elements.input) return;
  elements.input.style.height = 'auto';
  elements.input.style.height = `${Math.min(elements.input.scrollHeight, 220)}px`;
}

async function handlePromptClick(e) {
  const target = e.target.closest('li[data-prompt]');
  if (!target || !elements.input) return;
  elements.input.value = target.dataset.prompt;
  autoResize();
  elements.input.focus();
}

function renderAttachments() {
  if (!elements.attachments) return;
  elements.attachments.innerHTML = '';
  state.attachments.forEach((item) => {
    const chip = document.createElement('div');
    chip.className = 'attachment-chip';
    chip.dataset.id = item.id;

    const label = document.createElement('span');
    label.textContent = `${item.file.name} · ${formatBytes(item.file.size)}`;
    chip.appendChild(label);

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.setAttribute('aria-label', `Remove ${item.file.name}`);
    removeBtn.innerHTML = '<i class="fa-solid fa-times"></i>';
    removeBtn.addEventListener('click', () => removeAttachment(item.id));
    chip.appendChild(removeBtn);

    elements.attachments.appendChild(chip);
  });
}

function removeAttachment(id) {
  state.attachments = state.attachments.filter((att) => att.id !== id);
  renderAttachments();
}

function validateFile(file) {
  if (!file) return false;
  if (state.attachments.length >= MAX_FILES) {
    setStatus(`Maximum of ${MAX_FILES} files per message.`, 'error');
    return false;
  }
  if (file.size > MAX_FILE_SIZE) {
    setStatus(`${file.name} is too large (limit ${formatBytes(MAX_FILE_SIZE)}).`, 'error');
    return false;
  }
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (!SUPPORTED_EXTENSIONS.includes(ext)) {
    setStatus(`${file.name} is not supported yet.`, 'error');
    return false;
  }
  return true;
}

async function handleFiles(files) {
  if (!files || !files.length) return;
  const list = Array.from(files);
  for (const file of list) {
    if (!validateFile(file)) continue;
    try {
      const text = await extractTextFromFile(file);
      const id = `${file.name}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      state.attachments.push({ id, file, text });
      setStatus(`Loaded ${file.name}`, 'success');
    } catch (error) {
      console.error('Attachment error', error);
      setStatus(`Could not read ${file.name}`, 'error');
    }
  }
  renderAttachments();
}

async function extractTextFromFile(file) {
  const name = file.name.toLowerCase();
  const arrayBuffer = () => file.arrayBuffer();

  if (name.endsWith('.pdf')) {
    const pdfjs = await ensurePdfJs();
    const data = await arrayBuffer();
    const pdf = await pdfjs.getDocument({ data }).promise;
    let text = '';
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const pageText = content.items.map((item) => item.str || '').join(' ').trim();
      if (pageText) {
        text += `${pageText}\n\n`;
      }
    }
    return text.trim();
  }

  if (name.endsWith('.docx') || name.endsWith('.doc')) {
    const mammoth = await ensureMammoth();
    const buffer = await arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer: buffer });
    return (result && result.value ? result.value : '').trim();
  }

  if (name.endsWith('.xls') || name.endsWith('.xlsx') || name.endsWith('.csv')) {
    const XLSX = await ensureXlsx();
    if (name.endsWith('.csv')) {
      const text = await file.text();
      return text.trim();
    }
    const buffer = await arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheets = workbook.SheetNames || [];
    const parts = [];
    sheets.forEach((sheetName) => {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) return;
      const range = XLSX.utils.decode_range(sheet['!ref'] || '');
      const rows = [];
      for (let row = range.s.r; row <= range.e.r; row += 1) {
        const cols = [];
        for (let col = range.s.c; col <= range.e.c; col += 1) {
          const cellRef = XLSX.utils.encode_cell({ r: row, c: col });
          const cell = sheet[cellRef];
          cols.push(cell ? String(cell.v ?? '').trim() : '');
        }
        const line = cols.join('\t').trim();
        if (line) rows.push(line);
      }
      if (rows.length) {
        parts.push(`[${sheetName}]\n${rows.join('\n')}`);
      }
    });
    return parts.join('\n\n').trim();
  }

  if (name.endsWith('.json')) {
    const text = await file.text();
    try {
      const parsed = JSON.parse(text);
      return JSON.stringify(parsed, null, 2);
    } catch (error) {
      return text.trim();
    }
  }

  if (name.endsWith('.html')) {
    const text = await file.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'text/html');
    const stripped = doc.body ? doc.body.textContent || '' : text;
    return stripped.replace(/\s+/g, ' ').trim();
  }

  if (name.endsWith('.txt') || name.endsWith('.md')) {
    const text = await file.text();
    return text.trim();
  }

  const fallback = await file.text();
  return fallback.trim();
}

let pdfJsPromise;
async function ensurePdfJs() {
  if (window.pdfjsLib) {
    return window.pdfjsLib;
  }
  if (!pdfJsPromise) {
    pdfJsPromise = import('https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.mjs').then((module) => {
      const pdfjsLib = module.default;
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
      window.pdfjsLib = pdfjsLib;
      return pdfjsLib;
    });
  }
  return pdfJsPromise;
}

let mammothPromise;
async function ensureMammoth() {
  if (window.mammoth && typeof window.mammoth.extractRawText === 'function') {
    return window.mammoth;
  }
  if (!mammothPromise) {
    mammothPromise = loadScript('https://cdn.jsdelivr.net/npm/mammoth@1.6.0/mammoth.browser.min.js').then(() => window.mammoth);
  }
  return mammothPromise;
}

let xlsxPromise;
async function ensureXlsx() {
  if (window.XLSX && typeof window.XLSX.read === 'function') {
    return window.XLSX;
  }
  if (!xlsxPromise) {
    xlsxPromise = loadScript('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js').then(() => window.XLSX);
  }
  return xlsxPromise;
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-src="${src}"]`);
    if (existing) {
      if (existing.dataset.loaded === 'true') {
        resolve();
        return;
      }
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', reject, { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.dataset.src = src;
    script.onload = () => {
      script.dataset.loaded = 'true';
      resolve();
    };
    script.onerror = (err) => reject(err);
    document.head.appendChild(script);
  });
}

async function fetchWebContext(query) {
  const endpoint = config.webSearch && config.webSearch.endpoint;
  if (!state.webSearchEnabled || !endpoint) {
    return null;
  }
  try {
    setStatus('Searching the web…', 'info');
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, maxResults: 6 })
    });
    if (!res.ok) {
      throw new Error(`Status ${res.status}`);
    }
    const data = await res.json();
    if (!data || !Array.isArray(data.results) || !data.results.length) {
      return null;
    }
    const formatted = data.results.map((item, index) => {
      const title = item.title || `Result ${index + 1}`;
      const url = item.url || '';
      const snippet = item.snippet || '';
      return `${index + 1}. ${title}\n${url}\n${snippet}`;
    }).join('\n\n');
    return `Recent web findings (via Brave Search):\n${formatted}`;
  } catch (error) {
    console.warn('Web search failed', error);
    setStatus('Web search unavailable right now.', 'error');
    return null;
  }
}

async function sendChat(event) {
  event.preventDefault();
  if (!elements.input || !elements.model || !elements.send) return;
  const text = elements.input.value.trim();
  if (!text) {
    setStatus('Type a message first ✏️', 'error');
    return;
  }
  const modelKey = elements.model.value;
  if (!ensureProviderConfigured(modelKey)) {
    setStatus('Configure API endpoints in window.CATH_AI_CONFIG.providers.', 'error');
    return;
  }
  if (state.streaming) {
    setStatus('Please wait for the current response to finish.', 'error');
    return;
  }

  const provider = providers[modelKey];
  const userMessage = { role: 'user', content: text };
  addMessage('user', text);

  const attachmentMessage = await buildAttachmentsContext();
  const webContextText = await fetchWebContext(text);
  const webMessage = webContextText ? { role: 'system', content: webContextText } : null;

  const payloadMessages = [...state.history];
  if (attachmentMessage) payloadMessages.push(attachmentMessage);
  if (webMessage) payloadMessages.push(webMessage);
  payloadMessages.push(userMessage);

  const payload = {
    model: provider.model || modelKey,
    messages: payloadMessages,
    stream: true,
    temperature: typeof provider.temperature === 'number' ? provider.temperature : 0.6,
    max_tokens: provider.maxTokens || 1024
  };

  elements.input.value = '';
  autoResize();
  state.attachments = [];
  renderAttachments();

  const assistantEl = addMessage('assistant', '', { streaming: true });
  if (!assistantEl) return;
  state.lastAssistantMessage = assistantEl;

  elements.send.disabled = true;
  setStatus('Cath-AI is thinking…', 'info');

  try {
    const assistantContent = await streamCompletion(provider.endpoint, payload, assistantEl);
    assistantEl.classList.remove('assistant-streaming');
    if (!assistantContent) {
      throw new Error('No response received');
    }
    if (attachmentMessage) {
      state.history.push(attachmentMessage);
    }
    state.history.push(userMessage);
    state.history.push({ role: 'assistant', content: assistantContent });
    setStatus('Ready for another question ✨', 'success');
  } catch (error) {
    console.error('Chat error', error);
    assistantEl.classList.remove('assistant-streaming');
    assistantEl.textContent = 'Sorry, something went wrong. Please try again.';
    setStatus('Something went wrong. Try again?', 'error');
  } finally {
    elements.send.disabled = false;
    state.streaming = false;
    state.abortController = null;
  }
}

async function buildAttachmentsContext() {
  if (!state.attachments.length) return null;
  const parts = state.attachments.map((item, index) => {
    const text = item.text || '';
    const trimmed = text.length > 6000 ? `${text.slice(0, 6000)}…` : text;
    return `Document ${index + 1}: ${item.file.name} (${formatBytes(item.file.size)})\n${trimmed}`;
  });
  if (!parts.length) return null;
  return {
    role: 'system',
    content: `The user shared the following reference documents. Use them when answering if relevant.\n\n${parts.join('\n\n---\n\n')}`
  };
}

async function streamCompletion(endpoint, payload, assistantEl) {
  state.streaming = true;
  const controller = new AbortController();
  state.abortController = controller;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: controller.signal
  });
  if (!response.ok || !response.body) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Upstream error (${response.status}): ${detail}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let fullText = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let boundary;
    while ((boundary = buffer.indexOf('\n\n')) !== -1) {
      const chunk = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const lines = chunk.split('\n');
      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (!data || data === '[DONE]') {
          continue;
        }
        try {
          const json = JSON.parse(data);
          const delta = json.choices && json.choices[0] && json.choices[0].delta;
          const content = delta && typeof delta.content === 'string' ? delta.content : '';
          if (content) {
            fullText += content;
            const body = assistantEl.firstChild || assistantEl;
            body.textContent = fullText;
            scrollMessages();
          }
        } catch (error) {
          console.warn('SSE parse error', error);
        }
      }
    }
  }

  // Process remaining buffer
  if (buffer.length) {
    const lines = buffer.split('\n');
    lines.forEach((line) => {
      if (!line.startsWith('data:')) return;
      const data = line.slice(5).trim();
      if (!data || data === '[DONE]') return;
      try {
        const json = JSON.parse(data);
        const delta = json.choices && json.choices[0] && json.choices[0].delta;
        const content = delta && typeof delta.content === 'string' ? delta.content : '';
        if (content) {
          fullText += content;
          const body = assistantEl.firstChild || assistantEl;
          body.textContent = fullText;
        }
      } catch (error) {
        console.warn('SSE final parse error', error);
      }
    });
  }

  return fullText.trim();
}

function setupEvents() {
  if (elements.form) {
    elements.form.addEventListener('submit', sendChat);
  }
  if (elements.input) {
    elements.input.addEventListener('input', autoResize);
    elements.input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        if (elements.form) {
          elements.form.requestSubmit();
        }
      }
    });
  }
  if (elements.clear) {
    elements.clear.addEventListener('click', () => {
      resetChat();
      setStatus('Conversation cleared.', 'info');
    });
  }
  if (elements.fileInput) {
    elements.fileInput.addEventListener('change', (event) => {
      const files = event.target.files;
      handleFiles(files).finally(() => {
        elements.fileInput.value = '';
      });
    });
  }
  if (elements.webSearch) {
    elements.webSearch.addEventListener('change', (event) => {
      state.webSearchEnabled = Boolean(event.target.checked);
      setStatus(state.webSearchEnabled ? 'Web search enabled.' : 'Web search disabled.', 'info');
    });
  }
  if (elements.promptList) {
    elements.promptList.addEventListener('click', handlePromptClick);
  }
  document.querySelectorAll('[data-scroll]').forEach((el) => {
    el.addEventListener('click', (event) => {
      const targetId = el.getAttribute('data-scroll');
      if (!targetId) return;
      const target = document.querySelector(targetId);
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

(function init() {
  setupEvents();
  autoResize();
  resetChat();
})();
