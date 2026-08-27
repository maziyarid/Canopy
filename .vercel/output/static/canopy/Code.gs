/**
 * CANOPY — Mangools × Google Sheets
 * ---------------------------------
 * Keyword research, rank tracking, list sync, and AI-agent automation
 * against the Mangools REST API (KWFinder, SERPChecker, SERPWatcher).
 *
 * Install: Extensions → Apps Script → paste this file + appsscript.json
 *          → Save → reload the spreadsheet → Canopy menu → Setup workbook.
 *
 * Auth:    Script Properties key MANGOOLS_API_KEY  (X-Access-Token)
 * Docs:    https://apidocs.mangools.com/
 * Token:   https://mangools.com/api-token
 *
 * Web app: Deploy → New deployment → Web app. Your AI agents POST JSON
 *          with { secret, action, payload } to drive this workbook.
 */

var CANOPY = {
  BASE: 'https://api.mangools.com/v3',
  MAX_BULK: 700,
  SHORT_PAUSE_MS: 450,
  MAX_RETRIES: 5,
  EXEC_BUDGET_MS: 5 * 60 * 1000,
  SHEETS: {
    SETTINGS: 'Settings',
    KEYWORDS: 'Keywords',
    RELATED: 'Related',
    TRACKING: 'Tracking',
    COMPETITORS: 'Competitors',
    GAPS: 'Gaps',
    SERP: 'SERP',
    LISTS: 'Lists',
    AGENTS: 'Agents',
    LOCATIONS: 'Locations',
    QUOTA: 'Quota',
    LOG: 'Log'
  }
};

/* ------------------------------------------------------------------ */
/*  Menu                                                              */
/* ------------------------------------------------------------------ */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Canopy')
    .addItem('Setup workbook', 'canopySetup')
    .addItem('Save API key…', 'canopyPromptApiKey')
    .addItem('Check quota', 'canopyRefreshQuota')
    .addSeparator()
    .addItem('Score selected / Keywords sheet (bulk import)', 'canopyBulkImport')
    .addItem('Expand related keywords', 'canopyRelated')
    .addItem('Fetch SERP + live KD', 'canopySerp')
    .addSeparator()
    .addItem('Competitor keywords', 'canopyCompetitorKeywords')
    .addItem('Keyword gap analysis', 'canopyGapAnalysis')
    .addItem('Suggested keywords for URL', 'canopySuggested')
    .addSeparator()
    .addItem('Refresh rank tracking', 'canopyRefreshTracking')
    .addItem('Create tracking from Keywords', 'canopyCreateTracking')
    .addItem('Sync KWFinder lists', 'canopySyncLists')
    .addItem('Search locations…', 'canopySearchLocations')
    .addSeparator()
    .addItem('Run due agent tasks', 'canopyRunAgents')
    .addItem('Install daily trigger', 'canopyInstallTriggers')
    .addItem('Remove triggers', 'canopyRemoveTriggers')
    .addToUi();
}

function onInstall(e) {
  onOpen();
}

/* ------------------------------------------------------------------ */
/*  Setup                                                             */
/* ------------------------------------------------------------------ */

function canopySetup() {
  var ss = SpreadsheetApp.getActive();
  ensureSheet_(ss, CANOPY.SHEETS.SETTINGS, [
    ['Key', 'Value', 'Notes'],
    ['MANGOOLS_API_KEY', getProp_('MANGOOLS_API_KEY', ''), 'Also stored in Script Properties. Never share this file.'],
    ['DEFAULT_LOCATION_ID', getProp_('DEFAULT_LOCATION_ID', '2840'), '2840 = United States. Search via Canopy → Search locations.'],
    ['DEFAULT_LANGUAGE_ID', getProp_('DEFAULT_LANGUAGE_ID', '1000'), '1000 = English'],
    ['HOME_DOMAIN', getProp_('HOME_DOMAIN', ''), 'Your site for gap analysis and tracking'],
    ['COMPETITORS', getProp_('COMPETITORS', ''), 'Comma-separated, max 5'],
    ['TRACKING_ID', getProp_('TRACKING_ID', ''), 'SERPWatcher project id'],
    ['PLATFORM_ID', getProp_('PLATFORM_ID', '1'), '1 desktop, 2 mobile'],
    ['LLM_BASE_URL', getProp_('LLM_BASE_URL', 'https://api.x.ai/v1'), 'OpenAI-compatible chat endpoint'],
    ['LLM_API_KEY', getProp_('LLM_API_KEY', ''), 'Optional. Used by Brief / Scout agents.'],
    ['LLM_MODEL', getProp_('LLM_MODEL', 'grok-4.5'), 'Model id'],
    ['WEBHOOK_SECRET', getProp_('WEBHOOK_SECRET', randomSecret_()), 'Required for doPost agent automation'],
    ['DAILY_HOUR', getProp_('DAILY_HOUR', '6'), 'Hour (spreadsheet timezone) for Watch trigger']
  ]);
  ensureSheet_(ss, CANOPY.SHEETS.KEYWORDS, [[
    'Seed', 'Keyword', 'Location ID', 'Language ID', 'Volume', 'KD', 'CPC', 'PPC',
    'Opportunity', 'Status', 'Last fetched', 'Keyword ID', 'Notes', 'Agent'
  ]]);
  ensureSheet_(ss, CANOPY.SHEETS.RELATED, [[
    'Seed', 'Keyword', 'Location ID', 'Volume', 'KD', 'CPC', 'PPC', 'Opportunity',
    'Keyword ID', 'Fetched'
  ]]);
  ensureSheet_(ss, CANOPY.SHEETS.TRACKING, [[
    'Tracking ID', 'Domain', 'Keyword', 'Location ID', 'Device', 'Rank', 'Prev',
    'Change', 'Best', 'Visits', 'Volume', 'URL', 'Last check'
  ]]);
  ensureSheet_(ss, CANOPY.SHEETS.COMPETITORS, [[
    'Domain', 'Keyword', 'Volume', 'KD', 'CPC', 'PPC', 'Position', 'Keyword ID'
  ]]);
  ensureSheet_(ss, CANOPY.SHEETS.GAPS, [[
    'Keyword', 'Volume', 'CPC', 'Your position', 'Competitor', 'Competitor position'
  ]]);
  ensureSheet_(ss, CANOPY.SHEETS.SERP, [[
    'Keyword', 'Position', 'URL', 'Title', 'Domain', 'KD', 'SERP features', 'Fetched'
  ]]);
  ensureSheet_(ss, CANOPY.SHEETS.LISTS, [['List ID', 'Name', 'Keywords', 'Updated']]);
  ensureSheet_(ss, CANOPY.SHEETS.AGENTS, [
    ['Agent', 'Action', 'Input', 'Status', 'Output', 'Last run', 'Auto'],
    ['Scout', 'seeds', 'waterproof field notebook for hikers', 'idle', '', '', 'FALSE'],
    ['Expander', 'related', 'Keywords!B2:B', 'idle', '', '', 'TRUE'],
    ['Assessor', 'bulk', 'Keywords!B2:B', 'idle', '', '', 'TRUE'],
    ['Rival', 'gap', '', 'idle', '', '', 'FALSE'],
    ['Watch', 'track', '', 'idle', '', '', 'TRUE'],
    ['Brief', 'brief', 'Keywords!B2', 'idle', '', '', 'FALSE']
  ]);
  ensureSheet_(ss, CANOPY.SHEETS.LOCATIONS, [['ID', 'Label', 'Country', 'Type', 'Google domain']]);
  ensureSheet_(ss, CANOPY.SHEETS.QUOTA, [['Resource', 'Limit', 'Remaining', 'Reset (s)', 'Checked']]);
  ensureSheet_(ss, CANOPY.SHEETS.LOG, [['When', 'Level', 'Action', 'Detail', 'HTTP', 'Credits']]);

  syncSettingsToProps_();
  styleWorkbook_(ss);
  canopyRefreshQuota();
  ss.toast('Canopy workbook is ready. Add your API key if you have not.', 'Canopy', 6);
}

