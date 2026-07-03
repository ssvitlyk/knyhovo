// hp-shared.jsx — Knyhovo Homepage Discovery Exploration — Shared mock components
// @ds-adherence-ignore -- exploration mockup scaffold

const { BookCard, Badge, Chip } = window.KnyhovoDesignSystem_9fa616;

// ── Book data ─────────────────────────────────────────────────────────────────
const HP_BOOKS = [
  { id:'b1', title:'Атомні звички',    author:'Джеймс Клір',            price:'289 ₴', oldPrice:'360 ₴', store:'Yakaboo',        bt:'solid', bl:'-20%' },
  { id:'b2', title:'Дюна',             author:'Френк Герберт',           price:'315 ₴',                   store:'Книгарня «Є»',   bt:'green', bl:'Найкраща ціна' },
  { id:'b3', title:'Майстер і Маргарита', author:'М. Булгаков',         price:'220 ₴', oldPrice:'280 ₴', store:'Rozetka',        bt:'solid', bl:'-21%' },
  { id:'b4', title:'Думай повільно…',  author:'Даніель Канеман',        price:'265 ₴',                   store:'Nash Format' },
  { id:'b5', title:'Сапієнс',          author:'Юваль Харарі',           price:'340 ₴', oldPrice:'420 ₴', store:'BookChef',       bt:'solid', bl:'-19%' },
  { id:'b6', title:'Маленький принц',  author:'А. де Сент-Екзюпері',   price:'185 ₴',                   store:'Yakaboo',        bt:'green', bl:'Найкраща ціна' },
  { id:'b7', title:'1984',             author:'Джордж Орвелл',          price:'210 ₴',                   store:'Rozetka' },
  { id:'b8', title:'Кобзар',           author:'Тарас Шевченко',         price:'165 ₴', oldPrice:'200 ₴', store:'Книгарня «Є»',  bt:'solid', bl:'-17%' },
];

const HP_GENRES = ['Фантастика','Психологія','Класика','Нон-фікшн','Бізнес','Поезія','Детектив','Дитяче'];

