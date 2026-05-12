const GENRE_COLORS = {
  'Documentary': '#FF6B6B', 'Animation': '#4ECDC4', 'Comedy': '#FFE66D',
  'Drama': '#95E1D3', 'Action': '#FF6348', 'Romance': '#FF69B4',
  'Music': '#FFB347', 'Western': '#A0522D', 'Crime': '#2C3E50',
  'Science Fiction': '#3498DB', 'Family': '#F1C40F', 'History': '#8B7355',
  'Fantasy': '#9B59B6', 'War': '#34495E', 'Horror': '#C0392B',
  'Mystery': '#7F8C8D', 'Thriller': '#E74C3C', 'Adventure': '#1ABC9C',
  'TV Movie': '#BDC3C7'
};

let data = {};

Promise.all([
  fetch('data/production.json').then(r => r.json()),
  fetch('data/genres.json').then(r => r.json()),
  fetch('data/ratings.json').then(r => r.json()),
  fetch('data/finance.json').then(r => r.json()),
  fetch('data/movies.json').then(r => r.json())
]).then(([prod, genres, ratings, finance, movies]) => {
  data = { production: prod, genres, ratings, finance, movies };
  
  const genreSet = new Set();
  genres.forEach(d => d.genres.forEach(g => genreSet.add(g.name)));
  const allGenres = Array.from(genreSet).sort();
  
  // Genre buttons
  const genresContainer = document.getElementById('production-genres');
  const allBtn = document.createElement('button');
  allBtn.className = 'chip active';
  allBtn.textContent = 'All genres';
  allBtn.onclick = () => {
    genresContainer.querySelectorAll('.chip').forEach(b => b.classList.remove('active'));
    allBtn.classList.add('active');
    drawProduction('all');
  };
  genresContainer.appendChild(allBtn);
  
  allGenres.forEach(genre => {
    const btn = document.createElement('button');
    btn.className = 'chip';
    btn.textContent = genre;
    btn.onclick = () => {
      genresContainer.querySelectorAll('.chip').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      drawProduction(genre);
    };
    genresContainer.appendChild(btn);
  });
  
  drawProduction('all');
  drawGenres();
  drawRatings();
  drawFinance('all');
  showMovies();
  setupMovieDecadeButtons();
  setupDecadeButtons();
  initEraPersonalizer();
}).catch(err => console.error('Data load error:', err));

function drawProduction(genre = 'all') {
  const canvas = setupCanvas('.production-chart', 'Movies released per year (1988-2025)');
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  const { width, height, padding, plotWidth, plotHeight } = getCanvasDims(canvas);
  
  let chartData = data.production;
  if (genre !== 'all') {
    chartData = [];
    const decadeData = {};
    data.genres.forEach(d => {
      const g = d.genres.find(x => x.name === genre);
      if (g) decadeData[d.decade] = g.count;
    });
    const decades = Object.keys(decadeData).map(Number).sort((a,b) => a-b);
    for (let year = 1988; year <= 2025; year++) {
      let count = 0;
      for (let i = 0; i < decades.length; i++) {
        const curr = decades[i], next = decades[i+1];
        if (year >= curr && year < (next || 2030)) {
          if (next && decadeData[next]) {
            const prog = (year - curr) / 10;
            count = decadeData[curr] * (1-prog) + decadeData[next] * prog;
          } else {
            count = decadeData[curr];
          }
          break;
        }
      }
      chartData.push({ year, count });
    }
  }
  
  const max = Math.max(...chartData.map(d => d.count), 1);
  drawGrid(ctx, padding, width, height, plotWidth, plotHeight);
  drawYLabels(ctx, padding, plotHeight, max);
  
  const barWidth = plotWidth / chartData.length;
  ctx.fillStyle = '#668bff';
  chartData.forEach((p, i) => {
    const h = (p.count / max) * plotHeight;
    const x = padding.left + i * barWidth + barWidth * 0.1;
    const y = height - padding.bottom - h;
    ctx.fillRect(x, y, barWidth * 0.8, h);
  });
  
  drawAxes(ctx, padding, width, height);
}