function canopyPromptApiKey() {
  var ui = SpreadsheetApp.getUi();
  var res = ui.prompt(
    'Mangools API key',
    'Paste the token from mangools.com/api-token. It is stored in Script Properties, not in cells, after save.',
    ui.ButtonSet.OK_CANCEL
  );
  if (res.getSelectedButton() !== ui.Button.OK) return;
  var key = res.getResponseText().trim();
  if (!key) return;
  setProp_('MANGOOLS_API_KEY', key);
  writeSetting_('MANGOOLS_API_KEY', '(stored in Script Properties)');
  canopyRefreshQuota();
  SpreadsheetApp.getActive().toast('API key saved.', 'Canopy', 4);
}

/* ------------------------------------------------------------------ */
/*  HTTP client                                                       */
/* ------------------------------------------------------------------ */

function mangoolsFetch_(path, opt) {
  opt = opt || {};
  var key = getApiKey_();
  var url = CANOPY.BASE + path;
  if (opt.query) url += (url.indexOf('?') === -1 ? '?' : '&') + toQuery_(opt.query);
  var method = (opt.method || 'get').toUpperCase();
  var payload = opt.body ? JSON.stringify(opt.body) : null;
  var attempt = 0;
  var wait = 600;

  while (true) {
    attempt++;
    var params = {
      method: method,
      muteHttpExceptions: true,
      followRedirects: true,
      headers: {
        'X-Access-Token': key,
        'Accept': 'application/json'
      }
    };
    if (payload) {
      params.contentType = 'application/json';
      params.payload = payload;
    }
    var res = UrlFetchApp.fetch(url, params);
    var code = res.getResponseCode();
    var text = res.getContentText();
    if (code === 429 && attempt <= CANOPY.MAX_RETRIES) {
      log_('warn', path, '429 Too Many Requests — backing off ' + wait + 'ms', code, 0);
      Utilities.sleep(wait);
      wait = Math.min(wait * 2, 8000);
      continue;
    }
    if (code >= 500 && attempt <= CANOPY.MAX_RETRIES) {
      Utilities.sleep(wait);
      wait = Math.min(wait * 2, 8000);
      continue;
    }
    var json = {};
    try { json = text ? JSON.parse(text) : {}; } catch (err) { json = { raw: text }; }
    if (code >= 400) {
      var msg = (json && (json.message || json.error || json.detail)) || text.slice(0, 400);
      log_('error', path, msg, code, 0);
      throw new Error('Mangools ' + code + ' on ' + method + ' ' + path + ': ' + msg);
    }
    log_('info', path, method + ' ok', code, opt.credits || 0);
    return json;
  }
}

function toQuery_(obj) {
  var parts = [];
  Object.keys(obj).forEach(function (k) {
    if (obj[k] === undefined || obj[k] === null || obj[k] === '') return;
    parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(obj[k]));
  });
  return parts.join('&');
}

function getApiKey_() {
  syncSettingsToProps_();
  var key = getProp_('MANGOOLS_API_KEY', '');
  if (!key || key.indexOf('stored') !== -1) {
    throw new Error('Set MANGOOLS_API_KEY via Canopy → Save API key.');
  }
  return key;
}

