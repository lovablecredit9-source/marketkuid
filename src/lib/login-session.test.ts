import { describe, expect, it } from "vitest";
import { carrierFromIsp, isRealPhone, modelFrom, networkLabel, osFrom, vendorFrom } from "./login-session";

const CHROME_ANDROID = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36";

describe("login session helpers", () => {
  it("uses the real Android version from client hints, not the frozen UA 10", () => {
    expect(osFrom(CHROME_ANDROID, "Android", "14.0.0")).toEqual({ name: "Android", version: "14" });
  });
  it("uses the real model from client hints and ignores Chrome's 'K'", () => {
    expect(modelFrom(CHROME_ANDROID, "SM-A546E")).toBe("SM-A546E");
    expect(modelFrom(CHROME_ANDROID, null)).toBeNull();
    expect(vendorFrom("SM-A546E")).toBe("Samsung");
  });
  it("maps Indonesian ISPs to the SIM provider", () => {
    expect(carrierFromIsp("PT. Telekomunikasi Selular")).toBe("Telkomsel");
    expect(carrierFromIsp("Indosat Ooredoo Hutchison")).toBe("Indosat Ooredoo (IM3)");
    expect(carrierFromIsp("PT XL Axiata Tbk")).toBe("XL Axiata");
  });
  it("labels WiFi vs mobile data", () => {
    expect(networkLabel("wifi", "IndiHome (Telkom)")).toBe("WiFi · IndiHome (Telkom)");
    expect(networkLabel(null, "Telkomsel")).toBe("Data Seluler · Telkomsel");
  });
  it("never marks automation or desktop as a real phone", () => {
    expect(isRealPhone({ mobile: true, touchPoints: 5, webdriver: false }, CHROME_ANDROID)).toBe(true);
    expect(isRealPhone({ mobile: true, touchPoints: 5, webdriver: true }, CHROME_ANDROID)).toBe(false);
    expect(isRealPhone({ mobile: false, touchPoints: 0, webdriver: false }, "Mozilla/5.0 (Windows NT 10.0)")).toBe(false);
  });
});
