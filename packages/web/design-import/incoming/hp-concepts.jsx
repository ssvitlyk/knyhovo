// hp-concepts.jsx — Knyhovo Homepage Discovery — 5 Architecture Concepts
// @ds-adherence-ignore -- exploration mockup scaffold
// Depends on: hp-shared.jsx

const { BookCard, Badge, Chip, Button } = window.KnyhovoDesignSystem_9fa616;
const { HP_BOOKS, HP_GENRES, HpHeader, HpFooter, HpRail, HpGenreRow } = window;

// ── Shared helpers ────────────────────────────────────────────────────────────

const COVER_COLORS = ['#B56A2D','#24513E','#243C7A','#3B2517','#5A4A2A','#2A3D6B','#3E6B4A'];

const HpCover = ({ w=84, h=122, ci=0 }) => (
  <div style={{
    width:w, height:h, borderRadius:6, flexShrink:0,
    background:`color-mix(in oklab, ${COVER_COLORS[ci % COVER_COLORS.length]} 28%, var(--kn-paper))`,
    border:'1px solid rgba(0,0,0,0.08)', boxShadow:'1px 2px 8px rgba(60,40,20,0.14)',
  }} />
);

const SearchMock = ({ large=false }) => (
  <div style={{
    display:'flex', alignItems:'center', background:'var(--surface)',
    border:'1px solid var(--border)', borderRadius:16, overflow:'hidden',
    boxShadow:'0 2px 16px rgba(181,106,45,0.10)',
  }}>
    <svg style={{ margin: large?'0 14px 0 20px':'0 10px 0 16px', flexShrink:0 }}
      width={large?20:16} height={large?20:16} viewBox="0 0 24 24" fill="none"
      stroke="var(--icon-muted)" strokeWidth="2">
      <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
    </svg>
    <span style={{
      flex:1, padding: large?'17px 8px':'12px 8px',
      fontFamily:'var(--font-body)', fontSize: large?16:14, color:'var(--text-faint)',
    }}>Назва книги, автора або ISBN…</span>
    <div style={{
      background:'var(--accent)', color:'var(--text-on-accent)',
      padding: large?'17px 28px':'12px 20px', flexShrink:0,
      fontFamily:'var(--font-body)', fontWeight:600, fontSize: large?16:14,
    }}>Знайти</div>
  </div>
);

const ConceptShell = ({ children }) => (
  <div data-theme="light" style={{
    width:1280, background:'var(--bg)',
    boxShadow:'0 4px 32px rgba(0,0,0,0.09)', borderRadius:12,
    border:'1px solid rgba(0,0,0,0.06)', overflow:'hidden',
  }}>
    {children}
  </div>
);

