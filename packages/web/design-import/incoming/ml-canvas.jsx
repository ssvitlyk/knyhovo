'use strict';

const { DesignCanvas, DCSection, DCArtboard } = window;
const { ML_Frame, ML_AuthSpecimen, ML_ToastSpecimen } = window;

function MLCanvas() {
  return (
    <DesignCanvas>

      <DCSection id="desktop-light" title="Desktop · Light — Magic Link Login (/login)"
        subtitle="Природне продовження Knyhovo: затверджений header + footer, центрована панель у стилі Public unsubscribe. Без паролів, без соц-логінів, без реєстрації. Calm, minimal, trusted.">

        <DCArtboard id="dl-login" label="Login form" width={1040} height={600}>
          <ML_Frame variant="login" theme="light" />
        </DCArtboard>

        <DCArtboard id="dl-sending" label="Sending (button disabled + spinner)" width={1040} height={600}>
          <ML_Frame variant="sending" theme="light" />
        </DCArtboard>

        <DCArtboard id="dl-success" label="Success — «Перевірте пошту»" width={1040} height={600}>
          <ML_Frame variant="success" theme="light" />
        </DCArtboard>

        <DCArtboard id="dl-error" label="Error — inline error card + retry" width={1040} height={640}>
          <ML_Frame variant="error" theme="light" />
        </DCArtboard>

        <DCArtboard id="dl-invalid" label="Invalid / expired magic link" width={1040} height={580}>
          <ML_Frame variant="invalid" theme="light" />
        </DCArtboard>

        <DCArtboard id="dl-redirect" label="Signing in — «Входимо…» (redirect loading)" width={1040} height={560}>
          <ML_Frame variant="redirect" theme="light" />
        </DCArtboard>

      </DCSection>

      <DCSection id="desktop-dark" title="Desktop · Dark"
        subtitle="Ті самі стани, dark theme. Лише існуючі DS-токени (light-orange accent, cream text). Метрики ідентичні.">

        <DCArtboard id="dd-login" label="Login form" width={1040} height={600}>
          <ML_Frame variant="login" theme="dark" />
        </DCArtboard>

        <DCArtboard id="dd-success" label="Success — «Перевірте пошту»" width={1040} height={600}>
          <ML_Frame variant="success" theme="dark" />
        </DCArtboard>

        <DCArtboard id="dd-invalid" label="Invalid / expired magic link" width={1040} height={580}>
          <ML_Frame variant="invalid" theme="dark" />
        </DCArtboard>

      </DCSection>

      <DCSection id="mobile-light" title="Mobile · 375px · Light"
        subtitle="Компактний хедер (бургер + лого · перемикач теми), без бокового меню. Панель на повну ширину, контроли 44–48px, touch-friendly.">

        <DCArtboard id="ml-login" label="Login form" width={375} height={680}>
          <ML_Frame variant="login" mobile theme="light" />
        </DCArtboard>

        <DCArtboard id="ml-success" label="Success — «Перевірте пошту»" width={375} height={680}>
          <ML_Frame variant="success" mobile theme="light" />
        </DCArtboard>

        <DCArtboard id="ml-invalid" label="Invalid / expired link" width={375} height={640}>
          <ML_Frame variant="invalid" mobile theme="light" />
        </DCArtboard>

        <DCArtboard id="ml-auth-wl" label="Auth-required · Wishlist (Бажанки)" width={375} height={640}>
          <ML_Frame variant="auth" context="wishlist" mobile theme="light" />
        </DCArtboard>

        <DCArtboard id="ml-auth-set" label="Auth-required · Settings (Сповіщення)" width={375} height={640}>
          <ML_Frame variant="auth" context="settings" mobile theme="light" />
        </DCArtboard>

      </DCSection>

      <DCSection id="mobile-dark" title="Mobile · 375px · Dark"
        subtitle="Ключові стани в темній темі.">

        <DCArtboard id="md-login" label="Login form" width={375} height={680}>
          <ML_Frame variant="login" mobile theme="dark" />
        </DCArtboard>

        <DCArtboard id="md-success" label="Success — «Перевірте пошту»" width={375} height={680}>
          <ML_Frame variant="success" mobile theme="dark" />
        </DCArtboard>

      </DCSection>

      <DCSection id="auth-block" title="Auth-required reusable block — variants"
        subtitle="Нейтральний empty/auth state (НЕ помилка) для сторінок, де user не авторизований. Один компонент, контекстний підзаголовок. Вбудовується у Wishlist / Settings замість контенту.">

        <DCArtboard id="ab-wl-light" label="Variant A · Wishlist · Light" width={520} height={360}>
          <ML_AuthSpecimen context="wishlist" theme="light" />
        </DCArtboard>

        <DCArtboard id="ab-set-light" label="Variant B · Settings · Light" width={520} height={360}>
          <ML_AuthSpecimen context="settings" theme="light" />
        </DCArtboard>

        <DCArtboard id="ab-wl-dark" label="Variant A · Wishlist · Dark" width={520} height={360}>
          <ML_AuthSpecimen context="wishlist" theme="dark" />
        </DCArtboard>

        <DCArtboard id="ab-set-dark" label="Variant B · Settings · Dark" width={520} height={360}>
          <ML_AuthSpecimen context="settings" theme="dark" />
        </DCArtboard>

      </DCSection>

      <DCSection id="toast" title="Toast — «Посилання надіслано»"
        subtitle="Опційний. НЕ дублює success screen. Використовується лише як підтвердження дії «Надіслати ще раз» на екрані success (екран не змінюється). Спокійний, у стилі DS al-toast.">

        <DCArtboard id="toast-light" label="Light" width={420} height={120}>
          <ML_ToastSpecimen />
        </DCArtboard>

        <DCArtboard id="toast-dark" label="Dark" width={420} height={120}>
          <div data-theme="dark" style={{ height: '100%' }}><ML_ToastSpecimen /></div>
        </DCArtboard>

      </DCSection>

      <DCSection id="notes" title="Implementation notes"
        subtitle="Маршрути, returnTo, типографіка, компоненти, responsive. Production-ready handoff.">

        <DCArtboard id="notes-card" label="Magic Link Auth — spec" width={1040} height={1040}>
          <MLNotes />
        </DCArtboard>

      </DCSection>

    </DesignCanvas>
  );
}