// ── HpHeader ──────────────────────────────────────────────────────────────────
const HpHeader = ({ searchInHeader=false, active='Головна', extraRight=null }) => (
  <header style={{
    display:'flex', alignItems:'center', gap:24,
    padding:'0 40px', height:64, flexShrink:0,
    background:'var(--surface)', borderBottom:'1px solid var(--border)',
  }}>
    <img src="assets/logo/knyhovo-logo-light.png" alt="Knyhovo"
      style={{ height:26, objectFit:'contain', flexShrink:0 }} />
    <nav style={{ display:'flex', gap:20, flex:1 }}>
      {['Головна','Огляд','Каталог','Бажанки','Знижки'].map(n => (
        <span key={n} style={{
          fontFamily:'var(--font-body)', fontSize:14,
          color: n===active ? 'var(--accent)' : 'var(--text-muted)',
          fontWeight: n===active ? 600 : 400,
        }}>{n}</span>
      ))}
    </nav>
    {searchInHeader && (
      <div style={{
        display:'flex', alignItems:'center', gap:8,
        background:'var(--bg)', border:'1px solid var(--border)',
        borderRadius:8, padding:'8px 14px', width:248,
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--icon-muted)" strokeWidth="2">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <span style={{ fontFamily:'var(--font-body)', fontSize:13, color:'var(--text-faint)' }}>Назва книги, автора…</span>
      </div>
    )}
    {extraRight}
    <button style={{
      fontFamily:'var(--font-body)', fontSize:13, fontWeight:500,
      border:'1px solid var(--border-strong)', borderRadius:8,
      padding:'7px 18px', background:'transparent', color:'var(--text)', cursor:'pointer',
    }}>Увійти</button>
  </header>
);

// ── HpFooter ──────────────────────────────────────────────────────────────────
const HpFooter = ({ padTop=48 }) => (
  <footer style={{
    display:'flex', flexDirection:'column', alignItems:'center', gap:8,
    padding:`${padTop}px 40px 28px`, borderTop:'1px solid var(--border)',
    background:'var(--bg)',
  }}>
    <img src="assets/logo/knyhovo-logo-light.png" alt="Knyhovo" style={{ height:22 }} />
    <p style={{ fontFamily:'var(--font-body)', fontSize:13, color:'var(--text-muted)', margin:0 }}>
      Знаходимо найкращі ціни на книги — щодня.
    </p>
    <p style={{ fontFamily:'var(--font-body)', fontSize:12, color:'var(--text-faint)', margin:0 }}>© 2026 Knyhovo</p>
  </footer>
);

// ── HpRail ────────────────────────────────────────────────────────────────────
const HpRail = ({ title, books=[], seeAll=true, padTop=32, padBottom=0 }) => (
  <section style={{ padding:`${padTop}px 40px ${padBottom}px` }}>
    <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', marginBottom:18 }}>
      <h3 style={{ fontFamily:'var(--font-display)', fontSize:22, color:'var(--text)', margin:0, fontWeight:600 }}>
        {title}
      </h3>
      {seeAll && <span style={{ fontFamily:'var(--font-body)', fontSize:13, color:'var(--accent)' }}>Усі →</span>}
    </div>
    <div style={{ display:'flex', gap:14 }}>
      {books.map(b => (
        <BookCard key={b.id}
          title={b.title} author={b.author}
          price={b.price} oldPrice={b.oldPrice}
          store={b.store}
          badge={b.bt ? <Badge tone={b.bt}>{b.bl}</Badge> : null}
        />
      ))}
    </div>
  </section>
);

// ── HpGenreRow ────────────────────────────────────────────────────────────────
const HpGenreRow = ({ genres=HP_GENRES, padTop=24, padX=40 }) => (
  <div style={{ display:'flex', gap:8, flexWrap:'wrap', padding:`${padTop}px ${padX}px 0` }}>
    {genres.map(g => <Chip key={g}>{g}</Chip>)}
  </div>
);

// ── HpAnnotation ──────────────────────────────────────────────────────────────
const HpAnnotation = ({ letter, name, ia, journey, searchProm, discoveryProm, strengths, weaknesses, why }) => {
  const PROM_STYLES = {
    'Максимальна': { c:'var(--brand-green)', bg:'color-mix(in oklab, var(--brand-green) 10%, var(--surface))' },
    'Висока':      { c:'var(--accent)',       bg:'var(--accent-weak)' },
    'Середня':     { c:'var(--kn-blue)',      bg:'color-mix(in oklab, var(--kn-blue) 12%, var(--surface))' },
    'Низька':      { c:'var(--text-muted)',   bg:'var(--surface-sunk)' },
  };
  const PromBadge = ({ level }) => {
    const s = PROM_STYLES[level] || PROM_STYLES['Середня'];
    return (
      <span style={{
        display:'inline-block', fontFamily:'var(--font-body)', fontSize:12, fontWeight:600,
        color:s.c, background:s.bg, borderRadius:6, padding:'3px 10px',
      }}>{level}</span>
    );
  };

  const hpLbl = { fontFamily:'var(--font-body)', fontSize:11, fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase', color:'var(--text-muted)', display:'block', marginBottom:6 };
  const hpVal = { fontFamily:'var(--font-body)', fontSize:13.5, color:'var(--text-body)', lineHeight:1.55, margin:0 };

  return (
    <div style={{ padding:'28px 40px 36px', background:'var(--surface-sunk)', borderTop:'2px solid var(--border)' }}>
      <div style={{ display:'flex', alignItems:'baseline', gap:12, marginBottom:22 }}>
        <span style={{ fontFamily:'var(--font-display)', fontSize:30, fontWeight:700, color:'var(--accent)', lineHeight:1 }}>{letter}</span>
        <span style={{ fontFamily:'var(--font-display)', fontSize:20, fontWeight:600, fontStyle:'italic', color:'var(--text)' }}>{name}</span>
      </div>
      {/* Row 1 */}
      <div style={{ display:'grid', gridTemplateColumns:'2fr 2fr 1fr 1fr', gap:'0 28px', paddingBottom:20, marginBottom:20, borderBottom:'1px solid var(--border)' }}>
        <div><span style={hpLbl}>Інформаційна архітектура</span><p style={hpVal}>{ia}</p></div>
        <div><span style={hpLbl}>Подорож користувача</span><p style={hpVal}>{journey}</p></div>
        <div><span style={hpLbl}>Пошук</span><PromBadge level={searchProm} /></div>
        <div><span style={hpLbl}>Відкриття</span><PromBadge level={discoveryProm} /></div>
      </div>
      {/* Row 2 */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'0 28px' }}>
        <div>
          <span style={hpLbl}>Переваги</span>
          <ul style={{ margin:0, paddingLeft:16 }}>
            {strengths.map((s,i) => <li key={i} style={{ ...hpVal, color:'var(--brand-green)', marginBottom:3 }}>{s}</li>)}
          </ul>
        </div>
        <div>
          <span style={hpLbl}>Ризики</span>
          <ul style={{ margin:0, paddingLeft:16 }}>
            {weaknesses.map((w,i) => <li key={i} style={{ ...hpVal, color:'var(--kn-copper)', marginBottom:3 }}>{w}</li>)}
          </ul>
        </div>
        <div><span style={hpLbl}>Чому Knyhovo</span><p style={hpVal}>{why}</p></div>
      </div>
    </div>
  );
};

Object.assign(window, { HP_BOOKS, HP_GENRES, HpHeader, HpFooter, HpRail, HpGenreRow, HpAnnotation });
