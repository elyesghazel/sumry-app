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

## Building

```bash
npm install -g eas-cli
eas login
```

Both platforms use the `preview` profile: an internal build that points at the deployed
backend (`EXPO_PUBLIC_API_URL` in `eas.json`) and can be installed without a store.

### Android

```bash
eas build --platform android --profile preview
```

Produces an APK (rather than the Play Store AAB that `production` builds). Download it from
the link EAS prints and sideload it.

Release APKs are built by GitHub Actions instead (`.github/workflows/release.yml`): pushing a
`v*` tag runs `expo prebuild`, `gradlew assembleRelease`, signs with the release keystore from
the repo secrets (`ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`,
`ANDROID_KEY_PASSWORD`) and attaches `sumry-<version>.apk` to the GitHub Release. The version
name comes from the tag, the version code is `major * 1000000 + minor * 1000 + patch`. These
APKs are arm64 only and have OTA updates turned off.

### iPhone

Apple only lets signed apps onto a device, and signing needs an [Apple Developer Program](https://developer.apple.com/programs/)
membership. With that in place:

```bash
eas device:create                          # once per phone: open the link on the iPhone
eas build --platform ios --profile preview # ad-hoc build for the registered phones
```

`device:create` shows a QR code; opening it on the iPhone installs a profile that registers
the phone's UDID. EAS then asks for the Apple ID on the first build and creates the
certificate and provisioning profile itself. When the build finishes, open its link on the
iPhone in Safari and tap **Install**. Ad-hoc builds stay valid for a year; a new phone means
another `device:create` and a rebuild.

For a longer-lived install that updates itself, submit the same build to TestFlight instead:
`eas build --platform ios --profile production` followed by `eas submit --platform ios`.

Without a developer membership the app still runs on an iPhone inside [Expo Go](https://apps.apple.com/app/expo-go/id982107779):
`eas update --channel preview` publishes the JavaScript, and Expo Go (signed into the same
Expo account) lists the project under *Projects*.

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
