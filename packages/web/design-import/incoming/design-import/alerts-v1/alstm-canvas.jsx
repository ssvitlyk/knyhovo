// Knyhovo · Price Alerts (W4) — Alert States · Mobile spec.
// Same explicit matrix + mobile specimens: bell glyphs, chips, accordion-card
// lifecycle, success/error notes, empty states. Light + dark. 375–390px.
'use strict';

const ALSTM_AL = window.AL;
const ALSTM_C = window.ALC;
const ALSTM_S = window.ALS;
const ALSTM_D = window.ALData;

function StMobDoc({ theme }) {
  const R = ALSTM_D.ROWS;
  return (
    <div className="al-doc v1-mobile" data-theme={theme} data-screen-label={'Alert States · Mobile · ' + theme}>
      <div className="al-doc-wrap al-doc-wrap--mob">
        <p className="al-eyebrow">Price Alerts (W4)</p>
        <h1 className="al-doc-h1">Стани сповіщень — мобільний</h1>
        <p className="al-doc-lead">Ті самі п’ять станів у акордеон-картці бажанок та контролі Book Details. Дотик 44px, без горизонтального скролу, стан читається у згорнутому чипі.</p>

        <div className="al-group">
          <h2 className="al-group__title">Матриця станів</h2>
          <ALSTM_S.StateMatrix compact />
        </div>

        <div className="al-group">
          <h2 className="al-group__title">Дзвіночок</h2>
          <div className="al-spec"><ALSTM_S.BellGallery /></div>
        </div>

        <div className="al-group">
          <h2 className="al-group__title">Статус-чипи</h2>
          <div className="al-spec"><ALSTM_S.ChipGallery /></div>
        </div>

        <div className="al-group">
          <h2 className="al-group__title">Керування — у картці</h2>
          <p className="al-group__note">active · paused · unavailable у згорнутому та розкритому вигляді. «Змінити сповіщення» відкриває нижній лист (див. Alert Configuration).</p>
          <div className="hy-mcards">
            <ALSTM_C.WMobCard row={R.trig} defaultOpen />
            <ALSTM_C.WMobCard row={R.watch} />
            <ALSTM_C.WMobCard row={R.paused} defaultOpen />
            <ALSTM_C.WMobCard row={R.unavail} />
          </div>
        </div>

        <div className="al-group">
          <h2 className="al-group__title">Підтвердження</h2>
          <div className="al-grid">
            <ALSTM_AL.Note kind="ok"><b>Сповіщення увімкнено.</b> Напишемо, коли стане нижче 240 ₴.</ALSTM_AL.Note>
            <ALSTM_AL.Note kind="quiet">Сповіщення прибрано. Книга у бажанках.</ALSTM_AL.Note>
          </div>
        </div>

        <div className="al-group">
          <h2 className="al-group__title">Помилки</h2>
          <div className="al-grid">
            <ALSTM_AL.Note kind="err" action={<ALSTM_AL.Retry label="Ще раз" />}>Не вдалося ввімкнути сповіщення.</ALSTM_AL.Note>
            <ALSTM_AL.Note kind="err" action={<ALSTM_AL.Retry label="Ще раз" />}>Сервіс тимчасово недоступний.</ALSTM_AL.Note>
          </div>
        </div>

        <div className="al-group">
          <h2 className="al-group__title">Порожні стани</h2>
          <div className="al-grid">
            <ALSTM_S.EmptyNoAlerts />
            <ALSTM_S.EmptyUnavailable />
          </div>
        </div>

        <div className="al-stamp">
          <b>Price Alerts v1.0 — design exploration (W4).</b> Розширення замороженої системи; жодних змін у Wishlist / Book Details / OffersPanel / Price History.
        </div>
      </div>
    </div>
  );
}

function ALStMCanvas() {
  return (
    <DesignCanvas>
      <DCSection id="spec" title="Alert States — Mobile spec"
        subtitle="Матриця станів + мобільні специмени. Світла та темна теми. 44px дотик, без горизонтального скролу.">
        <DCArtboard id="light" label="Світла · 390px" width={390} height={2360}>
          <StMobDoc theme="light" />
        </DCArtboard>
        <DCArtboard id="dark" label="Темна · 390px" width={390} height={2360}>
          <StMobDoc theme="dark" />
        </DCArtboard>
      </DCSection>
    </DesignCanvas>
  );
}

ReactDOM.createRoot(document.getElementById('alstm-root')).render(<ALStMCanvas />);