function drawGenres() {
  const canvas = setupCanvas('.genre-chart', 'Genre composition over time (1988-2025)');
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  const { width, height, padding, plotWidth, plotHeight } = getCanvasDims(canvas);
  
  const genreSet = new Set();
  const maxCounts = {};
  data.genres.forEach(d => {
    d.genres.forEach(g => {
      genreSet.add(g.name);
      maxCounts[g.name] = Math.max(maxCounts[g.name] || 0, g.count);
    });
  });
  
  const topGenres = Array.from(genreSet)
    .sort((a,b) => (maxCounts[b]||0) - (maxCounts[a]||0))
    .slice(0, 10);
  
  const barWidth = plotWidth / data.genres.length;
  const max = Math.max(...data.genres.map(d => d.genres.reduce((s,g) => s+g.count, 0)), 1);
  
  const barPositions = [];
  
  drawGrid(ctx, padding, width, height, plotWidth, plotHeight);
  drawYLabels(ctx, padding, plotHeight, max);
  
  data.genres.forEach((decade, idx) => {
    let stacked = 0;
    [...decade.genres].sort((a,b) => b.count - a.count).forEach(g => {
      if (topGenres.includes(g.name)) {
        const h = (g.count / max) * plotHeight;
        const x = padding.left + idx * barWidth;
        const y = height - padding.bottom - stacked - h;
        
        ctx.fillStyle = GENRE_COLORS[g.name] || '#999';
        ctx.globalAlpha = 0.85;
        ctx.fillRect(x, y, barWidth - 1, h);
        
        barPositions.push({ x, y, width: barWidth-1, height: h, genre: g.name, count: g.count, decade: decade.decade });
        stacked += h;
      }
    });
  });
  
  ctx.globalAlpha = 1;
  drawAxes(ctx, padding, width, height);
  
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.font = '11px Arial';
  ctx.textAlign = 'center';
  data.genres.forEach((d, i) => {
    if (i % 3 === 0) {
      const x = padding.left + i * barWidth + barWidth / 2;
      ctx.fillText(d.decade, x, height - padding.bottom + 20);
    }
  });
  
  createLegend('#genre-legend', topGenres);
  
  const tooltip = document.createElement('div');
  tooltip.style.cssText = `position:fixed;background:rgba(20,25,35,0.95);color:#d9dce4;padding:8px 12px;border-radius:6px;font-size:13px;pointer-events:none;display:none;border:1px solid rgba(255,255,255,0.2);z-index:1000;box-shadow:0 4px 12px rgba(0,0,0,0.5)`;
  document.body.appendChild(tooltip);
  
  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const bar = barPositions.find(b => x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height);
    if (bar) {
      tooltip.innerHTML = `<strong>${bar.genre}</strong><br/>${bar.count} movies<br/>Decade: ${bar.decade}s`;
      tooltip.style.display = 'block';
      tooltip.style.left = (e.clientX + 10) + 'px';
      tooltip.style.top = (e.clientY + 10) + 'px';
    } else {
      tooltip.style.display = 'none';
    }
  });
  
  canvas.addEventListener('mouseleave', () => tooltip.style.display = 'none');
}