/* ------------------------------------------------------------------ */
/*  Keyword research                                                  */
/* ------------------------------------------------------------------ */

function canopyBulkImport() {
  var ss = SpreadsheetApp.getActive();
  var sheet = ss.getSheetByName(CANOPY.SHEETS.KEYWORDS);
  var rows = readObjects_(sheet);
  var loc = Number(getSetting_('DEFAULT_LOCATION_ID', 2840));
  var lang = Number(getSetting_('DEFAULT_LANGUAGE_ID', 1000));
  var selected = getSelectedKeywords_(sheet, rows, 1);
  if (!selected.length) throw new Error('Select keyword cells in column B, or fill the Keywords sheet.');
  var chunks = chunk_(unique_(selected), CANOPY.MAX_BULK);
  var started = Date.now();
  var written = 0;
  chunks.forEach(function (keywords, i) {
    if (Date.now() - started > CANOPY.EXEC_BUDGET_MS) {
      log_('warn', 'keyword-imports', 'Stopped to stay under the 6-minute Apps Script cap. Re-run to continue.', 0, 0);
      return;
    }
    var data = mangoolsFetch_('/kwfinder/keyword-imports', {
      method: 'post',
      body: { keywords: keywords, location_id: loc, language_id: lang },
      credits: 1
    });
    written += upsertKeywordMetrics_(sheet, rows, data.keywords || [], loc, lang, 'Assessor');
    if (i < chunks.length - 1) Utilities.sleep(CANOPY.SHORT_PAUSE_MS);
  });
  ss.toast('Scored ' + written + ' keywords.', 'Canopy', 5);
}

function canopyRelated() {
  var ss = SpreadsheetApp.getActive();
  var seed = getActiveKeyword_() || getSetting_('LAST_SEED', '');
  if (!seed) {
    var ui = SpreadsheetApp.getUi();
    var res = ui.prompt('Related keywords', 'Seed keyword:', ui.ButtonSet.OK_CANCEL);
    if (res.getSelectedButton() !== ui.Button.OK) return;
    seed = res.getResponseText().trim();
  }
  if (!seed) return;
  var loc = Number(getSetting_('DEFAULT_LOCATION_ID', 2840));
  var lang = Number(getSetting_('DEFAULT_LANGUAGE_ID', 1000));
  var data = mangoolsFetch_('/kwfinder/related-keywords', {
    query: { kw: seed, location_id: loc, language_id: lang },
    credits: 1
  });
  var out = ss.getSheetByName(CANOPY.SHEETS.RELATED);
  var values = (data.keywords || []).map(function (k) {
    return [
      seed,
      k.kw,
      k.lid || loc,
      num_(k.sv),
      k.seo == null ? '' : num_(k.seo),
      num_(k.cpc),
      num_(k.ppc),
      opportunity_(num_(k.sv), k.seo, num_(k.ppc)),
      k._id || '',
      new Date()
    ];
  });
  writeBelowHeader_(out, values, true);
  setProp_('LAST_SEED', seed);
  ss.toast((values.length) + ' related keywords for "' + seed + '".', 'Canopy', 5);
}

function canopySerp() {
  var kw = getActiveKeyword_();
  if (!kw) throw new Error('Select a keyword cell first.');
  var loc = Number(getSetting_('DEFAULT_LOCATION_ID', 2840));
  var lang = Number(getSetting_('DEFAULT_LANGUAGE_ID', 1000));
  var data = mangoolsFetch_('/serpchecker/serps', {
    query: { kw: kw, location_id: loc, language_id: lang },
    credits: 1
  });
  var items = data.organic || data.results || data.serps || data.items || [];
  var kd = data.seo || data.kd || (data.keyword && data.keyword.seo) || '';
  var features = serializeFeatures_(data);
  var rows = items.map(function (item, i) {
    return [
      kw,
      item.position || item.pos || (i + 1),
      item.url || item.link || '',
      item.title || '',
      item.domain || host_(item.url || item.link || ''),
      kd,
      features,
      new Date()
    ];
  });
  writeBelowHeader_(SpreadsheetApp.getActive().getSheetByName(CANOPY.SHEETS.SERP), rows, true);
  patchKeywordKd_(kw, kd);
  SpreadsheetApp.getActive().toast('SERP stored (' + rows.length + ' URLs). KD=' + kd, 'Canopy', 5);
}

function canopySuggested() {
  var domain = getSetting_('HOME_DOMAIN', '');
  if (!domain) throw new Error('Set HOME_DOMAIN on the Settings sheet.');
  var data = mangoolsFetch_('/kwfinder/suggested-keywords', {
    query: { url: domain },
    credits: 1
  });
  var kws = (data.keywords || data.items || []).map(function (k) { return k.kw || k.keyword || k; });
  appendSeeds_(kws, 'suggested');
  SpreadsheetApp.getActive().toast('Suggested ' + kws.length + ' keywords for ' + domain, 'Canopy', 5);
}

/* ------------------------------------------------------------------ */
/*  Competitors & gaps                                                */
/* ------------------------------------------------------------------ */

function canopyCompetitorKeywords() {
  var ui = SpreadsheetApp.getUi();
  var res = ui.prompt('Competitor keywords', 'Domain, subdomain, or URL:', ui.ButtonSet.OK_CANCEL);
  if (res.getSelectedButton() !== ui.Button.OK) return;
  var url = res.getResponseText().trim();
  if (!url) return;
  var loc = Number(getSetting_('DEFAULT_LOCATION_ID', 2840));
  var data = mangoolsFetch_('/kwfinder/competitor-keywords', {
    query: { url: url, location_id: loc },
    credits: 1
  });
  var rows = (data.keywords || []).map(function (k) {
    return [
      url,
      k.kw,
      num_(k.sv),
      k.seo == null ? '' : num_(k.seo),
      num_(k.cpc),
      num_(k.ppc),
      (k.h && k.h[0] && k.h[0][2]) || '',
      k._id || ''
    ];
  });
  writeBelowHeader_(SpreadsheetApp.getActive().getSheetByName(CANOPY.SHEETS.COMPETITORS), rows, true);
  SpreadsheetApp.getActive().toast(rows.length + ' competitor keywords for ' + url, 'Canopy', 5);
}

