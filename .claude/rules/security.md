# Security Rules

- Secrets тільки через env variables; ніколи у коді або git history
- SQL: parameterized queries; string concatenation заборонена
- User input валідується на межі системи (API boundary), не в середині
- Нові залежності: `npm audit` перед додаванням
- Зовнішні HTTP-запити: завжди з явним `timeout`; ніяких прихованих retry-loops
- HTTPS скрізь у production