function drawRatings() {
  const container = document.querySelector('.ratings-chart');
  container.innerHTML = '';
  
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const width = container.offsetWidth || 800;
  const height = 360;
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('style', 'width: 100%; height: 100%; display: block;');
  container.appendChild(svg);
  
  const pad = { top: 40, right: 40, bottom: 40, left: 50 };
  const plotWidth = width - pad.left - pad.right;
  const plotHeight = height - pad.top - pad.bottom;
  
  for (let i = 0; i < 5; i++) {
    const y = pad.top + (i * plotHeight / 4);
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', pad.left);
    line.setAttribute('y1', y);
    line.setAttribute('x2', width - pad.right);
    line.setAttribute('y2', y);
    line.setAttribute('stroke', 'rgba(255,255,255,0.1)');
    line.setAttribute('stroke-width', '1');
    svg.appendChild(line);
  }
  
  const maxRating = Math.max(...data.ratings.map(d => d.rating), 10);
  const minRating = Math.min(...data.ratings.map(d => d.rating), 0);
  const range = maxRating - minRating || 1;
  
  for (let i = 0; i <= 4; i++) {
    const val = (maxRating - (i/4) * range).toFixed(1);
    const y = pad.top + (i * plotHeight / 4);
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', pad.left - 10);
    text.setAttribute('y', y + 4);
    text.setAttribute('font-size', '12');
    text.setAttribute('fill', 'rgba(255,255,255,0.6)');
    text.setAttribute('text-anchor', 'end');
    text.textContent = val;
    svg.appendChild(text);
  }
  
  let path = 'M';
  data.ratings.forEach((p, i) => {
    const x = pad.left + (i / (data.ratings.length - 1)) * plotWidth;
    const y = pad.top + plotHeight - ((p.rating - minRating) / range * plotHeight);
    path += (i === 0 ? '' : ' L') + x + ',' + y;
  });
  
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  line.setAttribute('d', path);
  line.setAttribute('stroke', '#668bff');
  line.setAttribute('stroke-width', '3');
  line.setAttribute('fill', 'none');
  line.setAttribute('stroke-linecap', 'round');
  svg.appendChild(line);
  
  const yAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  yAxis.setAttribute('x1', pad.left);
  yAxis.setAttribute('y1', pad.top);
  yAxis.setAttribute('x2', pad.left);
  yAxis.setAttribute('y2', height - pad.bottom);
  yAxis.setAttribute('stroke', 'rgba(255,255,255,0.3)');
  yAxis.setAttribute('stroke-width', '2');
  svg.appendChild(yAxis);
  
  const xAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  xAxis.setAttribute('x1', pad.left);
  xAxis.setAttribute('y1', height - pad.bottom);
  xAxis.setAttribute('x2', width - pad.right);
  xAxis.setAttribute('y2', height - pad.bottom);
  xAxis.setAttribute('stroke', 'rgba(255,255,255,0.3)');
  xAxis.setAttribute('stroke-width', '2');
  svg.appendChild(xAxis);
  
  for (let i = 0; i < data.ratings.length; i += Math.ceil(data.ratings.length / 10)) {
    const x = pad.left + (i / (data.ratings.length - 1)) * plotWidth;
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', x);
    text.setAttribute('y', height - pad.bottom + 20);
    text.setAttribute('font-size', '11');
    text.setAttribute('fill', 'rgba(255,255,255,0.5)');
    text.setAttribute('text-anchor', 'middle');
    text.textContent = data.ratings[i].year;
    svg.appendChild(text);
  }
  
  const title = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  title.setAttribute('x', width / 2);
  title.setAttribute('y', 20);
  title.setAttribute('font-size', '14');
  title.setAttribute('font-weight', 'bold');
  title.setAttribute('fill', 'rgba(255,255,255,0.9)');
  title.setAttribute('text-anchor', 'middle');
  title.textContent = 'Average ratings by year (1988-2025)';
  svg.appendChild(title);
}

