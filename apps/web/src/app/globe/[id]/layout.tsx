import type { Metadata } from "next";

import { DEFAULT_DESCRIPTION, DEFAULT_TITLE, OG_IMAGE, SITE_NAME, SITE_URL } from "@/constants/site";
import { getGlobeData } from "@/services/memberService";

type Props = {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const { id: uuid } = await params;

    // API에서 동적으로 데이터 가져오기
    const globeResponse = await getGlobeData(uuid);

    if (!globeResponse?.data) {
      // openGraph·twitter는 루트 layout의 기본값을 물려받음 (GLB-243)
      return { title: DEFAULT_TITLE, description: DEFAULT_DESCRIPTION };
    }

    const { nickname } = globeResponse.data;
    const shareUrl = `${SITE_URL}/globe/${uuid}`;

    // 닉네임이 있으면 사용, 없으면 기본값
    const pageTitle = nickname ? `Globber(글로버) - ${nickname}님의 지구본` : DEFAULT_TITLE;

    const pageDescription = nickname ? `${nickname}님의 여행 기록을 담은 지구본을 확인해보세요!` : DEFAULT_DESCRIPTION;

    return {
      title: pageTitle,
      description: pageDescription,
      openGraph: {
        title: pageTitle,
        description: pageDescription,
        url: shareUrl,
        siteName: SITE_NAME,
        images: [
          {
            ...OG_IMAGE,
            alt: `${nickname}님의 여행 지구본`,
          },
        ],
        type: "website",
        locale: "ko_KR",
      },
      twitter: {
        card: "summary_large_image",
        title: pageTitle,
        description: pageDescription,
        images: [OG_IMAGE.url],
      },
      alternates: {
        canonical: shareUrl,
      },
    };
  } catch {
    // 에러 발생 시 기본 메타데이터 반환
    return { title: DEFAULT_TITLE, description: DEFAULT_DESCRIPTION };
  }
}

export default function GlobeLayout({ children }: Props) {
  return <>{children}</>;
}
