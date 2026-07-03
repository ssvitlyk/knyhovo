// Knyhovo · Price Alerts (W4) — Alert Configuration canvas.
// The lightweight, intent-first configuration flow. NOT a modal: a popover on
// desktop, a bottom sheet on mobile. Enable / edit / remove. Three intents map
// to wishlist_items.target_price; custom price is a quiet secondary path.
'use strict';

const ALCF_AL = window.AL;
const ALCF = window.ALData;

function CfgFrame({ theme, children, w, h, label, mobile }) {
  return (
    <div className="al-doc" data-theme={theme} data-screen-label={label}
      style={{ width: w, height: h, display: 'flex', alignItems: mobile ? 'stretch' : 'center', justifyContent: 'center', padding: mobile ? 0 : 'var(--space-8)', background: 'var(--surface-sunk)' }}>
      {children}
    </div>
  );
}

function ALCfgCanvas() {
  return (
    <DesignCanvas>
      <DCSection id="flow" title="Конфігурація сповіщення — основний потік"
        subtitle="«Що вам сказати?», а не «введіть число». Три наміри → Книговик обирає target_price. Власна ціна — тихий другорядний шлях. Поповер ~332px, картковий, на місці — без модального вікна.">
        <DCArtboard id="create" label="Створення · Світла" width={460} height={560}>
          <CfgFrame theme="light" w="100%" h="100%" label="Config · create · light"><ALCF_AL.Config initialIntent="below" /></CfgFrame>
        </DCArtboard>
        <DCArtboard id="create-d" label="Створення · Темна" width={460} height={560}>
          <CfgFrame theme="dark" w="100%" h="100%" label="Config · create · dark"><ALCF_AL.Config initialIntent="below" /></CfgFrame>
        </DCArtboard>
        <DCArtboard id="good" label="Намір «Вигідна ціна»" width={460} height={560}>
          <CfgFrame theme="light" w="100%" h="100%" label="Config · good intent"><ALCF_AL.Config initialIntent="good" /></CfgFrame>
        </DCArtboard>
        <DCArtboard id="custom" label="Власна ціна (розкрито)" width={460} height={600}>
          <CfgFrame theme="light" w="100%" h="100%" label="Config · custom open"><ALCF_AL.Config initialIntent="below" openCustom /></CfgFrame>
        </DCArtboard>
      </DCSection>

      <DCSection id="edit" title="Редагування та видалення"
        subtitle="Існуюче сповіщення відкривається з тим самим поповером: змінити поріг або «Прибрати». «Вигідна ціна» вимикається, коли Price History ще збирає історію (degraded — тай-ін з frozen empty-state).">
        <DCArtboard id="edit-light" label="Редагування · Світла" width={460} height={560}>
          <CfgFrame theme="light" w="100%" h="100%" label="Config · edit"><ALCF_AL.Config initialIntent="good" editing /></CfgFrame>
        </DCArtboard>
        <DCArtboard id="nohistory" label="«Вигідна ціна» недоступна" width={460} height={560}>
          <CfgFrame theme="light" w="100%" h="100%" label="Config · no history"><ALCF_AL.Config initialIntent="below" noHistory /></CfgFrame>
        </DCArtboard>
        <DCArtboard id="edit-dark" label="Редагування · Темна" width={460} height={560}>
          <CfgFrame theme="dark" w="100%" h="100%" label="Config · edit · dark"><ALCF_AL.Config initialIntent="good" editing /></CfgFrame>
        </DCArtboard>
      </DCSection>

      <DCSection id="mobile" title="Мобільний — нижній лист (bottom sheet)"
        subtitle="Той самий вибір намірів у легкому листі, що висувається знизу. Не повноекранне модальне вікно: захоплювач + затемнення сторінки під ним. Дотик 44px, кнопки на всю ширину.">
        <DCArtboard id="sheet-light" label="Лист · Світла · 375px" width={375} height={620}>
          <CfgFrame theme="light" w="100%" h="100%" label="Sheet · light" mobile>
            <ALCF_AL.Sheet height={620}><ALCF_AL.Config initialIntent="below" /></ALCF_AL.Sheet>
          </CfgFrame>
        </DCArtboard>
        <DCArtboard id="sheet-edit" label="Лист · редагування · 375px" width={375} height={620}>
          <CfgFrame theme="light" w="100%" h="100%" label="Sheet · edit" mobile>
            <ALCF_AL.Sheet height={620}><ALCF_AL.Config initialIntent="good" editing /></ALCF_AL.Sheet>
          </CfgFrame>
        </DCArtboard>
        <DCArtboard id="sheet-dark" label="Лист · Темна · 375px" width={375} height={620}>
          <CfgFrame theme="dark" w="100%" h="100%" label="Sheet · dark" mobile>
            <ALCF_AL.Sheet height={620}><ALCF_AL.Config initialIntent="below" /></ALCF_AL.Sheet>
          </CfgFrame>
        </DCArtboard>
      </DCSection>

      <DCSection id="result" title="Результат дії — підтвердження та помилки"
        subtitle="Підтвердження тихі, не святкові, ніколи не червоні. Помилки відновлюються локально («Спробувати ще раз») і ніколи не блокують перегляд книги.">
        <DCArtboard id="ok-created" label="Створено" width={520} height={150}>
          <CfgFrame theme="light" w="100%" h="100%" label="ok · created">
            <div style={{ width: '100%' }}><ALCF_AL.Note kind="ok"><b>Сповіщення увімкнено.</b> Книговик напише на пошту, коли ціна стане нижче 240 ₴.</ALCF_AL.Note></div>
          </CfgFrame>
        </DCArtboard>
        <DCArtboard id="ok-updated" label="Оновлено" width={520} height={150}>
          <CfgFrame theme="light" w="100%" h="100%" label="ok · updated">
            <div style={{ width: '100%' }}><ALCF_AL.Note kind="ok"><b>Сповіщення оновлено.</b> Тепер стежимо за ціною нижче 285 ₴.</ALCF_AL.Note></div>
          </CfgFrame>
        </DCArtboard>
        <DCArtboard id="ok-removed" label="Прибрано" width={520} height={150}>
          <CfgFrame theme="light" w="100%" h="100%" label="ok · removed">
            <div style={{ width: '100%' }}><ALCF_AL.Note kind="quiet">Сповіщення прибрано. Книга залишається у бажанках.</ALCF_AL.Note></div>
          </CfgFrame>
        </DCArtboard>
        <DCArtboard id="err-create" label="Помилка створення" width={520} height={150}>
          <CfgFrame theme="light" w="100%" h="100%" label="err · create">
            <div style={{ width: '100%' }}><ALCF_AL.Note kind="err" action={<ALCF_AL.Retry />}>Не вдалося ввімкнути сповіщення.</ALCF_AL.Note></div>
          </CfgFrame>
        </DCArtboard>
        <DCArtboard id="err-backend" label="Сервіс тимчасово недоступний" width={520} height={150}>
          <CfgFrame theme="dark" w="100%" h="100%" label="err · backend">
            <div style={{ width: '100%' }}><ALCF_AL.Note kind="err" action={<ALCF_AL.Retry />}>Сервіс сповіщень тимчасово недоступний. Книга у бажанках — спробуйте пізніше.</ALCF_AL.Note></div>
          </CfgFrame>
        </DCArtboard>
      </DCSection>
    </DesignCanvas>
  );
}

ReactDOM.createRoot(document.getElementById('alcfg-root')).render(<ALCfgCanvas />);
