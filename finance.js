import { marked } from 'https://cdn.jsdelivr.net/npm/marked/lib/marked.esm.js';

document.addEventListener('DOMContentLoaded', () => {
    const grid = document.getElementById('lesson-grid');
    const modalBackdrop = document.getElementById('modal-backdrop');
    const modalContent = document.getElementById('modal-content-body');
    const closeModalBtn = document.getElementById('modal-close');

    // Pagination Elements
    const paginationContainer = document.getElementById('pagination-container');
    const prevBtn = document.getElementById('prev-page');
    const nextBtn = document.getElementById('next-page');
    const pageInfo = document.getElementById('page-info');

    const ITEMS_PER_PAGE = 12;
    let currentPage = 1;
    let allItems = [];

    // Fetch and Render Data
    // Add timestamp to prevent caching
    fetch(`data/ai/wealth/finance-daily.json?t=${new Date().getTime()}`)
        .then(response => {
            if (!response.ok) throw new Error('Failed to load data');
            return response.json();
        })
        .then(data => {
            // Sort by date descending (newest first)
            allItems = data.sort((a, b) => new Date(b.date) - new Date(a.date));
            
            if (allItems.length > ITEMS_PER_PAGE) {
                paginationContainer.style.display = 'flex';
            } else {
                paginationContainer.style.display = 'none';
            }
            
            renderPage(currentPage);
        })
        .catch(error => {
            console.error('Error:', error);
            grid.innerHTML = `
                <div class="loading-state">
                    <p>Unable to load lessons at this time.</p>
                    <small>${error.message}</small>
                </div>
            `;
        });

    function renderPage(page) {
        const start = (page - 1) * ITEMS_PER_PAGE;
        const end = start + ITEMS_PER_PAGE;
        const pageItems = allItems.slice(start, end);
        
        renderGrid(pageItems);
        updatePaginationControls();
    }

    function updatePaginationControls() {
        const totalPages = Math.ceil(allItems.length / ITEMS_PER_PAGE);
        pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
        
        prevBtn.disabled = currentPage === 1;
        nextBtn.disabled = currentPage === totalPages;
    }

    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                renderPage(currentPage);
                // Scroll to top of grid instead of top of page for better UX
                const gridTop = grid.getBoundingClientRect().top + window.pageYOffset - 100;
                window.scrollTo({ top: gridTop, behavior: 'smooth' });
            }
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            const totalPages = Math.ceil(allItems.length / ITEMS_PER_PAGE);
            if (currentPage < totalPages) {
                currentPage++;
                renderPage(currentPage);
                const gridTop = grid.getBoundingClientRect().top + window.pageYOffset - 100;
                window.scrollTo({ top: gridTop, behavior: 'smooth' });
            }
        });
    }

    function renderGrid(items) {
        grid.innerHTML = ''; // Clear loading state

        items.forEach(item => {
            const card = document.createElement('article');
            card.className = 'lesson-card';
            
            // Format Date
            const dateObj = new Date(item.date);
            const dateStr = dateObj.toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric',
                year: 'numeric'
            });

            // Handle bilingual content - prefer EN for UI, or fallback
            const title = typeof item.topic === 'object' ? (item.topic.en || item.topic.zh) : (item.topic || item.title);
            const summary = typeof item.summary === 'object' ? (item.summary.en || item.summary.zh) : item.summary;
            let tags = item.meta && item.meta.tags ? item.meta.tags : (item.tags || []);
            // Filter out Chinese tags
            tags = tags.filter(tag => !/[\u4e00-\u9fa5]/.test(tag));

            card.innerHTML = `
                <div class="card-date">${dateStr}</div>
                <h2 class="card-title">${title}</h2>
                <div class="card-excerpt">${summary}</div>
                <div class="card-tags">
                    ${tags.slice(0, 3).map(tag => `<span class="card-tag">#${tag}</span>`).join('')}
                </div>
            `;

            // Click Event for Modal
            card.addEventListener('click', () => openModal(item));
            grid.appendChild(card);
        });
    }

    function openModal(item) {
        const dateObj = new Date(item.date);
        const dateStr = dateObj.toLocaleDateString('en-US', { 
            weekday: 'long',
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });

        // Handle bilingual content
        const title = typeof item.topic === 'object' ? (item.topic.en || item.topic.zh) : (item.topic || item.title);
        const content = typeof item.summary === 'object' ? (item.summary.en || item.summary.zh) : (item.summary || item.content);
        let tags = item.meta && item.meta.tags ? item.meta.tags : (item.tags || []);
        // Filter out Chinese tags
        tags = tags.filter(tag => !/[\u4e00-\u9fa5]/.test(tag));
        const keyPoints = item.key_points ? (Array.isArray(item.key_points) ? item.key_points : (item.key_points.en || item.key_points.zh || [])) : [];
        const practice = item.practice ? (Array.isArray(item.practice) ? item.practice : (item.practice.en || item.practice.zh || [])) : [];
        const risk = item.risk_notes ? (typeof item.risk_notes === 'object' ? (item.risk_notes.en || item.risk_notes.zh) : item.risk_notes) : (item.risk_warning || '');
        
        // Determine Source URL safely
        let sourceUrl = null;
        if (item.sources && Array.isArray(item.sources) && item.sources.length > 0) {
            // Find the first source with a valid http/https URL
            const validSource = item.sources.find(s => s.url && /^https?:\/\//i.test(s.url));
            if (validSource) {
                sourceUrl = validSource.url;
            }
        }
        // Fallback to item.source_url if valid
        if (!sourceUrl && item.source_url && /^https?:\/\//i.test(item.source_url)) {
            sourceUrl = item.source_url;
        }

        // Construct Modal Content
        const contentHTML = `
            <div class="modal-header">
                <div class="modal-meta">
                    <span>${dateStr}</span>
                    <span>•</span>
                    <span>${tags.join(', ')}</span>
                </div>
                <h2 class="modal-title">${title}</h2>
            </div>

            <div class="modal-summary">
                ${marked.parse(content)}
            </div>

            <div class="modal-blocks">
                ${keyPoints.length > 0 ? `
                <div class="info-block key-points">
                    <h3><i class="fa-solid fa-star"></i> Key Insights</h3>
                    <ul>
                        ${keyPoints.map(point => `<li>${point}</li>`).join('')}
                    </ul>
                </div>` : ''}

                ${practice.length > 0 ? `
                <div class="info-block practice">
                    <h3><i class="fa-solid fa-wand-magic-sparkles"></i> Actionable Practice</h3>
                    ${practice.map(p => `
                        <div style="margin-bottom: 1rem;">
                            <strong>${p.title}</strong>
                            <ul>${p.steps.map(s => `<li>${s}</li>`).join('')}</ul>
                        </div>
                    `).join('')}
                </div>` : ''}

                ${risk ? `
                <div class="info-block risk">
                    <h3><i class="fa-solid fa-feather"></i> Gentle Reminder</h3>
                    <p>${risk}</p>
                </div>
                ` : ''}
            </div>

            ${sourceUrl ? `
            <div class="modal-footer">
                Source: <a href="${sourceUrl}" target="_blank" rel="noopener noreferrer">Read Original Article</a>
            </div>
            ` : ''}
        `;

        modalContent.innerHTML = contentHTML;
        modalBackdrop.classList.add('active');
        document.body.style.overflow = 'hidden'; // Prevent background scrolling
    }

    function closeModal() {
        modalBackdrop.classList.remove('active');
        document.body.style.overflow = ''; // Restore scrolling
        setTimeout(() => {
            modalContent.innerHTML = ''; // Clear content after animation
        }, 300);
    }

    // Event Listeners
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', closeModal);
    }
    
    if (modalBackdrop) {
        modalBackdrop.addEventListener('click', (e) => {
            if (e.target === modalBackdrop) {
                closeModal();
            }
        });
    }

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modalBackdrop.classList.contains('active')) {
            closeModal();
        }
    });
});