// ── CONCEPT A: Oracle Search ──────────────────────────────────────────────────
const ConceptA = () => (
  <ConceptShell>
    <HpHeader active="Головна" />
    {/* Hero */}
    <section style={{
      display:'flex', alignItems:'center', justifyContent:'space-between',
      padding:'76px 80px 64px', gap:48, background:'var(--bg)', minHeight:360,
    }}>
      <div style={{ flex:1, maxWidth:620 }}>
        <p style={{
          fontFamily:'var(--font-body)', fontSize:11, fontWeight:600,
          letterSpacing:'0.14em', textTransform:'uppercase', color:'var(--text-muted)',
          marginBottom:24, marginTop:0,
        }}>ПОРІВНЯННЯ ЦІН · 5 КНИГАРЕНЬ · ЩОДНЯ</p>
        <h1 style={{
          fontFamily:'var(--font-display)', fontSize:48,
          lineHeight:1.08, letterSpacing:'-0.02em',
          color:'var(--text)', margin:'0 0 4px', fontWeight:700,
        }}>Де купити цю книгу?</h1>
        <h1 style={{
          fontFamily:'var(--font-display)', fontSize:48,
          lineHeight:1.08, letterSpacing:'-0.02em',
          color:'var(--accent)', fontStyle:'italic',
          margin:'0 0 36px', fontWeight:700,
        }}>Knyhovo знає.</h1>
        <SearchMock large={true} />
        <div style={{ display:'flex', gap:8, marginTop:16, flexWrap:'wrap' }}>
          <span style={{ fontFamily:'var(--font-body)', fontSize:13, color:'var(--text-muted)' }}>Шукають:</span>
          {['Атомні звички','Дюна','Сапієнс','1984'].map(q => <Chip key={q}>{q}</Chip>)}
        </div>
      </div>
      <img src="assets/mascot/mascot-magnifier.png" alt="Книговик"
        style={{ height:272, objectFit:'contain', flexShrink:0, filter:'drop-shadow(0 8px 24px rgba(60,40,20,0.12))' }} />
    </section>
    {/* Rails */}
    <div style={{ borderTop:'1px solid var(--border)' }}>
      <HpRail title="Популярне сьогодні" books={HP_BOOKS.slice(0,5)} padTop={36} />
      <HpRail title="Новинки" books={HP_BOOKS.slice(3,8)} padTop={32} padBottom={48} />
    </div>
    <HpFooter padTop={0} />
  </ConceptShell>
);

// ── CONCEPT B: Editorial Front ────────────────────────────────────────────────
const ConceptB = () => (
  <ConceptShell>
    <HpHeader searchInHeader={true} active="Головна" />
    {/* Editorial hero */}
    <section style={{
      display:'grid', gridTemplateColumns:'260px 1fr',
      background:'var(--surface-accent)', padding:'56px 64px',
      gap:52, alignItems:'center', minHeight:320,
    }}>
      <HpCover w={200} h={292} ci={4} />
      <div>
        <div style={{ marginBottom:16 }}><Badge tone="green">Knyhovo радить</Badge></div>
        <h2 style={{ fontFamily:'var(--font-display)', fontSize:30, fontWeight:700, color:'var(--text)', margin:'0 0 6px', lineHeight:1.18 }}>
          Сто років самотності
        </h2>
        <p style={{ fontFamily:'var(--font-body)', fontSize:15, color:'var(--text-muted)', margin:'0 0 20px', fontWeight:400 }}>
          Ґабріель Ґарсіа Маркес
        </p>
        <p style={{ fontFamily:'var(--font-display)', fontSize:15, fontStyle:'italic', color:'var(--text-body)', margin:'0 0 28px', lineHeight:1.65, maxWidth:480 }}>
          «Книга, яку треба читати повільно — не тому що складна, а тому що добра. Один із тих романів, після яких по-іншому дивишся на час.»
        </p>
        <div style={{ display:'flex', alignItems:'center', gap:20 }}>
          <div>
            <span style={{ fontFamily:'var(--font-display)', fontSize:28, fontWeight:700, color:'var(--accent)' }}>285 ₴</span>
            {'  '}
            <span style={{ fontFamily:'var(--font-body)', fontSize:13, color:'var(--text-muted)', textDecoration:'line-through' }}>340 ₴</span>
          </div>
          <button style={{
            background:'var(--accent)', color:'var(--text-on-accent)', border:'none',
            borderRadius:8, padding:'12px 24px', fontFamily:'var(--font-body)',
            fontWeight:600, fontSize:14, cursor:'pointer',
          }}>Порівняти ціни →</button>
        </div>
      </div>
    </section>
    {/* Genre chips */}
    <HpGenreRow padTop={28} />
    {/* Rails */}
    <HpRail title="Новинки" books={HP_BOOKS.slice(0,5)} padTop={32} />
    <HpRail title="Популярне" books={HP_BOOKS.slice(2,7)} padTop={28} padBottom={48} />
    <HpFooter padTop={0} />
  </ConceptShell>
);

