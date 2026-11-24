# Trip To Venda — website + phone app

Door-to-door lifts between Venda, Gauteng and every province. Riders and drivers both sign up and get verified.

## Files
- `index.html` – the page shell, with the 4-second branded loading screen
- `styles.css` – all styling (green & gold, works on phones and desktop)
- `app.js` – the whole app (pages, sign-up, verification, booking, safety, admin)
- `manifest.json`, `sw.js`, `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon.png`, `favicon-32.png`, `favicon-64.png` – install as a phone app (PWA) and work offline
- `img/` – the logo (`emblem.webp`, `logo-light.svg`) and the photos used in the app
- `brand/` – logo files for print, social media and documents (`logo.svg`/`logo.png` for light backgrounds, `logo-light.svg`/`logo-light.png` for dark backgrounds, `emblem-512.png`, `emblem-labelled-512.png`, `icon-512.png`). Not needed by the app itself.
- `lib/leaflet/` – the free, open-source map library
- `lib/routes.js`, `lib/basemap.js` – real road routes for ~45 popular routes and the South Africa outline map

## Run it
Put the folder on any web host (or locally: `python -m http.server`) and open `index.html`.
On a phone, open the site in Chrome and tap **Install app** / "Add to Home screen". It then opens full-screen like a normal app.
(The install button and offline mode need https or localhost.)

## Launch switches (top of `app.js`)
| Setting | Now | What it does |
|---|---|---|
| `SAMPLE_DATA` | `true` | Starts with sample drivers, trips and reviews so the app can be reviewed. A small "Sample listings" note shows on the home page. **Set to `false` at launch** so only real sign-ups and real trips appear (showing invented drivers or reviews to the public would mislead people). |
| `TEST_MODE` | `true` | Until SMS, ID-check and payment providers are connected: SMS codes, pick-up PINs and delivery codes are shown on screen, no real money moves, and the live map can replay a trip at speed. Set to `false` once the providers are connected. |
| `DEMO` | `false` | Staff-only test panel (account switcher + guided tour). Keep `false` in public. |
| `SPLASH_MS` | `4000` | How long the branded loading screen shows (milliseconds). |

Test accounts while `SAMPLE_DATA` is on: rider `rider@demo.co.za` (demo1234), driver `drv_tshilidzi@demo.co.za` (demo1234). Admin: `admin@triptovenda.co.za` (admin123) — **change this password before launch**.

## What's new in v5
- **New logo** (v5.2): a round badge made from real photos: the Thohoyandou pot roundabout on the Venda side and the Pretoria skyline on the Gauteng side, split by a gold line, with VENDA ⇄ GAUTENG on the full version. App icons for Android, iPhone and the browser tab use it.
- **Your own photos in the app** (v5.2): Thohoyandou on Venda routes and trips, Pretoria on Pretoria routes and as the story background, Welcome to Gauteng on other Gauteng routes.
- **No dashes** anywhere in the app's text (v5.1); dates show as "14 Nov 2026".
- **4-second loading screen** with the logo, a progress bar and status messages, then a smooth fade into the app.
- **Real photography**: hero over the open road, photo cards for popular routes (Joburg, Pretoria, Venda, the N1, Durban, Cape Town), a "Home is 500 km away" story section, a destination photo on every trip page, and photos on the log-in/sign-up and parcel pages.
- Demo labels removed: no demo panel or demo log-in links; a "Forgot password" link instead; remaining on-screen codes are clearly labelled **Test mode**.

- **Phone fit** (v5.3): every page checked at 320, 360, 375, 390, 412 and 768 px wide for every user type. Nothing is wider than the screen; text boxes are 16 px so iPhones don't zoom in; buttons are at least 40 px tall for thumbs; tables turn into easy cards on phones; tabs wrap instead of hiding; a "Book now" bar stays at the bottom of trip pages; the search form stacks province over town on small phones.

- **Driver earnings dashboard** (v5.4): drivers open My trips → **Earnings** (or tap the "Earned" box). Choose last 7 days, last 30 days, this month or all time to see: what they kept after fees, what riders paid, Trip To Venda fees, trips completed, passengers carried, parcels delivered, average per trip, km driven, rating, this week vs last week, money coming from booked trips, a weekly chart (passengers vs parcels), best routes, cash vs in app (paid out and waiting), and a trip by trip table. "Statement (CSV)" copies the earnings for Excel or Google Sheets.

- **Vehicle types** (v5.5): drivers can list only a **private car** (up to 4 passengers) or a **7 seater** (up to 6 passengers). They pick the type when verifying; the seat number is limited to match, and they can't post a trip with more seats than their car has. Riders see the type on every trip and can filter search by "Private cars" or "7 seaters". Admin's checklist includes checking that the car photo matches the type. Minibuses and taxis can't be listed. To change the limits or add a type, edit `VTYPES` near the top of `app.js`.

