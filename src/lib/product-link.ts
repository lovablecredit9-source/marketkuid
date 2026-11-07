/** marketku.id-style product links: /<kategori>/product/<judul>-<uuid>. */
const UUID_TAIL = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

export const slugify = (s: string) =>
  s.toLowerCase().replace(/&/g, " dan ").normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120) || "produk";

/** Product id at the end of a pretty slug, or null when the slug has none. */
export const idFromProductSlug = (slug: string) => slug.match(UUID_TAIL)?.[1]?.toLowerCase() ?? null;

export const productSlug = (name: string, id: string) => `${slugify(name)}-${id}`;
