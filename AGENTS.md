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
- Auth session state comes from `AuthProvider`/`useAuth` in `src/lib/auth.tsx`, the app's only `onAuthStateChange` subscriber — avoids duplicate listeners and stale UI.
- Profile rows are created by the `handle_new_user` trigger from signup metadata; seller stores live in `seller_stores` keyed by owner — keeps buyer and seller data separate and RLS owner-scoped.
- Seller Center pages live under `/seller/*` inside the `seller.tsx` layout, which gates on the owner having a `seller_stores` row and scopes its dark theme via the `.seller-panel` token class — keeps seller UI separate from the buyer app theme.
- Seller products live in `products` → `product_variants` → `product_stock` (owner-scoped RLS; only active products/variants are publicly readable, stock never is); images go to the private `product-images` bucket under `<owner_id>/` and are shown via signed URLs because the workspace blocks public buckets.
- Route head() meta is built with `pageMeta()` in `src/lib/meta.ts`; first-visit guided tours use `PageTour` (`src/components/marketku/tour.tsx`) with targets marked by `data-tour` — keeps SEO tags and onboarding consistent across pages.
- Orders are created only through the `place_order` database function (prices, stock, vouchers re-checked server-side; one order per seller grouped by `checkout_id`); buyers/sellers read orders via RLS and change status only via `cancel_order`/`seller_advance_order` — clients can never write prices or statuses directly.
- Public store info, stock counts, and seller customer lists come from SECURITY DEFINER read functions (`public_stores`, `store_by_slug`, `variant_stock`, `seller_customers`) because `seller_stores`/`product_stock` stay owner-only (bank data, stock contents).
- Chat uses `conversations` + `messages` (participant-only RLS; started via `start_conversation`, unread counters maintained by trigger, polled by the client) — no realtime channel yet.
- Home banners, category image icons and brand shortcut tiles are owner-supplied CDN assets listed in `src/lib/home-assets.ts` — keeps home promo content in one place, separate from seller product data.
