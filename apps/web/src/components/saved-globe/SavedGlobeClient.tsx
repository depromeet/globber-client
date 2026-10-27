"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

import type { BookmarkUser } from "@globber/shared/types/bookmark";
import { sendGAEvent } from "@next/third-parties/google";

import BookmarkIcon from "@/assets/icons/bookmark.svg";
import BookmarkFilledIcon from "@/assets/icons/bookmark-filled.svg";
import { Dropdown } from "@/components/common/Dropdown";
import { Header } from "@/components/common/Header";
import { DEFAULT_PROFILE_IMAGE } from "@/constants/image";
import { useAddBookmarkMutation, useRemoveBookmarkMutation } from "@/hooks/mutation/useBookmarkMutations";
import { useImageLoadError } from "@/hooks/useImageLoadError";
import { getBookmarks } from "@/services/bookmarkService";
import { getAuthInfo } from "@/utils/cookies";

type SortOption = "latest" | "alphabetical";

type SavedGlobeClientProps = {
  initialBookmarks: BookmarkUser[];
  initialError?: string | null;
};

const ErrorState = ({ error, onRetry }: { error: string; onRetry: () => void }) => {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="flex flex-col items-center gap-6 px-4">
        {/* Error Icon */}
        <div className="w-16 h-16 rounded-full bg-[rgba(255,80,80,0.1)] flex items-center justify-center">
          <svg className="w-8 h-8 text-[#ff5050]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <title>Error</title>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>

        {/* Error Message */}
        <div className="flex flex-col items-center gap-2 text-center">
          <h2 className="text-xl font-bold text-white tracking-[-0.4px]">오류가 발생했습니다</h2>
          <p className="text-base font-medium text-(--color-text-secondary,#a8b8c6) tracking-[-0.32px]">{error}</p>
        </div>

        {/* Retry Button */}
        <button
          type="button"
          onClick={onRetry}
          className="px-6 py-3 bg-[rgba(255,255,255,0.1)] hover:bg-[rgba(255,255,255,0.15)] rounded-xl text-white font-semibold transition-colors"
        >
          다시 시도
        </button>
      </div>
    </div>
  );
};

const EmptyState = () => {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="flex flex-col items-center gap-8 z-10">
        {/* Globe Image Container */}
        <div className="relative w-[289.695px] h-[289.695px] flex items-center justify-center">
          {/* Globe Image */}
          <div className="absolute inset-0 flex items-center justify-center rounded-lg overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets/globe-empty.webp" alt="저장된 지구본이 없어요" className="w-full h-full object-cover" />
          </div>
        </div>

        {/* Text Content */}
        <div className="flex flex-col items-center gap-2 w-[247px] text-center">
          <h2 className="text-xl font-bold text-white tracking-[-0.4px]">저장된 지구본이 없어요 🥲</h2>
          <p className="text-base font-medium text-(--color-text-secondary,#a8b8c6) tracking-[-0.32px]">
            친구의 지구본을 둘러보고 저장해보세요
          </p>
        </div>
      </div>
    </div>
  );
};

