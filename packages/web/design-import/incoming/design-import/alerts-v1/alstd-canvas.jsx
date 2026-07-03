// Knyhovo · Price Alerts (W4) — Alert States · Desktop spec.
// Explicit state matrix + desktop specimens: bell glyphs, status chips,
// lifecycle rows, success/error notes, empty states. Light + dark.
'use strict';

const ALSTD_AL = window.AL;
const ALSTD_C = window.ALC;
const ALSTD_S = window.ALS;
const ALSTD_D = window.ALData;

function StDoc({ theme }) {
  const R = ALSTD_D.ROWS;
  return (
    <div className="al-doc" data-theme={theme} data-screen-label={'Alert States · Desktop · ' + theme}>
      <div className="al-doc-wrap">
        <p className="al-eyebrow">Knyhovo · Price Alerts (W4) · розширення</p>
        <h1 className="al-doc-h1">Стани сповіщень про ціну — десктоп</h1>
        <p className="al-doc-lead">Розширює заморожені «Бажанки» та Book Details станами, що стають доступні з Alert API. Жодного нового макета — стани живуть у вже зарезервованих слотах. Кожен стан читається за глифом + текстом, колір — вторинний.</p>

        <div className="al-group">
          <h2 className="al-group__title">Матриця станів</h2>
          <p className="al-group__note">П’ять станів життєвого циклу сповіщення та їхнє відображення в обох поверхнях. Під капотом — одне поле <code style={{ background: 'var(--surface-sunk)', borderRadius: 3, padding: '1px 5px', fontSize: 12 }}>wishlist_items.target_price</code>.</p>
          <ALSTD_S.StateMatrix />
        </div>

        <div className="al-group">
          <h2 className="al-group__title">Дзвіночок — контроль сповіщення</h2>
          <p className="al-group__note">Чотири глифи (bell · bell-dot · bell-ring · bell-off) для п’яти станів; paused та unavailable ділять bell-off і розрізняються тоном, доступністю та сусіднім чипом. Розширює frozen <code style={{ background: 'var(--surface-sunk)', borderRadius: 3, padding: '1px 5px', fontSize: 12 }}>.wl-iconbtn</code>.</p>
          <div className="al-spec"><ALSTD_S.BellGallery /></div>
        </div>

        <div className="al-group">
          <h2 className="al-group__title">Статус-чипи</h2>
          <p className="al-group__note">Тихий індикатор у зарезервованій колонці статусу рядка — анатомія повторює frozen <code style={{ background: 'var(--surface-sunk)', borderRadius: 3, padding: '1px 5px', fontSize: 12 }}>.phv-badge</code> (іконка + підпис).</p>
          <div className="al-spec"><ALSTD_S.ChipGallery /></div>
        </div>

        <div className="al-group">
          <h2 className="al-group__title">Керування — у рядку бажанок</h2>
          <p className="al-group__note">active · paused · removed · unavailable. Висота рядка (104px) і сітка незмінні. «Removed» повертає рядок до стану saved + тихе підтвердження.</p>
          <div className="v1-rows">
            <ALSTD_C.WRow row={R.watch} />
            <ALSTD_C.WRow row={R.paused} />
            <ALSTD_C.WRow row={R.saved} />
            <ALSTD_C.WRow row={R.unavail} />
          </div>
          <div style={{ marginTop: 'var(--space-3)' }}>
            <ALSTD_AL.Note kind="quiet">«{R.saved.title}»: сповіщення прибрано — книга залишається у бажанках.</ALSTD_AL.Note>
          </div>
        </div>

        <div className="al-group">
          <h2 className="al-group__title">Підтвердження — тихі, не святкові</h2>
          <p className="al-group__note">Жодних конфеті, банерів чи червоного. Зелена галочка для позитивних подій; нейтральний тон для прибирання.</p>
          <div className="al-grid al-grid--3">
            <ALSTD_S.Spec name="Створено" when="alert created" col><ALSTD_AL.Note kind="ok"><b>Сповіщення увімкнено.</b> Книговик напише, коли ціна стане нижче 240 ₴.</ALSTD_AL.Note></ALSTD_S.Spec>
            <ALSTD_S.Spec name="Оновлено" when="alert updated" col><ALSTD_AL.Note kind="ok"><b>Сповіщення оновлено.</b> Стежимо за ціною нижче 285 ₴.</ALSTD_AL.Note></ALSTD_S.Spec>
            <ALSTD_S.Spec name="Прибрано" when="alert removed" col><ALSTD_AL.Note kind="quiet">Сповіщення прибрано. Книга у бажанках.</ALSTD_AL.Note></ALSTD_S.Spec>
          </div>
        </div>

        <div className="al-group">
          <h2 className="al-group__title">Помилки — локальне відновлення, не блокують перегляд</h2>
          <p className="al-group__note">Кожна помилка має дію відновлення поряд («Спробувати ще раз»). Книга й OffersPanel залишаються повністю робочими. Ніколи не глобальна сторінка, ніколи не червоний.</p>
          <div className="al-grid al-grid--2">
            <ALSTD_S.Spec name="Не вдалося створити" when="create failed" col><ALSTD_AL.Note kind="err" action={<ALSTD_AL.Retry />}>Не вдалося ввімкнути сповіщення.</ALSTD_AL.Note></ALSTD_S.Spec>
            <ALSTD_S.Spec name="Не вдалося оновити" when="update failed" col><ALSTD_AL.Note kind="err" action={<ALSTD_AL.Retry />}>Не вдалося зберегти зміни сповіщення.</ALSTD_AL.Note></ALSTD_S.Spec>
            <ALSTD_S.Spec name="Не вдалося прибрати" when="remove failed" col><ALSTD_AL.Note kind="err" action={<ALSTD_AL.Retry />}>Не вдалося прибрати сповіщення.</ALSTD_AL.Note></ALSTD_S.Spec>
            <ALSTD_S.Spec name="Сервіс недоступний" when="backend unavailable" col><ALSTD_AL.Note kind="err" action={<ALSTD_AL.Retry />}>Сервіс сповіщень тимчасово недоступний. Спробуйте пізніше.</ALSTD_AL.Note></ALSTD_S.Spec>
          </div>
        </div>

        <div className="al-group">
          <h2 className="al-group__title">Порожні стани</h2>
          <p className="al-group__note">Немає активних сповіщень · сповіщення недоступні через відсутність даних. Спокійні банери в голосі Книговика — без маскота (він лишається для empty / first-book).</p>
          <div className="al-grid al-grid--2">
            <ALSTD_S.EmptyNoAlerts />
            <ALSTD_S.EmptyUnavailable />
          </div>
        </div>

        <div className="al-stamp">
          <b>Price Alerts v1.0 — design exploration (W4).</b> Розширення замороженої системи: композиція з <code style={{ background: 'var(--surface-sunk)', borderRadius: 3, padding: '1px 5px', fontSize: 12 }}>window.KnyhovoDesignSystem_9fa616</code> + DS v1.0 токенів. Жодних нових кольорів, типу, радіусів чи тіней; жодних змін у Wishlist / Book Details / OffersPanel / Price History.
        </div>
      </div>
    </div>
  );
}

function ALStDCanvas() {
  return (
    <DesignCanvas>
      <DCSection id="spec" title="Alert States — Desktop spec"
        subtitle="Повна матриця станів + специмени. Світла та темна теми. Composes DS v1.0 + window.AL/ALC/ALS.">
        <DCArtboard id="light" label="Світла" width={1180} height={2280}>
          <StDoc theme="light" />
        </DCArtboard>
        <DCArtboard id="dark" label="Темна" width={1180} height={2280}>
          <StDoc theme="dark" />
        </DCArtboard>
      </DCSection>
    </DesignCanvas>
  );
}

ReactDOM.createRoot(document.getElementById('alstd-root')).render(<ALStDCanvas />);
