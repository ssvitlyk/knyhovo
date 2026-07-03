// Knyhovo · Price History W5 — STATEFUL SECTION (PriceHistorySection).
// W5 Price History UI Final Freeze. Orchestrates the live block on Book Details:
// calls the API, owns the period state machine, swaps loading / filled / empty /
// error WITHOUT moving the block or touching the rest of the page. Placement is
// fixed by the caller (directly below OffersPanel). Frozen v1.2.1 components only.
//
// State machine (API → UI):
//   loading — initial request OR period-change request in progress
//   filled  — response received AND points.length > 0
//   empty   — response received AND points.length === 0
//   error   — request failed OR unexpected parsing error
//
// Period selector visibility (W5 final freeze):
//   filled / loading → chips SHOWN (loading may follow a period change)
//   empty  / error   → chips HIDDEN (no data to switch / switching won't help)
// Block never collapses; title + (in filled/loading) chips persist; Book Details
// stays usable regardless of Price-History failures.
'use strict';

const { PriceChart: PHS_Chart, Advisory: PHS_Advisory, PriceStats: PHS_Stats,
        PeriodSelector: PHS_Periods } = window.PHChart;
const PHS_API = window.PHApi;
const PHS_DSX = window.KnyhovoDesignSystem_9fa616;
const PHS_Data = window.PHData;

/* Body-only skeleton (initial load + period switch): chart skeleton + 4-stat
   skeleton (+ advisory lines), so the real chips above stay put and layout
   never shifts. */
function PHS_BodySkeleton({ mobile }) {
  return (
    <React.Fragment>
      <div className="ph-sk-lines">
        <span className="ph-sk-block" style={{ width: '92%', maxWidth: 520, height: 13 }}></span>
        <span className="ph-sk-block" style={{ width: '54%', maxWidth: 320, height: 13 }}></span>
      </div>
      <div className={'ph-card' + (mobile ? ' ph-card--mob' : '')}>
        <div className={'ph-sk-chart' + (mobile ? ' ph-sk-chart--mob' : '')}>
          <span className="ph-sk-chart__band"></span>
          <span className="ph-sk-chart__axis">
            {[0, 1, 2, 3].map((i) => <span key={i}></span>)}
          </span>
        </div>
        <div className={'ph-stats' + (mobile ? ' ph-stats--mob' : '')}>
          {[44, 84, 96, 56].map((w, i) => (
            <div key={i} className="ph-stat">
              <span className="ph-sk-block" style={{ width: w, height: 11 }}></span>
              <span className="ph-sk-block" style={{ width: [62, 62, 108, 72][i], height: 24, marginTop: 6 }}></span>
            </div>
          ))}
        </div>
      </div>
    </React.Fragment>
  );
}

/* Empty — "no history yet". Honest, calm; reuses the .ph-empty chassis.
   No period chips (W5 final freeze) — there is no data to switch between. */
function PHS_EmptyBody({ mobile }) {
  const { Badge } = PHS_DSX;
  return (
    <div className={'ph-empty' + (mobile ? ' ph-empty--mob' : '')}>
      <div className="ph-empty__icon"><PHS_Data.Icon name="chart-line" size={20} /></div>
      <div>
        <div className="ph-empty__titlerow">
          <span className="ph-empty__title">Ще збираємо історію</span>
          <Badge tone="neutral">Збираємо дані</Badge>
        </div>
        <p>Knyhovo перевіряє ціни щодня о 08:00. Книговик підкаже, коли настане вдалий момент купувати.</p>
      </div>
    </div>
  );
}

/* Error — local, calm, recoverable. Never hides offers, never a global page.
   No period chips (W5 final freeze) — switching periods won't resolve a failure. */
function PHS_ErrorBody({ mobile, onRetry }) {
  const { Button } = PHS_DSX;
  return (
    <div className={'ph-empty ph-empty--error' + (mobile ? ' ph-empty--mob' : '')} role="alert">
      <div className="ph-empty__icon"><PHS_Data.Icon name="info" size={20} /></div>
      <div>
        <div className="ph-empty__titlerow">
          <span className="ph-empty__title">Не вдалося завантажити динаміку цін</span>
        </div>
        <p>Спробуйте ще раз за кілька секунд. Решта інформації про книгу доступна нижче.</p>
        <div style={{ marginTop: 'var(--space-4)' }}>
          <Button variant="secondary" size="sm" onClick={onRetry}>Спробувати ще раз</Button>
        </div>
      </div>
    </div>
  );
}