function drawFinance(decade = 'all') {
  const canvas = setupCanvas('.finance-chart', 'Budget vs Revenue by Genre');
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  const { width, height, padding, plotWidth, plotHeight } = getCanvasDims(canvas);
  
  let filtered = data.finance;
  if (decade !== 'all') {
    const decNum = parseInt(decade);
    filtered = data.finance.filter(m => m.decade >= decNum && m.decade < decNum + 10);
  }
  
  if (!filtered.length) {
    ctx.fillStyle = '#999';
    ctx.font = '14px Arial';
    ctx.fillText('No data', width / 2 - 30, height / 2);
    return;
  }
  
  const maxBudget = Math.max(...filtered.map(d => d.budget), 1);
  const maxRevenue = Math.max(...filtered.map(d => d.revenue), 1);
  
  drawGrid(ctx, padding, width, height, plotWidth, plotHeight);
  
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.font = '11px Arial';
  ctx.textAlign = 'right';
  for (let i = 0; i <= 4; i++) {
    const val = Math.round(((4-i) / 4) * maxRevenue / 1000000);
    const y = padding.top + (i * plotHeight / 4);
    ctx.fillText(val + 'M', padding.left - 10, y + 4);
  }
  
  ctx.textAlign = 'center';
  for (let i = 0; i <= 4; i++) {
    const val = Math.round((i / 4) * maxBudget / 1000000);
    const x = padding.left + (i * plotWidth / 4);
    ctx.fillText(val + 'M', x, height - padding.bottom + 20);
  }
  
  filtered.forEach(m => {
    const x = padding.left + (m.budget / maxBudget) * plotWidth;
    const y = height - padding.bottom - (m.revenue / maxRevenue) * plotHeight;
    
    ctx.fillStyle = GENRE_COLORS[m.primary_genre] || '#999';
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  });
  
  drawAxes(ctx, padding, width, height);
  
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.font = '12px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('Budget', width / 2, height - 8);
  
  ctx.save();
  ctx.translate(15, height / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText('Revenue', 0, 0);
  ctx.restore();
  
  createLegend('.finance-chart', Array.from(new Set(filtered.map(m => m.primary_genre))).slice(0, 10));
}

/* ─────────────────────────────────────────────
   REPRESENTATIVE MOVIES PANEL
   ───────────────────────────────────────────── */

// ── State ────────────────────────────────────
let activeMovieDecade = 'all';

// ── Called once on data load ─────────────────
function showMovies(decade = 'all') {
  activeMovieDecade = decade;
  const container = document.getElementById('movie-strip');
  container.innerHTML = '';

  const filtered = decade === 'all'
    ? data.movies
    : data.movies.filter(m => m.decade === parseInt(decade));

  if (!filtered.length) {
    container.innerHTML = '<p style="color:var(--muted);text-align:center;padding:40px">No films for this period.</p>';
    return;
  }

  filtered.forEach((m, i) => {
    const card = createMovieCard(m, i === 0 && decade === 'all');
    container.appendChild(card);
  });
}

// ── Build one card ────────────────────────────
function createMovieCard(m, featured = false) {
  const card = document.createElement('article');
  card.className = 'movie-card' + (featured ? ' featured' : '');
  card.title = `Open ${m.title} on IMDb`;
  card.style.cursor = 'pointer';

  const posterUrl = `https://image.tmdb.org/t/p/w500${m.poster_path}`;
  const color = GENRE_COLORS[m.genre] || '#668bff';
  const revenue = m.revenue > 0
    ? '$' + (m.revenue / 1e6).toFixed(0) + 'M'
    : 'N/A';
  const stars = '★'.repeat(Math.round(m.rating / 2)) + '☆'.repeat(5 - Math.round(m.rating / 2));

  card.innerHTML = `
    <div class="poster-wrap">
      <img
        class="poster-img"
        src="${posterUrl}"
        alt="${m.title} poster"
        loading="lazy"
        onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"
      />
      <div class="poster-fallback" style="background:linear-gradient(135deg,${color},${color}44);display:none">
        <span>${m.title}</span>
      </div>
      <div class="poster-overlay">
        <span class="genre-badge" style="background:${color}33;border-color:${color}66">${m.genre}</span>
      </div>
    </div>
    <div class="movie-info">
      <p class="movie-era">${m.era}</p>
      <h3 class="movie-title">${m.title}</h3>
      <div class="movie-meta">
        <span class="movie-year">${m.year}</span>
        <span class="movie-rating" title="${m.rating}/10">${stars} ${m.rating}</span>
      </div>
      <p class="movie-revenue">Box office: ${revenue}</p>
      <p class="movie-overview">${m.overview}</p>
    </div>
  `;

  card.addEventListener('click', () => {
    window.open(`https://www.imdb.com/title/${m.imdb_id}/`, '_blank', 'noopener');
  });

  // Hover lift
  card.addEventListener('mouseenter', () => card.style.transform = 'translateY(-6px)');
  card.addEventListener('mouseleave', () => card.style.transform = '');

  return card;
}

// ── Decade filter tabs ────────────────────────
function setupMovieDecadeButtons() {
  const section = document.getElementById('movies');
  if (!section) return;

  // Insert tab bar above the strip
  const tabBar = document.createElement('div');
  tabBar.className = 'movie-decade-tabs';
  tabBar.innerHTML = `
    <button class="chip active" data-mdecade="all">All eras</button>
    <button class="chip" data-mdecade="1990">1990s</button>
    <button class="chip" data-mdecade="2000">2000s</button>
    <button class="chip" data-mdecade="2010">2010s</button>
    <button class="chip" data-mdecade="2020">2020s</button>
  `;

  const strip = document.getElementById('movie-strip');
  section.insertBefore(tabBar, strip);

  tabBar.querySelectorAll('.chip').forEach(btn => {
    btn.addEventListener('click', () => {
      tabBar.querySelectorAll('.chip').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      showMovies(btn.getAttribute('data-mdecade'));
    });
  });
}

// ──────────────────────────────────────

function setupCanvas(selector, title) {
  const container = document.querySelector(selector);
  if (!container) return null;
  container.innerHTML = '';
  const canvas = document.createElement('canvas');
  container.appendChild(canvas);
  const width = container.offsetWidth || 800;
  const height = 360;
  canvas.width = width;
  canvas.height = height;
  
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.font = 'bold 14px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(title, width / 2, 20);
  
  return canvas;
}

function getCanvasDims(canvas) {
  return {
    width: canvas.width,
    height: canvas.height,
    padding: { top: 40, right: 20, bottom: 40, left: 50 },
    get plotWidth() { return this.width - this.padding.left - this.padding.right; },
    get plotHeight() { return this.height - this.padding.top - this.padding.bottom; }
  };
}

function drawGrid(ctx, padding, width, height, plotWidth, plotHeight) {
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    const y = padding.top + (i * plotHeight / 4);
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();
  }
}

