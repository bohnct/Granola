// Debug page (top-bar icon): is the GitHub Action fetching? One row per day with how many
// fetches ran; open a day for the time of each one, the Action runs GitHub started, and the
// basis moves seen that day.
//   Fetch log (data/fetchlog.json): every fetch, written by the fetcher itself.
//   Action runs (GitHub's API): each time GitHub started the fetch job. One run can do many
//   fetches (it loops every 15 min through the trading day).
import * as data from './data.js';
import { COMMODITIES, GITHUB_REPO } from './config.js';
import { h, timeAgo } from './ui.js';

const TZ = 'America/Regina'; // the fetcher logs Saskatchewan time
const sk = (iso, opts) => new Date(iso).toLocaleString('en-CA', { timeZone: TZ, ...opts });
const skDate = (iso) => sk(iso, { year: 'numeric', month: '2-digit', day: '2-digit' });
const skTime = (iso) => sk(iso, { hour: '2-digit', minute: '2-digit', hour12: false });
const dayName = (d) => new Date(`${d}T12:00:00`).toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' });
// Not failures: a trigger that waited while a run was looping gets cancelled or skipped.
const FINE = ['success', 'in_progress', 'queued', 'waiting', 'pending', 'cancelled', 'skipped'];
const STATUS = { new: 'new prices', same: 'no change', error: 'error' };
const plural = (n, word, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;
const length = (a, b) => {
  const mins = Math.round((new Date(b) - new Date(a)) / 60000);
  return mins < 1 ? '<1 min' : mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)} h ${mins % 60} min`;
};

export default {
  title: 'Debug',
  async render(root) {
    root.append(h('h2', { class: 'debug-h' }, 'Fetch debug'));
    const body = h('div', {}, h('p', { class: 'small muted' }, 'Loading…'));
    root.append(body);

    const [log, runs, hists, moves] = await Promise.all([
      data.fetchLog(),
      data.actionRuns(),
      Promise.all(COMMODITIES.map((c) => data.cashHistory(c.key))),
      Promise.all(COMMODITIES.map((c) => data.basisChanges(c.key))),
    ]);
    const fetches = log ?? {};
    const jobs = (runs ?? []).filter((r) => r.event !== 'dynamic').reverse(); // oldest first

    // Per day: months saved for each crop, Action runs and basis moves (UTC, shown in SK time).
    const days = new Map();
    const at = (d) => days.get(d) ?? days.set(d, { saved: {}, moves: [], runs: [] }).get(d);
    COMMODITIES.forEach((c, i) => {
      Object.values(hists[i]).forEach((rows) => rows.forEach((r) => { at(r.d).saved[c.short] = (at(r.d).saved[c.short] ?? 0) + 1; }));
      moves[i].forEach((m) => at(skDate(m.t)).moves.push({ ...m, com: c.short }));
    });
    jobs.forEach((r) => at(skDate(r.start)).runs.push(r));
    Object.keys(fetches).forEach(at);
    // Every weekday up to today gets a row, so a day with no fetching at all stands out.
    const today = skDate(new Date().toISOString());
    const first = [...days.keys()].sort()[0] ?? today;
    for (let t = new Date(`${first}T12:00:00Z`); t.toISOString().slice(0, 10) <= today; t.setUTCDate(t.getUTCDate() + 1)) {
      if (t.getUTCDay() % 6) at(t.toISOString().slice(0, 10));
    }

    const logDays = Object.keys(fetches).sort();
    const last = logDays.length ? { d: logDays.at(-1), ...fetches[logDays.at(-1)].at(-1) } : null;
    const lastRun = jobs.at(-1);
    const latest = data.getLatest();
    const runsUrl = `https://github.com/${GITHUB_REPO}/actions`;

    const summary = h('div', { class: 'card' },
      kv('Prices last changed', latest?.updatedAt ? `${sk(latest.updatedAt, { dateStyle: 'medium', timeStyle: 'short' })} (${timeAgo(latest.updatedAt)})` : 'not loaded'),
      kv('Last fetch logged', last ? `${dayName(last.d)} ${last.t} SK · ${STATUS[last.s] ?? last.s}` : 'none yet'),
      kv('Last Action run', lastRun ? `${dayName(skDate(lastRun.start))} ${skTime(lastRun.start)} SK · ${(lastRun.result ?? '').replace('_', ' ')}` : runs ? 'none' : 'couldn\'t reach GitHub'),
      latest?.errors?.length ? kv('Errors in latest.json', latest.errors.join('; ')) : null,
      h('p', { class: 'small muted', style: 'margin:8px 0 0' },
        'A trading day should show about 36 fetches (every 15 min, 6:30–15:30 SK) plus an evening one. ',
        'Bold times brought new prices, red ones failed, grey ones found no change. ',
        log ? `The fetch log starts ${dayName(logDays[0])}; earlier days only have GitHub's Action runs. ` : 'No fetch log yet: it starts with the first run of the updated fetcher. ',
        h('a', { href: runsUrl, target: '_blank', rel: 'noopener' }, 'Runs on GitHub')));

    // Newest first, folded by year, then month, then day. This year and month start open.
    const group = (keyOf) => (list) => [...list.reduce((m, d) => m.set(keyOf(d), [...(m.get(keyOf(d)) ?? []), d]), new Map())];
    const tally = (ds) => {
      const n = ds.reduce((a, d) => a + (fetches[d]?.length ?? 0), 0);
      const r = ds.reduce((a, d) => a + days.get(d).runs.length, 0);
      return [n ? plural(n, 'fetch', 'fetches') : null, r ? plural(r, 'run') : null].filter(Boolean).join(' · ');
    };
    const sorted = [...days.keys()].sort().reverse();
    const years = group((d) => d.slice(0, 4))(sorted).map(([yr, ds]) => fold(`y${yr}`, yr === today.slice(0, 4), 'debug-year',
      [h('b', {}, yr), h('span', { class: 'small muted' }, tally(ds))],
      group((d) => d.slice(0, 7))(ds).map(([ym, mds]) => fold(`m${ym}`, ym === today.slice(0, 7), 'debug-month',
        [h('b', {}, monthName(ym)), h('span', { class: 'small muted' }, `${plural(mds.length, 'day')} · ${tally(mds)}`)],
        mds.map((d) => dayRow(d, fetches[d], days.get(d)))))));
    body.replaceChildren(summary, h('div', { class: 'card tight' }, h('h3', { class: 'pad' }, 'Days'), years));
  },
};

