"use client";

import { AddBookmarkRequest, RemoveBookmarkRequest } from "@globber/shared/types/bookmark";
import { useMutation } from "@tanstack/react-query";

import { addBookmark, type BookmarkRequestOptions, removeBookmark } from "@/services/bookmarkService";

export const useAddBookmarkMutation = (onLoginGate?: () => void, options?: BookmarkRequestOptions) => {
  return useMutation<void, Error, AddBookmarkRequest>({
    mutationFn: ({ targetMemberId }) => addBookmark(targetMemberId, onLoginGate, options),
  });
};

export const useRemoveBookmarkMutation = (options?: BookmarkRequestOptions) => {
  return useMutation<void, Error, RemoveBookmarkRequest>({
    mutationFn: ({ targetMemberId }) => removeBookmark(targetMemberId, options),
  });
};
