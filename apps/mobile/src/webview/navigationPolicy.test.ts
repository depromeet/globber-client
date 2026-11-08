import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { shouldLoadInWebView } from "./navigationPolicy.ts";

const WEB_URL = "https://globber.world";

const expectLoad = (url: string, expected: boolean, webUrl = WEB_URL) =>
  assert.equal(shouldLoadInWebView(url, webUrl), expected, `${url} (기준: ${webUrl})`);

describe("shouldLoadInWebView", () => {
  it("서비스 도메인과 하위 도메인은 WebView 안에서 연다", () => {
    expectLoad("https://globber.world/globe/abc", true);
    expectLoad("https://www.globber.world/login", true);
    expectLoad("https://GLOBBER.WORLD:443/", true);
    expectLoad("about:blank", true);
  });

  it("카카오 로그인 도메인은 WebView 안에서 연다", () => {
    expectLoad("https://accounts.kakao.com/login?continue=x", true);
    expectLoad("https://kauth.kakao.com/oauth/authorize", true);
    expectLoad("https://k.kakaocdn.net/img.png", true);
  });

  it("userinfo(아이디:비밀번호@)로 허용 도메인을 위장해도 실제 호스트로 판단한다", () => {
    expectLoad("https://x.kakao.com:p@evil.example/", false);
    expectLoad("https://globber.world:x@evil.example/", false);
    expectLoad("https://globber.world@evil.example/", false);
  });

  it("query/fragment 안의 @ 에 속지 않는다 (React Native 내장 URL의 hostname 버그)", () => {
    expectLoad("https://evil.example/?next=a@globber.world", false);
    expectLoad("https://evil.example/#a@accounts.kakao.com", false);
  });

  it("백슬래시를 경로 구분자로 취급한다 (WHATWG 규칙)", () => {
    expectLoad("https://evil.example\\@globber.world", false);
  });

  it("유사 도메인과 외부 도메인은 외부로 넘긴다", () => {
    expectLoad("https://globber.world.evil.example/", false);
    expectLoad("https://evilglobber.world/", false);
    expectLoad("https://kakao.com.evil.example/", false);
    expectLoad("http://evil.example/", false);
  });

  it("http(s)가 아닌 스킴은 외부로 넘긴다", () => {
    expectLoad("kakaotalk://kakaolink", false);
    expectLoad("javascript:alert(1)", false);
    expectLoad("tel:01012345678", false);
    expectLoad("intent://authorize#Intent;scheme=kakaokompassauth;end", false);
  });

  it("localhost/IP 기준일 때는 정확히 일치하는 호스트만 허용한다", () => {
    expectLoad("http://10.0.2.2:3000/login", true, "http://10.0.2.2:3000");
    expectLoad("http://192.168.2.2/", false, "http://10.0.2.2:3000");
    expectLoad("http://localhost:3000/x", true, "http://localhost:3000");
    expectLoad("http://evil.localhost/", false, "http://localhost:3000");
  });
});