// ── CONCEPT C: Price Intelligence ─────────────────────────────────────────────
const DEALS = [
  { ci:0, title:'Атомні звички',    author:'Джеймс Клір',  price:'289 ₴', old:'360 ₴', saving:'71 ₴', pct:'-20%', store:'Yakaboo' },
  { ci:4, title:'Сапієнс',          author:'Юваль Харарі', price:'340 ₴', old:'420 ₴', saving:'80 ₴', pct:'-19%', store:'BookChef' },
  { ci:2, title:'Майстер і Маргарита', author:'М. Булгаков', price:'220 ₴', old:'280 ₴', saving:'60 ₴', pct:'-21%', store:'Rozetka' },
];

const ConceptC = () => (
  <ConceptShell>
    <HpHeader searchInHeader={true} active="Знижки" />
    {/* Price hero */}
    <section style={{ padding:'48px 40px 40px', background:'var(--bg)' }}>
      <p style={{ fontFamily:'var(--font-body)', fontSize:11, fontWeight:600, letterSpacing:'0.14em', textTransform:'uppercase', color:'var(--text-muted)', marginBottom:8, marginTop:0 }}>
        ЦІНИ ЗНИЖЕНО · ОНОВЛЕНО СЬОГОДНІ О 08:00
      </p>
      <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', marginBottom:28 }}>
        <h2 style={{ fontFamily:'var(--font-display)', fontSize:30, fontWeight:700, color:'var(--text)', margin:0 }}>
          Вигідний момент — зараз.
        </h2>
        <span style={{ fontFamily:'var(--font-body)', fontSize:13, color:'var(--accent)' }}>Усі знижки →</span>
      </div>
      {/* Deal cards */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:16 }}>
        {DEALS.map((d,i) => (
          <div key={i} style={{
            background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12,
            padding:'24px', display:'flex', gap:16, alignItems:'flex-start',
          }}>
            <HpCover w={72} h={104} ci={d.ci} />
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ marginBottom:8 }}><Badge tone="solid">{d.pct}</Badge></div>
              <h4 style={{ fontFamily:'var(--font-display)', fontSize:15, fontWeight:600, color:'var(--text)', margin:'0 0 2px', lineHeight:1.3 }}>{d.title}</h4>
              <p style={{ fontFamily:'var(--font-body)', fontSize:12, color:'var(--text-muted)', margin:'0 0 12px' }}>{d.author}</p>
              <div style={{ display:'flex', alignItems:'baseline', gap:8, marginBottom:4 }}>
                <span style={{ fontFamily:'var(--font-display)', fontSize:22, fontWeight:700, color:'var(--accent)' }}>{d.price}</span>
                <span style={{ fontFamily:'var(--font-body)', fontSize:12, color:'var(--text-muted)', textDecoration:'line-through' }}>{d.old}</span>
              </div>
              <p style={{ fontFamily:'var(--font-body)', fontSize:12, color:'var(--brand-green)', fontWeight:600, margin:'0 0 12px' }}>
                Економія {d.saving} · {d.store}
              </p>
              <span style={{ fontFamily:'var(--font-body)', fontSize:13, color:'var(--accent)', fontWeight:500 }}>Порівняти ціни →</span>
            </div>
          </div>
        ))}
      </div>
    </section>
    {/* Wishlist tease */}
    <div style={{ margin:'0 40px', background:'var(--accent-weak)', borderRadius:10, padding:'14px 20px', display:'flex', alignItems:'center', gap:16 }}>
      <p style={{ fontFamily:'var(--font-body)', fontSize:13, color:'var(--text-body)', margin:0, flex:1 }}>
        <strong>Стежте за ціною</strong> — додайте книгу до бажанок і Книговик повідомить, коли знижка настане.
      </p>
      <button style={{
        background:'var(--accent)', color:'var(--text-on-accent)', border:'none',
        borderRadius:8, padding:'9px 18px', fontFamily:'var(--font-body)', fontWeight:600, fontSize:13, cursor:'pointer', whiteSpace:'nowrap',
      }}>Бажанки →</button>
    </div>
    <HpRail title="Найкращі ціни тижня" books={HP_BOOKS.slice(0,5)} padTop={32} padBottom={48} />
    <HpFooter padTop={0} />
  </ConceptShell>
);

