'use strict';

const { DesignCanvas, DCSection, DCArtboard } = window;
const { NP_Frame, NP_Unsubscribe, NP_ToastSpecimen } = window;

function NPCanvas() {
  return (
    <DesignCanvas>

      <DCSection id="desktop" title="Desktop — Settings → Сповіщення"
        subtitle="Природне продовження Knyhovo Settings: затверджений header + footer, бокове меню Settings, картки у стилі DS. Тогли — auto-save (PATCH) + toast. Без зайвої кнопки збереження.">

        <DCArtboard id="dt-light" label="Light · Підписано · Обидва тогли ON" width={1040} height={620}>
          <NP_Frame state="loaded" theme="light" />
        </DCArtboard>

        <DCArtboard id="dt-dark" label="Dark · Підписано · Обидва тогли ON" width={1040} height={620}>
          <NP_Frame state="loaded" theme="dark" />
        </DCArtboard>

        <DCArtboard id="dt-unsub" label="Light · Відписано від усіх (тогли вимкнено)" width={1040} height={620}>
          <NP_Frame state="loaded" unsubscribed theme="light" />
        </DCArtboard>

        <DCArtboard id="dt-loading" label="Light · Завантаження (GET preferences)" width={1040} height={560}>
          <NP_Frame state="loading" theme="light" />
        </DCArtboard>

        <DCArtboard id="dt-error" label="Light · Помилка завантаження" width={1040} height={480}>
          <NP_Frame state="error" theme="light" />
        </DCArtboard>

      </DCSection>

      <DCSection id="mobile" title="Mobile — 375px"
        subtitle="Без бокового меню. Компактний хедер (бургер + лого · перемикач теми). Single-column, картки на повну ширину, тогли з 44px зоною дотику.">

        <DCArtboard id="mob-light" label="Light · Підписано" width={375} height={720}>
          <NP_Frame state="loaded" mobile theme="light" />
        </DCArtboard>

        <DCArtboard id="mob-dark" label="Dark · Підписано" width={375} height={720}>
          <NP_Frame state="loaded" mobile theme="dark" />
        </DCArtboard>

        <DCArtboard id="mob-unsub" label="Light · Відписано" width={375} height={760}>
          <NP_Frame state="loaded" unsubscribed mobile theme="light" />
        </DCArtboard>

        <DCArtboard id="mob-loading" label="Light · Завантаження" width={375} height={680}>
          <NP_Frame state="loading" mobile theme="light" />
        </DCArtboard>

      </DCSection>

      <DCSection id="atoms" title="Success toast"
        subtitle="З'являється після успішного PATCH /api/notifications/preferences. Спокійний, без святкування, зелена галочка — у стилі DS.">

        <DCArtboard id="toast-light" label="Light · Налаштування збережено" width={420} height={120}>
          <NP_ToastSpecimen />
        </DCArtboard>

        <DCArtboard id="toast-dark" label="Dark · Налаштування збережено" width={420} height={120}>
          <div data-theme="dark" style={{ height: '100%' }}><NP_ToastSpecimen /></div>
        </DCArtboard>

      </DCSection>

      <DCSection id="unsubscribe" title="Public unsubscribe — окрема сторінка"
        subtitle="GET /api/notifications/unsubscribe?token=… — окрема мінімальна сторінка, НЕ змішана з Settings. Той самий header/footer, центрований стан + CTA. Файл: «Notification Unsubscribe.html».">

        <DCArtboard id="unsub-light" label="Light · Ви відписані від усіх сповіщень" width={1040} height={560}>
          <NP_Unsubscribe theme="light" />
        </DCArtboard>

        <DCArtboard id="unsub-mob" label="Mobile · Ви відписані" width={375} height={620}>
          <NP_Unsubscribe mobile theme="light" />
        </DCArtboard>

      </DCSection>

    </DesignCanvas>
  );
}

ReactDOM.createRoot(document.getElementById('np-root')).render(<NPCanvas />);
