# Electric Store Panel

The panel an electric store owner and their staff use. It is built with Vue 3, Vuetify 3, Pinia and CASL, on the same structure and look as `Super-Mart-Frontend`. The backend (`Super-Mart-Backend`) and the platform admin (`Super-Mart-Admin`) are shared with Super Mart; the electric store gets its own APIs there.

## The backend

Every screen talks to `Super-Mart-Backend` on the address in `.env`:

```
VITE_API_URL=http://localhost:4000/api/
```

One axios interceptor in `src/main.ts` puts `electric/` in front of every call, so a screen asks for `bills` and the backend gets `/api/electric/bills`. The shared routes (`client/login`, `auth/`, `files/`) are left as they are. Login sends `panel: 'electric'`, which is what keeps this panel apart from the Super Mart one.

Text uses the Manrope font, the same as `saas-vendor`.

Product and brand pictures are in `public/demo/`.

## Demo logins

| Email | Password | Who |
| --- | --- | --- |
| `owner@electric.local` | `Owner@123` | Owner, both shops. Opens on the shop cards |
| `manager@electric.local` | `Manager@123` | Manager, Electric Products Shop |
| `cashier1@electric.local` | `Cashier@123` | Cashier, Electric Products Shop (Counter 1 already open, with one pending bought price) |
| `cashier2@electric.local` | `Cashier@123` | Cashier, Electric Products Shop |
| `cashier3@electric.local` | `Cashier@123` | Cashier, Safety Items Shop (Counter 1 already open) |
| `entry@electric.local` | `Entry@123` | Product Entry, Safety Items Shop |

## Screens

- **My Shops**: the owner's two shop cards with today's sales, profit, counters and missing bought prices.
- **Dashboard**: one shop's day, counters right now, today's bills and payments, items running low.
- **Sell**: open a counter, then brand strip, category picture tiles and search. A category opens a dialog where several sizes get quantities and go on the bill together. Price can be changed on the bill (permission), item discount (% or Rs), bill discount locked to the items on the bill at that moment, item from another shopkeeper (bought price pending), then **Bill** (Cash / Card / Online) or **Quotation**. Cash In, Cash Out and Close Counter are on the counter bar.
- **Bills** with **Return Items** (partial or full, refund by Cash / Card / Online from your open counter, printable return slip), **Quotations** (Open / Converted / Expired, Convert to Bill), **Pending Costs**.
- **Counters** and each counter's **Cash Flow** by day.
- **Products**, **Categories**, **Brands**: each shop has its own.
- **Users**, **Roles** and **Permissions**: the owner adds permissions, then builds roles by ticking them per module.

A counter cannot close while any item sold on it still has no bought price. Printing asks for A4 or 80 mm receipt and remembers the last choice.

## Setup

```bash
npm install
npm run dev -- --port 5176
```
