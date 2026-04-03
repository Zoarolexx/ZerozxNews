// API Configuration
const APIS = {
    cnbc: { url: 'https://api.nexray.web.id/berita/cnbcindonesia', name: 'CNBC Indonesia', color: 'cnbc' },
    cnn: { url: 'https://api.nexray.web.id/berita/cnn', name: 'CNN Indonesia', color: 'cnn' },
    kompas: { url: 'https://api.nexray.web.id/berita/kompas', name: 'Kompas.com', color: 'kompas' }
};

let allNews = [];
let displayedCount = 12; // Jumlah awal yang ditampilkan
let currentFilter = 'all';
let isLoading = false;

// Helper Functions
function formatTime(dateStr, source) {
    if (!dateStr) return 'baru saja';
    if (source === 'kompas' && dateStr.match(/\d+\s+\w+\s+\d{4}/)) return dateStr;
    if (source === 'cnn' && /^\d{14}$/.test(dateStr)) {
        return `${dateStr.substring(6, 8)}/${dateStr.substring(4, 6)}/${dateStr.substring(0, 4)} ${dateStr.substring(8, 10)}:${dateStr.substring(10, 12)}`;
    }
    if (dateStr.includes('menit') || dateStr.includes('jam') || dateStr.includes('hari')) return dateStr;
    return 'baru saja';
}

function getImageUrl(article, source) {
    if (source === 'cnbc') return article.image;
    if (source === 'cnn') return article.image_thumbnail || article.image_full;
    if (source === 'kompas') return article.image;
    return 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=800&auto=format';
}

function getDescription(article, source) {
    if (source === 'cnbc') return article.label || article.title;
    if (source === 'cnn') return article.content ? article.content.substring(0, 200) + '...' : article.title;
    if (source === 'kompas') return article.title;
    return article.title;
}

function getCategory(article, source) {
    if (source === 'cnbc') return article.category || 'Berita';
    if (source === 'cnn') return article.slug ? article.slug.split('/')[1] : 'Berita';
    if (source === 'kompas') return article.category || 'Berita';
    return 'Berita';
}

// Fetch single source - mengambil SEMUA data dari API
async function fetchSource(sourceKey) {
    const api = APIS[sourceKey];
    try {
        console.log(`📡 Mengambil data dari ${api.name}...`);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        const response = await fetch(api.url, { signal: controller.signal });
        clearTimeout(timeoutId);
        
        if (!response.ok) return [];
        const data = await response.json();
        
        if (data.status === true && data.result && data.result.length > 0) {
            console.log(`✅ ${api.name}: ${data.result.length} berita`);
            return data.result.map((article, idx) => ({
                id: `${sourceKey}_${Date.now()}_${idx}`,
                title: article.title || 'Tidak ada judul',
                description: getDescription(article, sourceKey),
                image: getImageUrl(article, sourceKey),
                source: api.name,
                sourceKey: sourceKey,
                sourceColor: api.color,
                category: getCategory(article, sourceKey),
                link: article.link || (sourceKey === 'cnn' ? article.link : '#'),
                time: formatTime(article.time || article.date, sourceKey),
                rawDate: article.time || article.date || new Date().toISOString()
            }));
        }
        return [];
    } catch (error) {
        console.error(`❌ Error fetching ${sourceKey}:`, error);
        return [];
    }
}

