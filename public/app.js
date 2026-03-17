/**
 * Disease Surveillance Dashboard — Frontend Logic
 *
 * Handles:
 *  - Search form submission
 *  - API calls to /api/search and /api/sources
 *  - Results rendering (cards per data source)
 *  - Source status indicators
 *  - Loading / error states
 */

(function () {
  'use strict';

  // -----------------------------------------------------------------------
  // DOM References
  // -----------------------------------------------------------------------
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const searchForm = $('#searchForm');
  const diseaseInput = $('#diseaseInput');
  const regionInput = $('#regionInput');
  const searchBtn = $('#searchBtn');
  const btnText = $('.search-form__btn-text');
  const btnLoading = $('.search-form__btn-loading');

  const queryMeta = $('#queryMeta');
  const metaQuery = $('#metaQuery');
  const metaLatency = $('#metaLatency');
  const metaSources = $('#metaSources');
  const metaCached = $('#metaCached');

  const sourceBar = $('#sourceBar');
  const sourceStatusGrid = $('#sourceStatusGrid');

  const loadingSection = $('#loadingSection');
  const loadingCount = $('#loadingCount');

  const errorSection = $('#errorSection');
  const errorTitle = $('#errorTitle');
  const errorMessage = $('#errorMessage');
  const errorRetryBtn = $('#errorRetryBtn');

  const resultsSection = $('#resultsSection');
  const classificationBlock = $('#classificationBlock');
  const classificationContent = $('#classificationContent');
  const epiBlock = $('#epiBlock');
  const epiGrid = $('#epiGrid');
  const alertsBlock = $('#alertsBlock');
  const alertsList = $('#alertsList');
  const genomicBlock = $('#genomicBlock');
  const genomicGrid = $('#genomicGrid');
  const therapeuticsBlock = $('#therapeuticsBlock');
  const therapeuticsGrid = $('#therapeuticsGrid');
  const trendChartBlock = $('#trendChartBlock');
  const trendChartCanvas = $('#trendChart');
  const trendAnalysisBlock = $('#trendAnalysisBlock');
  const trendAnalysisGrid = $('#trendAnalysisGrid');
  const emptyState = $('#emptyState');

  // -----------------------------------------------------------------------
  // State
  // -----------------------------------------------------------------------
  let lastQuery = { disease: '', region: '' };
  let trendChartInstance = null;

  // -----------------------------------------------------------------------
  // Utilities
  // -----------------------------------------------------------------------

  /** Format a number with commas */
  function formatNum(n) {
    if (n == null) return '--';
    return Number(n).toLocaleString();
  }

  /** Sanitize a string for safe HTML insertion */
  function esc(str) {
    if (str == null) return '';
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
  }

  /** Show one section, hide others */
  function showSection(section) {
    [loadingSection, errorSection, resultsSection, emptyState].forEach((s) => {
      s.hidden = s !== section;
    });
  }

  /** Set button loading state */
  function setLoading(loading) {
    searchBtn.disabled = loading;
    btnText.hidden = loading;
    btnLoading.hidden = !loading;
  }

  // -----------------------------------------------------------------------
  // API Calls
  // -----------------------------------------------------------------------

  async function apiSearch(disease, region) {
    const params = new URLSearchParams({ disease });
    if (region) params.append('region', region);

    const res = await fetch(`/api/search?${params.toString()}`);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.message || body?.error || `HTTP ${res.status}`);
    }
    return res.json();
  }

  // -----------------------------------------------------------------------
  // Render: Query Meta
  // -----------------------------------------------------------------------

  function renderQueryMeta(data) {
    const q = data.query;
    const queryStr = q.disease + (q.region ? ` + ${q.region}` : '');
    metaQuery.textContent = queryStr;
    metaLatency.textContent = `${data.totalLatency}ms`;

    const summary = data.summary;
    metaSources.textContent = `${summary.successful}/${summary.totalSources} OK`;
    metaSources.style.color =
      summary.failed > 0 ? 'var(--status-timeout)' : 'var(--status-ok)';

    metaCached.textContent =
      summary.cachedResponses > 0 ? `${summary.cachedResponses} cached` : 'none';
    metaCached.style.color =
      summary.cachedResponses > 0 ? 'var(--status-cached)' : 'var(--text-muted)';

    queryMeta.hidden = false;
  }

  // -----------------------------------------------------------------------
  // Render: Source Status Pills
  // -----------------------------------------------------------------------

  function renderSourceStatus(sources) {
    sourceStatusGrid.innerHTML = '';

    sources.forEach((src) => {
      const statusClass = `source-pill--${src.status === 'ok' ? 'ok' : src.status === 'timeout' ? 'timeout' : src.status === 'skipped' ? 'skipped' : 'error'}`;
      const cachedTag = src.cached ? '<span class="source-pill__cached">[cached]</span>' : '';

      const pill = document.createElement('span');
      pill.className = `source-pill ${statusClass}`;
      pill.innerHTML = `
        <span class="source-pill__dot"></span>
        ${esc(src.name)}
        <span class="source-pill__latency">${src.latency}ms</span>
        ${cachedTag}
      `;
      sourceStatusGrid.appendChild(pill);
    });

    sourceBar.hidden = false;
  }

  // -----------------------------------------------------------------------
  // Render: Classification
  // -----------------------------------------------------------------------

  function renderClassification(classification) {
    if (!classification || Object.keys(classification).length === 0) {
      classificationBlock.hidden = true;
      return;
    }

    classificationContent.innerHTML = '';

    // The backend returns data shaped as:
    //   { searchTerm, exactMatch, classification: { icd10Code, icd11Code, name, category, description, relatedCodes } }
    // or for partial matches:
    //   { searchTerm, exactMatch: false, partialMatches: [{ icd10, icd11, name, category, description }] }
    const cls = classification.classification || null;
    const partials = classification.partialMatches || [];

    if (cls) {
      // Exact match — render ICD-10, ICD-11, category from the inner classification object
      if (cls.icd10Code) {
        const item = document.createElement('div');
        item.className = 'class-item';
        item.innerHTML = `
          <div class="class-item__label">ICD-10</div>
          <div class="class-item__code">${esc(cls.icd10Code)}</div>
          <div class="class-item__name">${esc(cls.description || cls.name || '')}</div>
        `;
        classificationContent.appendChild(item);
      }

      if (cls.icd11Code) {
        const item = document.createElement('div');
        item.className = 'class-item';
        item.innerHTML = `
          <div class="class-item__label">ICD-11</div>
          <div class="class-item__code">${esc(cls.icd11Code)}</div>
          <div class="class-item__name">${esc(cls.name || '')}</div>
        `;
        classificationContent.appendChild(item);
      }

      if (cls.category) {
        const item = document.createElement('div');
        item.className = 'class-item';
        item.innerHTML = `
          <div class="class-item__label">Category</div>
          <div class="class-item__code">${esc(cls.category)}</div>
          <div class="class-item__name"></div>
        `;
        classificationContent.appendChild(item);
      }

      if (cls.relatedCodes && cls.relatedCodes.length) {
        const item = document.createElement('div');
        item.className = 'class-item';
        item.innerHTML = `
          <div class="class-item__label">Related Codes</div>
          <div class="class-item__name">${esc(cls.relatedCodes.map(rc => rc.code + ' — ' + rc.description).join('; '))}</div>
        `;
        classificationContent.appendChild(item);
      }
    } else if (partials.length > 0) {
      // Partial matches — render best matches
      partials.slice(0, 3).forEach((pm) => {
        if (pm.icd10) {
          const item = document.createElement('div');
          item.className = 'class-item';
          item.innerHTML = `
            <div class="class-item__label">ICD-10 (partial)</div>
            <div class="class-item__code">${esc(pm.icd10)}</div>
            <div class="class-item__name">${esc(pm.name || pm.description || '')}</div>
          `;
          classificationContent.appendChild(item);
        }
        if (pm.icd11) {
          const item = document.createElement('div');
          item.className = 'class-item';
          item.innerHTML = `
            <div class="class-item__label">ICD-11 (partial)</div>
            <div class="class-item__code">${esc(pm.icd11)}</div>
            <div class="class-item__name">${esc(pm.name || '')}</div>
          `;
          classificationContent.appendChild(item);
        }
      });
    }

    // Common names / aliases (if present at top level)
    if (classification.commonNames && classification.commonNames.length) {
      const item = document.createElement('div');
      item.className = 'class-item';
      item.innerHTML = `
        <div class="class-item__label">Also known as</div>
        <div class="class-item__name">${esc(classification.commonNames.join(', '))}</div>
      `;
      classificationContent.appendChild(item);
    }

    classificationBlock.hidden = classificationContent.children.length === 0;
  }

  // -----------------------------------------------------------------------
  // Render: Epidemiological Data
  // -----------------------------------------------------------------------

  function renderEpiData(epiData) {
    if (!epiData || Object.keys(epiData).length === 0) {
      epiBlock.hidden = true;
      return;
    }

    epiGrid.innerHTML = '';

    for (const [sourceName, data] of Object.entries(epiData)) {
      if (!data) continue;

      const card = document.createElement('div');
      card.className = 'data-card';

      const bodyHTML = buildEpiCardBody(sourceName, data);

      card.innerHTML = `
        <div class="data-card__header">
          <span class="data-card__source">${esc(sourceName)}</span>
          <span class="data-card__badge data-card__badge--ok">Live</span>
        </div>
        <div class="data-card__body">${bodyHTML}</div>
      `;
      epiGrid.appendChild(card);
    }

    epiBlock.hidden = epiGrid.children.length === 0;
  }

  /**
   * Build card body HTML for different epi source shapes.
   * Each connector returns data in different formats,
   * so we do our best to render key-value pairs from whatever we get.
   */
  function buildEpiCardBody(sourceName, data) {
    // Handle Disease.sh format (has cases, deaths, recovered, etc.)
    if (data.cases != null || data.global || data.country) {
      return renderKeyValuePairs(flattenTopLevel(data));
    }

    // Handle WHO / CDC / ECDC — usually arrays of records or nested objects
    if (Array.isArray(data)) {
      if (data.length === 0) return '<p>No records found</p>';
      // Show first few records as a table
      return renderRecordsTable(data.slice(0, 8));
    }

    // Handle object with nested properties
    if (typeof data === 'object') {
      // Check if it has a "records" or "data" array inside
      if (Array.isArray(data.records)) {
        return renderRecordsTable(data.records.slice(0, 8));
      }
      if (Array.isArray(data.data)) {
        return renderRecordsTable(data.data.slice(0, 8));
      }
      if (data.message && Object.keys(data).length <= 2) {
        return `<p>${esc(data.message)}</p>`;
      }
      return renderKeyValuePairs(flattenTopLevel(data));
    }

    return `<p>${esc(String(data))}</p>`;
  }

  /** Flatten an object one level deep for display */
  function flattenTopLevel(obj) {
    const pairs = [];
    for (const [key, val] of Object.entries(obj)) {
      if (val == null) continue;
      if (typeof val === 'object' && !Array.isArray(val)) {
        // Nest one level
        for (const [k2, v2] of Object.entries(val)) {
          if (v2 != null && typeof v2 !== 'object') {
            pairs.push([`${key}.${k2}`, v2]);
          }
        }
      } else if (Array.isArray(val)) {
        pairs.push([key, `[${val.length} items]`]);
      } else {
        pairs.push([key, val]);
      }
    }
    return pairs;
  }

  /** Render key-value pairs as stat rows */
  function renderKeyValuePairs(pairs) {
    if (!pairs.length) return '<p>No data</p>';
    return pairs
      .slice(0, 12) // limit to avoid overflow
      .map(([k, v]) => {
        const formatted = typeof v === 'number' ? formatNum(v) : esc(String(v));
        const valClass = isHighValue(k, v) ? 'stat-row__value--highlight' : '';
        return `
          <div class="stat-row">
            <span class="stat-row__label">${esc(prettifyKey(k))}</span>
            <span class="stat-row__value ${valClass}">${formatted}</span>
          </div>
        `;
      })
      .join('');
  }

  /** Render array of records as an HTML table */
  function renderRecordsTable(records) {
    if (!records.length) return '<p>No records</p>';

    // Get columns from first record, limit to 5 columns
    const allKeys = Object.keys(records[0]).filter(
      (k) => records[0][k] != null && typeof records[0][k] !== 'object'
    );
    const keys = allKeys.slice(0, 5);

    if (keys.length === 0) return '<p>No displayable fields</p>';

    const headerCells = keys.map((k) => `<th>${esc(prettifyKey(k))}</th>`).join('');
    const rows = records
      .map((rec) => {
        const cells = keys
          .map((k) => {
            const v = rec[k];
            const display = typeof v === 'number' ? formatNum(v) : esc(String(v ?? ''));
            return `<td>${display}</td>`;
          })
          .join('');
        return `<tr>${cells}</tr>`;
      })
      .join('');

    return `<table><thead><tr>${headerCells}</tr></thead><tbody>${rows}</tbody></table>`;
  }

  /** Make object keys more readable */
  function prettifyKey(key) {
    return key
      .replace(/[._]/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  /** Heuristic: is this a "big number" worth highlighting? */
  function isHighValue(key, val) {
    if (typeof val !== 'number') return false;
    const k = key.toLowerCase();
    if (k.includes('case') || k.includes('death') || k.includes('confirmed')) {
      return val > 1000;
    }
    return false;
  }

  // -----------------------------------------------------------------------
  // Render: Outbreak Alerts
  // -----------------------------------------------------------------------

  function renderAlerts(alerts) {
    if (!alerts || alerts.length === 0) {
      alertsBlock.hidden = true;
      return;
    }

    alertsList.innerHTML = '';

    alerts.slice(0, 20).forEach((alert) => {
      const el = document.createElement('div');
      el.className = 'alert-item';

      const title = alert.title || alert.headline || alert.summary || 'Alert';
      const date = alert.date || alert.published || alert.timestamp || '';
      const url = alert.url || alert.link || '';

      const titleHTML = url
        ? `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(title)}</a>`
        : esc(title);

      el.innerHTML = `
        <span class="alert-item__source">${esc(alert.source || 'Unknown')}</span>
        <div class="alert-item__content">
          <div class="alert-item__title">${titleHTML}</div>
          ${date ? `<div class="alert-item__date">${esc(date)}</div>` : ''}
        </div>
      `;
      alertsList.appendChild(el);
    });

    alertsBlock.hidden = false;
  }

  // -----------------------------------------------------------------------
  // Render: Genomic Associations
  // -----------------------------------------------------------------------

  function renderGenomic(associations) {
    if (!associations || associations.length === 0) {
      genomicBlock.hidden = true;
      return;
    }

    genomicGrid.innerHTML = '';

    associations.slice(0, 8).forEach((assoc) => {
      const card = document.createElement('div');
      card.className = 'data-card';

      const geneName = assoc.geneSymbol || assoc.targetSymbol || assoc.symbol || assoc.gene || assoc.name || 'Unknown';
      const scoreVal = assoc.overallScore != null ? assoc.overallScore : assoc.score;
      const score = scoreVal != null ? Number(scoreVal).toFixed(3) : '--';
      const desc = assoc.geneName || assoc.targetName || assoc.description || '';

      // Build evidence type scores HTML
      let evidenceHTML = '';
      if (assoc.evidenceScores && typeof assoc.evidenceScores === 'object') {
        const entries = Object.entries(assoc.evidenceScores).filter(([, v]) => v > 0);
        if (entries.length > 0) {
          // Sort by score descending
          entries.sort((a, b) => b[1] - a[1]);
          evidenceHTML = '<div class="evidence-scores">' +
            '<div class="stat-row"><span class="stat-row__label">Evidence Breakdown</span></div>' +
            entries.map(([type, val]) => {
              const pct = Math.round(val * 100);
              const label = type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
              return `<div class="evidence-bar">
                <span class="evidence-bar__label">${esc(label)}</span>
                <div class="evidence-bar__track"><div class="evidence-bar__fill" style="width:${pct}%"></div></div>
                <span class="evidence-bar__val">${val.toFixed(2)}</span>
              </div>`;
            }).join('') +
            '</div>';
        }
      }

      card.innerHTML = `
        <div class="data-card__header">
          <span class="data-card__source">${esc(geneName)}</span>
          <span class="data-card__badge data-card__badge--ok">Score: ${esc(score)}</span>
        </div>
        <div class="data-card__body">
          ${desc ? `<p>${esc(desc)}</p>` : ''}
          ${assoc.tractability ? `<div class="stat-row"><span class="stat-row__label">Tractability</span><span class="stat-row__value">${esc(assoc.tractability)}</span></div>` : ''}
          ${evidenceHTML}
        </div>
      `;
      genomicGrid.appendChild(card);
    });

    genomicBlock.hidden = genomicGrid.children.length === 0;
  }

  // -----------------------------------------------------------------------
  // Render: Therapeutics
  // -----------------------------------------------------------------------

  function renderTherapeutics(therapeutics) {
    if (!therapeutics || therapeutics.length === 0) {
      therapeuticsBlock.hidden = true;
      return;
    }

    therapeuticsGrid.innerHTML = '';

    therapeutics.slice(0, 8).forEach((compound) => {
      const card = document.createElement('div');
      card.className = 'data-card';

      const name = compound.name || compound.compoundName || compound.title || 'Unknown';
      const formula = compound.molecularFormula || compound.formula || '';
      const whoEml = compound.whoEssentialMedicine;

      const synonyms = Array.isArray(compound.synonyms) && compound.synonyms.length > 0
        ? compound.synonyms
        : [];
      const synonymsHTML = synonyms.length > 0
        ? `<div class="stat-row"><span class="stat-row__label">Also known as</span><span class="stat-row__value compound-synonyms">${synonyms.map(s => esc(s)).join(', ')}</span></div>`
        : '';

      card.innerHTML = `
        <div class="data-card__header">
          <span class="data-card__source">${esc(name)}</span>
          ${whoEml ? '<span class="data-card__badge data-card__badge--ok">WHO EML</span>' : ''}
        </div>
        <div class="data-card__body">
          ${compound.mechanismOfAction ? `<div class="stat-row"><span class="stat-row__label">Mechanism</span><span class="stat-row__value">${esc(compound.mechanismOfAction.length > 200 ? compound.mechanismOfAction.slice(0, 200) + '...' : compound.mechanismOfAction)}</span></div>` : ''}
          ${compound.indication ? `<div class="stat-row"><span class="stat-row__label">Indication</span><span class="stat-row__value">${esc(compound.indication.length > 200 ? compound.indication.slice(0, 200) + '...' : compound.indication)}</span></div>` : ''}
          ${formula ? `<div class="stat-row"><span class="stat-row__label">Formula</span><span class="stat-row__value">${esc(formula)}</span></div>` : ''}
          ${compound.molecularWeight ? `<div class="stat-row"><span class="stat-row__label">Mol. Weight</span><span class="stat-row__value">${esc(compound.molecularWeight)}</span></div>` : ''}
          ${synonymsHTML}
          ${compound.iupacName ? `<div class="stat-row"><span class="stat-row__label">IUPAC</span><span class="stat-row__value">${esc(compound.iupacName)}</span></div>` : ''}
          ${compound.cid ? `<div class="stat-row"><span class="stat-row__label">PubChem CID</span><span class="stat-row__value"><a href="${esc(compound.pubchemUrl || 'https://pubchem.ncbi.nlm.nih.gov/compound/' + compound.cid)}" target="_blank" rel="noopener">${esc(compound.cid)}</a></span></div>` : ''}
        </div>
      `;
      therapeuticsGrid.appendChild(card);
    });

    therapeuticsBlock.hidden = therapeuticsGrid.children.length === 0;
  }

  // -----------------------------------------------------------------------
  // Render: Trend Chart (Disease.sh historical timeline)
  // -----------------------------------------------------------------------

  function renderTrendChart(epiData) {
    // Destroy previous chart instance if it exists
    if (trendChartInstance) {
      trendChartInstance.destroy();
      trendChartInstance = null;
    }

    if (!epiData || typeof Chart === 'undefined') {
      trendChartBlock.hidden = true;
      return;
    }

    // Try to extract timeline data from Disease.sh
    const diseaseSh = epiData['Disease.sh'];
    let timeline = null;

    if (diseaseSh && diseaseSh.historical && diseaseSh.historical.timeline) {
      timeline = diseaseSh.historical.timeline;
    }

    // Also try IHME data if available
    let ihmeData = null;
    const ihme = epiData['IHME GHDx'];
    if (ihme && Array.isArray(ihme.records) && ihme.records.length > 1) {
      ihmeData = ihme.records;
    } else if (ihme && Array.isArray(ihme.data) && ihme.data.length > 1) {
      ihmeData = ihme.data;
    }

    if (!timeline && !ihmeData) {
      trendChartBlock.hidden = true;
      return;
    }

    const datasets = [];
    let labels = [];

    if (timeline) {
      // Disease.sh timeline: { cases: { "3/1/25": 123, ... }, deaths: { ... }, recovered: { ... } }
      if (timeline.cases) {
        const caseDates = Object.keys(timeline.cases);
        labels = caseDates;
        datasets.push({
          label: 'Cases (cumulative)',
          data: caseDates.map((d) => timeline.cases[d]),
          borderColor: '#00e5a0',
          backgroundColor: 'rgba(0, 229, 160, 0.1)',
          fill: true,
          tension: 0.3,
          pointRadius: 2,
          pointHoverRadius: 5,
          borderWidth: 2,
        });
      }

      if (timeline.deaths) {
        const deathDates = Object.keys(timeline.deaths);
        if (labels.length === 0) labels = deathDates;
        datasets.push({
          label: 'Deaths (cumulative)',
          data: deathDates.map((d) => timeline.deaths[d]),
          borderColor: '#ff4d6a',
          backgroundColor: 'rgba(255, 77, 106, 0.1)',
          fill: true,
          tension: 0.3,
          pointRadius: 2,
          pointHoverRadius: 5,
          borderWidth: 2,
        });
      }

      if (timeline.recovered) {
        const recDates = Object.keys(timeline.recovered);
        datasets.push({
          label: 'Recovered (cumulative)',
          data: recDates.map((d) => timeline.recovered[d]),
          borderColor: '#5ebbff',
          backgroundColor: 'rgba(94, 187, 255, 0.1)',
          fill: true,
          tension: 0.3,
          pointRadius: 2,
          pointHoverRadius: 5,
          borderWidth: 2,
        });
      }
    } else if (ihmeData) {
      // IHME data: array of records with year/metric/value fields
      // Try to build a time series from IHME records
      const yearField = ihmeData[0].year ? 'year' : (ihmeData[0].Year ? 'Year' : null);
      const valField = ihmeData[0].value ? 'value' : (ihmeData[0].Value ? 'Value' : (ihmeData[0].val ? 'val' : null));
      const metricField = ihmeData[0].metric ? 'metric' : (ihmeData[0].measure ? 'measure' : (ihmeData[0].Metric ? 'Metric' : null));

      if (yearField && valField) {
        // Group by metric
        const metricGroups = {};
        for (const rec of ihmeData) {
          const metric = metricField ? rec[metricField] : 'Value';
          if (!metricGroups[metric]) metricGroups[metric] = [];
          metricGroups[metric].push({ year: rec[yearField], value: rec[valField] });
        }

        const colors = ['#00e5a0', '#ff4d6a', '#5ebbff', '#ffb347'];
        let colorIdx = 0;

        for (const [metric, points] of Object.entries(metricGroups)) {
          points.sort((a, b) => a.year - b.year);
          if (labels.length === 0) labels = points.map((p) => String(p.year));
          const color = colors[colorIdx % colors.length];
          datasets.push({
            label: metric,
            data: points.map((p) => p.value),
            borderColor: color,
            backgroundColor: color + '1a',
            fill: true,
            tension: 0.3,
            pointRadius: 3,
            pointHoverRadius: 6,
            borderWidth: 2,
          });
          colorIdx++;
        }
      }
    }

    if (datasets.length === 0 || labels.length === 0) {
      trendChartBlock.hidden = true;
      return;
    }

    const ctx = trendChartCanvas.getContext('2d');
    trendChartInstance = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        plugins: {
          legend: {
            labels: {
              color: '#8999ad',
              font: { family: "'JetBrains Mono', monospace", size: 11 },
              boxWidth: 12,
              padding: 16,
            },
          },
          tooltip: {
            backgroundColor: '#111820',
            borderColor: '#1e2a3a',
            borderWidth: 1,
            titleColor: '#e4ebf5',
            bodyColor: '#8999ad',
            titleFont: { family: "'JetBrains Mono', monospace", size: 12 },
            bodyFont: { family: "'JetBrains Mono', monospace", size: 11 },
            padding: 10,
            callbacks: {
              label: function (context) {
                const val = context.parsed.y;
                return context.dataset.label + ': ' + (val != null ? Number(val).toLocaleString() : '--');
              },
            },
          },
        },
        scales: {
          x: {
            ticks: {
              color: '#556373',
              font: { family: "'JetBrains Mono', monospace", size: 10 },
              maxRotation: 45,
              maxTicksLimit: 12,
            },
            grid: { color: '#1e2a3a', lineWidth: 0.5 },
          },
          y: {
            ticks: {
              color: '#556373',
              font: { family: "'JetBrains Mono', monospace", size: 10 },
              callback: function (value) {
                if (value >= 1e6) return (value / 1e6).toFixed(1) + 'M';
                if (value >= 1e3) return (value / 1e3).toFixed(1) + 'K';
                return value;
              },
            },
            grid: { color: '#1e2a3a', lineWidth: 0.5 },
          },
        },
      },
    });

    trendChartBlock.hidden = false;
  }

  // -----------------------------------------------------------------------
  // Render: Trend Analysis Summary (computed rates of change)
  // -----------------------------------------------------------------------

  function renderTrendAnalysis(trendAnalysis) {
    if (!trendAnalysis || typeof trendAnalysis !== 'object') {
      trendAnalysisBlock.hidden = true;
      return;
    }

    const entries = Object.values(trendAnalysis);
    if (entries.length === 0) {
      trendAnalysisBlock.hidden = true;
      return;
    }

    trendAnalysisGrid.innerHTML = '';

    entries.forEach((trend) => {
      const card = document.createElement('div');
      card.className = 'data-card';

      const directionIcon = trend.trendDirection === 'increasing' ? '&#9650;'
        : trend.trendDirection === 'decreasing' ? '&#9660;' : '&#9644;';
      const directionClass = trend.trendDirection === 'increasing' ? 'trend-up'
        : trend.trendDirection === 'decreasing' ? 'trend-down' : 'trend-stable';

      let statsHTML = '';
      if (trend.period) {
        statsHTML += `<div class="stat-row"><span class="stat-row__label">Period</span><span class="stat-row__value">${esc(trend.period)}</span></div>`;
      }
      if (trend.dataPoints) {
        statsHTML += `<div class="stat-row"><span class="stat-row__label">Data Points</span><span class="stat-row__value">${trend.dataPoints}</span></div>`;
      }
      if (trend.totalChange != null) {
        statsHTML += `<div class="stat-row"><span class="stat-row__label">Total Change</span><span class="stat-row__value">${formatNum(trend.totalChange)}</span></div>`;
      }
      if (trend.dailyAverage != null) {
        statsHTML += `<div class="stat-row"><span class="stat-row__label">Daily Avg (recent)</span><span class="stat-row__value">${formatNum(trend.dailyAverage)}</span></div>`;
      }
      if (trend.weekOverWeekChange != null) {
        statsHTML += `<div class="stat-row"><span class="stat-row__label">Week-over-Week</span><span class="stat-row__value ${directionClass}">${trend.weekOverWeekChange > 0 ? '+' : ''}${trend.weekOverWeekChange}%</span></div>`;
      }
      if (trend.annualRateOfChange != null) {
        statsHTML += `<div class="stat-row"><span class="stat-row__label">Annual Rate</span><span class="stat-row__value">${formatNum(trend.annualRateOfChange)}/yr</span></div>`;
      }
      if (trend.startValue != null && trend.endValue != null) {
        statsHTML += `<div class="stat-row"><span class="stat-row__label">Start / End</span><span class="stat-row__value">${formatNum(trend.startValue)} &rarr; ${formatNum(trend.endValue)}</span></div>`;
      }

      card.innerHTML = `
        <div class="data-card__header">
          <span class="data-card__source">${esc(trend.source)}: ${esc(trend.metric)}</span>
          <span class="data-card__badge data-card__badge--${trend.trendDirection === 'increasing' ? 'error' : trend.trendDirection === 'decreasing' ? 'ok' : 'muted'}">${directionIcon} ${esc(trend.trendDirection)}</span>
        </div>
        <div class="data-card__body">
          ${statsHTML}
        </div>
      `;

      trendAnalysisGrid.appendChild(card);
    });

    trendAnalysisBlock.hidden = trendAnalysisGrid.children.length === 0;
  }

  // -----------------------------------------------------------------------
  // Main render orchestrator
  // -----------------------------------------------------------------------

  function renderResults(data) {
    renderQueryMeta(data);
    renderSourceStatus(data.sources);
    renderClassification(data.results.classification);
    renderEpiData(data.results.epidemiological);
    renderTrendChart(data.results.epidemiological);
    renderTrendAnalysis(data.results.trendAnalysis);
    renderAlerts(data.results.outbreakAlerts);
    renderGenomic(data.results.genomicAssociations.associations || data.results.genomicAssociations);
    renderTherapeutics(data.results.therapeutics);

    // Show results section (it contains sub-blocks which individually toggle)
    showSection(resultsSection);
  }

  // -----------------------------------------------------------------------
  // Search handler
  // -----------------------------------------------------------------------

  async function handleSearch(disease, region) {
    lastQuery = { disease, region };

    // Reset UI
    showSection(loadingSection);
    queryMeta.hidden = true;
    sourceBar.hidden = true;
    setLoading(true);

    try {
      const data = await apiSearch(disease, region);
      renderResults(data);
    } catch (err) {
      console.error('Search failed:', err);
      errorTitle.textContent = 'Search Failed';
      errorMessage.textContent = err.message || 'An unexpected error occurred.';
      showSection(errorSection);
    } finally {
      setLoading(false);
    }
  }

  // -----------------------------------------------------------------------
  // Event Listeners
  // -----------------------------------------------------------------------

  searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const disease = diseaseInput.value.trim();
    const region = regionInput.value.trim();
    if (!disease) return;
    handleSearch(disease, region);
  });

  // Hint buttons
  $$('.hint-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      diseaseInput.value = btn.dataset.disease || '';
      regionInput.value = btn.dataset.region || '';
      handleSearch(btn.dataset.disease, btn.dataset.region);
    });
  });

  // Retry button
  errorRetryBtn.addEventListener('click', () => {
    if (lastQuery.disease) {
      handleSearch(lastQuery.disease, lastQuery.region);
    }
  });

  // -----------------------------------------------------------------------
  // Init: focus the disease input
  // -----------------------------------------------------------------------
  diseaseInput.focus();
})();
