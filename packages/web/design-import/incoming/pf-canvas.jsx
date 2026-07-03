'use strict';

const { DesignCanvas, DCSection, DCArtboard } = window;
const { PF_Frame, PF_ToastSpecimen } = window;

// ─── Notes styling (calm doc cards — DS tokens only) ────────────────────────────
(function injectPFDocStyles() {
  if (document.getElementById('pf-doc-styles')) return;
  const s = document.createElement('style');
  s.id = 'pf-doc-styles';
  s.textContent = `
    .pfd { background: var(--bg); color: var(--text-body); height: 100%; box-sizing: border-box;
      padding: var(--space-8); font-family: var(--font-body); overflow: hidden; }
    .pfd h2 { font-family: var(--font-display); font-weight: var(--fw-semibold); font-size: var(--fs-h3);
      line-height: var(--lh-tight); letter-spacing: var(--ls-tight); color: var(--text); margin: 0 0 var(--space-2); }
    .pfd__lead { font-size: var(--fs-sm); color: var(--text-muted); margin: 0 0 var(--space-6); max-width: 70ch; text-wrap: pretty; }
    .pfd__grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-5); }
    .pfd__col { display: flex; flex-direction: column; gap: var(--space-4); }
    .pfd__block { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-md);
      box-shadow: var(--shadow-sm); padding: var(--space-5); }
    .pfd__h { font-size: var(--fs-xs); letter-spacing: var(--ls-eyebrow); text-transform: uppercase;
      color: var(--text-muted); font-weight: var(--fw-semibold); margin: 0 0 var(--space-3); }
    .pfd__list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--space-2); }
    .pfd__list li { font-size: var(--fs-sm); color: var(--text-body); line-height: var(--lh-snug); text-wrap: pretty;
      padding-left: var(--space-4); position: relative; }
    .pfd__list li::before { content: ''; position: absolute; left: 0; top: 9px; width: 5px; height: 5px;
      border-radius: 50%; background: var(--accent); }
    .pfd__list code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px;
      background: var(--surface-sunk); border: 1px solid var(--border); border-radius: 4px; padding: 1px 5px; color: var(--text-body); }
    .pfd__list b { color: var(--text); font-weight: var(--fw-semibold); }
  `;
  document.head.appendChild(s);
})();