// Fetch ALL sources - mengambil SEMUA berita dari semua sumber
async function fetchAllNews() {
    const loadingState = document.getElementById('loadingState');
    const newsContent = document.getElementById('newsContent');
    
    newsContent.style.display = 'none';
    loadingState.style.display = 'flex';
    isLoading = true;
    
    try {
        const sources = Object.keys(APIS);
        const promises = sources.map(source => fetchSource(source));
        const results = await Promise.all(promises);
        
        // Gabungkan semua berita
        allNews = results.flat();
        
        // Hapus duplikat berdasarkan judul
        const uniqueNews = [];
        const titles = new Set();
        for (const article of allNews) {
            if (!titles.has(article.title)) {
                titles.add(article.title);
                uniqueNews.push(article);
            }
        }
        allNews = uniqueNews;
        
        // Urutkan berdasarkan waktu (terbaru di atas)
        allNews.sort((a, b) => {
            if (a.rawDate > b.rawDate) return -1;
            if (a.rawDate < b.rawDate) return 1;
            return 0;
        });
        
        console.log(`📊 TOTAL BERITA: ${allNews.length} (CNBC: ${allNews.filter(a => a.sourceKey === 'cnbc').length}, CNN: ${allNews.filter(a => a.sourceKey === 'cnn').length}, Kompas: ${allNews.filter(a => a.sourceKey === 'kompas').length})`);
        
        if (allNews.length === 0) {
            throw new Error('Tidak ada berita dari semua sumber');
        }
        
        // Reset displayed count
        displayedCount = 12;
        renderNews();
        
    } catch (error) {
        console.error('Error:', error);
        newsContent.innerHTML = `
            <div class="error-state">
                <i class="fas fa-exclamation-triangle" style="font-size: 2.5rem; color: #dc2626;"></i>
                <p style="margin-top: 1rem;">Gagal memuat berita: ${error.message}</p>
                <button onclick="fullRefresh()" style="margin-top: 1rem; padding: 0.5rem 1.5rem; background: var(--accent-blue); border: none; border-radius: 30px; color: white; cursor: pointer;">Coba Lagi</button>
            </div>
        `;
        newsContent.style.display = 'block';
        loadingState.style.display = 'none';
    } finally {
        isLoading = false;
    }
}

// Render news dengan pagination/load more
function renderNews() {
    let articlesToShow = [];
    
    if (currentFilter === 'all') {
        articlesToShow = allNews;
    } else {
        articlesToShow = allNews.filter(article => article.sourceKey === currentFilter);
    }
    
    const totalArticles = articlesToShow.length;
    const shownArticles = articlesToShow.slice(0, displayedCount);
    const hasMore = displayedCount < totalArticles;
    
    if (totalArticles === 0) {
        document.getElementById('newsContent').innerHTML = `
            <div class="empty-state">
                <i class="fas fa-newspaper" style="font-size: 3rem; color: var(--text-secondary);"></i>
                <p style="margin-top: 1rem;">Tidak ada berita dari sumber ini</p>
            </div>
        `;
        document.getElementById('newsContent').style.display = 'block';
        document.getElementById('loadingState').style.display = 'none';
        return;
    }
    
    // Stats
    const cnbcCount = allNews.filter(a => a.sourceKey === 'cnbc').length;
    const cnnCount = allNews.filter(a => a.sourceKey === 'cnn').length;
    const kompasCount = allNews.filter(a => a.sourceKey === 'kompas').length;
    
    let html = `
        <div class="news-stats">
            <div><i class="fas fa-database"></i> Total: <span class="stats-total">${allNews.length}</span> berita dari 3 sumber</div>
            <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
                <span><i class="fas fa-circle" style="color: #25D366; font-size: 0.6rem;"></i> CNBC: ${cnbcCount}</span>
                <span><i class="fas fa-circle" style="color: #dc2626; font-size: 0.6rem;"></i> CNN: ${cnnCount}</span>
                <span><i class="fas fa-circle" style="color: #3b82f6; font-size: 0.6rem;"></i> Kompas: ${kompasCount}</span>
                <span><i class="fas fa-eye"></i> Ditampilkan: <span class="stats-loaded">${Math.min(displayedCount, totalArticles)}</span> dari ${totalArticles}</span>
            </div>
        </div>
    `;
    
    // Featured (berita pertama)
    if (shownArticles.length > 0) {
        const featured = shownArticles[0];
        html += `
            <div class="featured-wrapper">
                <div class="featured-card" onclick='openModal(${JSON.stringify(featured).replace(/'/g, "\\'")})'>
                    <div class="featured-image">
                        <img src="${featured.image}" alt="${featured.title}" onerror="this.src='https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=800&auto=format'">
                        <div class="featured-overlay"></div>
                    </div>
                    <div class="featured-content">
                        <span class="featured-source ${featured.sourceColor}">${featured.source}</span>
                        <h2 class="featured-title">${featured.title}</h2>
                        <div class="featured-meta">
                            <span><i class="fas fa-tag"></i> ${featured.category}</span>
                            <span><i class="far fa-clock"></i> ${featured.time}</span>
                        </div>
                        <p class="featured-desc">${featured.description.substring(0, 150)}${featured.description.length > 150 ? '...' : ''}</p>
                    </div>
                </div>
            </div>
        `;
    }
    
    // Grid articles
    html += `<div class="grid-articles">`;
    for (let i = 1; i < shownArticles.length; i++) {
        const article = shownArticles[i];
        html += `
            <div class="article-card" onclick='openModal(${JSON.stringify(article).replace(/'/g, "\\'")})'>
                <div class="article-image">
                    <img src="${article.image}" alt="${article.title}" onerror="this.src='https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=400&auto=format'">
                    <span class="article-source-badge ${article.sourceColor}">${article.source}</span>
                </div>
                <div class="article-content">
                    <h3 class="article-title">${article.title}</h3>
                    <p class="article-desc">${article.description.substring(0, 100)}${article.description.length > 100 ? '...' : ''}</p>
                    <div class="article-footer">
                        <span><i class="far fa-clock"></i> ${article.time}</span>
                        <span class="read-more">Baca <i class="fas fa-arrow-right"></i></span>
                    </div>
                </div>
            </div>
        `;
    }
    html += `</div>`;
    
    // Load More button
    if (hasMore) {
        html += `
            <div class="load-more-container">
                <button class="load-more-btn" onclick="loadMore()">
                    <i class="fas fa-arrow-down"></i> Load More Berita (${totalArticles - displayedCount} tersisa)
                </button>
            </div>
        `;
    }
    
    document.getElementById('newsContent').innerHTML = html;
    document.getElementById('newsContent').style.display = 'block';
    document.getElementById('loadingState').style.display = 'none';
}

