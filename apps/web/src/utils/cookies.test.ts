import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { AUTH_COOKIE } from "@/constants/authCookies";

import { clearAuthCookies } from "./cookies";

let writes: string[];

const stubBrowser = (hostname: string) => {
  writes = [];
  vi.stubGlobal("window", { location: { hostname } });
  vi.stubGlobal("document", {
    get cookie() {
      return "";
    },
    set cookie(value: string) {
      writes.push(value);
    },
  });
};

beforeEach(() => stubBrowser("dev.globber.world"));
afterEach(() => vi.unstubAllGlobals());

it("인증 쿠키만 domain 후보(없음·현재 호스트·부모 도메인)마다 만료시킨다", () => {
  clearAuthCookies();

  const authNames = Object.values(AUTH_COOKIE);
  expect(new Set(writes.map(line => line.slice(0, line.indexOf("="))))).toEqual(new Set(authNames));
  for (const name of authNames) {
    const lines = writes.filter(line => line.startsWith(`${name}=;`));
    expect(lines.map(line => line.match(/domain=([^;]+)/)?.[1])).toEqual([
      undefined,
      "dev.globber.world",
      ".globber.world",
      ".world",
    ]);
    expect(lines[0]).toBe(`${name}=; Max-Age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`);
    expect(lines[1]).toBe(
      `${name}=; Max-Age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=dev.globber.world`
    );
  }
});

it.each(["localhost", "127.0.0.1"])("%s에서는 domain 없이 만료시킨다", hostname => {
  stubBrowser(hostname);
  clearAuthCookies();

  expect(writes).toHaveLength(Object.values(AUTH_COOKIE).length);
  for (const line of writes) expect(line).not.toContain("domain=");
});

it("서버(document 없음)에서는 아무것도 하지 않는다", () => {
  vi.unstubAllGlobals();
  expect(() => clearAuthCookies()).not.toThrow();
});
