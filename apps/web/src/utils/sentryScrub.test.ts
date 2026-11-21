import type { Event } from "@sentry/nextjs";
import { describe, expect, it } from "vitest";

import { maskSensitiveUrl, scrubSensitiveData } from "./sentryScrub";

describe("maskSensitiveUrl", () => {
  it("로그인 code와 토큰 쿼리 값을 가림", () => {
    expect(maskSensitiveUrl("https://globber.world/login/oauth/success?code=abc&firstLogin=true")).toBe(
      "https://globber.world/login/oauth/success?code=%5BFiltered%5D&firstLogin=true"
    );
    expect(maskSensitiveUrl("/callback?accessToken=xyz#top")).toBe("/callback?accessToken=%5BFiltered%5D#top");
  });

  it("민감한 쿼리가 없으면 원래 문자열을 그대로 돌려줌", () => {
    expect(maskSensitiveUrl("/globe/W0kTg5?view=list")).toBe("/globe/W0kTg5?view=list");
    expect(maskSensitiveUrl("/record")).toBe("/record");
  });
});

describe("scrubSensitiveData", () => {
  it("요청의 쿠키·인증 헤더를 지우고 URL·쿼리 문자열의 code를 가림", () => {
    const event: Event = {
      request: {
        url: "https://globber.world/login/oauth/success?code=abc",
        query_string: "code=abc&uuid=W0kTg5",
        cookies: { kakao_access_token: "secret" },
        headers: { Cookie: "kakao_access_token=secret", Authorization: "Bearer secret", "User-Agent": "test" },
      },
    };

    const result = scrubSensitiveData(event);

    expect(result.request?.cookies).toBeUndefined();
    expect(result.request?.headers).toEqual({ "User-Agent": "test" });
    expect(result.request?.url).toBe("https://globber.world/login/oauth/success?code=%5BFiltered%5D");
    expect(result.request?.query_string).toBe("code=%5BFiltered%5D&uuid=W0kTg5");
  });

  it("객체 형태 쿼리와 breadcrumb URL도 가림", () => {
    const event: Event = {
      request: { query_string: { code: "abc", view: "list" } },
      breadcrumbs: [
        { category: "navigation", data: { from: "/login/oauth/success?code=abc", to: "/globe/W0kTg5" } },
        { category: "fetch", data: { url: "/api/v1/auth/token?token=t", method: "POST" } },
      ],
    };

    const result = scrubSensitiveData(event);

    expect(result.request?.query_string).toEqual({ code: "[Filtered]", view: "list" });
    expect(result.breadcrumbs?.[0]?.data).toEqual({
      from: "/login/oauth/success?code=%5BFiltered%5D",
      to: "/globe/W0kTg5",
    });
    expect(result.breadcrumbs?.[1]?.data).toEqual({ url: "/api/v1/auth/token?token=%5BFiltered%5D", method: "POST" });
  });

  it("요청 정보가 없는 이벤트는 그대로 돌려줌", () => {
    const event: Event = { message: "hello" };
    expect(scrubSensitiveData(event)).toEqual({ message: "hello" });
  });
});
