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
- Public store info, stock counts, and seller customer lists come from SECURITY DEFINER read functions (`public_stores`, `store_by_slug`, `variant_stock`, `seller_customers`, `public_store_vouchers`) because `seller_stores`/`product_stock` stay owner-only (bank data, stock contents).
- Chat uses `conversations` + `messages` (participant-only RLS; started via `start_conversation`; unread counters, typing flags and last sender maintained by triggers/`set_typing`; delivered/read ticks are set only server-side by the insert trigger, `touch_presence` and `mark_conversation_read`; optional `product_id` is validated against the conversation seller), polled by the client; photo attachments live in the private `chat-attachments` bucket under `<conversation_id>/`; partner presence comes from `chat_partner_state` (buyer presence = any visit, seller presence = inside an unlocked Seller Center) — no realtime channel yet.
- Home banners, category image icons and brand shortcut tiles are owner-supplied CDN assets listed in `src/lib/home-assets.ts` — keeps home promo content in one place, separate from seller product data.
- Ad campaigns are created/cancelled only via `create_ad_campaign`/`cancel_ad_campaign` (charge/refund `ad_wallets`, ledger in `ad_wallet_ledger`); sponsored slots are read through `sponsored_products` — clients can never set campaign status or balances.
- Seller Telegram bots live in `telegram_bots` (token/webhook secret column-hidden from the app); token-using actions go through `src/lib/telegram.functions.ts`, and updates arrive at `/api/public/telegram/$botId`, verified by the per-bot secret header — keeps bot tokens server-only.
- Seller Center has its own client-side unlock (password re-entry, `src/lib/chat.ts` helpers) on top of the buyer session; leaving Seller Center only re-locks it, while Akun "Keluar" signs out fully — a UX gate, not a security boundary (RLS still scopes data per user).
- Product categories form a tree via `product_categories.parent_id`; filters/counts expand a category to its descendants (`descendantIds` in `src/lib/products.ts`) and icons resolve through `categoryIcon()` in `src/lib/category-icons.ts` — one source for picker, home and kategori page.
- Admin access is the `admin` row in `user_roles` checked via `has_role` (RLS + SECURITY DEFINER RPCs); buyer Saldo Marketku lives in `wallets`/`wallet_ledger` and changes only through `admin_review_deposit` approving a `deposit_requests` row (manual QRIS, proof + QRIS image in private `payment-assets` bucket) — clients can never write balances or roles.
- Admin has its own sign-in at `/admin/login` and its own `.admin-panel` theme (not linked from buyer Akun); account/store bans live in `account_bans`/`store_bans` (timed or permanent), changed only via `admin_*` SECURITY DEFINER RPCs that also write `admin_logs`, and enforced server-side by triggers (orders, order_items, messages, products) plus a RESTRICTIVE products SELECT policy — clients can never lift a ban or unhide a taken-down product.
- Top up methods (QRIS, e-wallets, banks) are admin-managed rows in `payment_methods`; deposits record the chosen method — one list for the top up page and admin panel.
- Orders are paid only via `pay_order_with_wallet` (Saldo Marketku, no unique code) or `submit_order_payment` + `admin_review_order_payment` (QRIS/e-wallet proof in `order_payments`); both run `fulfill_paid_order`, which auto-delivers stock items and completes the order, and `credit_seller_for_order` credits the seller's wallet once per completed order (after the 5h hold, or immediately when the buyer confirms via `buyer_confirm_order`) — clients never set paid status or balances.
- Seller withdrawals live in `withdrawal_requests`, created only via `request_withdrawal`/`auto_withdraw_tick` (debit full wallet balance, fee set server-side) and settled via `admin_review_withdrawal` (reject refunds the wallet); fee constants are mirrored in `src/lib/withdraw.ts` — clients never write withdrawal rows or balances.
- Rekber lives in `rekber_deals`, changed only via `*_rekber` RPCs (wallet debit/credit); buyers join via secret `share_token` link — clients never write deal status or balances.
- Stock availability always goes through `stock_available` (products.stock_mode normal/unlimited/reusable; reusable items return via `product_stock.reuse_at`) — `place_order`, `fulfill_paid_order` and `variant_stock` share one rule.
