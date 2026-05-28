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

const FINANCE_MIN_BUDGET = 250000;
const FINANCE_MIN_REVENUE = 100000;
const FINANCE_MAX_ROI = 5000;

// ── Shared filter state (for cross-chart filtering) ────────────────────────
let activeGenreFilter = null;

initCinematicLampIntro();

Promise.all([
  fetch('data/production.json').then(r => r.json()),
  fetch('data/genres.json').then(r => r.json()),
  fetch('data/ratings.json').then(r => r.json()),
  fetch('data/finance.json').then(r => r.json()),
  fetch('data/movies.json').then(r => r.json()),
  fetch('data/genres_by_year.json').then(r => r.json())
]).then(([prod, genres, ratings, finance, movies, genresByYear]) => {
  const normalizedFinance = finance
    .map(d => {
      const rawGenre = (d.primary_genre || d.genre || '').trim();
      const primaryGenre = !rawGenre || rawGenre.toLowerCase() === 'unknown' ? null : rawGenre;
      const budget = Number(d.budget);
      const revenue = Number(d.revenue);
      const roi = Number.isFinite(budget) && budget > 0
        ? ((revenue - budget) / budget) * 100
        : NaN;

      return {
        ...d,
        budget,
        revenue,
        roi,
        primary_genre: primaryGenre
      };
    })
    .filter(d => d.primary_genre)
    .filter(d => Number.isFinite(d.budget) && Number.isFinite(d.revenue))
    .filter(d => d.budget >= FINANCE_MIN_BUDGET && d.revenue >= FINANCE_MIN_REVENUE)
    .filter(d => Number.isFinite(d.roi) && d.roi > -100 && d.roi <= FINANCE_MAX_ROI);

  data = { production: prod, genres, ratings, finance, movies, genresByYear };
  data.finance = normalizedFinance;

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

// ── Cross-chart filter dispatcher ──────────────────────────────────────────
function applyGenreFilter(genre) {
  // Filter production chart
  drawProduction(genre || 'all');

  // Redraw finance with genre filter
  if (data.finance) {
    const activeDecade = document.querySelector('#finance-decades .chip.active')
      ?.getAttribute('data-decade') || 'all';
    drawFinance(activeDecade, genre);
  }

  // Sync production genre chips
  document.querySelectorAll('#production-genres .chip').forEach(btn => {
    if (!genre) {
      btn.classList.toggle('active', btn.getAttribute('data-genre') === 'all');
    } else {
      btn.classList.toggle('active', btn.textContent === genre);
    }
  });
}

function drawProduction(genre = 'all') {
  const container = document.querySelector('.production-chart');
  if (!container) return;
  container.innerHTML = '';

  // ── Build chart data ───────────────────────────────────────────────────────
  let chartData;
  if (genre === 'all') {
    chartData = data.production.map(d => ({ year: d.year, count: d.count }));
  } else {
    chartData = data.genresByYear.map(d => ({ year: d.year, count: d[genre] || 0 }));
  }

  const margin = { top: 30, right: 30, bottom: 40, left: 60 };
  const totalW = container.offsetWidth || 700;
  const totalH = 360;
  const W = totalW - margin.left - margin.right;
  const H = totalH - margin.top - margin.bottom;

  const svg = d3.select(container)
    .append('svg')
    .attr('width', totalW)
    .attr('height', totalH)
    .style('display', 'block');

  const g = svg.append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  // ── Scales ─────────────────────────────────────────────────────────────────
  const xScale = d3.scaleLinear()
    .domain(d3.extent(chartData, d => d.year))
    .range([0, W]);

  const yScale = d3.scaleLinear()
    .domain([0, d3.max(chartData, d => d.count) * 1.08])
    .range([H, 0]);

  // ── Grid ───────────────────────────────────────────────────────────────────
  g.append('g')
    .call(d3.axisLeft(yScale).ticks(5).tickSize(-W).tickFormat(''))
    .call(ax => ax.select('.domain').remove())
    .call(ax => ax.selectAll('line')
      .attr('stroke', 'rgba(255,255,255,0.08)')
      .attr('stroke-dasharray', '3,3'));

  // ── Gradient def ───────────────────────────────────────────────────────────
  const color = genre !== 'all' ? (GENRE_COLORS[genre] || '#668bff') : '#668bff';
  const gradId = 'prod-grad-' + genre.replace(/\s/g, '');
  const defs = svg.append('defs');
  const grad = defs.append('linearGradient')
    .attr('id', gradId)
    .attr('x1', '0').attr('y1', '0')
    .attr('x2', '0').attr('y2', '1');
  grad.append('stop').attr('offset', '0%').attr('stop-color', color).attr('stop-opacity', 0.35);
  grad.append('stop').attr('offset', '100%').attr('stop-color', color).attr('stop-opacity', 0.02);

  // ── Area fill ──────────────────────────────────────────────────────────────
  const areaGen = d3.area()
    .x(d => xScale(d.year))
    .y0(H)
    .y1(d => yScale(d.count))
    .curve(d3.curveCatmullRom.alpha(0.5));

  g.append('path')
    .datum(chartData)
    .attr('fill', `url(#${gradId})`)
    .attr('d', areaGen);

  // ── Line ───────────────────────────────────────────────────────────────────
  const lineGen = d3.line()
    .x(d => xScale(d.year))
    .y(d => yScale(d.count))
    .curve(d3.curveCatmullRom.alpha(0.5));

  g.append('path')
    .datum(chartData)
    .attr('fill', 'none')
    .attr('stroke', color)
    .attr('stroke-width', 2.5)
    .attr('stroke-linecap', 'round')
    .attr('d', lineGen);

  // ── Axes ───────────────────────────────────────────────────────────────────
  g.append('g')
    .attr('transform', `translate(0,${H})`)
    .call(d3.axisBottom(xScale).ticks(8).tickFormat(d3.format('d')))
    .call(ax => ax.select('.domain').attr('stroke', 'rgba(255,255,255,0.3)'))
    .call(ax => ax.selectAll('text').attr('fill', 'rgba(255,255,255,0.6)').attr('font-size', '11px'))
    .call(ax => ax.selectAll('line').attr('stroke', 'rgba(255,255,255,0.2)'));

  g.append('g')
    .call(d3.axisLeft(yScale).ticks(5).tickFormat(d => d >= 1000 ? (d / 1000).toFixed(0) + 'k' : d))
    .call(ax => ax.select('.domain').attr('stroke', 'rgba(255,255,255,0.3)'))
    .call(ax => ax.selectAll('text').attr('fill', 'rgba(255,255,255,0.6)').attr('font-size', '11px'))
    .call(ax => ax.selectAll('line').attr('stroke', 'rgba(255,255,255,0.2)'));

  // ── Hover ──────────────────────────────────────────────────────────────────
  const tooltip = d3.select('body').append('div')
    .style('position', 'fixed')
    .style('background', 'rgba(14,18,28,0.96)')
    .style('color', '#d9dce4')
    .style('padding', '8px 13px')
    .style('border-radius', '7px')
    .style('font-size', '13px')
    .style('pointer-events', 'none')
    .style('display', 'none')
    .style('border', '1px solid rgba(255,255,255,0.15)')
    .style('box-shadow', '0 4px 16px rgba(0,0,0,0.5)')
    .style('z-index', '9999')
    .style('line-height', '1.6');

  const bisect = d3.bisector(d => d.year).left;

  const dot = g.append('circle')
    .attr('r', 5)
    .attr('fill', '#fff')
    .attr('stroke', color)
    .attr('stroke-width', 2)
    .style('display', 'none')
    .style('pointer-events', 'none');

  const vLine = g.append('line')
    .attr('stroke', 'rgba(255,255,255,0.25)')
    .attr('stroke-width', 1)
    .attr('stroke-dasharray', '4,3')
    .attr('y1', 0).attr('y2', H)
    .style('display', 'none')
    .style('pointer-events', 'none');

  g.append('rect')
    .attr('width', W).attr('height', H)
    .attr('fill', 'transparent')
    .on('mousemove', function(event) {
      const [mx] = d3.pointer(event, this);
      const year = Math.round(xScale.invert(mx));
      const idx  = Math.min(bisect(chartData, year, 0), chartData.length - 1);
      const d    = chartData[idx];
      if (!d) return;

      dot.style('display', null).attr('cx', xScale(d.year)).attr('cy', yScale(d.count));
      vLine.style('display', null).attr('x1', xScale(d.year)).attr('x2', xScale(d.year));

      tooltip
        .style('display', 'block')
        .style('left', (event.clientX + 14) + 'px')
        .style('top',  (event.clientY - 10) + 'px')
        .html(`
          <span style="color:rgba(255,255,255,0.5)">${d.year}</span><br/>
          <strong>${d.count.toLocaleString()}</strong> movies
          ${genre !== 'all' ? `<span style="color:${color}"> (${genre})</span>` : ''}
        `);
    })
    .on('mouseleave', function() {
      dot.style('display', 'none');
      vLine.style('display', 'none');
      tooltip.style('display', 'none');
    });
}

function drawGenres() {
  const container = document.querySelector('.genre-chart');
  if (!container || !data.genresByYear) return;
  container.innerHTML = '';

  const genres = Object.keys(data.genresByYear[0])
      .filter(k => k !== 'year')
      .sort((a, b) =>
          d3.sum(data.genresByYear, d => d[b]) - d3.sum(data.genresByYear, d => d[a])
      );

  const margin = { top: 30, right: 30, bottom: 40, left: 55 };
  const totalW = container.offsetWidth || 700;
  const totalH = 380;
  const W = totalW - margin.left - margin.right;
  const H = totalH - margin.top - margin.bottom;

  // ── SVG ───────────────────────────────────────────────────────────────────
  const svg = d3.select(container)
    .append('svg')
    .attr('width', totalW)
    .attr('height', totalH)
    .style('display', 'block');

  const g = svg.append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  // ── Scales ────────────────────────────────────────────────────────────────
  const xScale = d3.scaleLinear()
    .domain(d3.extent(data.genresByYear, d => d.year))
    .range([0, W]);

  const stack = d3.stack()
    .keys(genres)
    .order(d3.stackOrderNone)
    .offset(d3.stackOffsetNone);

  const series = stack(data.genresByYear);

  const yMax = d3.max(series, s => d3.max(s, d => d[1]));
  const yScale = d3.scaleLinear()
    .domain([0, yMax])
    .range([H, 0]);

  // ── Smooth area generator ─────────────────────────────────────────────────
  const area = d3.area()
    .x(d => xScale(d.data.year))
    .y0(d => yScale(d[0]))
    .y1(d => yScale(d[1]))
    .curve(d3.curveCatmullRom.alpha(0.5));

  // ── Grid lines ────────────────────────────────────────────────────────────
  g.append('g')
    .attr('class', 'grid')
    .call(
      d3.axisLeft(yScale)
        .ticks(5)
        .tickSize(-W)
        .tickFormat('')
    )
    .call(ax => ax.select('.domain').remove())
    .call(ax => ax.selectAll('line')
      .attr('stroke', 'rgba(255,255,255,0.08)')
      .attr('stroke-dasharray', '3,3'));

  // ── Areas ─────────────────────────────────────────────────────────────────
  const paths = g.selectAll('.area-path')
    .data(series)
    .join('path')
    .attr('class', 'area-path')
    .attr('d', area)
    .attr('fill', d => GENRE_COLORS[d.key] || '#999')
    .attr('fill-opacity', 0.85)
    .attr('stroke', d => GENRE_COLORS[d.key] || '#999')
    .attr('stroke-width', 0.5)
    .style('cursor', 'pointer')
    .style('transition', 'fill-opacity 0.25s');

  // ── Tooltip ───────────────────────────────────────────────────────────────
  const tooltip = d3.select('body').append('div')
    .style('position', 'fixed')
    .style('background', 'rgba(14,18,28,0.96)')
    .style('color', '#d9dce4')
    .style('padding', '9px 14px')
    .style('border-radius', '7px')
    .style('font-size', '13px')
    .style('pointer-events', 'none')
    .style('display', 'none')
    .style('border', '1px solid rgba(255,255,255,0.15)')
    .style('box-shadow', '0 4px 16px rgba(0,0,0,0.5)')
    .style('z-index', '9999')
    .style('line-height', '1.6');

  // ── Vertical hover line ───────────────────────────────────────────────────
  const hoverLine = g.append('line')
    .attr('stroke', 'rgba(255,255,255,0.35)')
    .attr('stroke-width', 1.5)
    .attr('stroke-dasharray', '4,3')
    .attr('y1', 0).attr('y2', H)
    .style('display', 'none')
    .style('pointer-events', 'none');

  // ── Hover overlay ─────────────────────────────────────────────────────────
  g.append('rect')
    .attr('width', W).attr('height', H)
    .attr('fill', 'transparent')
    .on('mousemove', function (event) {
      const [mx, my] = d3.pointer(event, this);
      const year = Math.round(xScale.invert(mx));

      // Find which layer the mouse is in
      let hoveredKey = null;
      for (const s of [...series].reverse()) {
        const bisect = d3.bisector(d => d.data.year).left;
        const idx = bisect(s, year, 0, s.length - 1);
        const pt = s[idx] || s[s.length - 1];
        if (pt && my >= yScale(pt[1]) && my <= yScale(pt[0])) {
          hoveredKey = s.key;
          break;
        }
      }

      // Highlight hovered, fade others
      paths.attr('fill-opacity', d => {
        if (!hoveredKey) return activeGenreFilter ? (d.key === activeGenreFilter ? 1 : 0.18) : 0.85;
        return d.key === hoveredKey ? 1 : 0.18;
      });

      hoverLine
        .style('display', null)
        .attr('x1', mx).attr('x2', mx);

      if (hoveredKey) {
        const bisect = d3.bisector(d => d.data.year).left;
        const s = series.find(s => s.key === hoveredKey);
        const idx = bisect(s, year, 0, s.length - 1);
        const pt = s[idx] || s[s.length - 1];
        const count = pt ? Math.round(pt[1] - pt[0]) : 0;
        const color = GENRE_COLORS[hoveredKey] || '#999';

        tooltip
          .style('display', 'block')
          .style('left', (event.clientX + 14) + 'px')
          .style('top', (event.clientY - 10) + 'px')
          .html(`
            <span style="display:inline-block;width:10px;height:10px;border-radius:50%;
              background:${color};margin-right:6px;vertical-align:middle"></span>
            <strong>${hoveredKey}</strong><br/>
            <span style="color:#aaa">${year}</span> — ${count.toLocaleString()} films
          `);
      } else {
        tooltip.style('display', 'none');
      }
    })
    .on('mouseleave', function () {
      paths.attr('fill-opacity', d =>
        activeGenreFilter ? (d.key === activeGenreFilter ? 1 : 0.18) : 0.85
      );
      hoverLine.style('display', 'none');
      tooltip.style('display', 'none');
    })
    .on('click', function (event) {
      const [mx, my] = d3.pointer(event, this);
      const year = Math.round(xScale.invert(mx));

      let clickedKey = null;
      for (const s of [...series].reverse()) {
        const bisect = d3.bisector(d => d.data.year).left;
        const idx = bisect(s, year, 0, s.length - 1);
        const pt = s[idx] || s[s.length - 1];
        if (pt && my >= yScale(pt[1]) && my <= yScale(pt[0])) {
          clickedKey = s.key;
          break;
        }
      }

      if (activeGenreFilter === clickedKey) {
        activeGenreFilter = null;
        paths.attr('fill-opacity', 0.85);
        updateLegendHighlight(null);
        applyGenreFilter(null);
      } else {
        activeGenreFilter = clickedKey;
        paths.attr('fill-opacity', d => d.key === clickedKey ? 1 : 0.18);
        updateLegendHighlight(clickedKey);
        applyGenreFilter(clickedKey);
      }
    });

  // ── Axes ──────────────────────────────────────────────────────────────────
  g.append('g')
    .attr('transform', `translate(0,${H})`)
    .call(d3.axisBottom(xScale).ticks(8).tickFormat(d3.format('d')))
    .call(ax => ax.select('.domain').attr('stroke', 'rgba(255,255,255,0.3)'))
    .call(ax => ax.selectAll('text').attr('fill', 'rgba(255,255,255,0.6)').attr('font-size', '11px'))
    .call(ax => ax.selectAll('line').attr('stroke', 'rgba(255,255,255,0.2)'));

  g.append('g')
    .call(d3.axisLeft(yScale).ticks(5).tickFormat(d => d >= 1000 ? (d / 1000).toFixed(0) + 'k' : d))
    .call(ax => ax.select('.domain').attr('stroke', 'rgba(255,255,255,0.3)'))
    .call(ax => ax.selectAll('text').attr('fill', 'rgba(255,255,255,0.6)').attr('font-size', '11px'))
    .call(ax => ax.selectAll('line').attr('stroke', 'rgba(255,255,255,0.2)'));

  // ── Legend highlight helper (hoisted so click handler can use it) ─────────
  let legendWrap = null;

  function updateLegendHighlight(activeGenre) {
    if (!legendWrap) return;
    legendWrap.querySelectorAll('span').forEach(s => {
      if (!activeGenre) {
        s.style.borderColor = 'transparent';
        s.style.opacity = '1';
      } else {
        const isActive = s.dataset.genre === activeGenre;
        s.style.borderColor = isActive ? (GENRE_COLORS[activeGenre] || '#999') : 'transparent';
        s.style.opacity = isActive ? '1' : '0.45';
      }
    });
  }

  // ── Legend ────────────────────────────────────────────────────────────────
  const legendEl = document.getElementById('genre-legend');
  if (legendEl) {
    legendEl.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:10px;margin-top:12px';
    legendWrap = wrap; // expose to updateLegendHighlight

    genres.forEach(genre => {
      const item = document.createElement('span');
      item.style.cssText = `
        display:flex;align-items:center;gap:6px;
        font-size:0.85rem;color:#d9dce4;
        cursor:pointer;padding:4px 8px;border-radius:4px;
        border:1px solid transparent;transition:border-color 0.2s,opacity 0.2s
      `;
      item.dataset.genre = genre;

      const dot = document.createElement('div');
      dot.style.cssText = `
        width:10px;height:10px;border-radius:50%;
        background:${GENRE_COLORS[genre] || '#999'};flex-shrink:0
      `;
      item.appendChild(dot);
      item.appendChild(document.createTextNode(genre));

      item.addEventListener('click', () => {
        if (activeGenreFilter === genre) {
          activeGenreFilter = null;
          paths.attr('fill-opacity', 0.85);
          updateLegendHighlight(null);
          applyGenreFilter(null);
        } else {
          activeGenreFilter = genre;
          paths.attr('fill-opacity', d => d.key === genre ? 1 : 0.18);
          updateLegendHighlight(genre);
          applyGenreFilter(genre);
        }
      });

      wrap.appendChild(item);
    });

    legendEl.appendChild(wrap);
  }
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
    const val = (maxRating - (i / 4) * range).toFixed(1);
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

function drawFinance(decade = 'all', genreFilter = null) {
  const container = document.querySelector('.finance-chart');
  if (!container) return;
  container.innerHTML = '';

  let filtered = data.finance;
  if (decade !== 'all') {
    const decNum = parseInt(decade, 10);
    filtered = filtered.filter(m => m.decade >= decNum && m.decade < decNum + 10);
  }
  if (genreFilter) filtered = filtered.filter(m => m.primary_genre === genreFilter);

  const grouped = Array.from(d3.group(filtered, d => d.primary_genre), ([genre, rows]) => ({
    genre,
    budget: d3.median(rows, d => d.budget) || 0,
    revenue: d3.median(rows, d => d.revenue) || 0,
    totalRevenue: d3.sum(rows, d => d.revenue) || 0,
    medianRoi: d3.median(rows, d => d.roi) || 0,
    count: rows.length,
    movies: rows
  })).filter(d => d.budget > 0 && d.revenue > 0);

  const totalW = container.offsetWidth || 700;
  const totalH = Math.max(340, Math.min(460, Math.round(totalW * 0.5)));
  const margin = { top: 30, right: 24, bottom: 48, left: 70 };
  const W = totalW - margin.left - margin.right;
  const H = totalH - margin.top - margin.bottom;

  const svg = d3.select(container).append('svg').attr('width', totalW).attr('height', totalH);
  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  if (!grouped.length) {
    g.append('text').attr('x', W / 2).attr('y', H / 2).attr('fill', '#aaa').attr('text-anchor', 'middle').text('No finance data for this filter');
    renderTopRoiList([]);
    return;
  }

  const x = d3.scaleLog().domain([1e5, d3.max(grouped, d => d.budget) * 1.15]).range([0, W]);
  const y = d3.scaleLog().domain([1e5, d3.max(grouped, d => d.revenue) * 1.15]).range([H, 0]);
  const r = d3.scaleSqrt().domain([0, d3.max(grouped, d => d.count)]).range([5, 24]);

  g.append('g')
    .attr('transform', `translate(0,${H})`)
    .call(d3.axisBottom(x).ticks(6, '~s'))
    .call(ax => ax.selectAll('text').attr('fill', 'rgba(255,255,255,0.7)').attr('font-size', '11px'))
    .call(ax => ax.selectAll('line,.domain').attr('stroke', 'rgba(255,255,255,0.25)'));

  g.append('g')
    .call(d3.axisLeft(y).ticks(6, '~s'))
    .call(ax => ax.selectAll('text').attr('fill', 'rgba(255,255,255,0.7)').attr('font-size', '11px'))
    .call(ax => ax.selectAll('line,.domain').attr('stroke', 'rgba(255,255,255,0.25)'));

  g.append('text').attr('x', W / 2).attr('y', H + 38).attr('text-anchor', 'middle').attr('fill', 'rgba(255,255,255,0.75)').text('Median budget');
  g.append('text').attr('transform', `translate(-48,${H / 2}) rotate(-90)`).attr('text-anchor', 'middle').attr('fill', 'rgba(255,255,255,0.75)').text('Median revenue');
  g.append('text').attr('x', W / 2).attr('y', -10).attr('text-anchor', 'middle').attr('fill', 'rgba(255,255,255,0.62)').attr('font-size', '11px').text('Only movies with meaningful financial data are included.');

  d3.selectAll('.finance-tooltip').remove();
  const tooltip = d3.select('body').append('div')
    .attr('class', 'finance-tooltip')
    .style('position', 'fixed')
    .style('background', 'rgba(14,18,28,0.97)')
    .style('color', '#e5e8f0')
    .style('padding', '8px 12px')
    .style('border-radius', '7px')
    .style('font-size', '12px')
    .style('display', 'none')
    .style('pointer-events', 'none')
    .style('border', '1px solid rgba(255,255,255,0.15)')
    .style('z-index', '9999');

  const nodes = grouped
    .sort((a, b) => b.count - a.count)
    .map(d => ({
      ...d,
      x: x(d.budget),
      y: y(d.revenue)
    }));

  d3.forceSimulation(nodes)
    .force('x', d3.forceX(d => x(d.budget)).strength(0.25))
    .force('y', d3.forceY(d => y(d.revenue)).strength(0.25))
    .force('collide', d3.forceCollide(d => r(d.count) + 2))
    .stop()
    .tick(120);

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const moneyInMillions = d3.format(',.1f');
  const maxAbsRoi = d3.max(nodes, d => Math.abs(d.medianRoi)) || 1;
  const glowScale = d3.scaleLinear().domain([0, maxAbsRoi]).range([0.28, 0.78]).clamp(true);
  const glowSize = d3.scaleLinear().domain([0, maxAbsRoi]).range([4, 12]).clamp(true);

  g.selectAll('circle')
    .data(nodes)
    .join('circle')
    .attr('cx', d => clamp(d.x, r(d.count), W - r(d.count)))
    .attr('cy', d => clamp(d.y, r(d.count), H - r(d.count)))
    .attr('r', d => r(d.count))
    .attr('fill', d => GENRE_COLORS[d.genre] || '#999')
    .attr('fill-opacity', 0.44)
    .attr('stroke', '#ffffff')
    .attr('stroke-opacity', 0.95)
    .attr('stroke-width', 1.35)
    .style('filter', d => {
      const c = d3.color(GENRE_COLORS[d.genre] || '#999999');
      const alpha = glowScale(Math.abs(d.medianRoi));
      const blur = glowSize(Math.abs(d.medianRoi));
      return `drop-shadow(0 0 ${blur}px rgba(${c.r}, ${c.g}, ${c.b}, ${alpha}))`;
    })
    .style('cursor', 'pointer')
    .on('mousemove', function(event, d) {
      tooltip
        .style('display', 'block')
        .style('left', `${event.clientX + 14}px`)
        .style('top', `${event.clientY - 10}px`)
        .html(`<strong>${d.genre}</strong><br/>Median budget: $${moneyInMillions(d.budget / 1e6)}M<br/>Median revenue: $${moneyInMillions(d.revenue / 1e6)}M<br/>Movies: ${d.count}`);
    })
    .on('mouseleave', () => tooltip.style('display', 'none'))
    .on('click', function(_, d) {
      g.selectAll('circle').attr('stroke-width', 1.2).attr('stroke', 'rgba(255,255,255,0.8)');
      d3.select(this).attr('stroke-width', 2.5).attr('stroke', '#f8cf7a');
      renderTopRoiList(d.movies, d.genre);
    });

  createLegend('.finance-chart', grouped.map(d => d.genre));
  renderTopRoiList([]);
}

function renderTopRoiList(movies, genre = null) {
  const wrap = document.getElementById('finance-top-roi');
  if (!wrap) return;

  if (!movies.length) {
    wrap.innerHTML = '<p class="finance-top-roi-title">Click a bubble to see the top ROI movies in that genre and period.</p>';
    return;
  }

  const rows = [...movies]
    .filter(m => Number.isFinite(m.roi))
    .sort((a, b) => b.roi - a.roi)
    .slice(0, 20);

  wrap.innerHTML = `<p class="finance-top-roi-title">Top ROI films — ${genre}</p>${rows.map((m, i) =>
    `<div class="finance-top-roi-item"><span>${i + 1}. ${m.title} (${m.year})</span><span>${m.roi.toFixed(1)}%</span></div>`
  ).join('')}`;
}

/* ─────────────────────────────────────────────
   REPRESENTATIVE MOVIES PANEL
   ───────────────────────────────────────────── */

let activeMovieDecade = 'all';

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

  card.addEventListener('mouseenter', () => card.style.transform = 'translateY(-6px)');
  card.addEventListener('mouseleave', () => card.style.transform = '');

  return card;
}

function setupMovieDecadeButtons() {
  const section = document.getElementById('movies');
  if (!section) return;

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

/* ─────────────────────────────────────────────
   CANVAS HELPERS
   ───────────────────────────────────────────── */

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
      drawFinance(btn.getAttribute('data-decade'), activeGenreFilter);
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
   ════════════════════════════════════════════════════════ */

const ERA_GENRE_BY_DECADE = {
  1990: 'Drama', 2000: 'Drama', 2010: 'Drama', 2020: 'Drama',
};

const ERA_BLOCKBUSTER_BY_DECADE = {
  1990: { title: 'Titanic', revenue: 2.26 },
  2000: { title: 'Avatar', revenue: 2.92 },
  2010: { title: 'Avengers: Endgame', revenue: 2.80 },
  2020: { title: 'Avatar: The Way of Water', revenue: 2.35 },
};

function initEraPersonalizer() {
  const slider = document.getElementById('birth-year-slider');
  const yearLabel = document.getElementById('era-selected-year');
  if (!slider) return;

  const prodByYear = {};
  const ratingByYear = {};

  data.production.forEach(d => { prodByYear[d.year] = d.count; });
  data.ratings.forEach(d => { ratingByYear[d.year] = d.rating; });

  const blockbusterByDecade = {};
  data.finance.forEach(m => {
    if (!m.revenue || m.revenue <= 0) return;
    const d = m.decade;
    if (!blockbusterByDecade[d] || m.revenue > blockbusterByDecade[d].revenue) {
      blockbusterByDecade[d] = { title: m.title, revenue: m.revenue };
    }
  });

  const EXCLUDE_GENRES = new Set(['Documentary', 'TV Movie']);
  const genreByDecade = {};
  data.genres.forEach(d => {
    const filtered = d.genres.filter(g => !EXCLUDE_GENRES.has(g.name));
    if (filtered.length) {
      const top = filtered.reduce((a, b) => a.count > b.count ? a : b);
      genreByDecade[d.decade] = top.name;
    }
  });

  drawEraSparkline(prodByYear);
  updateEra(parseInt(slider.value));

  let rafId;
  slider.addEventListener('input', () => {
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(() => updateEra(parseInt(slider.value)));
  });

  function updateEra(year) {
    yearLabel.textContent = year;

    const decade = Math.floor(year / 10) * 10;
    const films = prodByYear[year] ?? null;
    const rating = ratingByYear[year] ?? null;
    const genre = genreByDecade[decade] ?? '—';
    const block = blockbusterByDecade[decade];

    animateCount('estat-films', '.era-count:not(.era-decimal)', films, false);

    const genreEl = document.getElementById('era-genre-val');
    if (genreEl) fadeTextUpdate(genreEl, genre);

    animateCount('estat-rating', '.era-decimal', rating, true);

    const blockEl = document.getElementById('era-blockbuster-val');
    if (blockEl && block) {
      fadeTextUpdate(blockEl,
        `${block.title} <span style="color:var(--gold);font-size:0.75em">$${(block.revenue / 1e9).toFixed(2)}B</span>`
      );
    }

    updateEraMarker(year);

    document.querySelectorAll('.era-stat-card').forEach(c => {
      c.classList.remove('era-pop');
      void c.offsetWidth;
      c.classList.add('era-pop');
    });
  }

  function animateCount(cardId, selector, target, isDecimal) {
    if (target === null) return;
    const card = document.getElementById(cardId);
    if (!card) return;
    const el = card.querySelector(selector);
    if (!el) return;

    const start = parseFloat(el.textContent.replace(/,/g, '')) || 0;
    const end = target;
    const dur = 500;
    const t0 = performance.now();

    function tick(now) {
      const progress = Math.min((now - t0) / dur, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      const val = start + (end - start) * ease;
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

function drawEraSparkline(prodByYear) {
  const svg = document.getElementById('era-sparkline');
  if (!svg) return;

  const W = svg.parentElement.clientWidth || 700;
  const H = 90;
  const PAD = { top: 8, right: 16, bottom: 22, left: 40 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const years = Object.keys(prodByYear).map(Number).sort((a, b) => a - b);
  const counts = years.map(y => prodByYear[y]);
  const maxY = Math.max(...counts);

  const xScale = y => PAD.left + ((y - years[0]) / (years[years.length - 1] - years[0])) * plotW;
  const yScale = v => PAD.top + plotH - (v / maxY) * plotH;

  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);

  [0.25, 0.5, 0.75, 1].forEach(f => {
    const y = PAD.top + plotH * (1 - f);
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', PAD.left); line.setAttribute('x2', W - PAD.right);
    line.setAttribute('y1', y); line.setAttribute('y2', y);
    line.setAttribute('stroke', 'rgba(255,255,255,0.06)');
    line.setAttribute('stroke-width', '1');
    svg.appendChild(line);
    const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    txt.setAttribute('x', PAD.left - 6); txt.setAttribute('y', y + 4);
    txt.setAttribute('text-anchor', 'end');
    txt.setAttribute('fill', 'rgba(255,255,255,0.3)');
    txt.setAttribute('font-size', '9');
    txt.textContent = Math.round(maxY * f / 1000) + 'k';
    svg.appendChild(txt);
  });

  const areaPoints = [
    `${xScale(years[0])},${PAD.top + plotH}`,
    ...years.map(y => `${xScale(y)},${yScale(prodByYear[y])}`),
    `${xScale(years[years.length - 1])},${PAD.top + plotH}`
  ].join(' ');
  const area = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
  area.setAttribute('points', areaPoints);
  area.setAttribute('fill', 'url(#eraAreaGrad)');
  area.setAttribute('opacity', '0.4');

  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  defs.innerHTML = `
    <linearGradient id="eraAreaGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#d7b46a" stop-opacity="0.6"/>
      <stop offset="100%" stop-color="#d7b46a" stop-opacity="0.02"/>
    </linearGradient>`;
  svg.appendChild(defs);
  svg.appendChild(area);

  const pathD = years.map((y, i) =>
    `${i === 0 ? 'M' : 'L'}${xScale(y)},${yScale(prodByYear[y])}`
  ).join(' ');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', pathD);
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', '#d7b46a');
  path.setAttribute('stroke-width', '2');
  path.setAttribute('stroke-linejoin', 'round');
  svg.appendChild(path);

  const labelYears = years.filter(y => y % 5 === 0);
  labelYears.forEach(y => {
    const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    txt.setAttribute('x', xScale(y)); txt.setAttribute('y', H - 4);
    txt.setAttribute('text-anchor', 'middle');
    txt.setAttribute('fill', 'rgba(255,255,255,0.3)');
    txt.setAttribute('font-size', '9');
    txt.textContent = y;
    svg.appendChild(txt);
  });

  const markerG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  markerG.setAttribute('id', 'era-marker');

  const markerLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  markerLine.setAttribute('id', 'era-marker-line');
  markerLine.setAttribute('stroke', '#fff');
  markerLine.setAttribute('stroke-width', '1.5');
  markerLine.setAttribute('stroke-dasharray', '3 3');
  markerLine.setAttribute('y1', PAD.top); markerLine.setAttribute('y2', PAD.top + plotH);

  const markerDot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  markerDot.setAttribute('id', 'era-marker-dot');
  markerDot.setAttribute('r', '5');
  markerDot.setAttribute('fill', '#fff');
  markerDot.setAttribute('stroke', '#d7b46a');
  markerDot.setAttribute('stroke-width', '2');

  markerG.appendChild(markerLine);
  markerG.appendChild(markerDot);
  svg.appendChild(markerG);

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
  const dot = document.getElementById('era-marker-dot');
  if (line) { line.setAttribute('x1', x); line.setAttribute('x2', x); }
  if (dot) { dot.setAttribute('cx', x); dot.setAttribute('cy', y); }
}

/* ═══════════════════════════════════════════════════════════════
   CINEMATIC ADDITIONS
   ═══════════════════════════════════════════════════════════════ */

function initCountdownLoader() {
  const loader = document.getElementById('countdown-loader');
  if (!loader) return;
  setTimeout(() => {
    loader.style.display = 'none';
  }, 1950);
}

function initCinematicLampIntro() {
  const intro = document.getElementById('cinematic-intro');
  const flash = document.getElementById('intro-flash');
  if (!intro || !flash) return;

  document.body.classList.add('intro-playing');

  const existingCountdown = document.getElementById('countdown-loader');
  if (existingCountdown) {
    existingCountdown.remove();
  }

  intro.classList.add('play');

  flash.addEventListener('animationend', () => {
    intro.classList.add('done');
    setTimeout(() => {
      intro.remove();
      document.body.classList.remove('intro-playing');
    }, 460);
  }, { once: true });
}

initCountdownLoader();

/* ═══════════════════════════════════════════════════════════════════════
   POPULARITY vs QUALITY HEATMAP
   ═══════════════════════════════════════════════════════════════════════ */

(function () {

  // ── Colour scale: cream → sage → teal → steel-blue → navy ─────────────
  // Matches the palette in the hand-drawn sketch.
  const HM_STOPS = [
    [0.00,  [245, 240, 220]],   // warm cream
    [0.15,  [214, 232, 208]],   // sage green
    [0.35,  [158, 207, 192]],   // muted teal
    [0.55,  [ 91, 158, 201]],   // sky blue
    [0.75,  [ 33, 102, 168]],   // medium blue
    [1.00,  [ 11,  61, 122]],   // deep navy
  ];

  function lerpColour(t) {
    t = Math.max(0, Math.min(1, t));
    let lo = HM_STOPS[0], hi = HM_STOPS[HM_STOPS.length - 1];
    for (let i = 0; i < HM_STOPS.length - 1; i++) {
      if (t >= HM_STOPS[i][0] && t <= HM_STOPS[i + 1][0]) {
        lo = HM_STOPS[i]; hi = HM_STOPS[i + 1]; break;
      }
    }
    const range = hi[0] - lo[0] || 1;
    const u = (t - lo[0]) / range;
    const r = Math.round(lo[1][0] + (hi[1][0] - lo[1][0]) * u);
    const g = Math.round(lo[1][1] + (hi[1][1] - lo[1][1]) * u);
    const b = Math.round(lo[1][2] + (hi[1][2] - lo[1][2]) * u);
    return `rgb(${r},${g},${b})`;
  }

  // ── State ──────────────────────────────────────────────────────────────
  let hmData = null;     // { all, 1990s, 2000s, 2010s }
  let hmMeta = null;     // { genres, rating_bins, min, max }
  let hmDecade = 'all';

  const RATING_LABELS = ['1','2','3','4','5','6','7','8','9','10'];
  const DECADE_LABELS  = { all: 'All time', '1990s': '1990s', '2000s': '2000s', '2010s': '2010s' };

  // ── Load data ──────────────────────────────────────────────────────────
  Promise.all([
    fetch('data/popularity_quality.json').then(r => r.json()),
    fetch('data/heatmap_meta.json').then(r => r.json()),
  ]).then(([pq, meta]) => {
    hmData = pq;
    hmMeta = meta;
    buildHeatmapUI();
    renderHeatmap(hmDecade);
  }).catch(err => {
    console.warn('[Heatmap] Could not load data:', err);
    // Render a placeholder so the section still looks good
    renderHeatmapPlaceholder();
  });

  // ── Build static UI (genre labels, tick marks, decade buttons) ─────────
  function buildHeatmapUI() {
    const genres     = hmMeta.genres;        // ["Comedy","Action",...]
    const ratingBins = hmMeta.rating_bins;   // ["1",..."10"]

    // CSS var for column count
    const grid = document.getElementById('heatmap-grid');
    const ticks = document.getElementById('heatmap-x-ticks');
    if (!grid) return;
    grid.style.setProperty('--hm-cols', ratingBins.length);
    if (ticks) ticks.style.setProperty('--hm-cols', ratingBins.length);

    // Genre labels
    const labelsEl = document.getElementById('heatmap-genre-labels');
    if (labelsEl) {
      labelsEl.innerHTML = '';
      genres.forEach(g => {
        const div = document.createElement('div');
        div.className = 'heatmap-genre-label';
        div.textContent = g;
        div.dataset.genre = g;
        labelsEl.appendChild(div);
      });
    }

    // Rating tick labels
    if (ticks) {
      ticks.innerHTML = '';
      ratingBins.forEach(b => {
        const span = document.createElement('span');
        span.className = 'hm-tick';
        span.textContent = b;
        ticks.appendChild(span);
      });
      // Offset ticks to align with the grid (skip genre-label column width)
      alignTicks();
    }

    // Decade buttons
    document.querySelectorAll('#heatmap-decades .chip').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#heatmap-decades .chip')
          .forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        hmDecade = btn.getAttribute('data-hd');
        const badge = document.getElementById('heatmap-decade-badge');
        if (badge) badge.textContent = DECADE_LABELS[hmDecade] || hmDecade;
        renderHeatmap(hmDecade);
      });
    });
  }

  function alignTicks() {
    const labelsEl = document.getElementById('heatmap-genre-labels');
    const ticks    = document.getElementById('heatmap-x-ticks');
    if (!labelsEl || !ticks) return;
    const w = labelsEl.offsetWidth + 12; // 12 = gap
    ticks.style.paddingLeft = w + 'px';
  }

  // ── Render ─────────────────────────────────────────────────────────────
  function renderHeatmap(decade) {
    const grid = document.getElementById('heatmap-grid');
    if (!grid || !hmData || !hmMeta) return;

    const decadeData  = hmData[decade] || hmData['all'] || {};
    const genres      = hmMeta.genres;
    const ratingBins  = hmMeta.rating_bins;
    const globalMin   = hmMeta.min;
    const globalMax   = hmMeta.max;
    const valueRange  = globalMax - globalMin || 1;

    grid.innerHTML = '';

    // Compute per-decade max for local contrast boost (optional but looks better)
    let localMax = 0;
    genres.forEach(g => ratingBins.forEach(b => {
      const v = (decadeData[g] || {})[b] || 0;
      if (v > localMax) localMax = v;
    }));
    // Blend global and local max so scale is meaningful but not washed out
    const scaleMax = globalMax * 0.6 + localMax * 0.4;

    const tooltip  = document.getElementById('heatmap-tooltip');

    genres.forEach((genre, gi) => {
      ratingBins.forEach((bin, bi) => {
        const raw  = (decadeData[genre] || {})[bin] || 0;
        const t    = Math.max(0, Math.min(1, (raw - globalMin) / (scaleMax - globalMin || 1)));
        const colour = raw > 0 ? lerpColour(t) : 'rgba(255,255,255,0.04)';

        const cell = document.createElement('div');
        cell.className    = 'hm-cell';
        cell.dataset.genre  = genre;
        cell.dataset.bin    = bin;
        cell.dataset.row    = gi;
        // Stagger animation so cells pop in left→right, top→bottom
        cell.style.animationDelay = `${(gi * ratingBins.length + bi) * 12}ms`;
        cell.style.background = colour;
        if (raw > 0) {
          // Border colour = slightly lighter version of fill
          cell.style.borderColor = lerpColour(Math.min(1, t + 0.15));
        }

        // ── Tooltip ─────────────────────────────────────────────────────
        cell.addEventListener('mouseenter', (e) => {
          if (!tooltip) return;

          // Highlight row
          grid.classList.add('row-hover');
          grid.querySelectorAll('.hm-cell').forEach(c => {
            c.classList.toggle('hovered-row', c.dataset.row === String(gi));
          });
          document.querySelectorAll('.heatmap-genre-label').forEach(l => {
            l.classList.toggle('heatmap-row-hover', l.dataset.genre === genre);
          });

          const starCount = Math.round((parseInt(bin) / 10) * 5);
          const stars = '★'.repeat(starCount) + '☆'.repeat(5 - starCount);
          const displayVal = raw > 0
            ? `${Math.round(Math.exp(raw) - 1).toLocaleString()}`
            : '—';

          tooltip.innerHTML = `
            <strong>${genre}</strong><br/>
            Rating ${bin}/10 &nbsp;${stars}<br/>
            Popularity score: <strong>${displayVal}</strong>
          `;
          tooltip.style.display = 'block';
          positionTooltip(e);
        });

        cell.addEventListener('mousemove', positionTooltip);

        cell.addEventListener('mouseleave', () => {
          if (tooltip) tooltip.style.display = 'none';
          grid.classList.remove('row-hover');
          grid.querySelectorAll('.hm-cell').forEach(c => c.classList.remove('hovered-row'));
          document.querySelectorAll('.heatmap-genre-label').forEach(l => l.classList.remove('heatmap-row-hover'));
        });

        grid.appendChild(cell);
      });
    });

    // Re-sync genre label heights after render
    syncGenreLabelHeights(genres.length, ratingBins.length);
    alignTicks();
  }

  function positionTooltip(e) {
    const tooltip = document.getElementById('heatmap-tooltip');
    if (!tooltip) return;
    tooltip.style.left = (e.clientX + 16) + 'px';
    tooltip.style.top  = (e.clientY - 10) + 'px';
    // Flip if near right edge
    if (e.clientX + tooltip.offsetWidth + 20 > window.innerWidth) {
      tooltip.style.left = (e.clientX - tooltip.offsetWidth - 12) + 'px';
    }
  }

  function syncGenreLabelHeights(numGenres, numBins) {
    const grid     = document.getElementById('heatmap-grid');
    const labelsEl = document.getElementById('heatmap-genre-labels');
    if (!grid || !labelsEl) return;

    // Wait for layout to settle
    requestAnimationFrame(() => {
      const gridH = grid.offsetHeight;
      labelsEl.style.height = gridH + 'px';
    });
  }

  // ── Placeholder (if JSON files not yet generated) ───────────────────────
  function renderHeatmapPlaceholder() {
    const grid = document.getElementById('heatmap-grid');
    if (!grid) return;

    const GENRES = ['Comedy','Action','Drama','Horror','Romance','Animation'];
    const BINS   = 10;

    grid.style.setProperty('--hm-cols', BINS);
    grid.innerHTML = '';

    GENRES.forEach((genre, gi) => {
      for (let bi = 0; bi < BINS; bi++) {
        // Fake data: bell curve centred around ratings 6-7 with some genre variation
        const peakBin = 5 + gi * 0.3;
        const noise   = Math.random() * 0.25;
        const t       = Math.max(0, 1 - Math.pow((bi - peakBin) / 3, 2) + noise);

        const cell = document.createElement('div');
        cell.className  = 'hm-cell';
        cell.dataset.row = gi;
        cell.style.animationDelay = `${(gi * BINS + bi) * 14}ms`;
        cell.style.background = t > 0.05 ? lerpColour(t) : 'rgba(255,255,255,0.04)';
        grid.appendChild(cell);
      }
    });

    const labelsEl = document.getElementById('heatmap-genre-labels');
    if (labelsEl) {
      labelsEl.innerHTML = '';
      GENRES.forEach(g => {
        const div = document.createElement('div');
        div.className = 'heatmap-genre-label';
        div.textContent = g;
        labelsEl.appendChild(div);
      });
    }

    const ticks = document.getElementById('heatmap-x-ticks');
    if (ticks) {
      ticks.style.setProperty('--hm-cols', BINS);
      ticks.innerHTML = '';
      for (let i = 1; i <= BINS; i++) {
        const span = document.createElement('span');
        span.className = 'hm-tick';
        span.textContent = i;
        ticks.appendChild(span);
      }
    }

    syncGenreLabelHeights(GENRES.length, BINS);
    alignTicks();

    // Decade buttons still work (just re-render placeholder)
    document.querySelectorAll('#heatmap-decades .chip').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#heatmap-decades .chip').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderHeatmapPlaceholder();
        const badge = document.getElementById('heatmap-decade-badge');
        if (badge) badge.textContent = DECADE_LABELS[btn.getAttribute('data-hd')] || btn.getAttribute('data-hd');
      });
    });

    // Show a subtle notice
    const panel = document.querySelector('#heatmap .viz-panel');
    if (panel) {
      const notice = document.createElement('p');
      notice.style.cssText = 'font-size:0.75rem;color:rgba(255,255,255,0.3);margin-top:8px;text-align:center';
      notice.textContent = 'Preview mode — run generate_heatmap_data.py to load real data';
      panel.appendChild(notice);
    }
  }

})();

