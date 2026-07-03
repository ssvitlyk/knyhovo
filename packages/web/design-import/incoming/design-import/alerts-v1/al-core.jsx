// Knyhovo · Price Alerts extension (W4) — core alert UI primitives.
// Composes window.KnyhovoDesignSystem_9fa616 + window.ALData. Exports window.AL.
// Visual language is 100% frozen-token; these are NEW compositions, not new
// styles. Every state distinguishes by glyph + label first, colour second.
'use strict';

const AL_DS = window.KnyhovoDesignSystem_9fa616;
const ALD = window.ALData;
const { Icon: ALIcon } = ALD;

/* ── Bell control — the alert toggle that lives in the wishlist row actions
   and (mirrored) in the Book Details panel. Five lifecycle states, four
   distinct glyphs (paused/unavail share bell-off, disambiguated by tone +
   the adjacent status chip + the disabled affordance). ── */
const AL_BELL = {
  off:     { icon: 'bell',      cls: '',                  title: 'Сповістити про ціну' },
  watch:   { icon: 'bell-dot',  cls: ' wl-iconbtn--on',   title: 'Сповіщення увімкнено' },
  trig:    { icon: 'bell-ring', cls: ' wl-iconbtn--trig', title: 'Ціна досягла цілі' },
  paused:  { icon: 'bell-off',  cls: ' wl-iconbtn--paused', title: 'Сповіщення призупинено' },
  unavail: { icon: 'bell-off',  cls: ' wl-iconbtn--unavail', title: 'Сповіщення недоступні' },
};
function AlertBell({ state = 'off', size = 16 }) {
  const b = AL_BELL[state] || AL_BELL.off;
  return (
    <button className={'wl-iconbtn' + b.cls} type="button" title={b.title}
      aria-label={b.title} disabled={state === 'unavail'}>
      <ALIcon name={b.icon} size={size} />
    </button>
  );
}

/* ── Status chip — the quiet in-row indicator (mirrors .phv-badge anatomy) ── */
const AL_CHIP = {
  watch:   { tone: 'watch',   icon: 'bell-dot',  label: 'Стежимо за ціною' },
  trig:    { tone: 'trig',    icon: 'check-circle', label: 'Ціль досягнута' },
  paused:  { tone: 'paused',  icon: 'bell-off',  label: 'Призупинено' },
  unavail: { tone: 'unavail', icon: 'bell-off',  label: 'Сповіщення недоступні' },
};
function AlertChip({ state, size = 12 }) {
  const c = AL_CHIP[state];
  if (!c) return null;
  return <span className={'al-chip al-chip--' + c.tone}><ALIcon name={c.icon} size={size} />{c.label}</span>;
}

/* target-price reason line — «нижче 240 ₴» (the threshold Книговик watches) */
function AlertTarget({ intent, book = ALD.BOOK, green, triggered, price }) {
  const it = ALD.INTENT[intent] || ALD.INTENT.below;
  if (triggered) {
    return <span className="al-target al-target--green">Ціна впала до <b>{price} ₴</b> — нижче за вашу ціль {it.priceFor(book)} ₴.</span>;
  }
  return <span className={'al-target' + (green ? ' al-target--green' : '')}>Книговик напише, коли ціна стане <b>{it.noteFor(book)}</b>.</span>;
}

/* quiet text affordance — «Сповістити про ціну» / «Змінити» */
function AlertLink({ children, icon = 'bell', sm }) {
  return (
    <button className={'al-link' + (sm ? ' al-link--sm' : '')} type="button">
      <ALIcon name={icon} size={sm ? 13 : 15} />{children}
    </button>
  );
}

/* ── Configuration — lightweight, intent-first. The user chooses *what* to be
   told; Книговик translates it into target_price. Custom price is a quiet
   secondary path. Not a modal. ── */
