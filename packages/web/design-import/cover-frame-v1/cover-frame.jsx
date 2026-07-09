// ============================================================================
// Cover Frame System v1.0 — <CoverFrame>, the single canonical way to render
// a REAL book cover (2026-07-08). Pairs with cover-frame.css (.knc-frame /
// .knc-img). See the frozen "Cover Frame System" entry in CLAUDE.md.
//
// The frame class per surface keeps owning the frozen frame spec (size,
// aspect-ratio, radius, shadow, background); this component owns the markup
// and the fit contract (contain, centered, never cropped/stretched) plus
// missing/broken-image fallback that never changes frame dimensions.
//
// Pages configure ONLY the exposed props (variant / className / placeholder…)
// — no local overrides of the rendering logic, no hand-rolled frame+img pairs.
// Decorative compositions (cover stacks, fans, mascots) do NOT use CoverFrame.
// ============================================================================

const KNC_VARIANTS = {
  // Collections `.bkc` card (Landing + Details grids) and the wl22 rest-grid —
  // frozen recipe: radius 12px, aspect 2/3, surface-accent bg, shadow-sm.
  'collection-card': { frame: 'bkc__coverclip', img: 'bkc__cover' },
  // «Порада Книговика» desktop hero cover (Бажанки v2.2) — 2/3, shadow-md.
  'wishlist-hero': { frame: 'wl21-feat__coverclip', img: '' },
  // «Зараз вигідно купити» desktop 2×2 sale card — frozen 96px cover.
  'sale-card': { frame: 'wl21-sale__coverclip', img: '' },
  // Mobile portrait "book-styled" cover (spine + realistic shadow decoration
  // lives on the FRAME via ::before/::after — never on the image).
  'mobile-book': { frame: 'wl21-featm__book', img: '' },
  // Wishlist v1.0 per-item card cover (ph-wl.css) — 116px, min-height 168px.
  'wishlist-card': { frame: 'wsc-cover', img: '' },
};

function CoverFrame({
  variant,
  src,
  alt = '',
  as = 'div',
  className = '',
  imgClassName = '',
  loading,
  draggable,
  placeholder = null,
  placeholderClassName = '',
  ...rest
}) {
  const [broken, setBroken] = React.useState(false);
  React.useEffect(() => { setBroken(false); }, [src]);

  const v = KNC_VARIANTS[variant] || { frame: '', img: '' };
  const empty = !src || broken;
  const Tag = as;
  const frameCls = [
    'knc-frame', v.frame, className,
    empty ? 'knc-frame--empty' : '',
    empty ? placeholderClassName : '',
  ].filter(Boolean).join(' ');

  return (
    <Tag className={frameCls} {...rest}>
      {empty ? placeholder : (
        <img
          className={['knc-img', v.img, imgClassName].filter(Boolean).join(' ')}
          src={src}
          alt={alt}
          loading={loading}
          draggable={draggable}
          onError={() => setBroken(true)}
        />
      )}
    </Tag>
  );
}

window.KnCoverFrame = { CoverFrame, KNC_VARIANTS };
