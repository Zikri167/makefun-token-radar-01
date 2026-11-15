(function () {
  'use strict';

  const DATA = window.RADAR;
  const app = document.getElementById('app');

  const state = {
    query: '',
    category: 'all',
    chain: 'all',
    sort: 'rank',
    minimum: 0,
    protocol: null
  };

  const money = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  });
  const compactMoney = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 1
  });

  function usd(value) {
    if (value === null || value === undefined) return '—';
    return value >= 100000000 ? compactMoney.format(value) : money.format(value);
  }

  function percentage(value) {
    if (value === null || value === undefined) return '—';
    const sign = value >= 0 ? '+' : '';
    return sign + value.toFixed(1) + '%';
  }

  function ageLabel(days) {
    if (days === null || days === undefined) return 'Unknown';
    if (days >= 365) {
      const years = Math.floor(days / 365);
      const months = Math.floor((days % 365) / 30);
      return years + 'y ' + months + 'm';
    }
    return days + 'd';
  }

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  function append(parent, ...children) {
    children.forEach(function (child) {
      if (child) parent.appendChild(child);
    });
    return parent;
  }

  function readHash() {
    const params = new URLSearchParams(window.location.hash.slice(1));
    state.protocol = params.get('protocol');
    state.category = params.get('category') || 'all';
    state.chain = params.get('chain') || 'all';
    state.query = params.get('q') || '';
    state.sort = params.get('sort') || 'rank';
    state.minimum = Number(params.get('min') || 0);
  }

  function writeHash() {
    const params = new URLSearchParams();
    if (state.protocol) params.set('protocol', state.protocol);
    if (state.category !== 'all') params.set('category', state.category);
    if (state.chain !== 'all') params.set('chain', state.chain);
    if (state.query) params.set('q', state.query);
    if (state.sort !== 'rank') params.set('sort', state.sort);
    if (state.minimum > 0) params.set('min', String(state.minimum));

    const next = params.toString();
    const hash = next ? '#' + next : window.location.pathname;
    window.history.replaceState(null, '', hash);
  }

  function availableCategories() {
    return Array.from(new Set(DATA.rows.map(function (row) {
      return row.category || 'Other';
    }))).sort();
  }

  function availableChains() {
    return Array.from(new Set(DATA.rows.flatMap(function (row) {
      return row.chains || [];
    }))).sort();
  }

  function makeSelect(label, selected, options, onChange) {
    const select = element('select');
    select.setAttribute('aria-label', label);

    options.forEach(function (item) {
      const option = element('option', '', item.label);
      option.value = item.value;
      select.appendChild(option);
    });

    select.value = selected;
    select.addEventListener('change', function () {
      onChange(select.value);
      writeHash();
      drawTable();
    });
    return select;
  }

  function makeHeader() {
    const header = element('header', 'top');
    append(
      header,
      element('div', 'brand', 'TOKEN / RADAR     •     RESEARCH DESK'),
      element('div', 'asof', 'SNAPSHOT  ' + DATA.as_of)
    );
    return header;
  }

  function makeSummary() {
    const section = element('section');
    append(
      section,
      element('h1', '', 'The next token, priced by its footprint.'),
      element(
        'p',
        'lede',
        'A ' + DATA.board_size +
          '-protocol launch watch built from TVL, recent momentum, operating age and chain breadth. ' +
          'Every implied value is this radar’s model claim; token status reflects what the snapshot records.'
      )
    );

    const chips = element('div', 'chips');
    [
      ['Universe', DATA.protocol_count],
      ['Watchlist covered', DATA.watchlist_size + ' / ' + DATA.watchlist_size],
      ['Ranked', DATA.board_size],
      ['Live comps', DATA.live.length]
    ].forEach(function (pair) {
      const chip = element('span', 'chip');
      append(chip, document.createTextNode(pair[0] + '  '), element('b', '', pair[1]));
      chips.appendChild(chip);
    });
    section.appendChild(chips);
    section.appendChild(element(
      'div',
      'formula',
      'RADAR-2  ·  implied = max($1, round(TVL x category comp x growth x maturity x chain breadth))'
    ));
    return section;
  }

  function makeAnalytics() {
    const section = element('section', 'analytics');
    const totals = new Map();
    const chains = new Map();
    DATA.rows.forEach(function (row) {
      const category = row.category || 'Other';
      totals.set(category, (totals.get(category) || 0) + 1);
      (row.chains || []).forEach(function (chain) {
        chains.set(chain, (chains.get(chain) || 0) + 1);
      });
    });
    const values = DATA.rows.map(function (row) { return row.implied_value_usd; })
      .sort(function (a, b) { return a - b; });
    const middle = Math.floor(values.length / 2);
    const median = values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2;
    const stats = element('div', 'stats card');
    append(stats, element('div', 'eyebrow', 'BOARD SNAPSHOT'), element('h2', '', 'Coverage at a glance'));
    const categoryLine = Array.from(totals.entries()).sort(function (a, b) {
      return b[1] - a[1] || a[0].localeCompare(b[0]);
    }).map(function (item) { return item[0] + ' ' + item[1]; }).join(' · ');
    const chainLine = Array.from(chains.entries()).sort(function (a, b) {
      return b[1] - a[1] || a[0].localeCompare(b[0]);
    }).map(function (item) { return item[0] + ' ' + item[1]; }).join(' · ');
    append(stats,
      element('p', 'sub', DATA.rows.length + ' ranked protocols across ' + totals.size + ' categories'),
      element('p', 'sub', 'Median implied value · ' + usd(median)),
      element('p', 'sub', 'Combined TVL · ' + usd(DATA.rows.reduce(function (sum, row) { return sum + row.tvl_usd; }, 0))),
      element('p', 'sub', 'Categories · ' + categoryLine),
      element('p', 'sub', 'Protocols per chain · ' + chainLine));

    const chart = element('section', 'chart card');
    append(chart, element('div', 'eyebrow', 'MODEL LEADERS'), element('h2', '', 'Top 10 by implied value'));
    const leaders = DATA.rows.slice().sort(function (a, b) {
      return b.implied_value_usd - a.implied_value_usd || a.rank - b.rank;
    }).slice(0, 10);
    const max = leaders.length ? leaders[0].implied_value_usd : 1;
    const svgNamespace = 'http:' + String.fromCharCode(47, 47) + 'www.w3.org/2000/svg';
    const graphic = document.createElementNS(svgNamespace, 'svg');
    graphic.setAttribute('viewBox', '0 0 720 250');
    graphic.setAttribute('role', 'img');
    graphic.setAttribute('aria-label', 'Top ten protocols by implied value');
    leaders.forEach(function (row, index) {
      const y = index * 24 + 4;
      const label = document.createElementNS(svgNamespace, 'text');
      label.setAttribute('x', '0'); label.setAttribute('y', String(y + 13));
      label.setAttribute('class', 'chart-label'); label.setAttribute('fill', '#91a6a8');
      label.setAttribute('font-size', '11'); label.textContent = row.name.slice(0, 25);
      const bar = document.createElementNS(svgNamespace, 'rect');
      bar.setAttribute('x', '205'); bar.setAttribute('y', String(y)); bar.setAttribute('height', '16');
      bar.setAttribute('width', String(Math.max(2, 370 * row.implied_value_usd / max)));
      bar.setAttribute('rx', '4'); bar.setAttribute('class', 'chart-bar'); bar.setAttribute('fill', '#52e0bd');
      const amount = document.createElementNS(svgNamespace, 'text');
      amount.setAttribute('x', '590'); amount.setAttribute('y', String(y + 13));
      amount.setAttribute('class', 'chart-amount'); amount.setAttribute('fill', '#edf5f3');
      amount.setAttribute('font-size', '10'); amount.textContent = usd(row.implied_value_usd);
      append(graphic, label, bar, amount);
    });
    chart.appendChild(graphic);
    append(section, stats, chart);
    return section;
  }

  function exportRows() {
    const columns = ['rank', 'name', 'slug', 'category', 'chains', 'tvl_usd', 'change_7d', 'age_days', 'implied_value_usd'];
    function quote(value) {
      const text = Array.isArray(value) ? value.join('; ') : value === null || value === undefined ? '' : String(value);
      return '"' + text.replace(/"/g, '""') + '"';
    }
    const lines = [columns.join(',')].concat(sortRows(filteredRows()).map(function (row) {
      return columns.map(function (key) { return quote(row[key]); }).join(',');
    }));
    const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const link = element('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'token-radar-filtered.csv';
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function makeToolbar() {
    const toolbar = element('section', 'toolbar');
    const search = element('input');
    search.type = 'search';
    search.placeholder = 'Search protocol, slug, category or chain';
    search.value = state.query;
    search.setAttribute('aria-label', 'Search protocols');
    search.addEventListener('input', function () {
      state.query = search.value;
      writeHash();
      drawTable();
    });
    toolbar.appendChild(search);

    const categoryOptions = [{ label: 'All categories', value: 'all' }]
      .concat(availableCategories().map(function (category) {
        return { label: category, value: category };
      }));
    toolbar.appendChild(makeSelect(
      'Filter by category',
      state.category,
      categoryOptions,
      function (value) { state.category = value; }
    ));

    const chainOptions = [{ label: 'All chains', value: 'all' }]
      .concat(availableChains().map(function (chain) {
        return { label: chain, value: chain };
      }));
    toolbar.appendChild(makeSelect(
      'Filter by chain',
      state.chain,
      chainOptions,
      function (value) { state.chain = value; }
    ));

    const sortOptions = [
      { label: 'Sort: model rank', value: 'rank' },
      { label: 'Sort: implied value', value: 'value' },
      { label: 'Sort: TVL', value: 'tvl' },
      { label: 'Sort: 7-day change', value: 'change' }
    ];
    toolbar.appendChild(makeSelect(
      'Sort protocols',
      state.sort,
      sortOptions,
      function (value) { state.sort = value; }
    ));

    const minimum = element('input');
    minimum.type = 'number';
    minimum.min = '0';
    minimum.step = '1000000';
    minimum.placeholder = 'Minimum implied $';
    minimum.value = state.minimum || '';
    minimum.setAttribute('aria-label', 'Minimum implied value');
    minimum.addEventListener('change', function () {
      state.minimum = Number(minimum.value) || 0;
      writeHash();
      drawTable();
    });
    toolbar.appendChild(minimum);
    const exportButton = element('button', 'export', 'Export filtered CSV');
    exportButton.type = 'button';
    exportButton.addEventListener('click', exportRows);
    toolbar.appendChild(exportButton);
    return toolbar;
  }

  function filteredRows() {
    const query = state.query.trim().toLowerCase();
    return DATA.rows.filter(function (row) {
      if (state.category !== 'all' && (row.category || 'Other') !== state.category) return false;
      if (state.chain !== 'all' && !(row.chains || []).includes(state.chain)) return false;
      if (row.implied_value_usd < state.minimum) return false;
      if (!query) return true;

      const searchable = [
        row.name,
        row.slug,
        row.category || '',
        (row.chains || []).join(' ')
      ].join(' ').toLowerCase();
      return searchable.includes(query);
    });
  }

  function sortRows(rows) {
    const sortKey = state.sort;
    return rows.slice().sort(function (left, right) {
      if (sortKey === 'value') {
        return right.implied_value_usd - left.implied_value_usd || left.rank - right.rank;
      }
      if (sortKey === 'tvl') {
        return right.tvl_usd - left.tvl_usd || left.rank - right.rank;
      }
      if (sortKey === 'change') {
        const leftChange = left.change_7d === null ? -Infinity : left.change_7d;
        const rightChange = right.change_7d === null ? -Infinity : right.change_7d;
        return rightChange - leftChange || left.rank - right.rank;
      }
      return left.rank - right.rank;
    });
  }

  function makeTableHeader() {
    const head = element('thead');
    const row = element('tr');
    ['#', 'Protocol', 'Category', 'Chains', 'TVL', '7d Δ', 'Age', 'Implied value']
      .forEach(function (label) {
        row.appendChild(element('th', '', label));
      });
    head.appendChild(row);
    return head;
  }

  function openProtocol(slug) {
    state.protocol = slug;
    writeHash();
    render();
  }

  function makeBoardRow(protocol) {
    const row = element('tr');
    row.tabIndex = 0;
    row.setAttribute('aria-label', 'Open details for ' + protocol.name);
    row.addEventListener('click', function () {
      openProtocol(protocol.slug);
    });
    row.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openProtocol(protocol.slug);
      }
    });

    const name = element('td');
    append(
      name,
      element('div', 'name', protocol.name),
      element('div', 'slug', protocol.slug)
    );

    const changeClass = protocol.change_7d === null
      ? 'num'
      : 'num ' + (protocol.change_7d >= 0 ? 'pos' : 'neg');

    append(
      row,
      element('td', 'num rank', protocol.rank),
      name,
      element('td', '', protocol.category || 'Other'),
      element('td', 'sub', (protocol.chains || []).slice(0, 3).join(', ') || '—'),
      element('td', 'num', usd(protocol.tvl_usd)),
      element('td', changeClass, percentage(protocol.change_7d)),
      element('td', 'num', ageLabel(protocol.age_days)),
      element('td', 'num val', usd(protocol.implied_value_usd))
    );
    return row;
  }

  function drawTable() {
    const box = document.getElementById('tablebox');
    if (!box) return;

    box.replaceChildren();
    const rows = sortRows(filteredRows());
    if (rows.length === 0) {
      box.appendChild(element('div', 'empty', 'No protocols match these filters.'));
      return;
    }

    const table = element('table');
    const body = element('tbody');
    rows.forEach(function (row) {
      body.appendChild(makeBoardRow(row));
    });
    append(table, makeTableHeader(), body);
    box.appendChild(table);

    const count = document.getElementById('result-count');
    if (count) count.textContent = rows.length + ' rows shown';
  }

  function makeMethodology() {
    const section = element('section', 'card');
    append(
      section,
      element('div', 'eyebrow', 'METHODOLOGY'),
      element('h2', '', 'One formula, every protocol'),
      element(
        'div',
        'formula',
        'TVL x category comp x growth x maturity x chain breadth'
      )
    );

    const factors = element('ul');
    [
      'TVL: snapshot total value locked, in whole dollars.',
      'Category comp: median live market cap / TVL for that category with at least five live rows; otherwise use the all-category median, clamped to 0.02–2.00.',
      'Growth: 1 + clamp(change_7d, −60%, +120%) / 100 x 0.5; missing seven-day change is zero.',
      'Maturity: 0.6 + min(age_days, 1,095) / 1,095 x 0.4; an unknown listing date uses 365 days.',
      'Chain breadth: 1 + 0.03 x min(max(chain_count − 1, 0), 5).',
      'The watchlist is the house’s $50M TVL floor and excludes specified wrapped, staked and bridged products.'
    ].forEach(function (line) {
      factors.appendChild(element('li', '', line));
    });
    section.appendChild(factors);
    section.appendChild(element(
      'p',
      'sub',
      'Every row uses the same inputs and function. These implied values are this entry’s own claim, not a market quote or prediction. A protocol records no token when the snapshot has no token identifiers; that record is not proof that a token does not exist.'
    ));
    return section;
  }

  function makeLiveTokens() {
    const section = element('section', 'card');
    append(
      section,
      element('div', 'eyebrow', 'LIVE TOKENS'),
      element('h2', '', 'Market values, kept separate'),
      element(
        'p',
        'sub',
        'Top 24 live-token protocols by recorded market cap. These are the snapshot’s market values, never modeled.'
      )
    );

    const table = element('table');
    const header = element('thead');
    const headingRow = element('tr');
    ['Protocol', 'Category', 'TVL', 'Market cap'].forEach(function (label) {
      headingRow.appendChild(element('th', '', label));
    });
    header.appendChild(headingRow);

    const body = element('tbody');
    DATA.live.forEach(function (protocol) {
      const row = element('tr');
      const name = element('td');
      append(
        name,
        element('div', 'name', protocol.name),
        element('div', 'slug', protocol.slug)
      );
      append(
        row,
        name,
        element('td', 'sub', protocol.category || 'Other'),
        element('td', 'num', usd(protocol.tvl_usd)),
        element('td', 'num val', usd(protocol.mcap_usd))
      );
      body.appendChild(row);
    });
    append(table, header, body);

    const tableBox = element('div', 'tablebox');
    tableBox.appendChild(table);
    section.appendChild(tableBox);
    return section;
  }

  function makeFooter() {
    return element(
      'p',
      'footer',
      'Snapshot source: ' + DATA.source + ' · as of ' + DATA.as_of +
        ' · A protocol records no token when the snapshot has no token identifiers.'
    );
  }

  function makeDetail(protocol) {
    const panel = element('aside', 'detail');
    panel.setAttribute('aria-label', protocol.name + ' detail');

    const header = element('header');
    const title = element('div');
    append(
      title,
      element('div', 'eyebrow', 'RANK ' + protocol.rank + ' / ' + DATA.board_size),
      element('h2', '', protocol.name),
      element('div', 'slug', protocol.slug + ' · ' + (protocol.category || 'Other'))
    );

    const close = element('button', 'close', 'Close ×');
    close.type = 'button';
    close.addEventListener('click', function () {
      state.protocol = null;
      writeHash();
      render();
    });
    append(header, title, close);
    panel.appendChild(header);

    const facts = element('section', 'section');
    append(
      facts,
      element('h3', '', 'Protocol facts'),
      element(
        'p',
        'sub',
        'Records no token in this snapshot · Chains: ' + ((protocol.chains || []).join(', ') || '—') +
          ' · TVL: ' + usd(protocol.tvl_usd) +
          ' · 7d change: ' + percentage(protocol.change_7d) +
          ' · tracked age: ' + ageLabel(protocol.age_days)
      )
    );
    panel.appendChild(facts);

    const model = protocol.model;
    const base = Math.round(protocol.tvl_usd * model.comp_multiple);
    const breakdown = element('section', 'section');
    append(
      breakdown,
      element('h3', '', 'Implied value · arithmetic'),
      element(
        'div',
        'equation',
        usd(protocol.tvl_usd) + ' TVL x ' + model.comp_multiple.toFixed(6) +
          ' comp = ' + usd(base) + ' base\n' +
          'Growth input ' + percentage(model.growth_pct) +
          ' → multiplier ' + model.growth_multiplier.toFixed(6) + '\n' +
          'Age ' + ageLabel(protocol.age_days) +
          ' → maturity ' + model.maturity_multiplier.toFixed(6) + '\n' +
          'Chains ' + protocol.chains.length +
          ' → breadth ' + model.chains_multiplier.toFixed(6) + '\n' +
          '= ' + usd(protocol.implied_value_usd) + ' implied value'
      ),
      element(
        'p',
        'sub',
        'Growth is clamped to −60%…+120%; comp is the median live market cap / TVL and is clamped to 0.02–2.00.'
      )
    );
    panel.appendChild(breakdown);

    const factors = [
      ['Comp', model.comp_multiple],
      ['Growth', model.growth_multiplier],
      ['Maturity', model.maturity_multiplier],
      ['Chains', model.chains_multiplier]
    ];
    const factorPanel = element('section', 'section');
    append(factorPanel, element('h3', '', 'Multiplier profile'), element('p', 'sub', 'Each bar is scaled against the largest multiplier in this protocol’s model.'));
    const largest = Math.max.apply(null, factors.map(function (factor) { return factor[1]; }));
    factors.forEach(function (factor) {
      const line = element('div', 'factor-row');
      const label = element('span', 'factor-label', factor[0]);
      const track = element('div', 'factor-track');
      track.style.cssText = 'height:8px;background:#1d2b30;border-radius:5px;overflow:hidden;flex:1';
      const fill = element('div', 'factor-fill');
      fill.style.cssText = 'height:100%;background:#52e0bd;border-radius:5px';
      fill.style.width = Math.max(2, factor[1] / largest * 100) + '%';
      track.appendChild(fill);
      line.style.cssText = 'display:flex;align-items:center;gap:10px;margin:8px 0';
      label.style.cssText = 'width:76px;color:#91a6a8;font-size:12px';
      const value = element('b', 'factor-value', factor[1].toFixed(3) + '×');
      value.style.cssText = 'width:58px;text-align:right;font:11px var(--mono);color:#edf5f3';
      append(line, label, track, value);
      factorPanel.appendChild(line);
    });
    panel.appendChild(factorPanel);

    const nearest = DATA.comps.slice().sort(function (left, right) {
      return Math.abs(left.tvl_usd - protocol.tvl_usd) -
        Math.abs(right.tvl_usd - protocol.tvl_usd) ||
        left.slug.localeCompare(right.slug);
    }).slice(0, 3);

    const comps = element('section', 'section');
    append(
      comps,
      element('h3', '', 'Live comps · market data'),
      element(
        'p',
        'sub',
        'Category median comp multiple: ' + model.comp_multiple.toFixed(6) +
          ' · nearest live protocols by TVL'
      )
    );
    nearest.forEach(function (live) {
      comps.appendChild(element(
        'p',
        'sub',
        live.name + ' · TVL ' + usd(live.tvl_usd) +
          ' · market cap ' + usd(live.mcap_usd)
      ));
    });
    panel.appendChild(comps);

    const farm = element('section', 'section');
    append(
      farm,
      element('h3', '', 'Farm plan · costs & time')
    );
    const steps = element('ol', 'steps');
    protocol.farm_steps.forEach(function (step) {
      const item = element('li');
      const marker = ' Cost: ';
      const splitAt = step.indexOf(marker);
      const action = splitAt < 0 ? step : step.slice(0, splitAt);
      const costAndTime = splitAt < 0 ? '' : step.slice(splitAt + 1);
      append(item, element('b', '', action), element('span', 'cost', costAndTime));
      steps.appendChild(item);
    });
    farm.appendChild(steps);
    panel.appendChild(farm);
    return panel;
  }

  function render() {
    app.replaceChildren();
    const shell = element('div', 'wrap');
    append(
      shell,
      makeHeader(),
      makeSummary(),
      makeAnalytics()
    );

    const sectionHead = element('div', 'section-head');
    const sectionTitle = element('div');
    append(
      sectionTitle,
      element('div', 'eyebrow', '01 / PRE-TOKEN RADAR'),
      element('h2', '', 'Protocols ranked by implied value')
    );
    append(
      sectionHead,
      sectionTitle,
      element('span', 'sub', 'Select a row for its model and six-step plan')
    );

    const controls = makeToolbar();
    const tableBox = element('div', 'tablebox');
    tableBox.id = 'tablebox';

    const resultCount = element('span', 'sub', '');
    resultCount.id = 'result-count';

    const board = element('section');
    append(board, controls, sectionHead, resultCount, tableBox);

    const methodology = element('div', 'method');
    methodology.appendChild(makeMethodology());
    methodology.appendChild(makeLiveTokens());

    append(
      shell,
      board,
      methodology,
      makeFooter()
    );
    app.appendChild(shell);

    drawTable();
    if (state.protocol) {
      const protocol = DATA.rows.find(function (row) {
        return row.slug === state.protocol;
      });
      if (protocol) shell.appendChild(makeDetail(protocol));
    }
  }

  readHash();
  render();
  window.addEventListener('hashchange', function () {
    readHash();
    render();
  });
})();
