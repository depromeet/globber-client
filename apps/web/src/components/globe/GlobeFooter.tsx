"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { sendGAEvent } from "@next/third-parties/google";

import { BookmarkFilledIcon, BookmarkIcon } from "@/assets/icons";
import GlobeIcon from "@/assets/icons/globe.svg";
import ListIcon from "@/assets/icons/list.svg";
import PlusIcon from "@/assets/icons/plus.svg";
import { HeadlessToast, HeadlessToastProvider } from "@/components/common/Toast";
import { useAddBookmarkMutation, useRemoveBookmarkMutation } from "@/hooks/mutation/useBookmarkMutations";
import { cn } from "@/utils/cn";
import { getAuthInfo } from "@/utils/cookies";

import { ShareButton } from "./ShareButton";

type GlobeFooterProps = {
  isZoomed: boolean;
  viewMode?: "globe" | "list";
  onViewModeChange?: (mode: "globe" | "list") => void;
  isMyGlobe?: boolean;
  isFirstGlobe?: boolean;
  memberId?: number;
  isBookmarked?: boolean;
  onBookmarkChange?: (isBookmarked: boolean) => void;
};

const DESCRIPTIONS = ["다녀온 도시가 많을수록 나라 색이 밝아져요.", "+ 버튼을 눌러 새로운 여행을 기록해보세요."];

const VIEW_MODE_TOGGLE_DELAY_MS = 220;

const getRandomDescriptionIndex = (currentIndex: number): number => {
  let nextIndex = Math.floor(Math.random() * DESCRIPTIONS.length);
  while (nextIndex === currentIndex) nextIndex = Math.floor(Math.random() * DESCRIPTIONS.length);

  return nextIndex;
};