function canopyGapAnalysis() {
  var domain = getSetting_('HOME_DOMAIN', '');
  var comps = getSetting_('COMPETITORS', '')
    .split(',')
    .map(function (s) { return s.trim(); })
    .filter(Boolean)
    .slice(0, 5);
  if (!domain) throw new Error('Set HOME_DOMAIN on Settings.');
  if (!comps.length) throw new Error('Set COMPETITORS on Settings (comma-separated, max 5).');
  var loc = Number(getSetting_('DEFAULT_LOCATION_ID', 2840));
  var data = mangoolsFetch_('/kwfinder/gap-analysis', {
    method: 'post',
    body: { domain: domain, competitors: comps, location_id: loc },
    credits: 1
  });
  var rows = [];
  (data.results || []).forEach(function (block) {
    (block.items || []).forEach(function (item) {
      rows.push([
        item.keyword || item.kw,
        num_(item.search_volume || item.sv),
        num_(item.cpc),
        item.your_position == null ? '' : item.your_position,
        block.domain || item.competitor || '',
        item.competitor_position || ''
      ]);
    });
  });
  writeBelowHeader_(SpreadsheetApp.getActive().getSheetByName(CANOPY.SHEETS.GAPS), rows, true);
  SpreadsheetApp.getActive().toast(rows.length + ' gap keywords.', 'Canopy', 5);
}

/* ------------------------------------------------------------------ */
/*  Rank tracking                                                     */
/* ------------------------------------------------------------------ */

function canopyRefreshTracking() {
  var id = getSetting_('TRACKING_ID', '');
  if (!id) {
    var trackings = mangoolsFetch_('/serpwatcher/trackings');
    var list = trackings.trackings || trackings.items || trackings || [];
    if (!Array.isArray(list) || !list.length) throw new Error('No SERPWatcher trackings. Create one first.');
    id = list[0]._id || list[0].id;
    writeSetting_('TRACKING_ID', id);
  }
  var detail = mangoolsFetch_('/serpwatcher/trackings/' + encodeURIComponent(id) + '/detail');
  var stats = mangoolsFetch_('/serpwatcher/trackings/' + encodeURIComponent(id) + '/stats', { method: 'post', body: {} });
  var domain = (detail.domain || getSetting_('HOME_DOMAIN', ''));
  var loc = detail.location_id || getSetting_('DEFAULT_LOCATION_ID', '');
  var device = Number(detail.platform_id || getSetting_('PLATFORM_ID', 1)) === 2 ? 'mobile' : 'desktop';
  var byKw = indexBy_(stats.keywords || stats.items || [], function (k) { return (k.kw || k.keyword || '').toLowerCase(); });
  var rows = (detail.keywords || detail.tracked_keywords || stats.keywords || []).map(function (k) {
    var kw = k.kw || k.keyword;
    var s = byKw[(kw || '').toLowerCase()] || k;
    var rank = firstNum_(s.rank, s.position, s.current_rank);
    var prev = firstNum_(s.prev, s.previous_rank, s.rank_previous);
    var change = (rank != null && prev != null) ? (prev - rank) : '';
    return [
      id,
      domain,
      kw,
      loc,
      device,
      rank == null ? '' : rank,
      prev == null ? '' : prev,
      change,
      firstNum_(s.best, s.best_rank, '') || '',
      num_(s.visits || s.estimated_visits),
      num_(s.sv || s.search_volume),
      s.url || s.ranking_url || '',
      new Date()
    ];
  });
  writeBelowHeader_(SpreadsheetApp.getActive().getSheetByName(CANOPY.SHEETS.TRACKING), rows, true);
  SpreadsheetApp.getActive().toast('Tracking refreshed (' + rows.length + ' keywords).', 'Canopy', 5);
}

function canopyCreateTracking() {
  var domain = getSetting_('HOME_DOMAIN', '');
  if (!domain) throw new Error('Set HOME_DOMAIN on Settings.');
  var sheet = SpreadsheetApp.getActive().getSheetByName(CANOPY.SHEETS.KEYWORDS);
  var kws = unique_(readObjects_(sheet).map(function (r) { return r.Keyword; }).filter(Boolean)).slice(0, 50);
  if (!kws.length) throw new Error('Add keywords before creating a tracking.');
  var body = {
    domain: domain,
    location_id: Number(getSetting_('DEFAULT_LOCATION_ID', 2840)),
    platform_id: Number(getSetting_('PLATFORM_ID', 1)),
    keywords: kws
  };
  var data = mangoolsFetch_('/serpwatcher/trackings', { method: 'post', body: body, credits: kws.length });
  var id = data._id || data.id || (data.tracking && (data.tracking._id || data.tracking.id));
  if (id) writeSetting_('TRACKING_ID', id);
  SpreadsheetApp.getActive().toast('Tracking created' + (id ? ': ' + id : ''), 'Canopy', 6);
}

/* ------------------------------------------------------------------ */
/*  Lists, locations, quota                                           */
/* ------------------------------------------------------------------ */

