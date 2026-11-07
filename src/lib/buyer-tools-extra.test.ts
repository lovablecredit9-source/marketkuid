import { describe, expect, it } from "vitest";
import { ordersCsv, pushNote, restocked, toggleRestock } from "./buyer-tools";

describe("ingatkan stok", () => {
  it("klik pertama menambah, klik kedua menghapus", () => {
    expect(toggleRestock([], "a")).toEqual(["a"]);
    expect(toggleRestock(["a", "b"], "a")).toEqual(["b"]);
  });
  it("hanya produk yang dipantau dan stoknya > 0", () => {
    const r = restocked(["a", "b"], [{ id: "a", stock: 0 }, { id: "b", stock: 3 }, { id: "c", stock: 9 }]);
    expect(r.map((p) => p.id)).toEqual(["b"]);
  });
});

describe("catatan cepat", () => {
  it("menyimpan maksimal 5, terbaru di depan, tanpa duplikat", () => {
    const l = pushNote(["n1", "n2", "n3", "n4", "n5"].map((x) => `${x}xx`), "n3xx");
    expect(l[0]).toBe("n3xx");
    expect(l).toHaveLength(5);
    expect(pushNote(["abc1", "abc2", "abc3", "abc4", "abc5"], "baru")).toEqual(["baru", "abc1", "abc2", "abc3", "abc4"]);
  });
  it("catatan kurang dari 3 huruf diabaikan", () => {
    expect(pushNote(["lama"], "ok")).toEqual(["lama"]);
  });
});

describe("unduh riwayat", () => {
  it("satu baris per pesanan dan koma dibungkus kutip", () => {
    const csv = ordersCsv([{ order_no: 7, created_at: "2026-11-07T10:00:00Z", store_name: "Toko, A", status: "paid", total: 9000, order_items: [{ product_name: "Netflix", qty: 2 }] }], () => "Dibayar");
    const lines = csv.split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toBe('M-7,2026-11-07,"Toko, A",Netflix x2,Dibayar,9000');
  });
});