export const GlobeFooter = ({
  isZoomed,
  viewMode = "globe",
  onViewModeChange,
  isMyGlobe = true,
  isFirstGlobe = false,
  memberId,
  isBookmarked: initialIsBookmarked = false,
  onBookmarkChange,
}: GlobeFooterProps) => {
  const router = useRouter();

  const toggleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [descriptionIndex, setDescriptionIndex] = useState(() => Math.floor(Math.random() * DESCRIPTIONS.length));
  const [isBookmarked, setIsBookmarked] = useState(initialIsBookmarked);
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [visualViewMode, setVisualViewMode] = useState<"globe" | "list">(viewMode);

  const handleToggleViewMode = useCallback(() => {
    const nextMode = visualViewMode === "list" ? "globe" : "list";

    sendGAEvent("event", "home_view_switch", {
      flow: "home",
      screen: isMyGlobe
        ? visualViewMode === "globe"
          ? "globe_main"
          : "list_main"
        : visualViewMode === "globe"
          ? "globe_other"
          : "list_other",
      click_code: isMyGlobe
        ? nextMode === "globe"
          ? "home.bottom.view.globe"
          : "home.bottom.view.list"
        : nextMode === "globe"
          ? "home.other.bottom.view.globe"
          : "home.other.bottom.view.list",
      from: visualViewMode,
      to: nextMode,
    });

    setVisualViewMode(nextMode);

    if (!onViewModeChange) return;
    if (toggleTimeoutRef.current) clearTimeout(toggleTimeoutRef.current);

    toggleTimeoutRef.current = setTimeout(() => {
      onViewModeChange(nextMode);
      toggleTimeoutRef.current = null;
    }, VIEW_MODE_TOGGLE_DELAY_MS);
  }, [onViewModeChange, visualViewMode, isMyGlobe]);

  const { mutateAsync: addBookmark } = useAddBookmarkMutation(() =>
    sendGAEvent("event", "auth_login_gate_view", {
      flow: "home",
      screen: viewMode === "globe" ? "globe_other" : "list_other",
      source_event: "home_globe_bookmark_click",
    })
  );
  const { mutateAsync: removeBookmark } = useRemoveBookmarkMutation();

  const renderViewToggle = () => {
    const isListMode = visualViewMode === "list";

    return (
      <button
        type="button"
        onClick={handleToggleViewMode}
        className="relative flex items-center gap-2 h-[60px] px-2 py-1.5 rounded-[50px] bg-opacity-10 backdrop-blur-sm bg-(--color-surface-placeholder--8) overflow-hidden cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
        aria-label={`현재 ${isListMode ? "리스트" : "글로브"} 보기`}
        aria-pressed={!isListMode}
      >
        <span
          className={cn(
            "absolute left-2 top-1/2 z-0 size-11 rounded-[50px] bg-(--color-surface-inverseprimary) transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] -translate-y-1/2",
            isListMode ? "translate-x-0" : "translate-x-[52px]"
          )}
        />
        <span className="relative z-10 flex items-center justify-center size-11 rounded-[50px] transition-colors pointer-events-none">
          <ListIcon
            className={cn(
              "w-6 h-6 transition-colors duration-200 ease-in-out",
              isListMode ? "text-(--color-surface-primary)" : "text-white"
            )}
          />
        </span>
        <span className="relative z-10 flex items-center justify-center size-11 rounded-[50px] transition-colors pointer-events-none">
          <GlobeIcon
            className={cn(
              "w-8 h-8 transition-colors duration-200 ease-in-out",
              isListMode ? "text-white" : "text-(--color-surface-primary)"
            )}
          />
        </span>
      </button>
    );
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setDescriptionIndex(prevIndex => getRandomDescriptionIndex(prevIndex));
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setVisualViewMode(current => (current === viewMode ? current : viewMode));
  }, [viewMode]);

  // 부모에서 북마크 상태가 업데이트되면 로컬 상태도 동기화
  useEffect(() => {
    setIsBookmarked(initialIsBookmarked);
  }, [initialIsBookmarked]);

  useEffect(() => {
    return () => {
      if (toggleTimeoutRef.current) {
        clearTimeout(toggleTimeoutRef.current);
      }
    };
  }, []);

  const handleBookmarkClick = async () => {
    if (!memberId) return;

    sendGAEvent("event", "home_bookmark_click", {
      flow: "home",
      screen: viewMode === "globe" ? "globe_other" : "list_other",
      click_code: "home.other.bottom.action.bookmark",
    });

    const previousState = isBookmarked;
    const willBeBookmarked = !isBookmarked;
    setIsBookmarked(willBeBookmarked);

    // 부모 컴포넌트에게 상태 변경 알림
    onBookmarkChange?.(willBeBookmarked);

    try {
      if (isBookmarked) {
        await removeBookmark({ targetMemberId: memberId });
        sendGAEvent("event", "home_bookmark_remove", {
          flow: "home",
          screen: viewMode === "globe" ? "globe_other" : "list_other",
          click_code: "home.other.bottom.action.bookmark",
        });
        setToastMessage("저장이 해제되었습니다.");
      } else {
        await addBookmark({ targetMemberId: memberId });
        sendGAEvent("event", "home_bookmark_add", {
          flow: "home",
          screen: viewMode === "globe" ? "globe_other" : "list_other",
          click_code: "home.other.bottom.action.bookmark",
        });
        setToastMessage("저장되었습니다.");
      }
      setToastOpen(true);
    } catch {
      setIsBookmarked(previousState);
      // 실패 시 부모 상태도 롤백
      onBookmarkChange?.(previousState);
    }
  };

  return (
    <HeadlessToastProvider>
      <div
        aria-hidden={isZoomed}
        className={cn(
          "transition-opacity duration-500 w-full max-w-lg mx-auto flex flex-col items-center justify-center pt-10 relative",
          isZoomed ? "opacity-0 pointer-events-none" : "opacity-100"
        )}
      >
        {/* Toast */}
        <HeadlessToast
          open={toastOpen}
          onOpenChange={setToastOpen}
          duration={3000}
          className="toast-anim absolute bottom-[72px] left-1/2 -translate-x-1/2 w-[calc(100%-32px)] max-w-[370px] pl-3 pr-8 py-3 rounded-xl bg-[#21272d] z-50 flex items-center gap-2"
          contentClassName="text-sm font-semibold text-white tracking-[-0.28px] leading-[1.3] text-center"
        >
          {toastMessage}
        </HeadlessToast>
        {/* 첫 지구본: 자랑하기/홈 버튼 */}
        {isFirstGlobe ? (
          <div className="w-full max-w-lg flex flex-col gap-3">
            {/* 내 지구본 자랑하기 버튼 */}
            <ShareButton isFirstGlobe={true} />

            {/* 홈으로 이동 버튼 */}
            <button
              type="button"
              className="w-full flex items-center justify-center px-12 py-[17px] rounded-2xl transition-all hover:opacity-80 cursor-pointer"
              style={{
                background: "rgb(13, 12, 20) 100%)",
              }}
              aria-label="홈으로 이동"
              onClick={() => {
                sendGAEvent("event", "globeresult_home_click", {
                  flow: "onboarding",
                  screen: "globeresult",
                  click_code: "onboarding.globeresult.cta.home",
                });

                const { uuid } = getAuthInfo();
                if (uuid) {
                  router.push(`/globe/${uuid}`);
                }
              }}
            >
              <p className="font-bold text-base text-white leading-[1.3]">홈으로 이동</p>
            </button>
          </div>
        ) : (
          <>
            {/* 설명 문구 - 지구본 뷰일 때만 표시 (내 지구본일 때만) */}
            {viewMode === "globe" && isMyGlobe && (
              <div className="mb-10 text-center min-h-7">
                <p
                  key={descriptionIndex}
                  className="text-sm font-medium text-text-secondary animate-[slideInFromTop_0.5s_ease-out]"
                >
                  {DESCRIPTIONS[descriptionIndex]}
                </p>
              </div>
            )}

            {/* 버튼 래퍼 */}
            {isMyGlobe ? (
              // 내 지구본: 공유 버튼, 토글, 플러스 버튼 (중앙 정렬)
              <div className="flex items-center justify-center gap-11">
                {/* 공유 버튼 */}
                <ShareButton screen={viewMode === "globe" ? "globe_main" : "list_main"} />

                {/* 리스트 뷰/글로브 뷰 토글 */}
                {renderViewToggle()}

                {/* 기록/도시 추가 버튼 */}
                <button
                  type="button"
                  className="flex items-center justify-center p-2.5 rounded-[500px] size-14 transition-all hover:opacity-80 cursor-pointer"
                  style={{
                    background:
                      "radial-gradient(95.88% 89.71% at 17.16% 14.06%, #00D9FF 0%, #60E7FF 56.15%, #C6F6FF 100%)",
                  }}
                  aria-label="새 항목 추가"
                  onClick={() => {
                    sendGAEvent("event", "home_record_add", {
                      flow: "home",
                      screen: viewMode === "globe" ? "globe_main" : "list_main",
                      click_code: "home.bottom.action.add",
                      entry: "bottom_navigation",
                    });
                    router.push("/record");
                  }}
                >
                  <PlusIcon className="w-8 h-8 text-(--color-surface-primary)" />
                </button>
              </div>
            ) : (
              // 타인의 지구본: 북마크 버튼 (왼쪽), 토글 (오른쪽) - 양쪽 정렬
              <div className="w-full max-w-[328px] flex items-center justify-between">
                {/* 북마크 버튼 */}
                <button
                  type="button"
                  className="flex items-center justify-center rounded-[500px] size-[60px] transition-all hover:opacity-80 cursor-pointer"
                  style={{
                    background:
                      "radial-gradient(95.88% 89.71% at 17.16% 14.06%, #ffffff2e 0%, #ffffff14 56.15%, #ffffff09 100%)",
                  }}
                  aria-label="저장하기"
                  onClick={handleBookmarkClick}
                >
                  {isBookmarked ? <BookmarkFilledIcon className="w-8 h-8" /> : <BookmarkIcon className="w-8 h-8" />}
                </button>

                {/* 리스트 뷰/글로브 뷰 토글 */}
                {renderViewToggle()}
              </div>
            )}
          </>
        )}
      </div>
    </HeadlessToastProvider>
  );
};