function canopySyncLists() {
  var data = mangoolsFetch_('/kwfinder/lists');
  var lists = data.lists || data.items || data || [];
  var rows = (Array.isArray(lists) ? lists : []).map(function (l) {
    return [l._id || l.id, l.name || l.title, l.count || (l.keywords && l.keywords.length) || '', new Date()];
  });
  writeBelowHeader_(SpreadsheetApp.getActive().getSheetByName(CANOPY.SHEETS.LISTS), rows, true);
  SpreadsheetApp.getActive().toast(rows.length + ' lists synced.', 'Canopy', 4);
}

function canopySearchLocations() {
  var ui = SpreadsheetApp.getUi();
  var res = ui.prompt('Locations', 'City, region, or country:', ui.ButtonSet.OK_CANCEL);
  if (res.getSelectedButton() !== ui.Button.OK) return;
  var q = res.getResponseText().trim();
  if (!q) return;
  var data = mangoolsFetch_('/mangools/locations', { query: { query: q } });
  var items = data.locations || data.items || data || [];
  var rows = (Array.isArray(items) ? items : []).map(function (l) {
    return [l._id || l.id, l.label || l.name || l.canonical_name, l.country_code || l.code, l.type || '', l.google_domain || ''];
  });
  writeBelowHeader_(SpreadsheetApp.getActive().getSheetByName(CANOPY.SHEETS.LOCATIONS), rows, true);
  SpreadsheetApp.getActive().toast(rows.length + ' locations. Copy an ID into DEFAULT_LOCATION_ID.', 'Canopy', 6);
}

function canopyRefreshQuota() {
  var data = mangoolsFetch_('/kwfinder/limits');
  var now = new Date();
  var rows = [];
  Object.keys(data).forEach(function (k) {
    var v = data[k];
    if (v && typeof v === 'object' && 'limit' in v) {
      rows.push([k, v.limit, v.remaining, v.reset, now]);
    }
  });
  if (data.resources && data.resources.limit != null) {
    rows.unshift(['keyword lookups (resources)', data.resources.limit, data.resources.remaining, data.resources.reset, now]);
  }
  writeBelowHeader_(SpreadsheetApp.getActive().getSheetByName(CANOPY.SHEETS.QUOTA), rows, true);
}

/* ------------------------------------------------------------------ */
/*  Custom functions (use in cells)                                   */
/* ------------------------------------------------------------------ */

/**
 * Average monthly search volume for a keyword.
 * @param {string} keyword
 * @param {number} location_id Optional. Default from Settings.
 * @param {number} language_id Optional.
 * @return {number}
 * @customfunction
 */
function MANGOOLS_VOLUME(keyword, location_id, language_id) {
  var k = fetchOne_(keyword, location_id, language_id);
  return num_(k.sv);
}

/**
 * Keyword difficulty (cached). Empty if Mangools has not computed KD yet —
 * run Canopy → Fetch SERP + live KD to recompute.
 * @param {string} keyword
 * @customfunction
 */
function MANGOOLS_KD(keyword, location_id, language_id) {
  var k = fetchOne_(keyword, location_id, language_id);
  return k.seo == null ? '' : num_(k.seo);
}

/**
 * Cost per click.
 * @param {string} keyword
 * @customfunction
 */
function MANGOOLS_CPC(keyword, location_id, language_id) {
  var k = fetchOne_(keyword, location_id, language_id);
  return num_(k.cpc);
}

/**
 * PPC competition 0–100.
 * @param {string} keyword
 * @customfunction
 */
function MANGOOLS_PPC(keyword, location_id, language_id) {
  var k = fetchOne_(keyword, location_id, language_id);
  return num_(k.ppc);
}

/**
 * Opportunity score: volume / (KD+8) × (1 − 0.45·PPC).
 * @param {string} keyword
 * @customfunction
 */
function MANGOOLS_SCORE(keyword, location_id, language_id) {
  var k = fetchOne_(keyword, location_id, language_id);
  return opportunity_(num_(k.sv), k.seo, num_(k.ppc));
}

function fetchOne_(keyword, location_id, language_id) {
  if (!keyword) return {};
  var loc = Number(location_id || getSetting_('DEFAULT_LOCATION_ID', 2840));
  var lang = Number(language_id || getSetting_('DEFAULT_LANGUAGE_ID', 1000));
  var cache = CacheService.getDocumentCache();
  var ck = 'kw_' + loc + '_' + lang + '_' + String(keyword).toLowerCase();
  var hit = cache.get(ck);
  if (hit) return JSON.parse(hit);
  var data = mangoolsFetch_('/kwfinder/keyword-imports', {
    method: 'post',
    body: { keywords: [String(keyword)], location_id: loc, language_id: lang },
    credits: 1
  });
  var k = (data.keywords && data.keywords[0]) || {};
  cache.put(ck, JSON.stringify(k), 21600);
  return k;
}

/* ------------------------------------------------------------------ */
/*  Triggers                                                          */
/* ------------------------------------------------------------------ */

function canopyInstallTriggers() {
  canopyRemoveTriggers();
  var hour = Number(getSetting_('DAILY_HOUR', 6));
  ScriptApp.newTrigger('canopyDailyJob').timeBased().atHour(hour).everyDays(1).create();
  SpreadsheetApp.getActive().toast('Daily trigger installed at hour ' + hour + '.', 'Canopy', 5);
}

function canopyRemoveTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    var h = t.getHandlerFunction();
    if (h === 'canopyDailyJob' || h === 'canopyRunAgents') ScriptApp.deleteTrigger(t);
  });
}

function canopyDailyJob() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return;
  try {
    canopyRefreshQuota();
    try { canopyRefreshTracking(); } catch (e) { log_('warn', 'daily.track', e.message, 0, 0); }
    canopyRunAgents(true);
  } finally {
    lock.releaseLock();
  }
}

