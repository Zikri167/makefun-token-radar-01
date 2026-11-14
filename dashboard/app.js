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
      makeSummary()
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
