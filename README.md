# Digital Store Backend

Backend для магазина цифровых товаров: платежи, каталог, интеграции с поставщиками, автоматическая выдача ключей.

## Быстрый старт

```bash
npm install
npx prisma migrate dev
npx prisma db seed
npm run dev
# → http://localhost:3000
```

## API

| Метод | Путь | Описание |
|-------|------|----------|
| GET | /health | Health check |
| GET | /catalog | Витрина товаров |
| GET | /catalog/:sku/stock | Остаток ключей по SKU |
| POST | /orders | Создать заказ по SKU |
| GET | /orders/:orderId | Получить заказ |
| POST | /webhook/payment | Webhook оплаты (idempotent) |
| POST | /delivery/:orderId | Запуск доставки |
| GET | /reconciliation | Сверка: paid/not delivered, delivered/not paid |
| GET | /audit-trail | Журнал денежных движений |
| GET | /stuck-orders | Зависшие заказы (>5 мин в статусе delivering/failed) |
| POST | /recover-stuck | Фоновое восстановление зависших заказов |

## Как воспроизвести критичные сценарии

### Гонки: 50 parallel webhooks → 1 delivery

```bash
npx vitest run tests/stress/race-condition.test.ts
```

Тест создаёт заказ, шлёт 50 параллельных webhook'ов с одним `event_id`, проверяет:
- Ровно 1 платёж создан (UNIQUE constraint)
- Статус заказа `paid`
- Нет дублей

### Идемпотентность: повторный webhook

```bash
# Отправить дважды один и тот же event_id - второй должен быть проигнорирован
# (тот же event_id, тот же order_id, тот же статус)
```

### Fallback: поставщик A падает → B выдаёт

Поставщики конфигурируются через `errorRate` / `timeoutRate` в `delivery.controller.ts`:
```typescript
const suppliers = [
  createSupplier('supplier_a', { errorRate: 0.2, timeoutRate: 0.1 }), // 20% ошибок, 10% таймаутов
  createSupplier('supplier_b', { errorRate: 0.05, timeoutRate: 0.02 }), // 5% ошибок, 2% таймаутов
];
```

### Ловушка таймаута: timeout ≠ rejection

1. Поставщик A вызывается с `request_id = "ord-123-0"`
2. Поставщик выдаёт код, но ответ не доходит (таймаут)
3. Delivery service проверяет кэш: `request_id → code` уже сохранён
4. Повторный вызов поставщика с тем же `request_id` → тот же код (идемпотентность)
5. Второй код НЕ выдаётся

### Пустой остаток → out_of_stock

Просто выдайте все ключи по SKU через `POST /delivery/:orderId` пока не получите `{"status":"out_of_stock"}`. Статус восстановимый - повторная выдача возможна.

## Ключевые решения

### Exactly-once для платежей
- **UNIQUE constraint** на `event_id` в таблице `Payment` - гарантия на уровне БД
- **Prisma transaction** - атомарная обработка: статус заказа + платёж
- Быстрый путь: `findUnique(event_id)` до транзакции предотвращает лишний overhead

### Ловушка таймаута
- После успешной выдачи кода сохраняем `request_id → code` в память
- При таймауте проверяем кэш: если код уже выдан - возвращаем его
- Поставщики идемпотентны по `request_id`: повторный вызов с тем же `request_id` → тот же код
- **Таймаут ≠ отказ**: поставщик мог выдать код, но ответ не дошёл

### Устойчивые интеграции
- **Fallback**: Supplier A → Supplier B
- **Retry** с exponential backoff (1s, 2s, 4s + jitter)
- Конфигурируемые `errorRate`/`timeoutRate` для воспроизведения сценариев

### Статусы заказов
```
created → paid → delivering → delivered
created → payment_failed
paid → delivering → out_of_stock (recovery)
paid → delivering → delivery_failed (recovery)
```

### Сверка и восстановление
- `GET /reconciliation` - "оплачен, но не выдан" / "выдан, но не оплачен"
- `GET /audit-trail` - журнал денежных движений (balance always consistent)
- `GET /stuck-orders` - заказы зависшие более N минут
- `POST /recover-stuck` - безопасное восстановление: delivered если ключ выдан, иначе delivery_failed
