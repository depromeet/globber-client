import { describe, expect, it } from "vitest";

import { nicknameSchema, normalizeNickname } from "./profile";

describe("nicknameSchema", () => {
  it("공백만 있는 닉네임은 거부함", () => {
    expect(nicknameSchema.safeParse("   ").success).toBe(false);
    expect(nicknameSchema.safeParse("").success).toBe(false);
  });

  it("앞뒤 공백이 있어도 글자가 있으면 통과함", () => {
    expect(nicknameSchema.safeParse(" 글로버 ").success).toBe(true);
  });
});

describe("normalizeNickname", () => {
  it("앞뒤 공백만 지우고 중간 공백은 남김", () => {
    expect(normalizeNickname("  김정우 최고  ")).toBe("김정우 최고");
    expect(normalizeNickname("   ")).toBe("");
  });
});