- **Separate pages** (v5.6): "How it works" now has its own page (`#/how`) and the safety features moved to the Safety page (`#/safety`). The home page links to both under the main buttons, and they're in the top menu and the footer.

- **Edit trips** (v5.9): drivers tap **Edit trip** on any upcoming trip (until the first rider is picked up) to change the day, time, seats, price per seat, bag fee, parcel price, pickup/drop areas, notes and cash. Rules: seats can't go below what's already booked or above the car's limit; booked riders keep the price they agreed to (a new price only applies to new bookings); if the day or time changes, every booked rider gets a message and a notice on their booking, and can cancel for a full refund. Every edit is kept on the trip (`t.edits`) for the safety team.
- **Rider details under POPIA** (v5.9): drivers see each rider's first name and surname initial on lists. **Rider details** shows what's needed for the trip: photo (to check the face at pickup), full name, ID-verified badge, rating, phone, exact pickup and drop off with map pins, luggage photo, parcel receiver, notes and payment. Phone and exact addresses are shown only from acceptance until 24 hours after drop off (`RIDER_INFO_HOURS`), then hidden. Drivers never see ID numbers, ID documents, home addresses or emergency contacts. Each opening of Rider details is recorded and shown to admin in the booking view.

- **Approvals on the admin Overview** (v5.10): the first thing admin sees is **Waiting for approval**, with drivers and riders in two lists, how long ago each person applied, and how many automatic checks passed (cellphone, SA ID number and age, licence, PrDP, plate, disc, documents uploaded, vehicle type). **Review** opens their documents and checks in a pop-up; approving still needs every manual check ticked (face matches ID, name matches, licence, PrDP, car type, plate, disc). Reject asks for a reason, which the person sees. While `SAMPLE_DATA` is on, four sample applicants are waiting, with images clearly marked "SAMPLE · NOT A REAL DOCUMENT".

## Photo credits
Thohoyandou pot roundabout, Pretoria skyline and Welcome to Gauteng: photos supplied by Trip To Venda (`img/thohoyandou.jpg`, `img/pretoria.jpg`, `img/gauteng.jpg`, and the logo). Make sure you own these or have the photographer's permission before launch. The Thohoyandou photo is small (388 px wide), so send a larger copy if you have one and replace the file with the same name.

All other photos are from Unsplash and free to use under the Unsplash License: open road (Savannah Koomen), Cape Town (Vimal Joseph), Durban (Weyland Swart), N1 highway (Tiry Nelson Gono), mountain drive (Devon Janse van Rensburg), traveller (Tim Mossholder), parcel (RoseBox).

## What's new in v4
- **Admin control room** (`Admin` tab, log in as admin): trips completed, passengers, parcels, fares, platform revenue, a route map (line thickness = passengers), top routes, **"Who travelled where"** per rider, drivers' trips, a searchable **trip log** (filter by status, seats/parcels, direction, period; copy as CSV), user histories, verification queue with automatic + manual checks, safety (SOS, concerns, live shares) and money (revenue, payouts due, driver wallets).
- **Share live location with a loved one**: riders (and parcel senders) send a private link; the loved one sees the car moving, driver, number plate and ETA — no app or login. Stops automatically on arrival. "Report concern" alerts the safety team.
- **Stronger verification**: SA ID number checked (13 digits, date of birth, checksum, age 18+ riders / 21+ drivers); drivers must give licence number, code and expiry, PrDP number and expiry, number plate (format checked), licence-disc expiry, and photos. Admin must tick every manual check before approving; expiring documents are listed.
- **Send a parcel** page + 6-digit **delivery code** for the receiver.
- **Pay in the app** (held until drop-off, refunded if declined/cancelled, paid to drivers on Tuesdays) **or cash** (fee taken from the driver's prepaid wallet; negative wallet = can't post). **Pro plan** R199/month → 5% commission.
- **Pin pick-up/drop-off on a map** (tap, drag to adjust) or **detect location automatically**; drivers get "Navigate to pin" links and a pick-up map for all riders.
- **"I'm leaving…" quick post** for drivers + **departures board** with live countdowns and ready-made WhatsApp/Facebook post text.
- Works on every screen: tested at 320, 375, 768, 1024, 1440 and 1920 px wide.
- Fees live in one place: `FEES` near the top of `app.js` (R15/seat, R10/parcel booking fee; 10% / 15% commission; Pro 5% at R199). See *TripToVenda-Business-Model.docx*.

## Staff test panel
Set `const DEMO = true` to show a ⚡ panel for switching between Visitor, Rider, Driver and Admin and following a guided tour. Keep it off for the public.

