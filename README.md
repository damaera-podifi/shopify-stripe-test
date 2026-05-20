# shopify-try

Headless Shopify storefront with cart and on-site Stripe checkout. Paid orders are created in Shopify via the Admin API after payment succeeds.

For system design, data flows, and directory layout, see [docs/architecture.md](docs/architecture.md).

## Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [pnpm](https://pnpm.io/) 10+
- [Stripe CLI](https://stripe.com/docs/stripe-cli) (for local webhooks)
- Shopify custom app tokens (Storefront + Admin) and Stripe test keys

## Setup

1. Install dependencies:

```bash
pnpm install
```

2. Copy environment variables and fill in your values:

```bash
cp .env.example .env.local
```

See `.env.example` for required Shopify and Stripe variables. The Admin token needs scopes to create and complete draft orders (e.g. `write_draft_orders`, `read_products`), read/update orders (`read_orders`, `write_orders`), and returns (`read_returns`, `write_returns`).

Set `SESSION_SECRET` to any long random string for signed customer sessions (email sign-in cookie).

## Run the app

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). The store is at [http://localhost:3000/store](http://localhost:3000/store); checkout is at `/store/checkout`.

To use a different port (e.g. `PORT=6000` in `.env.example`):

```bash
pnpm dev -- -p 6000
```

Other commands:

```bash
pnpm build   # production build
pnpm start   # run production server
pnpm lint
```

## Stripe webhooks (local)

Webhook fulfillment runs when Stripe sends `payment_intent.succeeded`. For local development, forward events with the Stripe CLI in a **second terminal** while the app is running.

1. Log in (once):

```bash
stripe login
```

2. Forward webhooks to the app (use the same port as `pnpm dev`):

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

If you started the app on port 6000:

```bash
stripe listen --forward-to localhost:6000/api/webhooks/stripe
```

3. Copy the webhook signing secret printed by the CLI (`whsec_...`) into `.env.local` as `STRIPE_WEBHOOK_SECRET`, then restart `pnpm dev` if it was already running.

4. Optional: trigger a test event:

```bash
stripe trigger payment_intent.succeeded
```

### Test checkout

Use Stripe test card `4242 4242 4242 4242`, any future expiry, and any CVC.

Orders are also fulfilled from the success page and `/api/checkout/complete` when payment completes in the browser; the webhook is a backup for reliability.

## Learn more

- [Next.js Documentation](https://nextjs.org/docs)
- [Shopify Storefront API](https://shopify.dev/docs/api/storefront)
- [Stripe Payment Element](https://docs.stripe.com/payments/payment-element)