/* ═══════════════════════════════════════════════════════════════════════
   QUALITY THROUGH TIME — SANKEY
   ═══════════════════════════════════════════════════════════════════════ */

(function () {

  /* ── Genre colours (re-use from GENRE_COLORS if available) ─────────── */
  const SK_GENRE_COLORS = {
    Comedy:   '#FFE66D',
    Drama:    '#95E1D3',
    Action:   '#FF6348',
    Horror:   '#C0392B',
    Romance:  '#FF69B4',
    Thriller: '#E74C3C',
  };

  /* ── Quality tier definitions ──────────────────────────────────────── */
  const TIERS = [
    { key: '1star', label: '★',     stars: '★',         range: '1–2',  color: '#6b6b82' },
    { key: '2star', label: '★★',    stars: '★★',        range: '3–4',  color: '#7a8c9e' },
    { key: '3star', label: '★★★',   stars: '★★★',       range: '5–6',  color: '#8fb0c8' },
    { key: '4star', label: '★★★★',  stars: '★★★★',      range: '7–8',  color: '#a8c8d8' },
    { key: '5star', label: '★★★★★', stars: '★★★★★',     range: '9–10', color: '#c8e4ee' },
  ];

  const GENRES = ['Comedy', 'Drama', 'Action', 'Horror', 'Romance', 'Thriller'];

  /* ── Colour saturation for b&w → colour transition ─────────────────── */
  // decades before 1960 fade towards greyscale
  function getSaturation(decade) {
    const year = parseInt(decade);
    if (year <= 1930) return 0;
    if (year >= 1960) return 1;
    return (year - 1930) / 30;   // linear ramp 1930→1960
  }

  function desaturateHex(hex, sat) {
    // sat=0 → greyscale, sat=1 → full colour
    const r = parseInt(hex.slice(1,3),16);
    const g = parseInt(hex.slice(3,5),16);
    const b = parseInt(hex.slice(5,7),16);
    const grey = Math.round(0.299*r + 0.587*g + 0.114*b);
    const nr = Math.round(grey + (r - grey) * sat);
    const ng = Math.round(grey + (g - grey) * sat);
    const nb = Math.round(grey + (b - grey) * sat);
    return `rgb(${nr},${ng},${nb})`;
  }

  /* ── State ─────────────────────────────────────────────────────────── */
  let skData     = null;
  let skDecades  = [];
  let skDecadeIdx = 0;
  let skPlaying  = false;
  let skTimer    = null;
  let skSpeed    = 1200;   // ms per decade

  /* ── Load data ─────────────────────────────────────────────────────── */
  fetch('data/sankey_quality.json')
    .then(r => r.json())
    .then(d => {
      skData    = d;
      skDecades = Object.keys(d).sort();
      buildSankeyUI();
      renderSankey(skDecades[skDecades.length - 1]);   // start at latest decade
    })
    .catch(err => {
      console.warn('[Sankey] data load failed, using placeholder:', err);
      buildSankeyPlaceholder();
    });

  /* ── Build static UI ───────────────────────────────────────────────── */
  function buildSankeyUI() {
    // Star legend
    const legendEl = document.getElementById('sankey-star-items');
    if (legendEl) {
      legendEl.innerHTML = '';
      TIERS.forEach(t => {
        const row = document.createElement('div');
        row.className = 'sankey-star-item';
        row.innerHTML = `
          <div class="sankey-star-swatch" style="background:${t.color}"></div>
          <span class="sankey-star-stars">${t.stars}</span>
          <span>${t.range}/10</span>
        `;
        legendEl.appendChild(row);
      });
    }

    // Decade timeline
    const timeline = document.getElementById('sankey-timeline');
    if (timeline) {
      timeline.innerHTML = '';
      skDecades.forEach(d => {
        const btn = document.createElement('button');
        btn.className = 'sankey-decade-btn';
        btn.textContent = d;
        btn.dataset.decade = d;
        btn.addEventListener('click', () => {
          stopPlay();
          renderSankey(d);
        });
        timeline.appendChild(btn);
      });
    }

    // Play button
    const playBtn = document.getElementById('sankey-play-btn');
    if (playBtn) {
      playBtn.addEventListener('click', () => {
        skPlaying ? stopPlay() : startPlay();
      });
    }

    // Speed slider
    const speedEl = document.getElementById('sankey-speed');
    if (speedEl) {
      speedEl.addEventListener('input', () => {
        skSpeed = parseInt(speedEl.value);
        if (skPlaying) { stopPlay(); startPlay(); }
      });
    }
  }

  /* ── Play / Stop ───────────────────────────────────────────────────── */
  function startPlay() {
    skPlaying = true;
    setPlayUI(true);
    // If we're at the last decade, restart from first
    if (skDecadeIdx >= skDecades.length - 1) skDecadeIdx = 0;
    advancePlay();
  }

  function advancePlay() {
    if (!skPlaying) return;
    renderSankey(skDecades[skDecadeIdx]);
    if (skDecadeIdx >= skDecades.length - 1) {
      stopPlay(); return;
    }
    skDecadeIdx++;
    skTimer = setTimeout(advancePlay, skSpeed);
  }

  function stopPlay() {
    skPlaying = false;
    clearTimeout(skTimer);
    setPlayUI(false);
  }

  function setPlayUI(playing) {
    const btn   = document.getElementById('sankey-play-btn');
    const icon  = document.getElementById('sankey-play-icon');
    const label = document.getElementById('sankey-play-label');
    if (!btn) return;
    btn.classList.toggle('playing', playing);
    if (icon)  icon.textContent  = playing ? '■' : '▶';
    if (label) label.textContent = playing ? 'Stop' : 'Play';
  }

  /* ── Render one decade ─────────────────────────────────────────────── */
  function renderSankey(decade) {
    // Track selected decade index for play
    skDecadeIdx = skDecades.indexOf(decade);

    // Badge
    const badge = document.getElementById('sankey-decade-badge');
    if (badge) badge.textContent = decade;

    // Highlight timeline button
    document.querySelectorAll('.sankey-decade-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.decade === decade);
    });

    const svg = document.getElementById('sankey-svg');
    if (!svg) return;

    const decadeData = skData?.[decade] || {};
    const sat = getSaturation(decade);

    // Dimensions
    const W = svg.parentElement.offsetWidth || 620;
    const H = Math.max(340, Math.min(480, W * 0.72));
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('height', H);
    svg.innerHTML = '';

    const PAD   = { top: 20, bottom: 20, left: 16, right: 16 };
    const INNER_H = H - PAD.top - PAD.bottom;

    /* ── Layout constants ─────────────────────────────────────────── */
    const NODE_W     = 22;
    const NODE_GAP   = 10;   // gap between nodes in same column
    const LEFT_X     = PAD.left + 80;          // genre column right edge
    const RIGHT_X    = W - PAD.right - NODE_W; // quality column left edge
    const LABEL_PAD  = 8;

    /* ── Compute totals ───────────────────────────────────────────── */
    // Per genre total (for left node heights)
    const genreTotals = {};
    GENRES.forEach(g => {
      genreTotals[g] = TIERS.reduce((s, t) => s + ((decadeData[g]?.[t.key]) || 0), 0);
    });
    const grandTotal = Object.values(genreTotals).reduce((a, b) => a + b, 0) || 1;

    // Per tier total (for right node heights)
    const tierTotals = {};
    TIERS.forEach(t => {
      tierTotals[t.key] = GENRES.reduce((s, g) => s + ((decadeData[g]?.[t.key]) || 0), 0);
    });

    /* ── Build node positions ─────────────────────────────────────── */
    // Left nodes (genres)
    const totalNodeGapL = NODE_GAP * (GENRES.length - 1);
    const availableHL   = INNER_H - totalNodeGapL;

    let leftY = PAD.top;
    const genreNodes = GENRES.map(g => {
      const h = Math.max(4, (genreTotals[g] / grandTotal) * availableHL);
      const node = { genre: g, x: LEFT_X, y: leftY, w: NODE_W, h };
      leftY += h + NODE_GAP;
      return node;
    });

    // Right nodes (quality tiers)
    const totalNodeGapR = NODE_GAP * (TIERS.length - 1);
    const availableHR   = INNER_H - totalNodeGapR;

    let rightY = PAD.top;
    const tierNodes = TIERS.map(t => {
      const h = Math.max(4, (tierTotals[t.key] / grandTotal) * availableHR);
      const node = { tier: t, x: RIGHT_X, y: rightY, w: NODE_W, h };
      rightY += h + NODE_GAP;
      return node;
    });

    /* ── Draw ribbons ─────────────────────────────────────────────── */
    // Track current offset within each node for ribbon stacking
    const genreOffset  = {};  GENRES.forEach(g => genreOffset[g] = 0);
    const tierOffset   = {};  TIERS.forEach(t => tierOffset[t.key] = 0);

    // Sort flow order: draw narrower ribbons on top (ascending count)
    const flows = [];
    GENRES.forEach(g => {
      TIERS.forEach(t => {
        const count = (decadeData[g]?.[t.key]) || 0;
        if (count > 0) flows.push({ g, t, count });
      });
    });
    flows.sort((a, b) => a.count - b.count);

    const ribbonGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    ribbonGroup.setAttribute('class', 'sankey-ribbons');

    const tooltip = document.getElementById('sankey-tooltip');

    flows.forEach(({ g, t, count }) => {
      const gNode = genreNodes.find(n => n.genre === g);
      const tNode = tierNodes.find(n => n.tier.key === t.key);
      if (!gNode || !tNode) return;

      const ribbonH_left  = (count / grandTotal) * availableHL;
      const ribbonH_right = (count / grandTotal) * availableHR;

      const y0_top = gNode.y + genreOffset[g];
      const y0_bot = y0_top + ribbonH_left;
      const y1_top = tNode.y + tierOffset[t.key];
      const y1_bot = y1_top + ribbonH_right;

      genreOffset[g]     += ribbonH_left;
      tierOffset[t.key]  += ribbonH_right;

      const x0 = LEFT_X + NODE_W;
      const x1 = RIGHT_X;
      const cx = (x0 + x1) / 2;

      // Cubic bezier ribbon path
      const d = [
        `M ${x0} ${y0_top}`,
        `C ${cx} ${y0_top}, ${cx} ${y1_top}, ${x1} ${y1_top}`,
        `L ${x1} ${y1_bot}`,
        `C ${cx} ${y1_bot}, ${cx} ${y0_bot}, ${x0} ${y0_bot}`,
        'Z'
      ].join(' ');

      const baseColor = SK_GENRE_COLORS[g] || '#aaa';
      const fillColor = desaturateHex(baseColor.replace('#','').length === 6 ? baseColor : rgbToHex(baseColor), sat);

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', d);
      path.setAttribute('fill', fillColor);
      path.setAttribute('fill-opacity', '0.62');
      path.setAttribute('class', 'sankey-ribbon');
      path.style.cursor = 'pointer';

      // Animation: fade + stretch in
      path.style.opacity = '0';
      path.style.transition = 'opacity 0.45s ease';
      setTimeout(() => { path.style.opacity = '1'; }, 30);

      path.addEventListener('mouseenter', (e) => {
        ribbonGroup.querySelectorAll('.sankey-ribbon').forEach(r => r.style.opacity = '0.18');
        path.style.opacity = '1';
        if (tooltip) {
          const pct = ((count / grandTotal) * 100).toFixed(1);
          tooltip.innerHTML = `
            <strong>${g}</strong> → <strong>${t.label}</strong><br/>
            ${count.toLocaleString()} films &nbsp;(${pct}%)
          `;
          tooltip.style.display = 'block';
        }
      });
      path.addEventListener('mousemove', (e) => {
        if (!tooltip) return;
        tooltip.style.left = (e.clientX + 14) + 'px';
        tooltip.style.top  = (e.clientY - 10) + 'px';
      });
      path.addEventListener('mouseleave', () => {
        ribbonGroup.querySelectorAll('.sankey-ribbon').forEach(r => r.style.opacity = '0.62');
        if (tooltip) tooltip.style.display = 'none';
      });

      ribbonGroup.appendChild(path);
    });

    svg.appendChild(ribbonGroup);

    /* ── Draw left nodes (genres) ─────────────────────────────────── */
    genreNodes.forEach(n => {
      const baseColor  = SK_GENRE_COLORS[n.genre] || '#aaa';
      const nodeColor  = desaturateHex(baseColor.replace('#','').length === 6 ? baseColor : rgbToHex(baseColor), sat);

      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', n.x);
      rect.setAttribute('y', n.y);
      rect.setAttribute('width', n.w);
      rect.setAttribute('height', Math.max(n.h, 2));
      rect.setAttribute('fill', nodeColor);
      rect.setAttribute('rx', '4');
      rect.setAttribute('class', 'sankey-node-rect');
      svg.appendChild(rect);

      // Genre label (left of node)
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', n.x - LABEL_PAD);
      text.setAttribute('y', n.y + n.h / 2 + 1);
      text.setAttribute('text-anchor', 'end');
      text.setAttribute('dominant-baseline', 'middle');
      text.setAttribute('font-size', '11');
      text.setAttribute('font-weight', '700');
      text.setAttribute('letter-spacing', '0.8');
      text.setAttribute('fill', sat < 0.3 ? 'rgba(255,255,255,0.55)' : nodeColor);
      text.textContent = n.genre.toUpperCase();
      svg.appendChild(text);
    });

    /* ── Draw right nodes (quality tiers) ────────────────────────── */
    tierNodes.forEach(n => {
      const tierColor = sat < 0.3
        ? 'rgba(200,200,200,0.7)'
        : n.tier.color;

      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', n.x);
      rect.setAttribute('y', n.y);
      rect.setAttribute('width', n.w);
      rect.setAttribute('height', Math.max(n.h, 2));
      rect.setAttribute('fill', tierColor);
      rect.setAttribute('rx', '4');
      rect.setAttribute('class', 'sankey-node-rect');
      svg.appendChild(rect);

      // Star label (right of node)
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', n.x + n.w + LABEL_PAD);
      text.setAttribute('y', n.y + n.h / 2 + 1);
      text.setAttribute('dominant-baseline', 'middle');
      text.setAttribute('font-size', '13');
      text.setAttribute('fill', sat < 0.3 ? 'rgba(255,255,255,0.45)' : 'rgba(215,180,106,0.9)');
      text.textContent = n.tier.stars;
      svg.appendChild(text);
    });

    /* ── B&W grain overlay for early decades ─────────────────────── */
    if (sat < 0.8) {
      const overlay = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      overlay.setAttribute('x', 0); overlay.setAttribute('y', 0);
      overlay.setAttribute('width', W); overlay.setAttribute('height', H);
      overlay.setAttribute('fill', 'url(#grainPattern)');
      overlay.setAttribute('opacity', String((1 - sat) * 0.18));
      overlay.setAttribute('pointer-events', 'none');

      // Define grain pattern if not present
      let defs = svg.querySelector('defs');
      if (!defs) { defs = document.createElementNS('http://www.w3.org/2000/svg','defs'); svg.prepend(defs); }
      if (!defs.querySelector('#grainPattern')) {
        defs.innerHTML += `
          <filter id="grainFilter">
            <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch"/>
            <feColorMatrix type="saturate" values="0"/>
          </filter>
          <rect id="grainPattern" x="0" y="0" width="${W}" height="${H}"
                filter="url(#grainFilter)" opacity="1"/>
        `;
      }
      svg.appendChild(overlay);
    }
  }

  /* ── Helper: rgb(...) → hex ────────────────────────────────────────── */
  function rgbToHex(color) {
    // If already a hex, return as-is
    if (color.startsWith('#')) return color.slice(1);
    const m = color.match(/\d+/g);
    if (!m) return '999999';
    return m.slice(0,3).map(v => parseInt(v).toString(16).padStart(2,'0')).join('');
  }

  /* ── Placeholder if JSON missing ───────────────────────────────────── */
  function buildSankeyPlaceholder() {
    // Inject fake data and render
    const fakeData = {};
    const decades = ['1950s','1960s','1970s','1980s','1990s','2000s','2010s','2020s'];
    decades.forEach(d => {
      fakeData[d] = {};
      GENRES.forEach(g => {
        fakeData[d][g] = {};
        TIERS.forEach(t => {
          // Bell-curve-ish fake distribution
          const base = Math.random() * 400 + 50;
          fakeData[d][g][t.key] = Math.round(base);
        });
      });
    });
    skData    = fakeData;
    skDecades = decades;
    buildSankeyUI();
    renderSankey(decades[decades.length - 1]);

    const panel = document.querySelector('#sankey .viz-panel');
    if (panel) {
      const notice = document.createElement('p');
      notice.style.cssText = 'font-size:0.75rem;color:rgba(255,255,255,0.3);margin-top:8px;text-align:center';
      notice.textContent = 'Preview mode — run generate_sankey_data.py to load real data';
      panel.appendChild(notice);
    }
  }

})();