// Load more function
function loadMore() {
    if (isLoading) return;
    displayedCount += 12;
    renderNews();
}

// Filter function
function filterNews(filter) {
    currentFilter = filter;
    displayedCount = 12;
    
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.filter === filter) {
            btn.classList.add('active');
        }
    });
    
    renderNews();
}

// Full refresh (ambil ulang semua data)
async function fullRefresh() {
    displayedCount = 12;
    currentFilter = 'all';
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.filter === 'all') btn.classList.add('active');
    });
    await fetchAllNews();
}

// Modal functions
function openModal(article) {
    const modal = document.getElementById('newsModal');
    const modalBody = document.getElementById('modalBody');
    
    modalBody.innerHTML = `
        <img class="modal-image" src="${article.image}" alt="${article.title}" onerror="this.src='https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=800&auto=format'">
        <h2 class="modal-title">${article.title}</h2>
        <div class="modal-meta">
            <span><i class="fas fa-newspaper"></i> ${article.source}</span>
            <span><i class="fas fa-tag"></i> ${article.category}</span>
            <span><i class="far fa-clock"></i> ${article.time}</span>
        </div>
        <div class="modal-description">${article.description}</div>
        <div class="modal-actions">
            <button class="btn-secondary" onclick="closeModal()">Tutup</button>
            <a href="${article.link}" target="_blank" class="btn-primary">Baca Lengkap <i class="fas fa-arrow-right"></i></a>
        </div>
    `;
    
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    const modal = document.getElementById('newsModal');
    modal.classList.remove('active');
    document.body.style.overflow = 'auto';
}

// Event listeners
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
});

document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        filterNews(btn.dataset.filter);
    });
});

// Initial load
fetchAllNews();
setInterval(fullRefresh, 300000); // Refresh setiap 5 menit
