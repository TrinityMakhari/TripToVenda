# Trip To Venda: switch on the live system (Firebase)

About 20 minutes. Free plan (Spark) is enough to start. You need a Google account.
Until step 5 is done the website runs in **preview mode** on each phone only, with sample trips.

## 1. Create the project
1. Go to https://console.firebase.google.com and click **Create a project**. Name it `trip-to-venda`.
2. Google Analytics: optional, you can switch it off.

## 2. Accounts and passwords (Authentication)
1. Build → **Authentication** → Get started → **Email/Password** → Enable → Save.
2. Authentication → **Settings**:
   - **Password policy**: Require enforcement, minimum length **8**, tick upper case, lower case and numeric.
   - **User account management → Email enumeration protection**: switch **on** (stops people checking which emails have accounts).
   - **Authorized domains**: add `trip-to-venda.netlify.app` (and your own domain later). Remove anything you don't use.
3. Templates → Email address verification and Password reset: change the sender name to *Trip To Venda*.

Passwords are stored only by Google (hashed). Nobody, including you, can read them.
Brute force is stopped three ways: Google pauses an account after repeated wrong passwords, the app locks a phone for 15 minutes after 5 wrong tries, and the pickup PIN allows only 5 tries per booking (checked on Google's servers).

## 3. Database (Firestore) and the security rules
1. Build → **Firestore Database** → Create database → Location **africa-south1 (Johannesburg)** → Start in **production mode**.
2. Open the **Rules** tab, delete everything, paste the whole of `firebase/firestore.rules`, click **Publish**.

These rules are the lock on the back end. They run on Google's servers, so a copied or changed app cannot get around them:
- ID photos, licences, PrDP, selfies, ID numbers, addresses: only the owner and the Control room.
- Phone numbers and number plates: only the owner, the Control room, and the other person on an active booking (POPIA).
- Nobody can approve themselves, make themselves Pro, add money to a wallet or change a price after booking.
- The driver can never read the rider's PIN; the server checks it.
- Anything not listed is closed.

## 4. App Check (blocks access from anywhere except your website)
1. Go to https://www.google.com/recaptcha/admin → create a **reCAPTCHA v3** key for `trip-to-venda.netlify.app`. Copy the **site key**.
2. Firebase → Build → **App Check** → Apps → your web app → reCAPTCHA v3 → paste the **secret key** → Save.
3. After step 6 works, open App Check → APIs → **Cloud Firestore** and **Authentication** → **Enforce**.

## 5. Connect the website
1. Project settings (gear) → General → Your apps → **Web** (`</>`) → name it `Trip To Venda web` → Register (no hosting needed).
2. Copy the values into `firebase-config.js` (apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId).
3. Paste the reCAPTCHA **site key** into `appCheckSiteKey`.
4. Put your bank details in `bank` (drivers see them when they top up their wallet).
5. Upload the whole folder to Netlify again (drag and drop).

The apiKey is not a password; every Firebase website shows it. The rules and App Check protect the data.

## 6. Make yourself the Control room
1. On the website, **Sign up** with the email you'll use for the Control room (any role), and confirm the email.
2. Firebase → Authentication → Users: copy that account's **User UID**.
3. Firestore → Data → **Start collection** → ID `admins` → Document ID = the UID → field `name` (string) = `Safety Desk` → Save.
4. Log out and log in again. You now see the **Control room**.

Only accounts in `admins` can verify people, confirm top ups, switch Pro on, and see documents. Add or remove staff there. Nobody can add themselves (the rules block it).

## 7. Daily running
- **Verification**: Control room → Verification. Check the photos, tick the checks, Approve or Decline.
- **Top ups**: drivers pay by EFT with their reference; when it shows in your bank, Control room → Money → *Money received*.
- **Pro**: drivers request it; Control room → Money → *Switch on* (R fee goes off their wallet).
- **Safety**: SOS alerts and family concerns appear in Control room → Safety.

## Not included yet (need paid providers)
| Feature | Now | To switch on |
|---|---|---|
| Card / Instant EFT payments | Trips are **cash only** | Connect PayFast (or Peach/Yoco), then set `onlinePayments: true` |
| SMS codes | Email confirmation instead; staff check the cellphone at review | Firebase phone auth or Clickatell (Blaze plan) |
| Automatic ID check | Control room checks by eye + 11 automatic checks | Smile ID / VerifyNow |

## Free plan limits (Spark)
50,000 reads and 20,000 writes a day, 1 GB stored. Enough for hundreds of daily users. If you outgrow it, switch to Blaze (pay as you go) and set a budget alert.
