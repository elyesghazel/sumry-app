# Sumry — mobile app

Expo / React Native client for the [Sumry backend](https://git.elyesghazel.ch/sumry/backend).
Built for fast logging: open, type an amount, tap a category, done.

## Design

The ledger: paper, ink and hairlines. Figures and titles are set in Fraunces, everything
else in Inter with tabular numerals. The palette is near-monochrome and colour carries
exactly one meaning — which way money moved. Category colours exist but only ever appear
as a small swatch, never as a filled block, so a screen full of numbers stays readable.
Light is the primary palette; dark is its own set and follows the system unless overridden.

Nothing floats and nothing blurs: panels are a slightly lighter sheet with a hairline.

## What it does

- **Overview** — safe to spend before the next planned income, where the month is heading,
  what is due next (book overdue items with a tap), budgets at a glance, accounts, recent.
- **Entry** — the keypad, plus a quick line: type `12.50 kebab cash yesterday` and the form
  fills itself; the server parses it so phone and web agree.
- **Plan** — planned items (rent, salary, savings transfer) with one-tap or automatic
  booking, savings goals with contributions, subscriptions detected from history.
- **Budgets** — envelopes with a period, a start day (payday) and rollover; progress shows
  pace against elapsed time.
- **Insights** — month-end forecast and subscriptions cards join the existing ones.
- **Settings** — sign out ends the session on the server; "sign out everywhere" revokes
  every device; a password change hands this device a fresh token.

## Running it

```bash
npm install
cp .env.example .env      # point EXPO_PUBLIC_API_URL at your backend
npx expo start
```

For a device on your LAN, set `EXPO_PUBLIC_API_URL=http://<your-machine-ip>:48090` and run
the backend's `compose.yaml`. `localhost` will not work from a phone.

## Building an APK

```bash
npm install -g eas-cli
eas login
eas build --platform android --profile preview
```

`preview` produces an installable APK (rather than the Play Store AAB that `production`
builds). The build reads `.env.production`, so the resulting app points at the deployed
backend. Download the artifact from the link EAS prints and sideload it.

## Layout

```
app/                 expo-router routes
  _layout.tsx        providers + session gate
  sign-in.tsx
  entry.tsx          add/edit — the keypad screen, presented as a modal
  plan.tsx           planned items, goals, subscriptions
  budgets.tsx        envelopes with periods and rollover
  (tabs)/            overview, transactions, insights, settings
src/
  api.ts             typed backend client
  store.tsx          session + data, held in one context
  theme.ts           palette, spacing, type scale
  format.ts          money/date formatting and day grouping
  components/
```

State is a single context rather than a data-fetching library: the whole dataset is a few
hundred rows, so every mutation just re-reads it. Simple beats clever at this size.
