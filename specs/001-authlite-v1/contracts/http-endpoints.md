# Contract: адреса HTTP и экраны

Адреса Better Auth под `/api/auth` (используются экранами; JSON):

| Метод и путь | Тело | Успех | Ошибки |
|---|---|---|---|
| `POST /api/auth/sign-up/email` | `{ email, password, name }` | 200, cookie сессии | 422 `USER_ALREADY_EXISTS*`, 400 `PASSWORD_TOO_SHORT/LONG` |
| `POST /api/auth/sign-in/email` | `{ email, password, rememberMe: true }` | 200, cookie | 401 `INVALID_EMAIL_OR_PASSWORD`; 429 при превышении |
| `POST /api/auth/sign-out` | `{}` | 200, cookie удалена | — |
| `GET /api/auth/get-session` | — | 200 `{ session, user }` или `null` | — |
| `POST /api/auth/request-password-reset` | `{ email, redirectTo }` | 200 (всегда одинаково) | 429 при превышении по адресу |
| `GET /api/auth/reset-password/:token?callbackURL=` | — | 302 на `/reset-password?token=…` или `?error=INVALID_TOKEN` | — |
| `POST /api/auth/reset-password` | `{ newPassword, token }` | 200 | 400 `INVALID_TOKEN` |

Тексты на экранах (русские):

- неверный вход — «Неверный email или пароль»;
- занятый email — «Этот email уже зарегистрирован»;
- превышение частоты — «Слишком много попыток, попробуйте позже»;
- запрос сброса — «Если такой адрес зарегистрирован, мы отправили письмо»;
- плохая ссылка — «Ссылка устарела» + ссылка «Запросить новую».

Экраны приложения-хозяина (по умолчанию): `/login`, `/signup`, `/forgot-password`, `/reset-password`.
Защищённый запрос без входа: `401 {"error":"unauthorized"}`.