/* ── The section ──────────────────────────────────────────────────────────────
   props:
     bookId     — book id passed to the API (default 'demo' for the mock)
     mobile     — compact <768 composition
     scenario   — mock outcome: 'ok' | 'empty' | 'error' (default 'ok')
     forceState — deterministic render for QA frames:
                  'loading' | 'filled' | 'empty' | 'error'  (bypasses fetch)
     delay      — mock latency in ms                                            */
function PriceHistorySection({ bookId, mobile, scenario, forceState, delay }) {
  const id = bookId || 'demo';
  const [periodKey, setPeriodKey] = React.useState('90');         // internal key; 90 ↔ 90d
  const [status, setStatus] = React.useState('loading');          // loading|filled|empty|error
  const [vm, setVm] = React.useState(null);
  const reqRef = React.useRef(0);

  function load(key) {
    const apiPeriod = PHS_API.PERIOD_MAP[key];                    // → 30d|90d|1y|all
    setStatus('loading');
    const reqId = ++reqRef.current;
    PHS_API.fetchPriceHistory(id, apiPeriod, { scenario: scenario || 'ok', delay: delay == null ? 600 : delay })
      .then((api) => {
        if (reqId !== reqRef.current) return;                     // ignore stale responses
        const points = api && Array.isArray(api.points) ? api.points : [];
        if (points.length === 0) { setVm(null); setStatus('empty'); return; }   // response OK, no data
        const model = PHS_API.toViewModel(api);
        if (!model) { setStatus('error'); return; }               // points present but unparseable
        setVm(model); setStatus('filled');
      })
      .catch(() => {                                              // request failed
        if (reqId !== reqRef.current) return;
        setStatus('error');
      });
  }

  React.useEffect(() => { if (!forceState) load(periodKey); /* mount */ }, []); // eslint-disable-line

  function onPeriod(key) {
    setPeriodKey(key);                                            // active chip updates instantly
    if (!forceState) load(key);                                   // re-query API for this period
  }

  // Deterministic QA path.
  const effStatus = forceState || status;
  let effVm = vm;
  if (forceState === 'filled') effVm = PHS_API.toViewModel(PHS_API.buildMockRaw(periodKey));

  const label = 'Price history · ' + (mobile ? 'mobile' : 'desktop') + ' · ' + effStatus;
  const showChips = effStatus === 'filled' || effStatus === 'loading';

  // Header: title always; chips only in filled/loading.
  const titleH2 = (
    <h2 className={'ph-h2' + (mobile ? ' ph-h2--sm' : '')}
      style={mobile ? null : (showChips ? null : { marginBottom: 'var(--space-3)' })}>Динаміка ціни</h2>
  );
  const header = showChips
    ? (mobile
        ? (<React.Fragment>{titleH2}<PHS_Periods value={periodKey} onChange={onPeriod} mobile /></React.Fragment>)
        : (<div className="ph-head">{titleH2}<PHS_Periods value={periodKey} onChange={onPeriod} /></div>))
    : titleH2;

  // Body by state.
  let body;
  if (effStatus === 'loading') body = <PHS_BodySkeleton mobile={mobile} />;
  else if (effStatus === 'empty') body = <PHS_EmptyBody mobile={mobile} />;
  else if (effStatus === 'error') body = <PHS_ErrorBody mobile={mobile} onRetry={() => load(periodKey)} />;
  else body = (
    <React.Fragment>
      <PHS_Advisory series={effVm} mobile={mobile} />
      <div className={'ph-card' + (mobile ? ' ph-card--mob' : '')}>
        <div className="ph-chartwrap"><PHS_Chart series={effVm} mobile={mobile} /></div>
        <PHS_Stats series={effVm} mobile={mobile} />
      </div>
    </React.Fragment>
  );

  // The body region crossfades on every state / period swap (160ms). The header
  // (chips) is OUTSIDE the keyed wrapper so it never re-animates. Reduced-motion
  // disables the animation (see .ph-swap in ph-chart.css).
  return (
    <section className={'ph-section' + (mobile ? ' ph-section--mob' : '')}
      data-screen-label={label} data-ph-state={effStatus} aria-busy={effStatus === 'loading'}>
      {header}
      <div className="ph-swap" key={effStatus + '·' + periodKey}>{body}</div>
    </section>
  );
}

window.PHSection = { PriceHistorySection };
