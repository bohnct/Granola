// Debug page (top-bar icon): is the GitHub Action fetching? One row per day with how many
// fetches ran; open a day for the time of each one, plus the basis moves seen that day.
import * as data from './data.js';
import { COMMODITIES } from './config.js';
import { h, timeAgo } from './ui.js';

const TZ = 'America/Regina'; // the fetcher logs Saskatchewan time
const sk = (iso, opts) => new Date(iso).toLocaleString('en-CA', { timeZone: TZ, ...opts });
const skDate = (iso) => sk(iso, { year: 'numeric', month: '2-digit', day: '2-digit' });
const skTime = (iso) => sk(iso, { hour: '2-digit', minute: '2-digit', hour12: false });
const dayName = (d) => new Date(`${d}T12:00:00`).toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' });
const STATUS = { new: 'new prices', same: 'no change', error: 'error' };

export default {
  title: 'Debug',
  async render(root) {
    root.append(h('h2', { class: 'debug-h' }, 'Fetch debug'));
    const body = h('div', {}, h('p', { class: 'small muted' }, 'Loading…'));
    root.append(body);

    const [log, hists, moves] = await Promise.all([
      data.fetchLog(),
      Promise.all(COMMODITIES.map((c) => data.cashHistory(c.key))),
      Promise.all(COMMODITIES.map((c) => data.basisChanges(c.key))),
    ]);
    const fetches = log ?? {};

    // Per day: months saved for each crop, and basis moves (logged in UTC, shown in SK time).
    const days = new Map();
    const at = (d) => days.get(d) ?? days.set(d, { saved: {}, moves: [] }).get(d);
    COMMODITIES.forEach((c, i) => {
      Object.values(hists[i]).forEach((rows) => rows.forEach((r) => { at(r.d).saved[c.short] = (at(r.d).saved[c.short] ?? 0) + 1; }));
      moves[i].forEach((m) => at(skDate(m.t)).moves.push({ ...m, com: c.short }));
    });
    Object.keys(fetches).forEach(at);

    const logDays = Object.keys(fetches).sort();
    const last = logDays.length ? { d: logDays.at(-1), ...fetches[logDays.at(-1)].at(-1) } : null;
    const latest = data.getLatest();

    const summary = h('div', { class: 'card' },
      kv('Prices last changed', latest?.updatedAt ? `${sk(latest.updatedAt, { dateStyle: 'medium', timeStyle: 'short' })} (${timeAgo(latest.updatedAt)})` : 'not loaded'),
      kv('Last fetch run', last ? `${dayName(last.d)} ${last.t} SK · ${STATUS[last.s] ?? last.s}` : 'none logged yet'),
      latest?.errors?.length ? kv('Errors in latest.json', latest.errors.join('; ')) : null,
      h('p', { class: 'small muted', style: 'margin:8px 0 0' }, log
        ? `Fetch log covers ${logDays.length} day${logDays.length === 1 ? '' : 's'} from ${dayName(logDays[0])}. The Action should run about every 15 min, weekdays 6:30–15:30 SK, plus one evening run. Open a day for each fetch time: bold = new prices saved, red = failed, grey = no change.`
        : 'No fetch log yet (data/fetchlog.json). It appears after the updated fetcher runs on GitHub. Until then, days show what was saved.'));

    const list = [...days.keys()].sort().reverse().map((d) => dayRow(d, fetches[d], days.get(d), logDays[0]));
    body.replaceChildren(summary, h('div', { class: 'card tight' }, h('h3', { class: 'pad' }, 'Days'), list));
  },
};

const kv = (k, v) => h('div', { class: 'kv' }, h('span', { class: 'muted' }, k), h('b', {}, v));

function dayRow(d, runs, info, logStart) {
  const n = runs?.length ?? 0;
  const counts = (runs ?? []).reduce((a, r) => ({ ...a, [r.s]: (a[r.s] ?? 0) + 1 }), {});
  const saved = Object.entries(info.saved).map(([k, v]) => `${k} ${v}`).join(', ');
  const head = runs
    ? [`${n} fetch${n === 1 ? '' : 'es'}`, counts.new ? `${counts.new} new` : null, counts.error ? `${counts.error} error${counts.error === 1 ? '' : 's'}` : null]
    : ['no fetch log'];
  if (info.moves.length) head.push(`${info.moves.length} basis move${info.moves.length === 1 ? '' : 's'}`);

  const body = [];
  if (runs) {
    body.push(h('div', { class: 'debug-times' }, runs.map((r) => h('span', { class: `run ${r.s}`, title: r.e ?? STATUS[r.s] }, r.t))));
    const errs = runs.filter((r) => r.e);
    errs.forEach((r) => body.push(h('p', { class: 'small down' }, `${r.t} ${r.e}`)));
  } else {
    body.push(h('p', { class: 'small muted' }, logStart && d < logStart
      ? 'Before the fetch log started, so individual fetch times weren\'t saved.' : 'No fetch runs logged this day.'));
  }
  if (info.moves.length) {
    body.push(h('p', { class: 'small muted debug-sub' }, 'Basis moves (time first seen)'),
      ...info.moves.map((m) => h('div', { class: 'small' }, `${skTime(m.t)} · ${m.com} ${m.label}: ${m.from} → ${m.to}`)));
  }
  body.push(h('p', { class: 'small muted debug-sub' }, saved ? `Saved rows: ${saved} delivery months` : 'No price rows saved this day.'));

  return h('details', { class: 'debug-day' },
    h('summary', {}, h('b', {}, dayName(d)), h('span', { class: `small ${counts.error ? 'down' : 'muted'}` }, head.filter(Boolean).join(' · '))),
    h('div', { class: 'debug-body' }, body));
}