function AlertConfig({ book = ALD.BOOK, initialIntent = 'below', editing, manage, paused, noHistory, openCustom, onPause, onResume, onRemove, onSave, onCancel }) {
  const [intent, setIntent] = React.useState(initialIntent);
  const [customOn, setCustomOn] = React.useState(!!openCustom);
  const [custom, setCustom] = React.useState('');
  const { Button, Input } = AL_DS;
  const title = paused ? 'Сповіщення призупинено' : editing ? 'Сповіщення про ціну' : 'Коли повідомити про ціну?';
  const targetVal = (ALD.INTENT[intent] && ALD.INTENT[intent].priceFor(book)) || book.current;
  const label = paused ? 'Alert config · paused' : editing ? 'Alert config · edit' : 'Alert config · create';

  return (
    <div className="al-config" data-screen-label={label}>
      <div className="al-config__head">
        <span className="al-config__title">{title}</span>
        <span className="al-config__sub">«{book.title}» · зараз {book.current} ₴ у {book.store}</span>
      </div>

      {paused ? (
        <React.Fragment>
          <div className="al-paused-note">
            <ALIcon name="bell-off" size={18} />
            <span>Книговик не стежить за ціною, доки сповіщення призупинене. Поновіть, щоб далі чекати на ціль <b>{targetVal} ₴</b>.</span>
          </div>
          <div className="al-config__actions">
            <Button variant="ghost" size="sm" onClick={onRemove}><ALIcon name="x" size={14} /> Прибрати</Button>
            <span className="al-grow"><Button variant="primary" size="sm" onClick={onResume}><ALIcon name="bell-dot" size={14} /> Поновити сповіщення</Button></span>
          </div>
        </React.Fragment>
      ) : (
        <React.Fragment>
          <div className="al-opts" role="radiogroup">
            {ALD.INTENTS.map((it) => {
              const disabled = it.needsHistory && noHistory;
              const on = !customOn && intent === it.key;
              const price = it.priceFor(book);
              return (
                <button key={it.key} type="button" role="radio" aria-checked={on}
                  className={'al-opt' + (on ? ' al-opt--on' : '') + (disabled ? ' al-opt--disabled' : '')}
                  disabled={disabled} onClick={() => { setIntent(it.key); setCustomOn(false); }}>
                  <span className="al-radio"></span>
                  <span className="al-opt__main">
                    <span className="al-opt__label">{it.label}</span>
                    <span className="al-opt__desc">{disabled ? 'Збираємо історію цін для цієї книги.' : it.desc}</span>
                  </span>
                  {price && !disabled ? <span className="al-opt__price">{price} ₴</span> : null}
                </button>
              );
            })}
          </div>

          {customOn ? (
            <div className="al-custom">
              <div className="al-custom__row">
                <Input type="text" inputMode="numeric" placeholder="230" defaultValue={custom}
                  onChange={(e) => setCustom(e.target.value)} aria-label="Власна ціна" />
                <span className="al-custom__unit">₴</span>
                <AlertLink sm icon="x">Скасувати</AlertLink>
              </div>
              <span className="al-opt__desc">Книговик напише, коли ціна стане нижчою за вашу.</span>
            </div>
          ) : (
            <button className="al-link al-link--sm" type="button" onClick={() => setCustomOn(true)}>
              <ALIcon name="pencil" size={13} />Вказати свою ціну
            </button>
          )}

          {manage ? (
            <div className="al-manage">
              <button className="al-manage__btn" type="button" onClick={onPause}>
                <ALIcon name="bell-off" size={15} />Призупинити сповіщення
              </button>
            </div>
          ) : null}

          <div className="al-config__foot">
            <ALIcon name="clock" size={14} />
            <span>Knyhovo перевіряє ціни щодня о 08:00 — щойно ціль досягнута, Книговик одразу напише на пошту.</span>
          </div>

          <div className="al-config__actions">
            {editing ? (
              <React.Fragment>
                <Button variant="ghost" size="sm" onClick={onRemove}><ALIcon name="x" size={14} /> Прибрати</Button>
                <span className="al-grow"><Button variant="primary" size="sm" onClick={onSave}>Зберегти</Button></span>
              </React.Fragment>
            ) : (
              <React.Fragment>
                <Button variant="ghost" size="sm" onClick={onCancel}>Скасувати</Button>
                <span className="al-grow"><Button variant="primary" size="sm" onClick={onSave}><ALIcon name="bell" size={14} /> Увімкнути сповіщення</Button></span>
              </React.Fragment>
            )}
          </div>
        </React.Fragment>
      )}
    </div>
  );
}

/* mobile bottom-sheet wrapper (lightweight; shown docked in artboards) */
function AlertSheet({ height = 520, scrim = true, children }) {
  return (
    <div className="al-sheet-wrap" style={{ height }} data-screen-label="Alert sheet · mobile">
      {scrim ? <div className="al-sheet-scrim"></div> : null}
      <div className="al-sheet">
        <span className="al-sheet__grab"></span>
        {children}
      </div>
    </div>
  );
}

/* ── Inline confirmation / error notes — subtle, never celebratory, never red ── */
const AL_NOTE_ICON = { ok: 'check-circle', quiet: 'info', err: 'triangle-alert' };
function AlertNote({ kind = 'quiet', children, action }) {
  return (
    <div className={'al-note al-note--' + kind} role={kind === 'err' ? 'alert' : 'status'}>
      <span className="al-note__icon"><ALIcon name={AL_NOTE_ICON[kind]} size={18} /></span>
      <span className="al-note__body">{children}</span>
      {action ? <span className="al-note__action">{action}</span> : null}
    </div>
  );
}
function RetryBtn({ label = 'Спробувати ще раз' }) {
  const { Button } = AL_DS;
  return <Button variant="secondary" size="sm">{label}</Button>;
}
function AlertToast({ children }) {
  return <span className="al-toast"><ALIcon name="check" size={16} />{children}</span>;
}

window.AL = {
  DS: AL_DS, Icon: ALIcon,
  Bell: AlertBell, Chip: AlertChip, Target: AlertTarget, Link: AlertLink,
  Config: AlertConfig, Sheet: AlertSheet, Note: AlertNote, Retry: RetryBtn, Toast: AlertToast,
  BELL: AL_BELL, CHIP: AL_CHIP,
};
