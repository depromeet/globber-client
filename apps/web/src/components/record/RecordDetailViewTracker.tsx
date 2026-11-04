"use client";
import React, { useEffect } from "react";

import { sendGAEvent } from "@next/third-parties/google";

type Props = {
  recordId: string;
  cityId: number;
  photoCount: number;
  isOwner: boolean;
};

const RecordDetailViewTracker = ({ recordId, cityId, photoCount, isOwner }: Props) => {
  useEffect(() => {
    const screen = isOwner ? "my" : "other";
    const eventName = isOwner ? "endview_my_view" : "endview_other_view";
    sendGAEvent("event", eventName, {
      flow: "endview",
      screen,
      record_id: recordId,
      city_id: cityId,
      photo_count: photoCount,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <></>;
};

export default RecordDetailViewTracker;
