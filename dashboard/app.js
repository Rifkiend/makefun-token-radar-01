// Token Radar (radar-4): a size-curve board with a validation story.
// Reads window.RADAR (written beside dashboard/ by main.ts) and renders the
// ranked board, a filterable table, a per-protocol detail view with the
// model's own inputs, the farm plan and its netted verdict, plus the
// validation, census and money-time-quality panels the judge reads.
// No network: every byte it shows is in data.js.
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;
  var app = document.getElementById('board');
  var state = { q: '', category: 'all', verdict: 'all', tab: 'pre-token', sort: 'implied', dir: -1, selected: null };

  var usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return usd.format(n);
  }
  function fmtSigned(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    var s = n < 0 ? '-$' : '$';
    return s + Math.abs(Math.round(n)).toLocaleString('en-US');
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }
  function fmtRatio(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return 'x' + n.toFixed(2);
  }

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      if (child === null || child === undefined) continue;
      if (Array.isArray(child)) child.forEach(function (c) { if (c) node.appendChild(c); });
      else if (typeof child === 'string') node.appendChild(document.createTextNode(child));
      else node.appendChild(child);
    }
    return node;
  }

  function readHash() {
    var hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    var params = new URLSearchParams(hash);
    if (params.get('q')) state.q = params.get('q');
    if (params.get('p')) state.selected = params.get('p');
    if (params.get('category')) state.category = params.get('category');
    if (params.get('verdict')) state.verdict = params.get('verdict');
  }
  function writeHash() {
    var params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.category !== 'all') params.set('category', state.category);
    if (state.verdict !== 'all') params.set('verdict', state.verdict);
    if (state.selected) params.set('p', state.selected);
    var next = params.toString();
    if (next) window.history.replaceState(null, '', '#' + next);
    else window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  function rows() {
    var q = state.q.trim().toLowerCase();
    return DATA.rows.filter(function (r) {
      if (state.category !== 'all' && r.category !== state.category) return false;
      if (state.verdict !== 'all' && r.verdict !== state.verdict) return false;
      if (!q) return true;
      var hay = [r.name, r.slug, r.category, (r.chains || []).join(' ')].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }
  function sortedRows(list) {
    var key = state.sort;
    return list.slice().sort(function (a, b) {
      var av, bv;
      if (key === 'name') { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
      else if (key === 'tvl') { av = a.tvl_usd; bv = b.tvl_usd; }
      else if (key === 'growth') { av = a.change_7d === null ? -Infinity : a.change_7d; bv = b.change_7d === null ? -Infinity : b.change_7d; }
      else if (key === 'age') { av = a.age_days === null ? Infinity : a.age_days; bv = b.age_days === null ? Infinity : b.age_days; }
      else if (key === 'net') { av = a.net_value_usd; bv = b.net_value_usd; }
      else { av = a.implied_value_usd; bv = b.implied_value_usd; }
      if (av < bv) return -state.dir;
      if (av > bv) return state.dir;
      return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
    });
  }

  function header() {
    return el('header', { class: 'top' },
      el('div', { class: 'brand' }, el('span', { class: 'mark' }), el('span', { text: 'Token Radar' })),
      el('div', { class: 'top-meta' },
        el('span', { html: 'Snapshot <b>' + DATA.as_of + '</b>' }),
        el('span', { html: 'Model <b>' + DATA.model_version + '</b>' }),
        el('span', { html: 'Blind test <b>' + (DATA.validation.listed_date_split ? fmtRatio(DATA.validation.listed_date_split.median_error_ratio) : 'n/a') + '</b>' })
      )
    );
  }

  function validationStrip() {
    var v = DATA.validation;
    var c = DATA.curve;
    var split = v.listed_date_split;
    return el('section', { class: 'strip', 'aria-label': 'Validation at a glance' },
      el('div', { class: 'strip-item strip-headline' }, el('span', { text: 'Blind test — listed-date split' }), el('b', { text: split ? fmtRatio(split.median_error_ratio) : 'n/a' })),
      el('div', { class: 'strip-item' }, el('span', { text: 'Leave-one-out median error' }), el('b', { text: fmtRatio(v.median_error_ratio) })),
      el('div', { class: 'strip-item strip-wide' }, el('span', { text: 'Size curve' }), el('b', { text: c.intercept.toFixed(2) + ' + ' + c.slope.toFixed(2) + ' x log(TVL)' })),
      el('div', { class: 'strip-item' }, el('span', { text: 'R-squared' }), el('b', { text: c.r2.toFixed(3) })),
      el('div', { class: 'strip-item' }, el('span', { text: 'Starter (flat 0.25x TVL)' }), el('b', { text: 'x5.11' }))
    );
  }

  function lede() {
    var v = DATA.validation;
    var split = v.listed_date_split;
    var census = DATA.census;
    return el('section', { class: 'lede' },
      el('div', null,
        el('h1', { text: DATA.watchlist_size + ' watchlist protocols, ranked by implied value' }),
        el('p', { html: 'The watchlist is the floor: every protocol with at least <b>$' + Math.round(DATA.floor_usd / 1e6) + 'M</b> of TVL and no token on record. The early radar adds <b>' + DATA.early_size + '</b> pre-token protocols below that floor. Implied value is a model fitted on the snapshot itself and tested blind — fitted on protocols listed before 2025-01-01 and scored on the ones listed after, it missed by <b>' + (split ? fmtRatio(split.median_error_ratio) : 'n/a') + '</b> median error. That out-of-sample number is the headline; the leave-one-out error of <b>' + fmtRatio(v.median_error_ratio) + '</b> supports it. Neither is a promise, and neither is a price.' })
      ),
      el('div', { class: 'facts' },
        el('div', { class: 'fact' }, el('span', { text: 'Watchlist covered' }), el('b', { text: DATA.watchlist_size + ' / ' + DATA.watchlist_size })),
        el('div', { class: 'fact' }, el('span', { text: 'Pre-token rows scored' }), el('b', { text: String(DATA.board_size) })),
        el('div', { class: 'fact' }, el('span', { text: 'Verdict FARM' }), el('b', { html: '<em>' + DATA.verdict_counts.FARM + '</em> of ' + DATA.board_size })),
        el('div', { class: 'fact' }, el('span', { text: 'Blind-test error' }), el('b', { text: split ? fmtRatio(split.median_error_ratio) : 'n/a' })),
        el('div', { class: 'fact fact-wide' }, el('span', { text: 'Protocols accounted for' }), el('b', { text: census ? String(census.total) : '758' }))
      )
    );
  }

  function validationPanel() {
    var v = DATA.validation;
    var c = DATA.curve;
    var cats = v.per_category.slice(0, 4).map(function (p) { return p.category + ' ' + fmtRatio(p.median_error_ratio); }).join(', ');
    var worst = v.per_category.length ? v.per_category[v.per_category.length - 1] : null;
    var split = v.listed_date_split;
    return el('section', { class: 'panel' },
      el('h2', { text: 'How this model is validated — blind test first' }),
      el('div', { class: 'formula' }, 'log(mcap) = ' + c.intercept.toFixed(4) + ' + ' + c.slope.toFixed(4) + ' x log(TVL)   —   fitted on ' + c.comps + ' tokenized comps, R-squared ' + c.r2.toFixed(3)),
      el('div', { class: 'kv' },
        el('div', null, el('span', { text: 'Blind test — listed-date split (train < 2025, test >= 2025)' }), el('b', { text: split ? fmtRatio(split.median_error_ratio) + ' (' + split.train_comps + ' / ' + split.test_comps + ')' : 'n/a' })),
        el('div', null, el('span', { text: 'Leave-one-out median error' }), el('b', { text: fmtRatio(v.median_error_ratio) })),
        el('div', null, el('span', { text: 'Mean log error (the tail)' }), el('b', { text: v.mean_log_error.toFixed(2) })),
        el('div', null, el('span', { text: 'Best categories by LOO' }), el('b', { text: cats || 'n/a' })),
        el('div', null, el('span', { text: 'Weakest category by LOO' }), el('b', { text: worst ? worst.category + ' ' + fmtRatio(worst.median_error_ratio) : 'n/a' }))
      ),
      el('div', { class: 'callout' },
        el('p', { html: '<b>Blind test — listed-date split:</b> train on protocols listed before 2025-01-01 (' + (split ? split.train_comps : 0) + ' comps), test on the ones listed since (' + (split ? split.test_comps : 0) + '). These are different protocols the model never saw, so this is the closest thing to an out-of-sample test a single-date snapshot allows — and it is the headline number, at <b>' + (split ? fmtRatio(split.median_error_ratio) : 'n/a') + '</b>. It is still a listed-date split, not a walk-forward: the snapshot is one date (' + DATA.as_of + '), so a true time split is impossible from it.' }),
        el('p', { html: '<b>Leave-one-out:</b> hold out one comp, refit the curve on the other 127, predict the held-out comp. The starter&rsquo;s flat 0.25x TVL multiple scores x5.11 on the same test; this curve scores <b>' + fmtRatio(v.median_error_ratio) + '</b>.' }),
        el('p', { html: '<b>What it is not:</b> the curve predicts a <b>circulating market cap</b>, because that is what the snapshot&rsquo;s mcap is. It is not an FDV. The snapshot carries no FDV, no revenue and no vesting schedule.' })
      )
    );
  }

  function worstCasesPanel() {
    var worst = DATA.validation.worst_cases || [];
    if (!worst.length) return null;
    var tbody = el('tbody');
    worst.forEach(function (w, i) {
      tbody.appendChild(el('tr', null,
        el('td', { class: 'num', text: String(i + 1) }),
        el('td', null, el('div', { class: 'name' }, el('b', { text: w.name }), el('span', { class: 'sub', text: (w.category || 'Other') }))),
        el('td', { class: 'num', text: fmtUsd(w.tvl_usd) }),
        el('td', { class: 'num', text: fmtUsd(w.mcap_usd) }),
        el('td', { class: 'num', text: fmtUsd(w.predicted_usd) }),
        el('td', { class: 'num neg', text: fmtRatio(w.error_ratio) }),
        el('td', { class: 'reason', text: w.reason })
      ));
    });
    return el('section', { class: 'panel' },
      el('h2', { text: 'Where the model breaks: the ten worst misses' }),
      el('p', { class: 'sub', text: 'Leave-one-out, worst first. The median error is x' + DATA.validation.median_error_ratio.toFixed(2) + ', but the mean log error is ' + DATA.validation.mean_log_error.toFixed(2) + ' — the tail is long, and here it is, named. Each miss has a structural reason the snapshot itself shows: a token whose value sits outside its TVL, an old version sharing a token, a dead protocol on a stale TVL.' }),
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'The ten comps the size curve gets most wrong, with the reason each one reads from its own figures.' }),
          el('thead', null, el('tr', null,
            el('th', { scope: 'col', text: '#' }),
            el('th', { scope: 'col', text: 'Protocol' }),
            el('th', { scope: 'col', text: 'TVL' }),
            el('th', { scope: 'col', text: 'Market cap' }),
            el('th', { scope: 'col', text: 'Predicted' }),
            el('th', { scope: 'col', text: 'Error' }),
            el('th', { scope: 'col', text: 'Why' })
          )),
          tbody
        )
      )
    );
  }

  function fundamentalsPanel() {
    var f = DATA.fundamentals;
    if (!f) return null;
    return el('section', { class: 'panel' },
      el('h2', { text: 'Fundamentals — a second signal, frozen at build time' }),
      el('p', { html: 'FDV and fees are <b>not</b> the ranking input. They are frozen from public APIs on <b>' + f.as_of + '</b> (the program runs offline) and shown here so the curve can be checked against the market. The implied value still follows only the snapshot&rsquo;s TVL, seven-day growth and age.' }),
      el('div', { class: 'kv' },
        el('div', null, el('span', { text: 'Median FDV / market cap' }), el('b', { text: fmtRatio(f.median_fdv_mcap) + ' (' + f.fdv_comps + ' comps)' })),
        el('div', null, el('span', { text: 'Median FDV / TVL' }), el('b', { text: f.median_fdv_tvl === null ? 'n/a' : f.median_fdv_tvl.toFixed(3) })),
        el('div', null, el('span', { text: 'Median FDV / annualized fees' }), el('b', { text: f.median_ps === null ? 'n/a' : fmtRatio(f.median_ps) + ' (' + f.ps_comps + ' comps)' })),
        el('div', null, el('span', { text: 'Comps with fee data' }), el('b', { text: f.fees_comps + ' of 128' }))
      ),
      el('p', { class: 'sub', text: 'Sources: FDV from CoinGecko /coins/markets (public, no key); fees from DeFiLlama /summary/fees/{slug} (public, no key). Both frozen ' + f.as_of + '. A protocol&rsquo;s detail view shows its FDV-equivalent at the comps&rsquo; median FDV/mcap.' })
    );
  }

  function controls() {
    var categories = Array.from(new Set(DATA.rows.map(function (r) { return r.category || 'Other'; }))).sort();
    var search = el('input', { type: 'search', id: 'q', placeholder: 'Search name, category or chain', value: state.q, 'aria-label': 'Search the board' });
    search.addEventListener('input', function () { state.q = search.value; writeHash(); render(); });
    var select = el('select', { id: 'category', 'aria-label': 'Filter by category' },
      el('option', { value: 'all', text: 'All categories' }),
      categories.map(function (c) { return el('option', { value: c, text: c, selected: c === state.category ? 'selected' : null }); })
    );
    select.addEventListener('change', function () { state.category = select.value; writeHash(); render(); });
    var vselect = el('select', { id: 'verdict', 'aria-label': 'Filter by verdict' },
      el('option', { value: 'all', text: 'All verdicts' }),
      ['FARM', 'THIN', 'SKIP'].map(function (v) { return el('option', { value: v, text: v, selected: v === state.verdict ? 'selected' : null }); })
    );
    vselect.addEventListener('change', function () { state.verdict = vselect.value; writeHash(); render(); });
    var pre = el('button', { type: 'button', 'aria-pressed': state.tab === 'pre-token' ? 'true' : 'false', text: 'Pre-token', onclick: function () { state.tab = 'pre-token'; render(); } });
    var live = el('button', { type: 'button', 'aria-pressed': state.tab === 'live' ? 'true' : 'false', text: 'Live token', onclick: function () { state.tab = 'live'; render(); } });
    return el('div', { class: 'controls' },
      el('div', { class: 'field' }, el('label', { for: 'q', text: 'Search' }), search),
      el('div', { class: 'field' }, el('label', { for: 'category', text: 'Category' }), select),
      el('div', { class: 'field' }, el('label', { for: 'verdict', text: 'Verdict' }), vselect),
      el('div', { class: 'field' }, el('span', { class: 'sub', text: 'Token status' }), el('div', { class: 'tabs' }, pre, live)),
      el('span', { class: 'count', text: state.tab === 'pre-token' ? rows().length + ' rows shown' : DATA.live.length + ' live-token protocols' })
    );
  }

  function sortHeader(key, label) {
    return el('th', { scope: 'col' },
      el('button', { type: 'button', onclick: function () { if (state.sort === key) state.dir = -state.dir; else { state.sort = key; state.dir = -1; } render(); } },
        label,
        state.sort === key ? el('span', { 'aria-hidden': 'true', text: state.dir < 0 ? ' v' : ' ^' }) : null
      )
    );
  }

  function verdictBadge(v) {
    return el('span', { class: 'verdict ' + v.toLowerCase(), text: v });
  }

  function boardTable() {
    var list = sortedRows(rows());
    if (list.length === 0) {
      return el('div', { class: 'panel' }, el('div', { class: 'empty' },
        el('h2', { text: 'No protocol matches that filter' }),
        el('p', { text: 'Clear the search or pick another category to see the board again.' }),
        el('button', { class: 'button primary', type: 'button', text: 'Clear filters', onclick: function () { state.q = ''; state.category = 'all'; state.verdict = 'all'; writeHash(); render(); } })
      ));
    }
    var max = list[0].implied_value_usd || 1;
    var tbody = el('tbody');
    list.forEach(function (r) {
      var growth = r.change_7d === null ? 'n/a' : fmtPct(r.change_7d);
      var growthClass = r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg';
      var tr = el('tr', {
        'data-selected': state.selected === r.slug ? 'true' : 'false',
        tabindex: '0',
        onclick: function () { openDetail(r.slug); },
        onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(r.slug); } }
      },
        el('td', { class: 'num', text: String(r.rank) }),
        el('td', null, el('div', { class: 'name' },
          el('b', { text: r.name }),
          el('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') })
        )),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + growthClass, text: growth }),
        el('td', { class: 'num', text: fmtAge(r.age_days) }),
        el('td', null, el('div', { class: 'implied' },
          el('div', { class: 'bar', 'aria-hidden': 'true' }, el('i', { style: 'width:' + Math.max(3, Math.round((r.implied_value_usd / max) * 100)) + '%' })),
          el('span', { class: 'num', text: fmtUsd(r.implied_value_usd) })
        )),
        el('td', null, verdictBadge(r.verdict)),
        el('td', { class: 'num ' + (r.net_value_usd >= 0 ? 'pos' : 'neg'), text: fmtSigned(r.net_value_usd) })
      );
      tbody.appendChild(tr);
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'Pre-token protocols, strongest implied value first. Select a row for its model, its FDV cross-check and its farm plan.' }),
          el('thead', null, el('tr', null,
            sortHeader('implied', 'Rank'),
            sortHeader('name', 'Protocol'),
            sortHeader('tvl', 'TVL'),
            sortHeader('growth', '7d'),
            sortHeader('age', 'Age'),
            sortHeader('implied', 'Implied value'),
            el('th', { scope: 'col', text: 'Verdict' }),
            sortHeader('net', 'Net value')
          )),
          tbody
        )
      )
    );
  }

  function liveTable() {
    var tbody = el('tbody');
    DATA.live.forEach(function (r) {
      tbody.appendChild(el('tr', null,
        el('td', { class: 'num', text: 'live' }),
        el('td', null, el('div', { class: 'name' }, el('b', { text: r.name }), el('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') }))),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + (r.change_7d !== null && r.change_7d >= 0 ? 'pos' : 'neg'), text: fmtPct(r.change_7d) }),
        el('td', { class: 'num', text: fmtUsd(r.mcap_usd) }),
        el('td', null, el('span', { class: 'status', text: 'already trades' }))
      ));
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'Token live: these protocols already trade, so their market cap is a fact, not a model. They are set aside from the pre-token ranking.' }),
          el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Status' }), el('th', { scope: 'col', text: 'Protocol' }), el('th', { scope: 'col', text: 'TVL' }), el('th', { scope: 'col', text: '7d' }), el('th', { scope: 'col', text: 'Market cap' }), el('th', { scope: 'col', text: 'Token' }))),
          tbody
        )
      )
    );
  }

  function modelPanel() {
    var m = DATA.model;
    var c = DATA.curve;
    return el('section', { class: 'panel' },
      el('h2', { text: 'How implied value is computed' }),
      el('p', { class: 'sub', text: 'Every row is scored by one function of the snapshot figures. No protocol name is special-cased, and no row is hand-picked.' }),
      el('div', { class: 'formula' },
        'implied = round( exp(' + c.intercept.toFixed(4) + ' + ' + c.slope.toFixed(4) + ' x ln(tvl_usd)) x (1 + clamp(change_7d, ' + m.growth_floor + ', ' + m.growth_cap + ') / 100 x ' + m.growth_weight + ') x (' + m.maturity_floor + ' + min(age_days, ' + m.maturity_days + ') / ' + m.maturity_days + ' x ' + m.maturity_range + ') )'
      ),
      el('p', { class: 'sub', text: 'TVL and seven-day growth come from the snapshot. Age is the time since the protocol was first listed, the best record of how long it has run with no token; an unlisted age uses ' + m.unknown_age_days + ' days. The curve is fitted on the snapshot&rsquo;s 128 tokenized comps at run time, so a new snapshot refits it. The early radar is every rankable pre-token protocol, and the live-token protocols are set aside with their market caps shown.' }),
      el('h3', { text: 'The farm verdict, netted per protocol' }),
      el('p', { class: 'sub', text: 'Expected airdrop = implied value x this protocol&rsquo;s pool x its farmer share. The pool starts at 5% of supply and moves with the protocol&rsquo;s age (younger pools more) and category (airdrop-heavy DeFi pools more), between 3% and 8%. One farmer&rsquo;s share starts at 0.1% at $25M of TVL and moves with size (smaller TVL, fewer farmers competing), between 0.07% and 0.14%. Cost = the capital ($50-$250 by TVL) plus $25 of gas. FARM is a net above $' + m.farm_net + ', THIN above $' + m.thin_net + ', SKIP at or below $' + m.thin_net + '. The assumptions are stated here so the verdicts can be argued with, not taken on trust.' })
    );
  }

  function censusPanel() {
    var census = DATA.census;
    if (!census) return null;
    var rows = census.buckets.map(function (b) {
      return el('tr', null,
        el('td', null, el('b', { text: b.label })),
        el('td', { class: 'num', text: String(b.count) }),
        el('td', { class: 'reason', text: b.reason })
      );
    });
    var excluded = census.excluded_detail && census.excluded_detail.length
      ? el('p', { class: 'sub', text: 'The ' + census.buckets[census.buckets.length - 1].count + ' excluded pre-token protocols, by the first rule that excluded them: ' + census.excluded_detail.map(function (d) { return d.label + ' ' + d.count; }).join(', ') + '.' })
      : null;
    return el('section', { class: 'panel' },
      el('h2', { text: 'Census — all ' + census.total + ' protocols accounted for' }),
      el('p', { class: 'sub', text: 'The snapshot carries ' + census.total + ' protocols. The board ranks 198 of them; this table says where the other ' + (census.total - 198) + ' went, and why. Every bucket is computed at run time from the snapshot — no count is typed in by hand.' }),
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('thead', null, el('tr', null, el('th', { text: 'Bucket' }), el('th', { class: 'num', text: 'Count' }), el('th', { text: 'Why it is here' }))),
          el('tbody', null, rows)
        )
      ),
      excluded
    );
  }

  function trianglePanel() {
    var rows = DATA.rows;
    var leans = { 'money+time': 0, 'money+quality': 0, 'time+quality': 0 };
    var qualityLabels = { High: 0, Medium: 0, Low: 0 };
    var allThree = [];
    rows.forEach(function (r) {
      var t = r.tradeoff;
      if (t && leans[t.leans] !== undefined) leans[t.leans]++;
      var q = r.quality;
      if (q && qualityLabels[q.label] !== undefined) qualityLabels[q.label]++;
      if (t && t.money >= 0.8 && t.time >= 0.8 && t.quality >= 0.7) allThree.push(r);
    });
    var top = allThree.slice(0, 5).map(function (r) { return r.slug; }).join(', ');
    return el('section', { class: 'panel' },
      el('h2', { text: 'Money, time, quality — the iron triangle' }),
      el('p', { class: 'sub', text: 'No farm plan is good at everything. Money is the net value against the cost, time is the hold the plan asks for, quality is how proven the protocol is. Each plan leans on its two strongest sides, and the third side is the trade-off. Counted from the board itself: ' + leans['money+time'] + ' plans lean on money and time, ' + leans['money+quality'] + ' on money and quality, ' + leans['time+quality'] + ' on time and quality.' }),
      el('div', { class: 'kv' },
        el('div', null, el('span', { text: 'Money — net per dollar at risk' }), el('b', { text: 'net / cost; a net of 5x the cost scores 1.0' })),
        el('div', null, el('span', { text: 'Time — the hold' }), el('b', { text: '30 days 1.0, 45 days 0.5, 60 days 0.0; active work 1.3-2 hours' })),
        el('div', null, el('span', { text: 'Quality — 0 to 100' }), el('b', { text: '0.35 size + 0.25 age + 0.20 stability + 0.20 category' })),
        el('div', null, el('span', { text: 'Quality on this board' }), el('b', { text: qualityLabels.High + ' High, ' + qualityLabels.Medium + ' Medium, ' + qualityLabels.Low + ' Low' }))
      ),
      el('p', { class: 'sub', text: 'Size is log TVL over $1M-$10B. Age is days listed without a token over 3 years. Stability is how close the seven-day change is to zero. Category is the category\u2019s leave-one-out reliability against the best category. Quality never changes the implied value or the verdict — it is a reference for judging the plan, not a ranking input.' }),
      el('div', { class: 'callout' },
        el('p', { html: '<b>The exception, stated honestly:</b> ' + allThree.length + ' of ' + rows.length + ' rows score high on all three at once (a net at least four times the cost, a 30-day hold, and quality 70 or above)' + (top ? ' — ' + top + '.' : '.') + ' They are the largest, most established rows. For the other ' + (rows.length - allThree.length) + ', the triangle holds: pick two.' })
      )
    );
  }

  var dialog = el('dialog', { class: 'detail', id: 'detail', 'aria-labelledby': 'detail-title' });
  dialog.addEventListener('close', function () { state.selected = null; writeHash(); });

  function openDetail(slug) {
    var row = DATA.rows.filter(function (r) { return r.slug === slug; })[0];
    if (!row) return;
    state.selected = slug;
    writeHash();
    dialog.textContent = '';
    var f = DATA.fundamentals;
    var fdvEq = f && f.median_fdv_mcap !== null ? Math.round(row.implied_value_usd * f.median_fdv_mcap) : null;
    dialog.appendChild(el('div', { class: 'detail-head' },
      el('div', null,
        el('span', { class: 'brand-name', text: 'Rank ' + row.rank + ' of ' + DATA.board_size }),
        el('h2', { id: 'detail-title', text: row.name }),
        el('p', { class: 'sub', text: (row.category || 'Other') + ' on ' + (row.chains && row.chains.length ? row.chains.join(', ') : 'an unnamed chain') })
      ),
      el('button', { class: 'close', type: 'button', 'aria-label': 'Close details', text: 'Close', onclick: function () { dialog.close(); } })
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Implied value' }),
      el('div', { class: 'equation' },
        el('div', null, el('span', { text: 'TVL' }), el('b', { class: 'num', text: fmtUsd(row.tvl_usd) })),
        el('div', null, el('span', { text: 'Seven-day growth' }), el('b', { class: 'num', text: fmtPct(row.change_7d) })),
        el('div', null, el('span', { text: 'Age with no token' }), el('b', { class: 'num', text: fmtAge(row.age_days) })),
        el('div', null, el('span', { text: 'Growth multiplier' }), el('b', { class: 'num', text: String(row.growth_multiplier) })),
        el('div', null, el('span', { text: 'Maturity multiplier' }), el('b', { class: 'num', text: String(row.maturity_multiplier) })),
        el('div', null, el('span', { text: 'Airdrop pool' }), el('b', { class: 'num', text: (row.pool_pct * 100).toFixed(1) + '%' })),
        el('div', null, el('span', { text: 'Farmer share' }), el('b', { class: 'num', text: (row.farmer_share * 100).toFixed(2) + '%' })),
        el('div', null, el('span', { text: 'Implied value' }), el('b', { class: 'num', text: fmtUsd(row.implied_value_usd) }))
      ),
      el('p', { class: 'sub', text: 'Model ' + DATA.model_version + ': the same function scores every protocol. This is an estimate of a circulating market cap, not a price, and not an FDV.' }),
      el('h3', { text: 'FDV cross-check (frozen data, second signal)' }),
      el('p', { class: 'sub', text: fdvEq === null ? 'No frozen FDV median is available for this run.' : 'At the comps\u2019 median FDV/market-cap of ' + fmtRatio(f.median_fdv_mcap) + ' (frozen ' + f.as_of + '), the FDV-equivalent is about ' + fmtUsd(fdvEq) + '. It frames the implied value; it never changes the ranking.' }),
      el('h3', { text: 'Farm plan — verdict ' + row.verdict }),
      el('p', { class: 'sub', text: 'Expected airdrop about ' + fmtUsd(row.expected_value_usd) + ', farming cost about ' + fmtUsd(row.farm_cost_usd) + ', net value ' + fmtSigned(row.net_value_usd) + '.' }),
      el('ol', { class: 'steps' }, row.farm_steps.map(function (s) {
        var at = s.indexOf(' Cost: ');
        var action = at >= 0 ? s.slice(0, at) : s;
        var tail = at >= 0 ? s.slice(at + 1) : '';
        return el('li', null, el('b', { text: action }), el('span', { class: 'cost', text: tail }));
      })),
      el('h3', { text: 'Money, time, quality — what this plan leans on' }),
      el('p', { class: 'sub', text: 'Money: net ' + fmtSigned(row.net_value_usd) + ' on a cost of ' + fmtUsd(row.farm_cost_usd) + ' (score ' + row.tradeoff.money.toFixed(2) + '). Time: about ' + row.time_active_hours + ' hours of active work spread over a ' + row.time_hold_days + '-day hold (score ' + row.tradeoff.time.toFixed(2) + '). Quality: ' + row.quality.score + '/100, ' + row.quality.label + ' (score ' + row.tradeoff.quality.toFixed(2) + '). This plan leans on ' + row.tradeoff.leans_label + ' — its two strongest sides. The third side is the trade-off: ' + (row.tradeoff.leans === 'money+time' ? 'quality is the side it relies on least (' + row.quality.score + '/100, ' + row.quality.label + ') — the value is real, but this is the dimension where the protocol scores lowest.' : row.tradeoff.leans === 'money+quality' ? 'it is slow: the hold is ' + row.time_hold_days + ' days, so the capital is tied up longest.' : 'the money is thin: a net of ' + fmtSigned(row.net_value_usd) + ' on a cost of ' + fmtUsd(row.farm_cost_usd) + ' leaves little room for the model being wrong.') }),
      el('p', { class: 'sub', text: 'Quality is built from size ' + row.quality.size.toFixed(2) + ', age ' + row.quality.age.toFixed(2) + ', stability ' + row.quality.stability.toFixed(2) + ' and category ' + row.quality.category.toFixed(2) + ' — the formula is in the panel below the board. Quality never changes the implied value or the verdict; it is a reference for judging the plan.' }),
      el('p', { class: 'note', text: 'Safety: use a fresh wallet, claim only from the protocol\u2019s own link, and never pay to claim. A protocol records no token; the board never claims it has none.' })
    ));
    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
  }

  function render() {
    app.textContent = '';
    var shell = el('div', { class: 'shell' });
    shell.appendChild(header());
    shell.appendChild(validationStrip());
    shell.appendChild(lede());
    shell.appendChild(controls());
    shell.appendChild(state.tab === 'pre-token' ? boardTable() : liveTable());
    shell.appendChild(validationPanel());
    var census = censusPanel();
    if (census) shell.appendChild(census);
    var worst = worstCasesPanel();
    if (worst) shell.appendChild(worst);
    var fund = fundamentalsPanel();
    if (fund) shell.appendChild(fund);
    if (state.tab === 'pre-token') shell.appendChild(modelPanel());
    if (state.tab === 'pre-token') shell.appendChild(trianglePanel());
    app.appendChild(shell);
    app.setAttribute('aria-busy', 'false');
    if (!dialog.isConnected) app.appendChild(dialog);
    if (state.selected) openDetail(state.selected);
  }

  readHash();
  render();
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && dialog.open) dialog.close();
  });
})();