// ─── Notes artboard (DS doc styling — reuses .al-doc scaffolding) ───────────────
function MLNotes() {
  const Row = ({ k, children }) => (
    <tr><td>{k}</td><td>{children}</td></tr>
  );
  return (
    <div className="al-doc" style={{ height: '100%' }}>
      <div className="al-doc-wrap">
        <p className="al-eyebrow">Knyhovo · Auth</p>
        <h1 className="al-doc-h1">Magic Link Login — implementation spec</h1>
        <p className="al-doc-lead">Passwordless. Один потік: email → лист із посиланням → перехід → повернення на returnTo. Жодних паролів, соц-логінів чи форми реєстрації. Усе зібрано з DS v1.0 + затвердженого header/footer.</p>

        <div className="al-group">
          <h2 className="al-group__title">Маршрути та потік</h2>
          <div className="al-matrix-wrap">
            <table className="al-matrix">
              <tbody>
                <Row k="Точка входу"><b>Header «Увійти» → модальне вікно</b> поверх поточної сторінки. Окрема сторінка <code>/login</code> — лише для: auth-required редіректів, протермінованих / недійсних magic-link, прямого URL та збереженого в закладках входу. Модалка і сторінка <b>використовують той самий компонент входу</b>.</Row>
                <Row k="/login"><b>Login form</b> — email + «Надіслати посилання». Відкривається з header-кнопки «Увійти» (модалка) або редіректом з gated-сторінки.</Row>
                <Row k="POST /api/auth/magic-link">Надсилає лист. Кнопка → <code>sending</code> (disabled + spinner, «Надсилаємо посилання…»). Успіх → <b>success</b> screen. Помилка → <b>error</b> (inline card, CTA «Надіслати ще раз»).</Row>
                <Row k="GET /auth/verify?token=…">Перехід за посиланням. Валідний → <b>«Входимо…»</b> (redirect loading, анімований лого) → <code>returnTo</code>. Невалідний / протермінований → <b>«Посилання недійсне»</b>.</Row>
                <Row k="Invalid → prefill">На екрані «Посилання недійсне» кнопка «Отримати нове посилання» → екран входу з <b>уже підставленим раніше введеним email</b> (через збережений email + <code>returnTo</code>). Користувач не вводить пошту вдруге.</Row>
                <Row k="returnTo">Зберігається при вході в потік (query / cookie). Користувач <b>завжди повертається на сторінку, з якої почався вхід</b>: Бажанки (Wishlist), Settings, Book Details, Search Results. Дефолт (fallback) — головна.</Row>
                <Row k="Auth-required block">Gated-сторінки (Бажанки, Settings) показують нейтральний блок «Увійдіть, щоб продовжити» з кнопкою «Увійти» → модалка / <code>/login</code> з відповідним <code>returnTo</code>.</Row>
                <Row k="Toast">«Посилання надіслано» з’являється <b>лише</b> після «Надіслати ще раз» на екрані success. Після першого успішного входу тосту немає — success screen уже є підтвердженням.</Row>
              </tbody>
            </table>
          </div>
        </div>

        <div className="al-group">
          <h2 className="al-group__title">Компоненти та токени</h2>
          <div className="al-matrix-wrap">
            <table className="al-matrix">
              <tbody>
                <Row k="Chrome">Затверджений <code>NP_SiteHeader</code> / <code>NP_SiteFooter</code> (verbatim з Settings · Wishlist · Book Details). Mobile = компактний хедер (бургер + лого · ThemeToggle).</Row>
                <Row k="Panel">Центрована <b>DS-картка</b> (<code>--surface</code> + hairline <code>--border</code> + <code>--radius-md</code> + <code>--shadow-sm</code>, padding <code>--space-12</code>, ~440px) у ритмі решти продукту: медальйон <code>.np-unsub__icon</code> → заголовок <code>.np-unsub__title</code> (Lora) → lead <code>--text-muted</code>. На success email — primary anchor (serif accent, <code>--fs-title</code>).</Row>
                <Row k="Email">DS <code>.kn-input</code> на повну ширину, <code>type="email"</code>, <code>autocomplete="email"</code>. Focus = <code>--focus-ring</code>.</Row>
                <Row k="Buttons"><code>Button variant="primary"</code> на повну ширину; secondary — «Надіслати ще раз»; quiet text-link <code>.ml-link</code> — «Змінити email» / «На головну».</Row>
                <Row k="Error">Затверджений <code>.al-note.al-note--err</code> — спокійний, ніколи не червоний. Retry — як primary CTA форми.</Row>
                <Row k="Loading"><code>.ml-spin</code> — для активної дії (sending). Redirect «Входимо…» — <b>субтильно анімований лого Knyhovo</b> (existing asset, лише opacity-пульс). Статичний під <code>prefers-reduced-motion</code>. Жодних нескінченних анімацій контенту.</Row>
              </tbody>
            </table>
          </div>
        </div>

        <div className="al-group">
          <h2 className="al-group__title">Responsive та spacing</h2>
          <div className="al-matrix-wrap">
            <table className="al-matrix">
              <tbody>
                <Row k="Desktop ≥768px"><code>.ml-main</code> по центру, padding <code>--space-16</code>, картка 440px.</Row>
                <Row k="Mobile &lt;768px (375px)">Без бокового меню, компактний хедер, картка на повну ширину. <b>+48px верхнього відступу</b> під хедером (більше повітря). Контроли 44–48px (touch).</Row>
                <Row k="Rhythm">Icon→title <code>--space-5</code> · title→lead <code>--space-3</code> · lead→form <code>--space-6</code> · поля <code>--space-3</code> · trust-note <code>--space-5</code>.</Row>
                <Row k="Theme">Light + Dark через <code>data-theme</code>. Лише існуючі токени; нова палітра не створюється.</Row>
              </tbody>
            </table>
          </div>
        </div>

        <div className="al-stamp">
          <b>Готово до імплементації.</b> Magic Link Login зібрано як природне продовження frozen Knyhovo v1.0 — без нового auth-продукту, SaaS-дашборду, паролів чи соц-логінів. Розширюйте функціонал; візуальні основи не редизайнити.
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('ml-root')).render(<MLCanvas />);
