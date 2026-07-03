/* Knyhovyk W8 — shared theme toggle. Swaps theme, logo, --ka-face avatar source,
   and any [data-mascot] illustration (magnifier ↔ lantern). Persists to kn-theme. */
(function () {
  var root = document.documentElement;
  var btn = document.getElementById('theme-btn');
  var logo = document.getElementById('doc-logo');
  var L = '../../assets/mascot/mascot-magnifier.png';
  var D = '../../assets/mascot/mascot-lantern.png';
  function apply(t) {
    root.setAttribute('data-theme', t);
    if (btn) btn.textContent = t === 'dark' ? 'Світла тема' : 'Темна тема';
    if (logo) logo.src = t === 'dark'
      ? '../../assets/logo/knyhovo-logo-dark.png'
      : '../../assets/logo/knyhovo-logo-light.png';
    root.style.setProperty('--ka-face', 'url("' + (t === 'dark' ? D : L) + '")');
    document.querySelectorAll('[data-mascot]').forEach(function (img) {
      img.src = t === 'dark' ? D : L;
    });
  }
  apply(localStorage.getItem('kn-theme') || 'light');
  if (btn) btn.addEventListener('click', function () {
    var t = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    localStorage.setItem('kn-theme', t);
    apply(t);
  });
  if (window.lucide) lucide.createIcons();
})();
