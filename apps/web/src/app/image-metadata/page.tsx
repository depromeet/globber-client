import { ImageMetadataComponent } from "@/components/imageMetadata/ImageMetadata";
import type { PageProps } from "@/types/components";

type ImageMetadataQuery = {
  cityId?: string;
  city?: string;
  country?: string;
  diaryId?: string;
  scrollIndex?: string;
  uuid?: string;
};

type ImageMetadataPageProps = PageProps<never, ImageMetadataQuery>;

export default async function Page({ searchParams }: ImageMetadataPageProps) {
  const params = await searchParams;
  const rawCityId = params?.cityId?.trim();
  const parsedCityId =
    rawCityId && rawCityId !== "undefined" && rawCityId !== "null" ? Number.parseInt(rawCityId, 10) : undefined;
  const cityId = typeof parsedCityId === "number" && Number.isFinite(parsedCityId) ? parsedCityId : undefined;

  const rawDiaryId = params?.diaryId?.trim();
  const parsedDiaryId =
    rawDiaryId && rawDiaryId !== "undefined" && rawDiaryId !== "null" ? Number.parseInt(rawDiaryId, 10) : undefined;
  const diaryId = typeof parsedDiaryId === "number" && Number.isFinite(parsedDiaryId) ? parsedDiaryId : undefined;

  const rawScrollIndex = params?.scrollIndex?.trim();
  const parsedScrollIndex =
    rawScrollIndex && rawScrollIndex !== "undefined" && rawScrollIndex !== "null"
      ? Number.parseInt(rawScrollIndex, 10)
      : undefined;
  const scrollIndex =
    typeof parsedScrollIndex === "number" && Number.isFinite(parsedScrollIndex) ? parsedScrollIndex : undefined;

  return (
    <ImageMetadataComponent
      cityId={cityId}
      diaryId={diaryId}
      initialCity={params?.city}
      initialCountry={params?.country}
      scrollIndex={scrollIndex}
      uuid={params?.uuid}
    />
  );
}
