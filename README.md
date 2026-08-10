# Sumry — mobile app

Expo / React Native client for the [Sumry backend](https://git.elyesghazel.ch/sumry/backend).
Built for fast logging: open, type an amount, tap a category, done.

## Design

Calm over clutter. The palette is almost monochrome and colour carries exactly one meaning —
which way money moved. Category colours exist but only ever appear as a small icon tint,
never as a filled block, so a screen full of numbers stays readable.

Glass (`src/components/Glass.tsx`) is used on the few surfaces that genuinely float: the
summary cards, the tab bar and the entry sheet. Android falls back to a flat tinted panel,
because `expo-blur` needs a `BlurTargetView` wrapper there and a half-working blur reads as
a bug rather than a style.

Both colour schemes are supported and follow the system setting.

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
  (tabs)/            overview, transactions, budgets, settings
src/
  api.ts             typed backend client
  store.tsx          session + data, held in one context
  theme.ts           palette, spacing, type scale
  format.ts          money/date formatting and day grouping
  components/
```

State is a single context rather than a data-fetching library: the whole dataset is a few
hundred rows, so every mutation just re-reads it. Simple beats clever at this size.
