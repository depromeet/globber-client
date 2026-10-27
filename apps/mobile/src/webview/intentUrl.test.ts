import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseIntentUrl } from "./intentUrl.ts";

describe("parseIntentUrl", () => {
  it("앱 스킴 URL, 대체 URL, 패키지명을 분리한다", () => {
    const fallback = "https://accounts.kakao.com/login?continue=https%3A%2F%2Fkauth.kakao.com";
    const url =
      "intent://authorize?client_id=abc&redirect_uri=https%3A%2F%2Fglobber.world" +
      `#Intent;scheme=kakaokompassauth;package=com.kakao.talk;S.browser_fallback_url=${encodeURIComponent(fallback)};end`;

    assert.deepEqual(parseIntentUrl(url), {
      appUrl: "kakaokompassauth://authorize?client_id=abc&redirect_uri=https%3A%2F%2Fglobber.world",
      fallbackUrl: fallback,
      packageName: "com.kakao.talk",
    });
  });

  it("대체 URL이 없으면 null", () => {
    assert.deepEqual(parseIntentUrl("intent://send#Intent;scheme=kakaolink;package=com.kakao.talk;end"), {
      appUrl: "kakaolink://send",
      fallbackUrl: null,
      packageName: "com.kakao.talk",
    });
  });

  it("경로가 없으면 스킴만으로 앱 URL을 만든다", () => {
    assert.equal(parseIntentUrl("intent:#Intent;scheme=kakaotalk;end")?.appUrl, "kakaotalk://");
  });

  it("스킴이 없거나 허용되지 않는 문자가 있으면 앱 URL을 만들지 않는다", () => {
    assert.equal(parseIntentUrl("intent://x#Intent;package=com.kakao.talk;end")?.appUrl, null);
    assert.equal(parseIntentUrl("intent://x#Intent;scheme=java script;end")?.appUrl, null);
  });

  it("대체 URL은 http(s)만 허용한다", () => {
    const js = encodeURIComponent("javascript:alert(1)");
    assert.equal(parseIntentUrl(`intent://x#Intent;scheme=a;S.browser_fallback_url=${js};end`)?.fallbackUrl, null);
  });

  it("잘못된 퍼센트 인코딩의 대체 URL은 무시한다", () => {
    assert.equal(parseIntentUrl("intent://x#Intent;scheme=a;S.browser_fallback_url=%E0%A4%A;end")?.fallbackUrl, null);
  });

  it("end 이후 값은 무시하고, 대소문자 구분 없이 intent: 를 인식한다", () => {
    const parsed = parseIntentUrl("INTENT://x#Intent;scheme=a;end;package=evil");
    assert.equal(parsed?.appUrl, "a://x");
    assert.equal(parsed?.packageName, null);
  });

  it("intent URL이 아니거나 #Intent; 가 없으면 null", () => {
    assert.equal(parseIntentUrl("https://globber.world"), null);
    assert.equal(parseIntentUrl("intent://x"), null);
  });
});
