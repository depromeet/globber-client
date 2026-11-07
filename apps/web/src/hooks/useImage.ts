import { useState } from "react";

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

  const handleSelectFile = (photoType: keyof typeof photos) => (file: File) => {
    const previewUrl = URL.createObjectURL(file);

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