const kv = (k, v) => h('div', { class: 'kv' }, h('span', { class: 'muted' }, k), h('b', {}, v));
const monthName = (ym) => new Date(`${ym}-15T12:00:00`).toLocaleDateString('en-CA', { month: 'long', year: 'numeric' });

// Which folds are open, kept while the app runs so a refresh doesn't close them.
const opened = new Map();
function fold(key, byDefault, cls, summary, children) {
  return h('details', { class: cls, open: opened.get(key) ?? byDefault, ontoggle: (e) => opened.set(key, e.target.open) },
    h('summary', {}, summary), h('div', { class: `${cls}-body` }, children));
}

function dayRow(d, fetches, info) {
  const counts = (fetches ?? []).reduce((a, r) => ({ ...a, [r.s]: (a[r.s] ?? 0) + 1 }), {});
  const failed = info.runs.filter((r) => r.result && !FINE.includes(r.result)).length;
  const head = [
    fetches ? plural(fetches.length, 'fetch', 'fetches') : null,
    counts.new ? `${counts.new} new` : null,
    counts.error ? plural(counts.error, 'error') : null,
    info.runs.length ? plural(info.runs.length, 'run') : null,
    failed ? `${failed} failed` : null,
    info.moves.length ? plural(info.moves.length, 'basis move') : null,
  ].filter(Boolean);
  const bad = counts.error || failed;

  const body = [];
  if (fetches) {
    body.push(h('p', { class: 'small muted debug-sub' }, 'Fetches (fetch log)'),
      h('div', { class: 'debug-times' }, fetches.map((r) => h('span', { class: `run ${r.s}`, title: r.e ?? STATUS[r.s] }, r.t))));
    fetches.filter((r) => r.e).forEach((r) => body.push(h('p', { class: 'small down' }, `${r.t} ${r.e}`)));
  }
  body.push(h('p', { class: 'small muted debug-sub' }, 'GitHub Action runs (start · length · result)'));
  if (info.runs.length) {
    body.push(...info.runs.map((r) => h('div', { class: `small ${!r.result || r.result === 'success' || r.result === 'in_progress' ? '' : FINE.includes(r.result) ? 'muted' : 'down'}` },
      `${skTime(r.start)} · ${r.result === 'in_progress' ? `running ${length(r.start, new Date().toISOString())}` : length(r.start, r.end)} · ${(r.result ?? '').replace('_', ' ')}${r.event === 'schedule' ? '' : ` (${r.event.replace('_', ' ')})`}`)));
  } else {
    body.push(h('p', { class: 'small muted' }, 'None on record.'));
  }
  if (info.moves.length) {
    body.push(h('p', { class: 'small muted debug-sub' }, 'Basis moves (time first seen)'),
      ...info.moves.map((m) => h('div', { class: 'small' }, `${skTime(m.t)} · ${m.com} ${m.label}: ${m.from} → ${m.to}`)));
  }
  const saved = Object.entries(info.saved).map(([k, v]) => `${k} ${v}`).join(', ');
  body.push(h('p', { class: 'small muted debug-sub' }, saved ? `Saved rows: ${saved} delivery months` : 'No price rows saved this day.'));

  return fold(d, false, 'debug-day',
    [h('b', {}, dayName(d)), h('span', { class: `small ${bad ? 'down' : 'muted'}` }, head.join(' · ') || 'nothing recorded')],
    body);
}
