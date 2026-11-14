import type { MetadataRoute } from "next";

import { SITE_URL } from "@/constants/site";

export default function robots(): MetadataRoute.Robots {
  // 개발 서버(dev.globber.world)는 검색 엔진이 수집하지 않도록 전부 막는다
  if (process.env.NEXT_PUBLIC_DEPLOYMENT_ENV === "development") {
    return {
      rules: { userAgent: "*", disallow: "/" },
    };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: "/private/",
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