/* ------------------------------------------------------------------ */
/*  Agents                                                            */
/* ------------------------------------------------------------------ */

function canopyRunAgents(autoOnly) {
  var sheet = SpreadsheetApp.getActive().getSheetByName(CANOPY.SHEETS.AGENTS);
  if (!sheet) return;
  var rows = readObjects_(sheet);
  rows.forEach(function (row, i) {
    if (autoOnly && String(row.Auto).toUpperCase() !== 'TRUE') return;
    var status = String(row.Status || 'idle').toLowerCase();
    if (status === 'skip' || status === 'done') return;
    var agent = String(row.Agent || '').toLowerCase();
    var action = String(row.Action || agent).toLowerCase();
    var input = String(row.Input || '');
    try {
      var output = runAgentTask_(agent, action, input);
      sheet.getRange(i + 2, 4, 1, 3).setValues([['ok', String(output).slice(0, 400), new Date()]]);
    } catch (err) {
      sheet.getRange(i + 2, 4, 1, 3).setValues([['error', err.message.slice(0, 400), new Date()]]);
    }
  });
}

function runAgentTask_(agent, action, input) {
  if (action === 'related' || agent === 'expander') {
    if (input.indexOf('!') !== -1) {
      var seeds = flattenRange_(input);
      seeds.slice(0, 5).forEach(function (s, idx) {
        SpreadsheetApp.getActive().setActiveRange(
          SpreadsheetApp.getActive().getSheetByName(CANOPY.SHEETS.KEYWORDS).getRange('B2')
        );
        setProp_('LAST_SEED', s);
        if (idx) Utilities.sleep(CANOPY.SHORT_PAUSE_MS);
        var loc = Number(getSetting_('DEFAULT_LOCATION_ID', 2840));
        var lang = Number(getSetting_('DEFAULT_LANGUAGE_ID', 1000));
        mangoolsFetch_('/kwfinder/related-keywords', {
          query: { kw: s, location_id: loc, language_id: lang },
          credits: 1
        });
      });
      return 'Expanded ' + Math.min(5, seeds.length) + ' seeds';
    }
    setProp_('LAST_SEED', input);
    canopyRelated();
    return 'related ' + input;
  }
  if (action === 'bulk' || agent === 'assessor') {
    canopyBulkImport();
    return 'bulk scored';
  }
  if (action === 'gap' || agent === 'rival') {
    canopyGapAnalysis();
    return 'gap analysis';
  }
  if (action === 'track' || agent === 'watch') {
    canopyRefreshTracking();
    return 'tracking refreshed';
  }
  if (action === 'seeds' || agent === 'scout' || action === 'brief' || agent === 'brief') {
    return llmAgent_(agent || action, input);
  }
  throw new Error('Unknown agent action: ' + action);
}

function llmAgent_(role, input) {
  var key = getSetting_('LLM_API_KEY', '');
  if (!key) {
    if (role === 'scout' || role === 'seeds') {
      var guesses = String(input).split(/[,\n]/).map(function (s) { return s.trim(); }).filter(Boolean);
      appendSeeds_(guesses, 'Scout');
      return 'Queued ' + guesses.length + ' seeds (no LLM key; used input as list)';
    }
    return 'No LLM_API_KEY set — skipped ' + role;
  }
  var base = getSetting_('LLM_BASE_URL', 'https://api.x.ai/v1').replace(/\/$/, '');
  var model = getSetting_('LLM_MODEL', 'grok-4.5');
  var system = role === 'brief' || role === 'Brief'
    ? 'You write concise SEO content briefs. Return markdown: search intent, outline (H2s), questions to answer, internal links, and a title. 250 words max.'
    : 'You are an SEO keyword researcher. Return 15 seed keywords as a JSON array of strings. No commentary.';
  var res = UrlFetchApp.fetch(base + '/chat/completions', {
    method: 'post',
    contentType: 'application/json',
    muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + key },
    payload: JSON.stringify({
      model: model,
      temperature: 0.4,
      max_tokens: 700,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: String(input) }
      ]
    })
  });
  if (res.getResponseCode() >= 400) throw new Error('LLM ' + res.getResponseCode() + ': ' + res.getContentText().slice(0, 240));
  var body = JSON.parse(res.getContentText());
  var text = (((body.choices || [])[0] || {}).message || {}).content || '';
  if (role === 'scout' || role === 'seeds') {
    var seeds = parseJsonArray_(text);
    appendSeeds_(seeds, 'Scout');
    return 'Scout added ' + seeds.length + ' seeds';
  }
  return text.slice(0, 500);
}

/* ------------------------------------------------------------------ */
/*  Web app API — for Cursor, Claude, custom agents                   */
/* ------------------------------------------------------------------ */

function doGet(e) {
  return jsonOut_({ ok: true, service: 'canopy', hint: 'POST JSON { secret, action, payload }' });
}

