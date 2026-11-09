import React from "react";
import { act, create } from "react-test-renderer";

import { afterEach, expect, it, vi } from "vitest";

import { ProfileClient } from "./ProfileClient";

const { replace, logout } = vi.hoisted(() => ({ replace: vi.fn(), logout: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, push: vi.fn() }) }));
vi.mock("@next/third-parties/google", () => ({ sendGAEvent: vi.fn() }));
vi.mock("@globber/shared/utils/logger", () => ({ logger: { error: vi.fn() } }));
vi.mock("@/services/authService", () => ({ logout }));
vi.mock("@/services/profileService", () => ({ uploadAndUpdateProfile: vi.fn() }));
vi.mock("@/components/common/Button", () => ({ Button: "button" }));
vi.mock("@/components/common/Header", () => ({ Header: "header" }));
vi.mock("@/components/profile/EditProfileBottomSheet", () => ({ EditProfileBottomSheet: "aside" }));
vi.mock("@/components/profile/LogoutDialog", () => ({ LogoutDialog: "dialog" }));
vi.mock("@/components/profile/ProfileCard", () => ({ ProfileCard: "article" }));
vi.mock("@/components/profile/SettingItem", () => ({ SettingItem: "nav" }));
vi.mock("@/components/profile/SettingSection", () => ({ SettingSection: "section" }));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

it.each([false, true])("로그아웃 API 실패 여부와 관계없이 로그인 화면으로 교체한다 (실패=%s)", async fails => {
  vi.stubGlobal("React", React);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("alert", vi.fn());
  logout.mockImplementation(async () => {
    if (fails) throw new Error("서버 오류");
  });
  let renderer: ReturnType<typeof create>;
  await act(async () => {
    renderer = create(
      React.createElement(ProfileClient, {
        initialProfile: {
          memberId: 1,
          nickname: "테스트",
          email: "test@example.test",
          profileImageUrl: undefined,
          authProvider: "KAKAO",
        },
      })
    );
  });
  await act(async () => {
    await renderer!.root.findByType("dialog").props.onConfirm();
  });
  expect(replace).toHaveBeenCalledExactlyOnceWith("/login");
  expect(renderer!.root.findByType("dialog").props.isOpen).toBe(false);
  await act(async () => renderer!.unmount());
});
