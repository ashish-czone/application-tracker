## Data Formatting Rules

### Timestamps (moments in time: createdAt, updatedAt, login times)
- **DB:** `timestamptz` → Drizzle: `timestamp('...', { withTimezone: true, mode: 'date' })`
- **API:** ISO 8601 UTC strings (`2026-03-12T14:30:00.000Z`)
- **Frontend:** Parse UTC, display in user's local timezone. Use `formatDateTime()` / `formatRelative()`.
- **Date filtering on timestamptz:** Server interprets calendar date in `APP_TIMEZONE`, converts to UTC range. Use `startOfDayInTimezone()` / `endOfDayInTimezone()`.

### Calendar dates (DOB, start date — no timezone)
- **DB:** `DATE` → Drizzle: `date('...', { mode: 'string' })`
- **API/Frontend:** `YYYY-MM-DD` strings. No timezone conversion ever.

### IDs
- All UUIDs. Never expose auto-increment IDs.

### Currency
- **DB/API:** Integer cents + currency code: `{ amount: 12550, currency: "USD" }`
- **Frontend:** `formatCurrency(cents, code)` → `"$125.50"`. Input accepts decimal, converts to cents before API call.

### Percentages
- **DB/API:** Basis points (integer). `15.5%` = `1550`
- **Frontend:** `formatPercentage(1550)` → `"15.5%"`. Input accepts decimal, converts to basis points.

### Phone numbers
- **DB/API:** E.164 format (`+15551234567`). Validate with `libphonenumber-js`, never regex.
- **Frontend:** Use `FormPhoneInput` from `@packages/ui/components/form/`. Display formatted per locale.

### Email
- **DB:** Lowercased before storage. Uniqueness on lowercase.
- **Validation:** Check for `@` + domain. Don't over-regex. Allow `+` aliases, international chars.

### Passwords
- Hash with bcrypt/argon2. Never log, never include in API responses.
- Constant-time comparison (`timingSafeEqual`).

### Timezone
- App timezone: `APP_TIMEZONE` env var (IANA, e.g., `Asia/Dubai`). All "today" comparisons use `todayInTimezone()`.
- User timezone: IANA string on user profile. Frontend: `userPreference ?? browserTimezone`.
- Cron jobs: Use `cronForLocalHour(hour, timezone)` from `@packages/common`. Never hardcode UTC cron.