// ── CONCEPT D: Two Doors ──────────────────────────────────────────────────────
const MOOD_TILES = [
  { label:'Фантастика',  count:'2 430 книг', ci:2 },
  { label:'Психологія',  count:'1 840 книг', ci:1 },
  { label:'Класика',     count:'3 210 книг', ci:3 },
  { label:'Нон-фікшн',   count:'4 120 книг', ci:0 },
];

const ConceptD = () => (
  <ConceptShell>
    <HpHeader active="Головна" />
    {/* Two-door hero */}
    <section style={{ display:'grid', gridTemplateColumns:'1fr 1fr', minHeight:420 }}>
      {/* Left: Search door */}
      <div style={{ padding:'64px 56px', background:'var(--surface)', borderRight:'1px solid var(--border)' }}>
        <p style={{ fontFamily:'var(--font-body)', fontSize:11, fontWeight:600, letterSpacing:'0.14em', textTransform:'uppercase', color:'var(--text-muted)', marginTop:0, marginBottom:16 }}>
          Знаю назву книги
        </p>
        <h2 style={{ fontFamily:'var(--font-display)', fontSize:26, fontWeight:700, color:'var(--text)', margin:'0 0 28px', lineHeight:1.2 }}>
          Знайти конкретну книгу й порівняти ціни.
        </h2>
        <SearchMock large={false} />
        <div style={{ marginTop:20 }}>
          <p style={{ fontFamily:'var(--font-body)', fontSize:12, color:'var(--text-muted)', marginBottom:8, marginTop:0 }}>Нещодавні пошуки</p>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {['Атомні звички','Дюна','Сапієнс'].map(q => <Chip key={q}>{q}</Chip>)}
          </div>
        </div>
      </div>
      {/* Right: Discovery door */}
      <div style={{ padding:'64px 56px', background:'var(--surface-accent)' }}>
        <p style={{ fontFamily:'var(--font-body)', fontSize:11, fontWeight:600, letterSpacing:'0.14em', textTransform:'uppercase', color:'var(--text-muted)', marginTop:0, marginBottom:16 }}>
          Хочу щось відкрити
        </p>
        <h2 style={{ fontFamily:'var(--font-display)', fontSize:26, fontWeight:700, color:'var(--text)', margin:'0 0 28px', lineHeight:1.2 }}>
          Що читають зараз?
        </h2>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          {MOOD_TILES.map((t,i) => (
            <div key={i} style={{
              background:`color-mix(in oklab, ${COVER_COLORS[t.ci % COVER_COLORS.length]} 20%, var(--surface))`,
              border:'1px solid rgba(0,0,0,0.08)', borderRadius:10,
              padding:'20px 18px', cursor:'pointer',
            }}>
              <p style={{ fontFamily:'var(--font-display)', fontSize:16, fontWeight:600, color:'var(--text)', margin:'0 0 4px' }}>{t.label}</p>
              <p style={{ fontFamily:'var(--font-body)', fontSize:12, color:'var(--text-muted)', margin:0 }}>{t.count} →</p>
            </div>
          ))}
        </div>
      </div>
    </section>
    {/* Compact strip */}
    <div style={{ borderTop:'1px solid var(--border)' }}>
      <HpRail title="Зараз у Knyhovo" books={HP_BOOKS.slice(0,6)} padTop={28} padBottom={40} />
    </div>
    <HpFooter padTop={0} />
  </ConceptShell>
);

