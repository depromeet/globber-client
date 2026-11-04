export type ImageTag = "FOOD" | "SCENERY" | "PEOPLE" | "NONE";

export const IMAGE_TAGS: ImageTag[] = ["FOOD", "SCENERY", "PEOPLE"];

export const TAG_LABELS: Record<ImageTag, string> = {
  FOOD: "음식",
  SCENERY: "풍경",
  PEOPLE: "인물",
  NONE: "없음",
};

export interface ImageMetadata {
  id: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  imagePreview: string;
  dimensions?: { width: number; height: number };
  camera?: { make: string; model: string; software: string };
  settings?: { iso: number; aperture: number; shutterSpeed: string; focalLength: number; flash: boolean };
  location?: { latitude?: number; longitude?: number; altitude?: number; address?: string; nearbyPlaces?: string[] };
  timestamp?: string;
  orientation?: number;
  tag?: ImageTag;
  status: "processing" | "completed" | "error";
  error?: string;
}
