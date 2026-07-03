/* Knyhovyk W8 — shared cross-document footer nav. Marks the current page. */
(function () {
  var pages = [
    ['Manifesto.html', 'Маніфест'],
    ['Personality.html', 'Особистість'],
    ['Character System.html', 'Система персонажа'],
    ['Character System - W8b.html', 'Біблія персонажа · W8b'],
    ['Knyhovyk in Product - W8c.html', 'Книговик у продукті · W8c'],
    ['Presence Map.html', 'Карта присутності'],
    ['Recommendation Framework.html', 'Рекомендації'],
    ['Trust Model.html', 'Довіра'],
    ['Copy System.html', 'Копірайт'],
    ['AI Readiness.html', 'Готовність до AI']
  ];
  var here = decodeURIComponent(location.pathname.split('/').pop() || 'Manifesto.html');
  var nav = document.getElementById('docnav');
  if (!nav) return;
  pages.forEach(function (p) {
    var a = document.createElement('a');
    a.href = p[0];
    a.textContent = p[1];
    if (p[0] === here) a.setAttribute('aria-current', 'page');
    nav.appendChild(a);
  });
})();
