import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

// Exercise the actual SQL helper in the app's embedded test database.
describe("public review username", () => {
  it("keeps usernames unmasked and uses no private name fallback", () => {
    const sql = readFileSync("drizzle/migrations/0029_public_review_username.sql", "utf8");
    const helper = sql.match(/AS \$\$ SELECT (.*?) \$\$/s)?.[1];
    if (!helper) throw new Error("Missing review label helper");
    const query = `select ${helper.replaceAll("p_username", "'adimuy'")} as label; select ${helper.replaceAll("p_username", "NULL")} as label;`;
    const result = execFileSync("python3", ["-c", "import duckdb,sys; c=duckdb.connect(); print(c.execute(sys.argv[1].split(';')[0]).fetchone()[0]); print(c.execute(sys.argv[1].split(';')[1]).fetchone()[0])", query], { encoding: "utf8" }).trim().split("\n");
    expect(result).toEqual(["adimuy", "Pembeli"]);
  });
});