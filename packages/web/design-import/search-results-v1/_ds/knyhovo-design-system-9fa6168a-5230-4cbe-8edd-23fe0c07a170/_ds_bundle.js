/* @ds-bundle: {"format":3,"namespace":"KnyhovoDesignSystem_9fa616","components":[{"name":"Button","sourcePath":"components/buttons/Button.jsx"},{"name":"Avatar","sourcePath":"components/display/Avatar.jsx"},{"name":"Badge","sourcePath":"components/display/Badge.jsx"},{"name":"BookCard","sourcePath":"components/display/BookCard.jsx"},{"name":"ThemeToggle","sourcePath":"components/display/ThemeToggle.jsx"},{"name":"Chip","sourcePath":"components/forms/Chip.jsx"},{"name":"Input","sourcePath":"components/forms/Input.jsx"},{"name":"SearchBar","sourcePath":"components/forms/SearchBar.jsx"}],"sourceHashes":{"components/buttons/Button.jsx":"da61ed81f5df","components/display/Avatar.jsx":"1444a6d92a81","components/display/Badge.jsx":"bd1504f5e1dc","components/display/BookCard.jsx":"8c2fd211f041","components/display/ThemeToggle.jsx":"58186efdbd3c","components/forms/Chip.jsx":"9eead1349293","components/forms/Input.jsx":"e97551b61b92","components/forms/SearchBar.jsx":"a02d71290448","ui_kits/website/Header.jsx":"d8c831116ab2","ui_kits/website/Hero.jsx":"e9edb6d1e0fd","ui_kits/website/Sections.jsx":"9a0a413859b1"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.KnyhovoDesignSystem_9fa616 = window.KnyhovoDesignSystem_9fa616 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/buttons/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Button({
  variant = 'primary',
  size = 'md',
  iconLeft = null,
  iconRight = null,
  type = 'button',
  disabled = false,
  className = '',
  children,
  ...rest
}) {
  const classes = ['kn-btn', `kn-btn--${variant}`, size !== 'md' ? `kn-btn--${size}` : '', className].filter(Boolean).join(' ');
  return /*#__PURE__*/React.createElement("button", _extends({
    type: type,
    className: classes,
    disabled: disabled
  }, rest), iconLeft, children, iconRight);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/buttons/Button.jsx", error: String((e && e.message) || e) }); }

// components/display/Avatar.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Avatar({
  size = 40,
  theme = 'light',
  src = null,
  alt = '',
  className = '',
  ...rest
}) {
  const base = window.__KN_DS_ROOT || '';
  const fallback = theme === 'dark' ? base + 'assets/avatar/avatar-dark.png' : base + 'assets/avatar/avatar-light.png';
  return /*#__PURE__*/React.createElement("img", _extends({
    className: ['kn-avatar', className].filter(Boolean).join(' '),
    src: src || fallback,
    width: size,
    height: size,
    alt: alt
  }, rest));
}
Object.assign(__ds_scope, { Avatar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/display/Avatar.jsx", error: String((e && e.message) || e) }); }

// components/display/Badge.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Badge({
  tone = 'accent',
  className = '',
  children,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("span", _extends({
    className: ['kn-badge', `kn-badge--${tone}`, className].filter(Boolean).join(' ')
  }, rest), children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/display/Badge.jsx", error: String((e && e.message) || e) }); }

// components/display/BookCard.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function BookCard({
  title,
  author,
  price,
  oldPrice = null,
  store,
  cover = null,
  badge = null,
  onClick,
  className = '',
  ...rest
}) {
  return /*#__PURE__*/React.createElement("article", _extends({
    className: ['kn-book', className].filter(Boolean).join(' '),
    onClick: onClick
  }, rest), cover ? /*#__PURE__*/React.createElement("img", {
    className: "kn-book__cover",
    src: cover,
    alt: ""
  }) : /*#__PURE__*/React.createElement("div", {
    className: "kn-book__cover",
    "aria-hidden": "true"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
      minWidth: 0,
      flex: 1
    }
  }, badge ? /*#__PURE__*/React.createElement("div", null, badge) : null, /*#__PURE__*/React.createElement("h3", {
    className: "kn-book__title"
  }, title), /*#__PURE__*/React.createElement("p", {
    className: "kn-book__author"
  }, author), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 'auto',
      display: 'flex',
      alignItems: 'baseline',
      gap: 8,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "kn-book__price"
  }, price), oldPrice ? /*#__PURE__*/React.createElement("span", {
    style: {
      textDecoration: 'line-through',
      color: 'var(--text-faint)',
      fontSize: 'var(--fs-sm)'
    }
  }, oldPrice) : null, store ? /*#__PURE__*/React.createElement("span", {
    className: "kn-book__store"
  }, "\xB7 ", store) : null)));
}
Object.assign(__ds_scope, { BookCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/display/BookCard.jsx", error: String((e && e.message) || e) }); }

// components/display/ThemeToggle.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function ThemeToggle({
  theme,
  onChange,
  className = '',
  ...rest
}) {
  const [internal, setInternal] = React.useState(() => document.documentElement.getAttribute('data-theme') || 'light');
  const current = theme || internal;
  const set = next => {
    document.documentElement.setAttribute('data-theme', next);
    setInternal(next);
    if (onChange) onChange(next);
  };
  const Sun = /*#__PURE__*/React.createElement("svg", {
    width: "16",
    height: "16",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "4"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32 1.41-1.41"
  }));
  const Moon = /*#__PURE__*/React.createElement("svg", {
    width: "16",
    height: "16",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"
  }));
  return /*#__PURE__*/React.createElement("div", _extends({
    className: ['kn-theme-toggle', className].filter(Boolean).join(' '),
    role: "group",
    "aria-label": "Theme"
  }, rest), /*#__PURE__*/React.createElement("button", {
    type: "button",
    "data-active": current === 'light' ? 'true' : 'false',
    onClick: () => set('light'),
    "aria-label": "Light theme"
  }, Sun), /*#__PURE__*/React.createElement("button", {
    type: "button",
    "data-active": current === 'dark' ? 'true' : 'false',
    onClick: () => set('dark'),
    "aria-label": "Dark theme"
  }, Moon));
}
Object.assign(__ds_scope, { ThemeToggle });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/display/ThemeToggle.jsx", error: String((e && e.message) || e) }); }

