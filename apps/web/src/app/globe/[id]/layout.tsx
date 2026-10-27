import type { Metadata } from "next";

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
      return {
        title: "Globber(글로버) - 지구본 위에서, 나의 여행을 한눈에!",
        description: "지구본으로 완성하는 여행 기록 서비스",
      };
    }

    const { nickname } = globeResponse.data;
    const shareUrl = `https://www.globber.world/globe/${uuid}`;

    // 닉네임이 있으면 사용, 없으면 기본값
    const pageTitle = nickname
      ? `Globber(글로버) - ${nickname}님의 지구본`
      : "Globber(글로버) - 지구본 위에서, 나의 여행을 한눈에!";

    const pageDescription = nickname
      ? `${nickname}님의 여행 기록을 담은 지구본을 확인해보세요!`
      : "지구본으로 완성하는 여행 기록 서비스";

    return {
      title: pageTitle,
      description: pageDescription,
      openGraph: {
        title: pageTitle,
        description: pageDescription,
        url: shareUrl,
        siteName: "Globber",
        images: [
          {
            url: "https://www.globber.world/assets/thumbnail.webp",
            width: 1200,
            height: 630,
            alt: `${nickname}님의 여행 지구본`,
            type: "image/webp",
          },
        ],
        type: "website",
        locale: "ko_KR",
      },
      twitter: {
        card: "summary_large_image",
        title: pageTitle,
        description: pageDescription,
        images: ["https://www.globber.world/assets/thumbnail.webp"],
      },
      alternates: {
        canonical: shareUrl,
      },
    };
  } catch {
    // 에러 발생 시 기본 메타데이터 반환
    return {
      title: "Globber(글로버) - 지구본 위에서, 나의 여행을 한눈에!",
      description: "지구본으로 완성하는 여행 기록 서비스",
    };
  }
}

export default function GlobeLayout({ children }: Props) {
  return <>{children}</>;
}