Maps now draw their own outline of South Africa's provinces and neighbouring countries (`lib/basemap.js`), so they work offline and inside preview frames; when online in a normal browser, OpenStreetMap street detail loads on top.

## What's new in v2
- Modern redesign: new font, proper icons, dark-green hero with Soutpansberg hills, glass search card, phone mock-up, bottom tab bar on phones
- **Real maps** (OpenStreetMap) on every trip with the **actual road route**, real distance and drive time (e.g. Thohoyandou → Joburg ≈ 500 km)
- **Live trip tracking**: a car moves along the route with ETA and km left (simulated in the prototype; GPS in production)
- **4-step booking**: seats or parcel → pick-up/drop-off → luggage with photo → review & confirm
- Search with a date strip, sort (earliest/cheapest/top rated) and filters (women only, parcels)
- Driver profiles with a drawn car in the driver's real car colour, number plate, bio, languages and reviews
- Notifications bell, chat quick-replies, suggested price per route for drivers, GPS pin for pick-up
- 6 realistic demo drivers and 14 upcoming trips (Venda ⇄ Gauteng, Polokwane, Durban, Cape Town)

## Features
**Riders:** sign up, verify phone (OTP) + ID + selfie, search by province & town, book seats, add pick-up and drop-off address (door to door),
upload a **luggage photo**, count normal and extra-large bags, **send a parcel** without travelling, get a **pick-up PIN**, chat with the driver,
**share the trip** (driver, car, plate, live location) to their emergency contact on WhatsApp, **SOS button**, cancel, and rate the driver.
**Lift requests:** if no trip exists, riders post a request and drivers get notified.

**Drivers:** sign up, upload ID, selfie, licence, PrDP, licence disc and car photo with plate, add vehicle details.
After approval they post trips and set **their own price per seat**, an extra-large bag fee, a parcel price, bags allowed, payment methods (cash/EFT/card),
trip rules, and **women-only trips** (female drivers). They see each rider's verification, rating and luggage photo before accepting,
must enter the rider's PIN to start the trip, mark drop-off, rate riders, and see an earnings summary.

**Admin:** a verification desk to view documents and approve or reject (with a reason), plus a log of SOS alerts and a user list.

Every trip must start or end in Venda.

## Before going live
All data is saved **in the browser on that device** (localStorage). It is enough to demo and test the full flow, but to go live you need a server so that riders and drivers on different phones see the same trips.
Suggested next step, using your .NET skills:
1. **ASP.NET Core Web API + SQL Server** (tables: Users, Documents, Vehicles, Trips, Bookings, Messages, Reviews, Requests, Alerts). Each function in `app.js` (`F.bookForm`, `A.accept`, etc.) maps to an API endpoint.
2. Maps: OpenStreetMap's free tiles are fine for a pilot. At scale, use a paid map provider (e.g. Mapbox or MapTiler) and your own routing server — the code only needs the tile URL changed.
3. Store passwords with proper hashing (ASP.NET Identity) and documents in private blob storage, not the browser.
4. Real **SMS OTP** through an SA SMS gateway, and an **ID-verification provider** (checks against Home Affairs) instead of manual review only.
5. Push notifications (Firebase) for booking updates.
6. POPIA: privacy policy, consent, and deleting documents on request.
7. Optional: online payments (e.g. PayFast/Yoco) with a small booking fee as your income.


## v6 · Live system (Firebase, real time)
- **Switch it on:** follow `SETUP-FIREBASE.md` (about 20 min). Without a config the site runs as a one phone preview with sample trips.
- Real accounts with Firebase Authentication: email + password, email confirmation, password reset email, strong password rule, 5 wrong tries lock a phone for 15 min, Google also pauses accounts under attack.
- Everything updates live on every phone: new trips, bookings, approvals, chat, notifications, wallet.
- Security rules (`firebase/firestore.rules`) protect the back end on Google's servers. Tested with 80 attack tests on the Firebase emulator.
- Documents (ID, licence, PrDP, selfie) are readable only by the owner and the Control room; phone and plate only by the other person on a booking.
- The pickup PIN and parcel code are checked by the server; the driver never sees them. 5 tries max.
- Live GPS: the phone in the car shares its position; family follow it on the tracking link (no account needed).
- Wallet: drivers request a top up by EFT with a reference; the Control room confirms. Pro is switched on by the Control room.
- Control room = accounts listed in the `admins` collection (set in the Firebase console).
- Removed for live use: sample people and trips, test codes on screen, replay speed buttons, the old `admin123` login.
- Card payments, SMS and automatic ID checks need paid providers; until then trips are cash only (see the setup guide).
- Files: `cloud.js` (sync), `firebase-config.js` (your keys), `lib/firebase.js` (Google's SDK, stored locally), `_headers` (Netlify security headers).
