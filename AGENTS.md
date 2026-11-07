<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- Review labels are assigned by `set_review_label` using `review_public_label` from username only — public reviews never reveal private profile fields.
- Store-page sizing is scoped by `.store-profile`, and `AppShell.showSupport` controls the support strip per page — preserves shared buyer features and other pages' headers.
- Auth session state comes from `AuthProvider`/`useAuth` in `src/lib/auth.tsx`, the app's only `onAuthStateChange` subscriber — avoids duplicate listeners and stale UI.
- Profile rows are created by the `handle_new_user` trigger from signup metadata; seller stores live in `seller_stores` keyed by owner — keeps buyer and seller data separate and RLS owner-scoped.
- Seller Center pages live under `/seller/*` inside the `seller.tsx` layout, which gates on the owner having a `seller_stores` row and scopes its dark theme via the `.seller-panel` token class — keeps seller UI separate from the buyer app theme.
- Seller products live in `products` → `product_variants` → `product_stock` (owner-scoped RLS; only active products/variants are publicly readable, stock never is); images go to the private `product-images` bucket under `<owner_id>/` and are shown via signed URLs because the workspace blocks public buckets.
- Route head() meta is built with `pageMeta()` in `src/lib/meta.ts`; first-visit guided tours use `PageTour` (`src/components/marketku/tour.tsx`) with targets marked by `data-tour` — keeps SEO tags and onboarding consistent across pages.
- Orders are created only through the `place_order` database function (prices, stock, vouchers re-checked server-side; one order per seller grouped by `checkout_id`); buyers/sellers read orders via RLS and change status only via `cancel_order`/`seller_advance_order` — clients can never write prices or statuses directly.
- Public store info, stock counts, and seller customer lists come from SECURITY DEFINER read functions (`public_stores`, `store_by_slug`, `search_stores`, `variant_stock`, `seller_customers`, `public_store_vouchers`, `recent_purchases`) — `seller_stores`/`product_stock` stay owner-only.
- Chat uses `conversations` + `messages` (participant-only RLS; started via `start_conversation`; counters, typing, delivered/read ticks set only server-side by triggers/RPCs; `product_id` validated against the seller), polled by the client; photos in private `chat-attachments` under `<conversation_id>/`; presence via `chat_partner_state` — no realtime yet.
- Home promo assets live in `src/lib/home-assets.ts`.
- Ad campaigns change only via `create_ad_campaign`/`cancel_ad_campaign` (wallet ledger); sponsored slots via `sponsored_products` — clients never set status or balances.
- Telegram bots (`telegram_bots`, token hidden) via `telegram.functions.ts`/`broadcast.functions.ts` (log: `telegram_broadcasts`); updates hit `/api/public/telegram/$botId` with per-bot secret — tokens server-only. Owner alerts: triggers queue `telegram_notifications`, `drainNotifications` sends (cron `/api/public/telegram/notify`); bot links use `siteBase()` (no localhost).
- Seller Center client-side unlock (password re-entry, `src/lib/chat.ts`) sits on the buyer session; leaving re-locks, Akun "Keluar" signs out — UX gate only, RLS scopes data.
- Product categories form a tree via `product_categories.parent_id`; filters/counts expand a category to its descendants (`descendantIds` in `src/lib/products.ts`) icons via `categoryIcon()`; home browses `/?kategori=&subkategori=` (names) — one source for picker, home and kategori page.
- Admin access is the `admin` row in `user_roles` checked via `has_role` (RLS + SECURITY DEFINER RPCs); buyer Saldo Marketku lives in `wallets`/`wallet_ledger` and changes only through `admin_review_deposit` approving a `deposit_requests` row (manual QRIS, proof + QRIS image in private `payment-assets` bucket) — clients can never write balances or roles.
- Admin has its own sign-in at `/admin/login` and its own `.admin-panel` theme (not linked from buyer Akun); account/store bans live in `account_bans`/`store_bans` (timed or permanent), changed only via `admin_*` SECURITY DEFINER RPCs that also write `admin_logs`, and enforced server-side by triggers (orders, order_items, messages, products) plus a RESTRICTIVE products SELECT policy — clients can never lift a ban or unhide a taken-down product.
- Top up methods (QRIS, e-wallets, banks) are admin-managed rows in `payment_methods`; deposits record the chosen method and `purpose` (wallet, or seller `credits` via `create_credit_topup` → `seller_credits`/`seller_credit_ledger` on admin approval) — one list and one review flow for both.
- Orders are paid only via `pay_order_with_wallet` (Saldo Marketku, no unique code) or `submit_order_payment` + `admin_review_order_payment` (QRIS/e-wallet proof in `order_payments`); both run `fulfill_paid_order`, which auto-delivers stock items and completes the order, and `credit_seller_for_order` credits the seller once after `order_release_at` (5h/buyer confirm; garansi: warranty window, max 3d) — clients never set paid status or balances.
- Seller withdrawals (`withdrawal_requests`) are created only via `request_withdrawal`/`auto_withdraw_tick` and settled via `admin_review_withdrawal`; fee constants mirrored in `src/lib/withdraw.ts` — clients never write rows or balances.
- Rekber (`rekber_deals`) changes only via `*_rekber` RPCs; buyers join via secret `share_token` — clients never write status or balances.
- Stock availability always via `stock_available` — one rule for orders, fulfilment, counts.
- Warranty/category-request status changes only via RPCs.
- Platform bots `admin_bot`/`seller_hub_bot`: service-role singletons, has_role setup, trigger-queued alerts, PNG cards (`card-image.server.ts`) — tokens server-only.
- Admin Mini App: only current admins in `admin_bot_admins`.
- Flash sales change only via `create_flash_sale`/`cancel_flash_sale`; `place_order` applies them — client mirror in `src/lib/flash.ts`.
- Pretty links `/$kategori/product/<slug>-<uuid>` only redirect to `/produk/$id`; `/search`, `/u/$slug`, `/terms`, `/privacy` likewise only redirect — one product page.