function ComponentNotes() {
  return (
    <div className="pfd" data-screen-label="Component notes">
      <h2>Компоненти та повторне використання</h2>
      <p className="pfd__lead">Екран скомпоновано виключно з DS v1.0 та затвердженого інтер'єрного chrome. Жодного нового візуального словника.</p>
      <div className="pfd__grid">
        <div className="pfd__col">
          <div className="pfd__block">
            <p className="pfd__h">Повторно (без змін)</p>
            <ul className="pfd__list">
              <li><b>Header / Footer</b> — <code>NP_SiteHeader</code> / <code>NP_SiteFooter</code> (frozen chrome)</li>
              <li><b>Settings sidebar</b> — <code>.np-sidenav</code>, активний пункт «Профіль»</li>
              <li><b>Layout</b> — <code>.np-main</code> / <code>.np-layout</code> (196px меню + контент 640px)</li>
              <li><b>Картки</b> — той самий рецепт і теплий wash, що й <code>.np-card</code></li>
              <li><b>Кнопки / Badge / Input</b> — <code>Button</code>, <code>Badge</code>, <code>.kn-input</code></li>
              <li><b>Toast</b> — <code>.al-toast</code> + <code>.np-toast</code> (спокійний, зелена галочка)</li>
              <li><b>Inline-помилка</b> — <code>.al-note--err</code> (як у Сповіщеннях; ніколи не червоний)</li>
            </ul>
          </div>
        </div>
        <div className="pfd__col">
          <div className="pfd__block">
            <p className="pfd__h">Нове (лише page-level pf-*)</p>
            <ul className="pfd__list">
              <li><code>.pf-card</code> — картка-секція (head + body + foot)</li>
              <li><code>.pf-field</code> / <code>.pf-label</code> — рядок форми над <code>.kn-input</code></li>
              <li><code>.pf-rows</code> / <code>.pf-row</code> — read-only label↔value список</li>
              <li><code>.pf-auth</code> — інфоблок Magic Link (медальйон + текст + CTA)</li>
              <li><code>.pf-card--quiet</code> — спокійна «Небезпечна дія» (sunk surface, не червона)</li>
            </ul>
          </div>
          <div className="pfd__block">
            <p className="pfd__h">Hover / Focus / Press</p>
            <ul className="pfd__list">
              <li>Input <b>focus</b> → 3px <code>--focus-ring</code> + бордюр <code>--accent</code></li>
              <li>Read-only Email — <code>--surface-sunk</code>, без focus-ring</li>
              <li>Primary <b>hover</b> → темніша мідь; <b>press</b> → −1px</li>
              <li>Меню <b>hover</b> → <code>--surface-accent</code>; active → <code>--accent-weak</code></li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function ImplementationNotes() {
  return (
    <div className="pfd" data-screen-label="Implementation notes">
      <h2>Нотатки для імплементації</h2>
      <p className="pfd__lead">Маршрут <code>/settings/profile</code>. Та сама поведінка, що й Settings → Сповіщення.</p>
      <div className="pfd__grid">
        <div className="pfd__col">
          <div className="pfd__block">
            <p className="pfd__h">Дані та дії</p>
            <ul className="pfd__list">
              <li><b>Email</b> — readonly, з акаунта (Magic Link identity)</li>
              <li><b>Ім'я для відображення</b> — необов'язкове; <code>PATCH /api/profile</code> по «Зберегти» (без autosave)</li>
              <li><b>Надіслати нове посилання</b> — викликає наявний Magic Link flow</li>
              <li><b>Вийти</b> — завершує сесію → повторний вхід через Magic Link</li>
              <li><b>Успіх</b> — спокійний toast «Профіль оновлено»</li>
            </ul>
          </div>
        </div>
        <div className="pfd__col">
          <div className="pfd__block">
            <p className="pfd__h">Адаптивність (як у Сповіщеннях)</p>
            <ul className="pfd__list">
              <li><b>≥768px</b> — бокове меню + контент</li>
              <li><b>&lt;768px</b> — меню згортається, картки на повну ширину</li>
              <li>Зони дотику ≥44px; кнопки/інпути 48px на мобільному</li>
              <li>Світла + темна теми через <code>data-theme</code></li>
            </ul>
          </div>
          <div className="pfd__block">
            <p className="pfd__h">Поза MVP (не додавати)</p>
            <ul className="pfd__list">
              <li>Пароль · зміна пароля · видалення акаунта</li>
              <li>Аватар · фото · соцлогін · 2FA · сесії</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function PFCanvas() {
  return (
    <DesignCanvas>

      <DCSection id="desktop" title="Desktop — Settings → Профіль"
        subtitle="Останній екран MVP. Затверджений header + footer, бокове меню Settings (активний «Профіль»), картки у стилі DS з тим самим теплим wash, що й Сповіщення. Чотири секції: Особисті дані · Обліковий запис · Авторизація · Небезпечна дія.">

        <DCArtboard id="dt-light" label="Desktop · Light · 1440 → контент 1040" width={1040} height={1080}>
          <PF_Frame theme="light" interactive />
        </DCArtboard>

        <DCArtboard id="dt-dark" label="Desktop · Dark" width={1040} height={1080}>
          <PF_Frame theme="dark" interactive />
        </DCArtboard>

      </DCSection>

      <DCSection id="mobile" title="Mobile — 375px"
        subtitle="Без бокового меню. Компактний хедер (бургер + лого · перемикач теми). Single-column, картки на повну ширину, кнопки та інпути 48px (≥44px зона дотику).">

        <DCArtboard id="mob-light" label="Mobile · Light" width={375} height={1240}>
          <PF_Frame theme="light" mobile interactive />
        </DCArtboard>

        <DCArtboard id="mob-dark" label="Mobile · Dark" width={375} height={1240}>
          <PF_Frame theme="dark" mobile interactive />
        </DCArtboard>

      </DCSection>

      <DCSection id="states" title="Стани — hover / focus · валідація · toast"
        subtitle="Inline-валідація повторює патерн Сповіщень (.al-note--err, ніколи не червоний). Toast «Профіль оновлено» з'являється після успішного збереження.">

        <DCArtboard id="st-error" label="Inline-валідація · Ім'я задовге (light)" width={1040} height={760}>
          <PF_Frame theme="light" presetName="Дуже-дуже довге ім'я, що перевищує дозволену межу символів" presetError />
        </DCArtboard>

        <DCArtboard id="st-toast" label="Збережено · toast (dark)" width={1040} height={760}>
          <PF_Frame theme="dark" presetToast />
        </DCArtboard>

        <DCArtboard id="toast-light" label="Toast · Light" width={420} height={120}>
          <PF_ToastSpecimen />
        </DCArtboard>

        <DCArtboard id="toast-dark" label="Toast · Dark" width={420} height={120}>
          <div data-theme="dark" style={{ height: '100%' }}><PF_ToastSpecimen /></div>
        </DCArtboard>

      </DCSection>

      <DCSection id="notes" title="Нотатки"
        subtitle="Компоненти, повторне використання, hover/focus та нотатки для імплементації.">

        <DCArtboard id="notes-components" label="Component notes" width={1040} height={520}>
          <ComponentNotes />
        </DCArtboard>

        <DCArtboard id="notes-impl" label="Implementation notes" width={1040} height={520}>
          <ImplementationNotes />
        </DCArtboard>

      </DCSection>

    </DesignCanvas>
  );
}

ReactDOM.createRoot(document.getElementById('pf-root')).render(<PFCanvas />);
