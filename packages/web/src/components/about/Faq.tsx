'use client';

import { useState } from 'react';
import { AbIcon } from './icons';

/**
 * FAQ accordion (`about-app.jsx` AbFaq) — single-open, item 0 expanded by
 * default. Only client component on the page (needs `useState`).
 */
const AB_FAQ = [
  {
    q: 'Як часто оновлюються ціни?',
    a: 'Щодня. Ми автоматично обходимо книгарні та фіксуємо актуальні ціни — саме з цих щоденних перевірок складається історія ціни кожної книги.',
  },
  {
    q: 'Чи продає Knyhovo книги?',
    a: 'Ні. Ми не книгарня: порівнюємо ціни та ведемо на сайт книгарні, де ви купуєте напряму. Ціна для вас від цього не змінюється.',
  },
  {
    q: 'Як працюють бажанки?',
    a: 'Додайте книгу до бажанок — і ми стежитимемо за нею. За бажанням встановіть цільову ціну: щойно книга подешевшає до неї, ви дізнаєтеся першими.',
  },
  {
    q: 'Як працюють сповіщення?',
    a: 'Коли ціна досягає вашої цілі, стає найнижчою за 90 днів або помітно падає, ми надсилаємо email. Жодного спаму — лише події, які справді варті уваги.',
  },
  {
    q: 'Чому ціна відрізняється від тієї, що я бачу в книгарні?',
    a: 'Ми показуємо ціну на момент останньої щоденної перевірки. Книгарня могла змінити її пізніше — тому поруч із ціною завжди видно, коли ми її перевіряли.',
  },
  {
    q: 'Чи можна відстежувати книгу без реєстрації?',
    a: 'Шукати книги та порівнювати ціни можна без акаунта. Для бажанок і сповіщень потрібен вхід за email — без пароля, за посиланням.',
  },
  {
    q: 'Чому деяких книг ще немає?',
    a: 'Каталог зростає поступово: ми додаємо нові книгарні та видання. Якщо книги не видно — найімовірніше, її немає в наявності у книгарнях, які ми відстежуємо, або ми ще не встигли її додати.',
  },
  {
    q: 'Чому деякі книги без опису або історії цін?',
    a: 'Історія накопичується з дня, коли книга з’явилася в каталозі, — новим книгам потрібен трохи часу. Описи ми отримуємо від книгарень, тому інколи їх бракує.',
  },
] as const;

export function Faq(): React.JSX.Element {
  const [open, setOpen] = useState(0);
  return (
    <section className="ab-sec reveal">
      <div className="ab-faq__wrap">
        <div className="ab-sechead" style={{ marginBottom: 0 }}>
          <img className="ab-faq__mascot" src="/mascot/avatarWithBook.png" alt="" />
          <div className="ab-eyebrow">Питання й відповіді</div>
          <h2 className="ab-h2">Поширені запитання</h2>
        </div>
        <div className="ab-acc">
          {AB_FAQ.map((f, i) => {
            const isOpen = open === i;
            return (
              <div className={'ab-acc__item' + (isOpen ? ' ab-acc__item--open' : '')} key={f.q}>
                <button
                  type="button"
                  className="ab-acc__q"
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? -1 : i)}
                >
                  {f.q}
                  <span className="ab-acc__chev">
                    <AbIcon name="chevdown" size={19} />
                  </span>
                </button>
                <div className="ab-acc__body">
                  <div className="ab-acc__innr">
                    <p className="ab-acc__a">{f.a}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
