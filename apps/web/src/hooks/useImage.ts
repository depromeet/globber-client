import { useEffect, useRef, useState } from "react";

type PhotoState = {
  file: File | null;
  url: string | null;
  label?: string;
};

type Photos = Record<string, PhotoState>;

const useImage = (initialKeys: string[], initialLabels?: Record<string, string>) => {
  const [photos, setPhotos] = useState<Photos>(() => {
    const initialPhotos: Photos = {};

    initialKeys.forEach(key => {
      initialPhotos[key] = { file: null, url: null, label: initialLabels?.[key] };
    });

    return initialPhotos;
  });

  // 화면을 떠날 때 남아 있는 미리보기 URL을 해제하기 위해 최신 값을 보관한다
  const photosRef = useRef(photos);
  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);
  useEffect(
    () => () => {
      Object.values(photosRef.current).forEach(({ url }) => {
        if (url) URL.revokeObjectURL(url);
      });
    },
    []
  );

  const handleSelectFile = (photoType: keyof typeof photos) => (file: File) => {
    const previewUrl = URL.createObjectURL(file);
    // 같은 자리에 사진을 바꿔 넣으면 이전 미리보기 URL은 더 쓰지 않는다
    const previousUrl = photos[photoType]?.url;
    if (previousUrl) URL.revokeObjectURL(previousUrl);

    setPhotos(prev => ({
      ...prev,
      [photoType]: {
        ...prev[photoType],
        file: file,
        url: previewUrl,
      },
    }));
  };

  const handleRemove = (photoType: keyof typeof photos) => () => {
    const url = photos[photoType].url;
    if (url) {
      URL.revokeObjectURL(url);
    }

    setPhotos(prev => ({
      ...prev,
      [photoType]: {
        ...prev[photoType],
        file: null,
        url: null,
      },
    }));
  };

  return {
    photos,
    handleSelectFile,
    handleRemove,
  };
};

export default useImage;