function drawYLabels(ctx, padding, plotHeight, max) {
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.font = '12px Arial';
  ctx.textAlign = 'right';
  for (let i = 0; i <= 4; i++) {
    const val = Math.round((i / 4) * max);
    const y = padding.top + ((4 - i) * plotHeight / 4);
    ctx.fillText(val, padding.left - 10, y + 4);
  }
}

function drawAxes(ctx, padding, width, height) {
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(padding.left, padding.top);
  ctx.lineTo(padding.left, height - padding.bottom);
  ctx.lineTo(width - padding.right, height - padding.bottom);
  ctx.stroke();
}

function createLegend(target, genres) {
  const container = typeof target === 'string' ? document.querySelector(target) : target;
  if (!container) return;
  
  const leg = document.createElement('div');
  leg.style.cssText = 'display:flex;flex-wrap:wrap;gap:15px;margin-top:15px;padding:10px 0;justify-content:center';
  
  genres.forEach(g => {
    const item = document.createElement('span');
    item.style.cssText = 'display:flex;align-items:center;gap:6px;font-size:0.9rem;color:#d9dce4';
    
    const dot = document.createElement('div');
    dot.style.cssText = `width:10px;height:10px;border-radius:50%;background:${GENRE_COLORS[g] || '#999'};flex-shrink:0`;
    
    item.appendChild(dot);
    item.appendChild(document.createTextNode(g));
    leg.appendChild(item);
  });
  
  container.appendChild(leg);
}

function setupDecadeButtons() {
  document.getElementById('finance-decades')?.querySelectorAll('.chip').forEach(btn => {
    btn.onclick = () => {
      document.getElementById('finance-decades').querySelectorAll('.chip').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      drawFinance(btn.getAttribute('data-decade'));
    };
  });
}

document.querySelectorAll('.reveal').forEach(el => {
  new IntersectionObserver(entries => {
    entries.forEach(e => e.isIntersecting && e.target.classList.add('visible'));
  }, { threshold: 0.15 }).observe(el);
});

