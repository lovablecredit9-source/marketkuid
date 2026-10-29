import { describe, expect, it } from "vitest";
import { lastSeenLabel } from "@/components/marketku/chat-avatar";

const now = new Date("2026-10-29T12:00:00Z").getTime();
const ago = (ms: number) => new Date(now - ms).toISOString();

describe("chat last seen", () => {
  it("shows Online within 2 minutes", () => expect(lastSeenLabel(ago(60_000), now)).toBe("Online"));
  it("shows hours like the reference", () => expect(lastSeenLabel(ago(7 * 3600_000), now)).toBe("Terakhir online 7 jam lalu"));
  it("handles never seen", () => expect(lastSeenLabel(null, now)).toBe("Belum pernah online"));
});