function doPost(e) {
  var body = {};
  try { body = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (err) {
    return jsonOut_({ ok: false, error: 'invalid json' }, 400);
  }
  var secret = getSetting_('WEBHOOK_SECRET', '');
  if (!secret || body.secret !== secret) return jsonOut_({ ok: false, error: 'unauthorized' }, 401);
  var action = String(body.action || '');
  var payload = body.payload || {};
  try {
    var result = dispatchAction_(action, payload);
    return jsonOut_({ ok: true, action: action, result: result });
  } catch (err) {
    return jsonOut_({ ok: false, action: action, error: err.message });
  }
}

function dispatchAction_(action, payload) {
  switch (action) {
    case 'quota':
      canopyRefreshQuota();
      return readObjects_(SpreadsheetApp.getActive().getSheetByName(CANOPY.SHEETS.QUOTA)).slice(0, 20);
    case 'read':
      return readObjects_(SpreadsheetApp.getActive().getSheetByName(payload.sheet || CANOPY.SHEETS.KEYWORDS)).slice(0, payload.limit || 200);
    case 'write':
      appendSeeds_(payload.keywords || [], payload.agent || 'api');
      return { added: (payload.keywords || []).length };
    case 'related':
      setProp_('LAST_SEED', payload.keyword || payload.kw);
      canopyRelated();
      return { seed: payload.keyword || payload.kw };
    case 'bulk':
      if (payload.keywords) appendSeeds_(payload.keywords, 'api');
      canopyBulkImport();
      return { ok: true };
    case 'competitor':
      if (payload.url) {
        var loc = Number(getSetting_('DEFAULT_LOCATION_ID', 2840));
        return mangoolsFetch_('/kwfinder/competitor-keywords', { query: { url: payload.url, location_id: loc }, credits: 1 });
      }
      throw new Error('payload.url required');
    case 'gap':
      canopyGapAnalysis();
      return { ok: true };
    case 'track':
      canopyRefreshTracking();
      return { ok: true };
    case 'agent':
      return runAgentTask_(payload.agent || '', payload.action || payload.agent || '', payload.input || '');
    case 'setting':
      if (!payload.key) throw new Error('payload.key required');
      writeSetting_(payload.key, String(payload.value || ''));
      return { key: payload.key };
    default:
      throw new Error('Unknown action. Use quota|read|write|related|bulk|competitor|gap|track|agent|setting');
  }
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* ------------------------------------------------------------------ */
/*  Sheet helpers                                                     */
/* ------------------------------------------------------------------ */

function ensureSheet_(ss, name, headerAndSeed) {
  var sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0 && headerAndSeed && headerAndSeed.length) {
    sh.getRange(1, 1, headerAndSeed.length, headerAndSeed[0].length).setValues(headerAndSeed);
  } else if (headerAndSeed && headerAndSeed[0] && sh.getRange(1, 1).getValue() === '') {
    sh.getRange(1, 1, 1, headerAndSeed[0].length).setValues([headerAndSeed[0]]);
  }
  return sh;
}

function styleWorkbook_(ss) {
  var names = Object.keys(CANOPY.SHEETS).map(function (k) { return CANOPY.SHEETS[k]; });
  names.forEach(function (name) {
    var sh = ss.getSheetByName(name);
    if (!sh) return;
    var lastCol = Math.max(sh.getLastColumn(), 1);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, lastCol)
      .setFontFamily('Google Sans')
      .setFontWeight('bold')
      .setBackground('#1c1914')
      .setFontColor('#f3f0e7');
    sh.setRowHeight(1, 28);
  });
}

function writeBelowHeader_(sheet, values, clear) {
  if (clear && sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).clearContent();
  }
  if (!values.length) return;
  sheet.getRange(2, 1, values.length, values[0].length).setValues(values);
}

function readObjects_(sheet) {
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  var headers = data[0].map(function (h) { return String(h).trim(); });
  var out = [];
  for (var i = 1; i < data.length; i++) {
    var obj = { _row: i + 1 };
    var empty = true;
    headers.forEach(function (h, c) {
      obj[h] = data[i][c];
      if (data[i][c] !== '' && data[i][c] != null) empty = false;
    });
    if (!empty) out.push(obj);
  }
  return out;
}

function getSelectedKeywords_(sheet, rows, colIndex) {
  var range = SpreadsheetApp.getActiveRange();
  var picked = [];
  if (range && range.getSheet().getName() === sheet.getName()) {
    range.getValues().forEach(function (r) {
      r.forEach(function (v) { if (v) picked.push(String(v).trim()); });
    });
  }
  if (picked.length) return picked.filter(function (v) { return v && v !== 'Keyword' && v !== 'Seed'; });
  return rows.map(function (r) { return String(r.Keyword || r.Seed || '').trim(); }).filter(Boolean);
}

function getActiveKeyword_() {
  var v = SpreadsheetApp.getActiveRange() && SpreadsheetApp.getActiveRange().getValue();
  if (v && typeof v !== 'object') return String(v).trim();
  return '';
}

function upsertKeywordMetrics_(sheet, existing, keywords, loc, lang, agent) {
  var byKw = {};
  existing.forEach(function (r) { byKw[String(r.Keyword).toLowerCase()] = r; });
  var writes = 0;
  keywords.forEach(function (k) {
    var key = String(k.kw || '').toLowerCase();
    if (!key) return;
    var opp = opportunity_(num_(k.sv), k.seo, num_(k.ppc));
    var line = [
      (byKw[key] && byKw[key].Seed) || k.kw,
      k.kw,
      k.lid || loc,
      lang,
      num_(k.sv),
      k.seo == null ? '' : num_(k.seo),
      num_(k.cpc),
      num_(k.ppc),
      opp,
      (byKw[key] && byKw[key].Status) || 'new',
      new Date(),
      k._id || '',
      (byKw[key] && byKw[key].Notes) || '',
      agent
    ];
    if (byKw[key]) {
      sheet.getRange(byKw[key]._row, 1, 1, line.length).setValues([line]);
    } else {
      sheet.appendRow(line);
    }
    writes++;
  });
  return writes;
}