const SavedGlobeProfileImage = ({ src, alt }: { src?: string | null; alt: string }) => {
  const { hasError, handleError } = useImageLoadError(src);

  if (!src || hasError) {
    return (
      <Image src={DEFAULT_PROFILE_IMAGE} alt={alt} width={44} height={44} className="w-full h-full object-cover" />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      // 하이드레이션 전에 로드에 실패하면 onError가 호출되지 않으므로 마운트 시점에 한 번 더 확인합니다.
      ref={img => {
        if (img?.complete && img.naturalWidth === 0) handleError();
      }}
      src={src}
      alt={alt}
      className="w-full h-full object-cover"
      onError={handleError}
    />
  );
};

const GlobeList = ({
  sortedGlobes,
  sortOption,
  onSortChange,
  onSortDropdownOpen,
  onSortSelect,
  onItemSelect,
  onGlobeClick,
  onSaveToggle,
  isLoading,
}: {
  sortedGlobes: BookmarkUser[];
  sortOption: SortOption;
  onSortChange: (value: SortOption) => void;
  onSortDropdownOpen: () => void;
  onSortSelect: (value: SortOption) => void;
  onItemSelect: (memberId: number, position: number, bookmarked: boolean) => void;
  onGlobeClick: (uuid: string) => void;
  onSaveToggle: (memberId: number) => void;
  isLoading: boolean;
}) => {
  return (
    <div className="flex-1 overflow-y-auto flex flex-col">
      {/* Sort Dropdown */}
      <div className="flex items-center justify-end px-4 pt-5 pb-5 shrink-0">
        <Dropdown
          value={sortOption}
          onValueChange={value => {
            const sortValue = value as SortOption;
            onSortSelect(sortValue);
            onSortChange(sortValue);
          }}
          onOpenChange={open => {
            if (open) onSortDropdownOpen();
          }}
          options={[
            { label: "최신순", value: "latest" },
            { label: "가나다순", value: "alphabetical" },
          ]}
        />
      </div>

      {/* Globe List */}
      <div className="px-4 flex flex-col gap-2 pb-4">
        {sortedGlobes.map(({ memberId, uuid, nickname, profileImageUrl, bookmarked }, index) => (
          <div
            key={memberId}
            role="button"
            tabIndex={0}
            className="w-full px-5 py-3 flex items-center justify-between rounded-2xl bg-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.1)] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => {
              onItemSelect(memberId, index, bookmarked);
              onGlobeClick(uuid);
            }}
            onKeyDown={e => {
              if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
                e.preventDefault();
                onItemSelect(memberId, index, bookmarked);
                onGlobeClick(uuid);
              }
            }}
            aria-label={`Open ${nickname} 지구본`}
          >
            {/* Left Content */}
            <div className="flex items-center gap-2.5">
              {/* Profile Image */}
              <div className="w-11 h-11 rounded-full bg-[rgba(255,255,255,0.1)] shrink-0 overflow-hidden">
                <SavedGlobeProfileImage src={profileImageUrl} alt={nickname} />
              </div>

              {/* Name */}
              <p className="text-sm font-semibold text-white">{nickname}</p>
            </div>

            {/* Bookmark Button */}
            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                onSaveToggle(memberId);
              }}
              disabled={isLoading}
              className="shrink-0 w-7 h-7 flex items-center justify-center hover:opacity-80 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label={bookmarked ? "저장 해제" : "저장"}
            >
              {bookmarked ? <BookmarkFilledIcon alt="저장됨" /> : <BookmarkIcon alt="저장 안 됨" />}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export const SavedGlobeClient = ({ initialBookmarks, initialError = null }: SavedGlobeClientProps) => {
  const router = useRouter();
  const [bookmarks, setBookmarks] = useState<BookmarkUser[]>(initialBookmarks);
  const [isLoading, setIsLoading] = useState(false);
  const [sortOption, setSortOption] = useState<SortOption>("latest");
  const [error, setError] = useState<string | null>(initialError);
  useEffect(() => {
    sendGAEvent("event", "home_friends_view", { flow: "home", screen: "friends" });
  }, []);

  const { mutateAsync: addBookmark } = useAddBookmarkMutation();
  const { mutateAsync: removeBookmark } = useRemoveBookmarkMutation();

  const loadBookmarks = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const data = await getBookmarks();
      setBookmarks(data);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "북마크를 불러오는데 실패했습니다";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleSaveToggle = useCallback(
    async (memberId: number) => {
      try {
        setIsLoading(true);
        const bookmark = bookmarks.find(g => g.memberId === memberId);
        if (!bookmark) {
          setIsLoading(false);
          return;
        }

        if (bookmark.bookmarked) {
          await removeBookmark({ targetMemberId: memberId });
        } else {
          await addBookmark({ targetMemberId: memberId });
        }

        setBookmarks(prev => prev.map(g => (g.memberId === memberId ? { ...g, bookmarked: !g.bookmarked } : g)));
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "북마크 상태 변경에 실패했습니다";
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    },
    [bookmarks, addBookmark, removeBookmark]
  );

  const handleGlobeCardClick = (uuid: string) => {
    sessionStorage.setItem("fromSavedGlobe", "true");
    router.push(`/globe/${uuid}`);
  };

  const sortedBookmarks = useMemo(() => {
    const sorted = [...bookmarks];
    if (sortOption === "alphabetical") {
      sorted.sort((a, b) => a.nickname.localeCompare(b.nickname));
    }
    return sorted;
  }, [bookmarks, sortOption]);

  const hasBookmarks = sortedBookmarks.length > 0;

  const headerSection = (
    <div className="max-w-lg mx-auto w-full">
      <Header
        variant="navy"
        leftIcon="back"
        onLeftClick={() => {
          const { uuid } = getAuthInfo();
          sendGAEvent("event", "home_friends_back_click", {
            flow: "home",
            screen: "friends",
            click_code: "home.friends.header.back",
          });
          router.push(`/globe/${uuid}`);
        }}
        title="저장된 지구본"
        style={{
          backgroundColor: "transparent",
          position: "relative",
          zIndex: 20,
        }}
      />
    </div>
  );

  if (error) {
    return (
      <main className="flex items-center justify-center min-h-dvh w-full bg-surface-secondary">
        <div className="bg-surface-secondary relative w-full max-w-lg h-dvh flex flex-col">
          {headerSection}
          <ErrorState error={error} onRetry={loadBookmarks} />
        </div>
      </main>
    );
  }

  if (!hasBookmarks) {
    return (
      <main className="flex items-center justify-center min-h-dvh w-full bg-surface-secondary">
        <div className="bg-surface-secondary relative w-full max-w-lg h-dvh flex flex-col">
          {headerSection}
          <EmptyState />
        </div>
      </main>
    );
  }

  return (
    <main className="flex items-center justify-center min-h-dvh w-full bg-surface-secondary">
      <div className="bg-surface-secondary relative w-full max-w-lg h-dvh flex flex-col">
        {headerSection}

        <GlobeList
          sortedGlobes={sortedBookmarks}
          sortOption={sortOption}
          onSortChange={setSortOption}
          onSortDropdownOpen={() =>
            sendGAEvent("event", "home_friends_sort_click", {
              flow: "home",
              screen: "friends",
              click_code: "home.friends.sort",
            })
          }
          onSortSelect={value =>
            sendGAEvent("event", "home_friends_sort_select", {
              flow: "home",
              screen: "friends",
              sort: value === "latest" ? "latest" : "alpha",
              click_code: value === "latest" ? "home.friends.sort.latest" : "home.friends.sort.alpha",
            })
          }
          onItemSelect={(memberId, position, hasBookmark) =>
            sendGAEvent("event", "home_friends_item_select", {
              flow: "home",
              screen: "friends",
              target_user_id: memberId,
              position,
              has_bookmark: hasBookmark,
              click_code: "home.friends.item.select",
            })
          }
          onGlobeClick={handleGlobeCardClick}
          onSaveToggle={handleSaveToggle}
          isLoading={isLoading}
        />
      </div>
    </main>
  );
};
