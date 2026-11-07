import { describe, expect, it } from "vitest";

import { escapeHtml } from "./htmlEscape";

describe("escapeHtml", () => {
  it("HTML 특수문자 5종을 엔티티로 바꾼다", () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&#x27;&amp;&#x27;&lt;/a&gt;");
  });

  it("특수문자가 없으면 그대로 둔다", () => {
    expect(escapeHtml("서울 여행 2026")).toBe("서울 여행 2026");
  });
});