const progressBar = document.querySelector('.timeline-progress');
window.addEventListener('scroll', () => {
  if (progressBar) {
    const progress = (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100;
    progressBar.style.width = progress + '%';
  }
});

/* ════════════════════════════════════════════════════════
   YOUR CINEMA ERA — personalizer
   ════════════════════════════════════════════════════════
   ─────────────────────────────────────────────────────── */

// ── Top non-documentary genre per decade (pre-computed from data) ──────────
// Built from genres.json, excluding Documentary & TV Movie
const ERA_GENRE_BY_DECADE = {
  1990: 'Drama',
  2000: 'Drama',
  2010: 'Drama',
  2020: 'Drama',
};

// ── Biggest blockbuster per decade (pre-computed from finance.json) ─────────
const ERA_BLOCKBUSTER_BY_DECADE = {
  1990: { title: 'Titanic',                   revenue: 2.26 },
  2000: { title: 'Avatar',                    revenue: 2.92 },
  2010: { title: 'Avengers: Endgame',         revenue: 2.80 },
  2020: { title: 'Avatar: The Way of Water',  revenue: 2.35 },
};

// ── Main init ───────────────────────────────────────────────────────────────
function initEraPersonalizer() {
  const slider     = document.getElementById('birth-year-slider');
  const yearLabel  = document.getElementById('era-selected-year');
  if (!slider) return;

  // Build fast lookup maps from already-loaded data
  const prodByYear   = {};
  const ratingByYear = {};

  data.production.forEach(d => { prodByYear[d.year]   = d.count; });
  data.ratings.forEach(d    => { ratingByYear[d.year]  = d.rating; });

  // Compute blockbuster per decade live from finance data (more accurate)
  const blockbusterByDecade = {};
  data.finance.forEach(m => {
    if (!m.revenue || m.revenue <= 0) return;
    const d = m.decade;
    if (!blockbusterByDecade[d] || m.revenue > blockbusterByDecade[d].revenue) {
      blockbusterByDecade[d] = { title: m.title, revenue: m.revenue };
    }
  });

  // Compute top non-doc genre per decade live from genres data
  const EXCLUDE_GENRES = new Set(['Documentary', 'TV Movie']);
  const genreByDecade = {};
  data.genres.forEach(d => {
    const filtered = d.genres.filter(g => !EXCLUDE_GENRES.has(g.name));
    if (filtered.length) {
      const top = filtered.reduce((a, b) => a.count > b.count ? a : b);
      genreByDecade[d.decade] = top.name;
    }
  });

  // Draw sparkline once; update marker on slider move
  drawEraSparkline(prodByYear);

  // Initial render
  updateEra(parseInt(slider.value));

  // Debounced slider handler
  let rafId;
  slider.addEventListener('input', () => {
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(() => updateEra(parseInt(slider.value)));
  });

  // ── Core update ────────────────────────────────────────────────────────────
  function updateEra(year) {
    yearLabel.textContent = year;

    const decade = Math.floor(year / 10) * 10;
    const films   = prodByYear[year]   ?? null;
    const rating  = ratingByYear[year] ?? null;
    const genre   = genreByDecade[decade] ?? '—';
    const block   = blockbusterByDecade[decade];

    // Films count
    animateCount('estat-films', '.era-count:not(.era-decimal)', films, false);

    // Genre
    const genreEl = document.getElementById('era-genre-val');
    if (genreEl) fadeTextUpdate(genreEl, genre);

    // Rating
    animateCount('estat-rating', '.era-decimal', rating, true);

    // Blockbuster
    const blockEl = document.getElementById('era-blockbuster-val');
    if (blockEl && block) {
      fadeTextUpdate(blockEl,
        `${block.title} <span style="color:var(--gold);font-size:0.75em">$${(block.revenue/1e9).toFixed(2)}B</span>`
      );
    }

    // Sparkline marker
    updateEraMarker(year);

    // Pop animation on cards
    document.querySelectorAll('.era-stat-card').forEach(c => {
      c.classList.remove('era-pop');
      void c.offsetWidth; // reflow
      c.classList.add('era-pop');
    });
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  function animateCount(cardId, selector, target, isDecimal) {
    if (target === null) return;
    const card = document.getElementById(cardId);
    if (!card) return;
    const el = card.querySelector(selector);
    if (!el) return;

    const start  = parseFloat(el.textContent.replace(/,/g, '')) || 0;
    const end    = target;
    const dur    = 500; // ms
    const t0     = performance.now();

    function tick(now) {
      const progress = Math.min((now - t0) / dur, 1);
      const ease = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      const val  = start + (end - start) * ease;
      el.textContent = isDecimal
        ? val.toFixed(2)
        : Math.round(val).toLocaleString();
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  function fadeTextUpdate(el, html) {
    el.style.opacity = '0';
    el.style.transform = 'translateY(4px)';
    el.style.transition = 'opacity 0.2s, transform 0.2s';
    setTimeout(() => {
      el.innerHTML = html;
      el.style.opacity = '1';
      el.style.transform = 'translateY(0)';
    }, 150);
  }
}

// ── Sparkline (drawn once, marker updated on slide) ─────────────────────────
function drawEraSparkline(prodByYear) {
  const svg = document.getElementById('era-sparkline');
  if (!svg) return;

  const W = svg.parentElement.clientWidth || 700;
  const H = 90;
  const PAD = { top: 8, right: 16, bottom: 22, left: 40 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const years  = Object.keys(prodByYear).map(Number).sort((a,b) => a-b);
  const counts = years.map(y => prodByYear[y]);
  const minY   = 0;
  const maxY   = Math.max(...counts);

  const xScale = y => PAD.left + ((y - years[0]) / (years[years.length-1] - years[0])) * plotW;
  const yScale = v => PAD.top + plotH - (v / maxY) * plotH;

  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);

  // Grid lines (subtle)
  [0.25, 0.5, 0.75, 1].forEach(f => {
    const y = PAD.top + plotH * (1 - f);
    const line = document.createElementNS('http://www.w3.org/2000/svg','line');
    line.setAttribute('x1', PAD.left); line.setAttribute('x2', W - PAD.right);
    line.setAttribute('y1', y);        line.setAttribute('y2', y);
    line.setAttribute('stroke', 'rgba(255,255,255,0.06)');
    line.setAttribute('stroke-width', '1');
    svg.appendChild(line);
    // Y label
    const txt = document.createElementNS('http://www.w3.org/2000/svg','text');
    txt.setAttribute('x', PAD.left - 6); txt.setAttribute('y', y + 4);
    txt.setAttribute('text-anchor','end');
    txt.setAttribute('fill','rgba(255,255,255,0.3)');
    txt.setAttribute('font-size','9');
    txt.textContent = Math.round(maxY * f / 1000) + 'k';
    svg.appendChild(txt);
  });

  // Area fill
  const areaPoints = [
    `${xScale(years[0])},${PAD.top + plotH}`,
    ...years.map(y => `${xScale(y)},${yScale(prodByYear[y])}`),
    `${xScale(years[years.length-1])},${PAD.top + plotH}`
  ].join(' ');
  const area = document.createElementNS('http://www.w3.org/2000/svg','polygon');
  area.setAttribute('points', areaPoints);
  area.setAttribute('fill', 'url(#eraAreaGrad)');
  area.setAttribute('opacity', '0.4');

  // Gradient def
  const defs = document.createElementNS('http://www.w3.org/2000/svg','defs');
  defs.innerHTML = `
    <linearGradient id="eraAreaGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#d7b46a" stop-opacity="0.6"/>
      <stop offset="100%" stop-color="#d7b46a" stop-opacity="0.02"/>
    </linearGradient>`;
  svg.appendChild(defs);
  svg.appendChild(area);

  // Line
  const pathD = years.map((y, i) =>
    `${i === 0 ? 'M' : 'L'}${xScale(y)},${yScale(prodByYear[y])}`
  ).join(' ');
  const path = document.createElementNS('http://www.w3.org/2000/svg','path');
  path.setAttribute('d', pathD);
  path.setAttribute('fill','none');
  path.setAttribute('stroke','#d7b46a');
  path.setAttribute('stroke-width','2');
  path.setAttribute('stroke-linejoin','round');
  svg.appendChild(path);

  // X-axis year labels
  const labelYears = years.filter(y => y % 5 === 0);
  labelYears.forEach(y => {
    const txt = document.createElementNS('http://www.w3.org/2000/svg','text');
    txt.setAttribute('x', xScale(y)); txt.setAttribute('y', H - 4);
    txt.setAttribute('text-anchor','middle');
    txt.setAttribute('fill','rgba(255,255,255,0.3)');
    txt.setAttribute('font-size','9');
    txt.textContent = y;
    svg.appendChild(txt);
  });

  // Marker group (updated on slide)
  const markerG = document.createElementNS('http://www.w3.org/2000/svg','g');
  markerG.setAttribute('id','era-marker');

  const markerLine = document.createElementNS('http://www.w3.org/2000/svg','line');
  markerLine.setAttribute('id','era-marker-line');
  markerLine.setAttribute('stroke','#fff');
  markerLine.setAttribute('stroke-width','1.5');
  markerLine.setAttribute('stroke-dasharray','3 3');
  markerLine.setAttribute('y1', PAD.top); markerLine.setAttribute('y2', PAD.top + plotH);

  const markerDot = document.createElementNS('http://www.w3.org/2000/svg','circle');
  markerDot.setAttribute('id','era-marker-dot');
  markerDot.setAttribute('r','5');
  markerDot.setAttribute('fill','#fff');
  markerDot.setAttribute('stroke','#d7b46a');
  markerDot.setAttribute('stroke-width','2');

  markerG.appendChild(markerLine);
  markerG.appendChild(markerDot);
  svg.appendChild(markerG);

  // Store scales for later use by updateEraMarker
  svg._xScale = xScale;
  svg._yScale = yScale;
  svg._prodByYear = prodByYear;
}

function updateEraMarker(year) {
  const svg = document.getElementById('era-sparkline');
  if (!svg || !svg._xScale) return;
  const x = svg._xScale(year);
  const y = svg._yScale(svg._prodByYear[year] ?? 0);

  const line = document.getElementById('era-marker-line');
  const dot  = document.getElementById('era-marker-dot');
  if (line) { line.setAttribute('x1', x); line.setAttribute('x2', x); }
  if (dot)  { dot.setAttribute('cx', x);  dot.setAttribute('cy', y); }
}