function appendSeeds_(keywords, agent) {
  var sheet = SpreadsheetApp.getActive().getSheetByName(CANOPY.SHEETS.KEYWORDS);
  var have = {};
  readObjects_(sheet).forEach(function (r) { have[String(r.Keyword).toLowerCase()] = true; });
  var loc = Number(getSetting_('DEFAULT_LOCATION_ID', 2840));
  var lang = Number(getSetting_('DEFAULT_LANGUAGE_ID', 1000));
  keywords.forEach(function (kw) {
    kw = String(kw || '').trim();
    if (!kw || have[kw.toLowerCase()]) return;
    sheet.appendRow([kw, kw, loc, lang, '', '', '', '', '', 'new', '', '', 'Added by ' + agent, agent]);
    have[kw.toLowerCase()] = true;
  });
}

function patchKeywordKd_(kw, kd) {
  if (kd === '' || kd == null) return;
  var sheet = SpreadsheetApp.getActive().getSheetByName(CANOPY.SHEETS.KEYWORDS);
  readObjects_(sheet).forEach(function (r) {
    if (String(r.Keyword).toLowerCase() === String(kw).toLowerCase()) {
      sheet.getRange(r._row, 6).setValue(kd);
    }
  });
}

function getSetting_(key, fallback) {
  var sh = SpreadsheetApp.getActive().getSheetByName(CANOPY.SHEETS.SETTINGS);
  if (sh) {
    var data = sh.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === key) {
        var val = String(data[i][1] == null ? '' : data[i][1]).trim();
        if (val && val.indexOf('stored in Script') === -1) return val;
      }
    }
  }
  return getProp_(key, fallback);
}

function writeSetting_(key, value) {
  setProp_(key, value);
  var sh = SpreadsheetApp.getActive().getSheetByName(CANOPY.SHEETS.SETTINGS);
  if (!sh) return;
  var data = sh.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === key) {
      sh.getRange(i + 1, 2).setValue(key === 'MANGOOLS_API_KEY' ? '(stored in Script Properties)' : value);
      return;
    }
  }
  sh.appendRow([key, value, '']);
}

function syncSettingsToProps_() {
  var sh = SpreadsheetApp.getActive().getSheetByName(CANOPY.SHEETS.SETTINGS);
  if (!sh) return;
  var data = sh.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    var k = String(data[i][0] || '').trim();
    var v = String(data[i][1] == null ? '' : data[i][1]).trim();
    if (!k || !v) continue;
    if (k === 'MANGOOLS_API_KEY' && v.indexOf('stored') !== -1) continue;
    setProp_(k, v);
  }
}

function getProp_(k, fallback) {
  var v = PropertiesService.getScriptProperties().getProperty(k);
  return v == null || v === '' ? fallback : v;
}

function setProp_(k, v) {
  PropertiesService.getScriptProperties().setProperty(k, String(v));
}

function log_(level, action, detail, http, credits) {
  try {
    var sh = SpreadsheetApp.getActive().getSheetByName(CANOPY.SHEETS.LOG);
    if (!sh) return;
    sh.insertRowAfter(1);
    sh.getRange(2, 1, 1, 6).setValues([[new Date(), level, action, String(detail).slice(0, 500), http || '', credits || 0]]);
  } catch (err) {}
}

function opportunity_(volume, kd, ppc) {
  var d = kd == null || kd === '' ? 45 : Number(kd);
  var c = Math.min(100, Math.max(0, Number(ppc) || 0)) / 100;
  var raw = (Number(volume) || 0) / (d + 8) * (1 - c * 0.45);
  return Math.round(raw * 10) / 10;
}

function num_(v) {
  if (v == null || v === '') return 0;
  var n = Number(v);
  return isNaN(n) ? 0 : n;
}

function firstNum_() {
  for (var i = 0; i < arguments.length; i++) {
    if (arguments[i] === '' || arguments[i] == null) continue;
    var n = Number(arguments[i]);
    if (!isNaN(n)) return n;
  }
  return null;
}

function unique_(arr) {
  var seen = {};
  var out = [];
  arr.forEach(function (v) {
    var k = String(v).toLowerCase();
    if (!k || seen[k]) return;
    seen[k] = true;
    out.push(String(v));
  });
  return out;
}

function chunk_(arr, size) {
  var out = [];
  for (var i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function indexBy_(arr, fn) {
  var o = {};
  (arr || []).forEach(function (x) { o[fn(x)] = x; });
  return o;
}

function host_(url) {
  try { return String(url).replace(/^https?:\/\//, '').split('/')[0]; } catch (e) { return ''; }
}

function serializeFeatures_(data) {
  var f = data.features || data.serp_features || [];
  if (Array.isArray(f)) return f.join(', ');
  if (f && typeof f === 'object') return Object.keys(f).filter(function (k) { return f[k]; }).join(', ');
  return '';
}

function flattenRange_(a1) {
  try {
    return SpreadsheetApp.getActive().getRange(a1).getValues()
      .reduce(function (acc, r) { return acc.concat(r); }, [])
      .map(function (v) { return String(v || '').trim(); })
      .filter(Boolean);
  } catch (e) {
    return [a1];
  }
}

function parseJsonArray_(text) {
  var m = String(text).match(/\[[\s\S]*\]/);
  if (m) {
    try {
      var arr = JSON.parse(m[0]);
      if (Array.isArray(arr)) return arr.map(function (x) { return String(x); });
    } catch (e) {}
  }
  return String(text).split(/\n/).map(function (s) { return s.replace(/^[\-\*\d\.\s]+/, '').trim(); }).filter(Boolean).slice(0, 20);
}

function randomSecret_() {
  var chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  var s = 'cnp_';
  for (var i = 0; i < 24; i++) s += chars.charAt(Math.floor(Math.random() * chars.length));
  return s;
}
