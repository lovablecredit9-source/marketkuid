import { BRAND_GROUPS, CATEGORY_IMAGES } from "@/lib/home-assets";

/** Category icons cropped from the owner's "Pilih kategori produk" screenshots, keyed by slug of the name. */
const CROPPED = import.meta.glob("@/assets/cat2/*.png", { eager: true, import: "default" }) as Record<string, string>;
const BY_SLUG: Record<string, string> = Object.fromEntries(
  Object.entries(CROPPED).map(([p, url]) => [p.split("/").pop()!.replace(/\.png$/, ""), url]),
);
const BRAND_IMAGES: Record<string, string> = Object.fromEntries(BRAND_GROUPS.flatMap((g) => g.brands.map((b) => [b.name, b.img])));

export const categorySlug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** Image icon for a category name, or undefined when the category uses the plain folder icon. */
export function categoryIcon(name: string): string | undefined {
  return BY_SLUG[categorySlug(name)] ?? CATEGORY_IMAGES[name] ?? BRAND_IMAGES[name];
}