// ── CONCEPT E: Discovery Hub ──────────────────────────────────────────────────
const E_TILES = [
  { label:'Новинки', sub:'12 нових книг цього тижня',    ci:1 },
  { label:'Knyhovo радить', sub:'Редакційна добірка',     ci:0 },
  { label:'Trending',   sub:'Що набирає популярність', ci:2 },
];

const ConceptE = () => (
  <ConceptShell>
    <HpHeader searchInHeader={true} active="Огляд" />
    {/* Magazine editorial grid */}
    <section style={{ padding:'40px 40px 0', display:'grid', gridTemplateColumns:'2fr 1fr', gap:20, alignItems:'stretch' }}>
      {/* Large editorial card */}
      <div style={{
        background:'var(--surface-accent)', borderRadius:12,
        border:'1px solid var(--border)', padding:'40px',
        display:'flex', gap:36, alignItems:'flex-start', minHeight:400,
      }}>
        <HpCover w={160} h={232} ci={6} />
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', gap:8, marginBottom:20 }}>
            <Badge tone="green">Knyhovo радить</Badge>
            <Chip>Класика</Chip>
          </div>
          <h2 style={{ fontFamily:'var(--font-display)', fontSize:26, fontWeight:700, color:'var(--text)', margin:'0 0 6px', lineHeight:1.2 }}>
            Сто років самотності
          </h2>
          <p style={{ fontFamily:'var(--font-body)', fontSize:14, color:'var(--text-muted)', margin:'0 0 16px' }}>Ґабріель Ґарсіа Маркес</p>
          <p style={{ fontFamily:'var(--font-display)', fontSize:14, fontStyle:'italic', color:'var(--text-body)', margin:'0 0 24px', lineHeight:1.65 }}>
            «Книга, яку треба читати повільно — не тому що складна, а тому що добра.»
          </p>
          <div style={{ display:'flex', alignItems:'center', gap:16 }}>
            <span style={{ fontFamily:'var(--font-display)', fontSize:24, fontWeight:700, color:'var(--accent)' }}>285 ₴</span>
            <span style={{ fontFamily:'var(--font-body)', fontSize:13, color:'var(--text-muted)', textDecoration:'line-through' }}>340 ₴</span>
            <button style={{
              background:'var(--accent)', color:'var(--text-on-accent)', border:'none',
              borderRadius:8, padding:'10px 20px', fontFamily:'var(--font-body)', fontWeight:600, fontSize:13, cursor:'pointer',
            }}>Порівняти ціни</button>
          </div>
        </div>
      </div>
      {/* Discovery tiles stack */}
      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
        {E_TILES.map((t,i) => (
          <div key={i} style={{
            background:`color-mix(in oklab, ${COVER_COLORS[t.ci % COVER_COLORS.length]} 18%, var(--surface))`,
            border:'1px solid rgba(0,0,0,0.07)', borderRadius:10,
            padding:'22px 24px', flex:1, cursor:'pointer',
            display:'flex', flexDirection:'column', justifyContent:'space-between',
          }}>
            <div>
              <p style={{ fontFamily:'var(--font-display)', fontSize:17, fontWeight:600, color:'var(--text)', margin:'0 0 4px' }}>{t.label}</p>
              <p style={{ fontFamily:'var(--font-body)', fontSize:13, color:'var(--text-muted)', margin:0 }}>{t.sub}</p>
            </div>
            <span style={{ fontFamily:'var(--font-body)', fontSize:13, color:'var(--accent)', marginTop:16 }}>Переглянути →</span>
          </div>
        ))}
      </div>
    </section>
    {/* Genre nav + rails */}
    <HpGenreRow padTop={28} />
    <HpRail title="Популярне зараз" books={HP_BOOKS.slice(0,5)} padTop={28} />
    <HpRail title="Новинки" books={HP_BOOKS.slice(3,8)} padTop={24} padBottom={48} />
    <HpFooter padTop={0} />
  </ConceptShell>
);

Object.assign(window, { ConceptA, ConceptB, ConceptC, ConceptD, ConceptE });