// components/forms/Chip.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Chip({
  selected = false,
  iconLeft = null,
  className = '',
  children,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    className: ['kn-chip', className].filter(Boolean).join(' '),
    "data-selected": selected ? 'true' : 'false'
  }, rest), iconLeft, children);
}
Object.assign(__ds_scope, { Chip });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Chip.jsx", error: String((e && e.message) || e) }); }

// components/forms/Input.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Input({
  className = '',
  ...rest
}) {
  return /*#__PURE__*/React.createElement("input", _extends({
    className: ['kn-input', className].filter(Boolean).join(' ')
  }, rest));
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Input.jsx", error: String((e && e.message) || e) }); }

// components/forms/SearchBar.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function SearchBar({
  placeholder = 'Назва книги, автора або ISBN\u2026',
  buttonLabel = 'Знайти',
  value,
  onChange,
  onSearch,
  className = '',
  ...rest
}) {
  const handleKey = e => {
    if (e.key === 'Enter' && onSearch) onSearch(e.target.value);
  };
  return /*#__PURE__*/React.createElement("div", _extends({
    className: ['kn-field', className].filter(Boolean).join(' ')
  }, rest), /*#__PURE__*/React.createElement("span", {
    className: "kn-field__icon"
  }, /*#__PURE__*/React.createElement("i", {
    "data-lucide": "search"
  })), /*#__PURE__*/React.createElement("input", {
    type: "search",
    placeholder: placeholder,
    value: value,
    onChange: onChange,
    onKeyDown: handleKey,
    "aria-label": placeholder
  }), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "kn-btn kn-btn--primary",
    onClick: () => onSearch && onSearch(value)
  }, buttonLabel));
}
Object.assign(__ds_scope, { SearchBar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/SearchBar.jsx", error: String((e && e.message) || e) }); }

// ui_kits/website/Header.jsx
try { (() => {
// Knyhovo website — Header. Uses approved logo lockups (swap by theme).
function SiteHeader({
  theme,
  onTheme
}) {
  const {
    Button,
    ThemeToggle
  } = window.KnyhovoDesignSystem_9fa616;
  const base = new URL('../../', document.baseURI).href;
  const logo = theme === 'dark' ? base + 'assets/logo/knyhovo-logo-dark.png' : base + 'assets/logo/knyhovo-logo-light.png';
  return /*#__PURE__*/React.createElement("header", {
    className: "site-header"
  }, /*#__PURE__*/React.createElement("img", {
    className: "site-logo",
    src: logo,
    alt: "Knyhovo"
  }), /*#__PURE__*/React.createElement("nav", {
    className: "site-nav"
  }, /*#__PURE__*/React.createElement("a", {
    href: "#",
    className: "nav-link nav-link--active"
  }, "\u0413\u043E\u043B\u043E\u0432\u043D\u0430"), /*#__PURE__*/React.createElement("a", {
    href: "#",
    className: "nav-link"
  }, "\u041A\u0430\u0442\u0430\u043B\u043E\u0433"), /*#__PURE__*/React.createElement("a", {
    href: "#",
    className: "nav-link"
  }, "\u0417\u043D\u0438\u0436\u043A\u0438"), /*#__PURE__*/React.createElement("a", {
    href: "#",
    className: "nav-link"
  }, "\u041F\u0440\u043E \u043D\u0430\u0441")), /*#__PURE__*/React.createElement("div", {
    className: "site-actions"
  }, /*#__PURE__*/React.createElement(ThemeToggle, {
    theme: theme,
    onChange: onTheme
  }), /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    size: "sm"
  }, "\u0423\u0432\u0456\u0439\u0442\u0438")));
}
window.SiteHeader = SiteHeader;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/website/Header.jsx", error: String((e && e.message) || e) }); }

// ui_kits/website/Hero.jsx
try { (() => {
// Knyhovo website — Hero. Recreates the APPROVED hero exactly:
// 50/50 split, text left / mascot right (~75–80% of hero height),
// identical proportions & positioning in both themes.
function Hero({
  theme
}) {
  const {
    SearchBar,
    Chip
  } = window.KnyhovoDesignSystem_9fa616;
  const [q, setQ] = React.useState('');
  const base = new URL('../../', document.baseURI).href;
  const mascot = theme === 'dark' ? base + 'assets/mascot/mascot-hero-dark.png' : base + 'assets/mascot/mascot-hero-light.png';
  const chips = ['Атомні звички', 'Жадан', 'Sapiens', 'Кідрук', 'Харарі'];
  return /*#__PURE__*/React.createElement("section", {
    className: "hero",
    "data-screen-label": "Hero"
  }, /*#__PURE__*/React.createElement("div", {
    className: "hero__text"
  }, /*#__PURE__*/React.createElement("p", {
    className: "kn-eyebrow"
  }, "\u041F\u043E\u0440\u0456\u0432\u043D\u044F\u043D\u043D\u044F \u0446\u0456\u043D \xB7 5 \u043A\u043D\u0438\u0433\u0430\u0440\u0435\u043D\u044C \xB7 \u0429\u043E\u0434\u043D\u044F"), /*#__PURE__*/React.createElement("h1", {
    className: "hero__title"
  }, "\u0414\u0435 \u043A\u0443\u043F\u0438\u0442\u0438 \u0446\u044E \u043A\u043D\u0438\u0433\u0443?", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("em", {
    className: "kn-accent-serif"
  }, "Knyhovo \u0437\u043D\u0430\u0454.")), /*#__PURE__*/React.createElement("p", {
    className: "hero__lead"
  }, "\u0429\u043E\u0434\u043D\u044F \u0437\u043D\u0430\u0445\u043E\u0434\u0438\u043C\u043E \u043D\u0430\u0439\u043D\u0438\u0436\u0447\u0443 \u0446\u0456\u043D\u0443 \u0432 Yakaboo, \u041A\u043D\u0438\u0433\u0430\u0440\u043D\u0456 \xAB\u0404\xBB, \u0420\u043E\u0437\u0435\u0442\u0446\u0456, BookChef \u0442\u0430 Nash Format."), /*#__PURE__*/React.createElement(SearchBar, {
    value: q,
    onChange: e => setQ(e.target.value),
    placeholder: "\u041D\u0430\u0437\u0432\u0430 \u043A\u043D\u0438\u0433\u0438, \u0430\u0432\u0442\u043E\u0440\u0430 \u0430\u0431\u043E ISBN...",
    buttonLabel: "\u0417\u043D\u0430\u0439\u0442\u0438"
  }), /*#__PURE__*/React.createElement("div", {
    className: "hero__popular"
  }, /*#__PURE__*/React.createElement("span", {
    className: "hero__popular-label"
  }, "\u041F\u043E\u043F\u0443\u043B\u044F\u0440\u043D\u0435:"), chips.map(c => /*#__PURE__*/React.createElement(Chip, {
    key: c
  }, c))), /*#__PURE__*/React.createElement("div", {
    className: "hero__stats"
  }, /*#__PURE__*/React.createElement("div", {
    className: "stat"
  }, /*#__PURE__*/React.createElement("span", {
    className: "stat__num"
  }, "5"), /*#__PURE__*/React.createElement("span", {
    className: "stat__label"
  }, "\u043A\u043D\u0438\u0433\u0430\u0440\u0435\u043D\u044C")), /*#__PURE__*/React.createElement("div", {
    className: "stat"
  }, /*#__PURE__*/React.createElement("span", {
    className: "stat__num"
  }, "12k+"), /*#__PURE__*/React.createElement("span", {
    className: "stat__label"
  }, "\u043A\u043D\u0438\u0433")), /*#__PURE__*/React.createElement("div", {
    className: "stat"
  }, /*#__PURE__*/React.createElement("span", {
    className: "stat__num"
  }, "\u0449\u043E\u0434\u043D\u044F"), /*#__PURE__*/React.createElement("span", {
    className: "stat__label"
  }, "\u043E\u043D\u043E\u0432\u043B\u0435\u043D\u043D\u044F")))), /*#__PURE__*/React.createElement("div", {
    className: "hero__art"
  }, /*#__PURE__*/React.createElement("img", {
    className: "hero__mascot",
    src: mascot,
    alt: "Knyhovyk \u2014 \u043A\u043D\u0438\u0436\u043A\u043E\u0432\u0438\u0439 \u043F\u0440\u043E\u0432\u0456\u0434\u043D\u0438\u043A Knyhovo"
  })));
}
window.Hero = Hero;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/website/Hero.jsx", error: String((e && e.message) || e) }); }

// ui_kits/website/Sections.jsx
try { (() => {
// Knyhovo website — Popular books grid + footer.
function PopularBooks() {
  const {
    BookCard,
    Badge,
    Button
  } = window.KnyhovoDesignSystem_9fa616;
  const books = [{
    title: 'Атомні звички',
    author: 'Джеймс Клір',
    price: '245 ₴',
    oldPrice: '320 ₴',
    store: 'Yakaboo',
    badge: /*#__PURE__*/React.createElement(Badge, {
      tone: "green"
    }, "\u041D\u0430\u0439\u043A\u0440\u0430\u0449\u0430 \u0446\u0456\u043D\u0430")
  }, {
    title: 'Інтернат',
    author: 'Сергій Жадан',
    price: '210 ₴',
    oldPrice: null,
    store: 'Книгарня «Є»',
    badge: /*#__PURE__*/React.createElement(Badge, {
      tone: "accent"
    }, "\u041D\u043E\u0432\u0438\u043D\u043A\u0430")
  }, {
    title: 'Sapiens. Людина розумна',
    author: 'Ювал Ной Харарі',
    price: '380 ₴',
    oldPrice: '450 ₴',
    store: 'Rozetka',
    badge: /*#__PURE__*/React.createElement(Badge, {
      tone: "solid"
    }, "-15%")
  }, {
    title: 'Доки світло не згасне назавжди',
    author: 'Макс Кідрук',
    price: '265 ₴',
    oldPrice: null,
    store: 'Nash Format',
    badge: null
  }];
  return /*#__PURE__*/React.createElement("section", {
    className: "books",
    "data-screen-label": "Popular books"
  }, /*#__PURE__*/React.createElement("div", {
    className: "books__head"
  }, /*#__PURE__*/React.createElement("h2", null, "\u041F\u043E\u043F\u0443\u043B\u044F\u0440\u043D\u0456 \u043A\u043D\u0438\u0433\u0438"), /*#__PURE__*/React.createElement(Button, {
    variant: "ghost"
  }, "\u0412\u0435\u0441\u044C \u043A\u0430\u0442\u0430\u043B\u043E\u0433")), /*#__PURE__*/React.createElement("div", {
    className: "books__grid"
  }, books.map(b => /*#__PURE__*/React.createElement(BookCard, {
    key: b.title,
    title: b.title,
    author: b.author,
    price: b.price,
    oldPrice: b.oldPrice,
    store: b.store,
    badge: b.badge
  }))));
}
function SiteFooter({
  theme
}) {
  const base = new URL('../../', document.baseURI).href;
  const logo = theme === 'dark' ? base + 'assets/logo/knyhovo-logo-dark.png' : base + 'assets/logo/knyhovo-logo-light.png';
  return /*#__PURE__*/React.createElement("footer", {
    className: "site-footer",
    "data-screen-label": "Footer"
  }, /*#__PURE__*/React.createElement("img", {
    className: "footer-logo",
    src: logo,
    alt: "Knyhovo"
  }), /*#__PURE__*/React.createElement("p", {
    className: "footer-line"
  }, "\u0417\u043D\u0430\u0445\u043E\u0434\u0438\u043C\u043E \u043D\u0430\u0439\u043A\u0440\u0430\u0449\u0456 \u0446\u0456\u043D\u0438 \u043D\u0430 \u043A\u043D\u0438\u0433\u0438 \u2014 \u0449\u043E\u0434\u043D\u044F."), /*#__PURE__*/React.createElement("p", {
    className: "footer-copy"
  }, "\xA9 2026 Knyhovo"));
}
window.PopularBooks = PopularBooks;
window.SiteFooter = SiteFooter;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/website/Sections.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Avatar = __ds_scope.Avatar;

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.BookCard = __ds_scope.BookCard;

__ds_ns.ThemeToggle = __ds_scope.ThemeToggle;

__ds_ns.Chip = __ds_scope.Chip;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.SearchBar = __ds_scope.SearchBar;

})();
