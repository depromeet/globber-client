import type { Metadata } from "next";

import { MaintenancePageContent } from "@/components/common/MaintenancePageContent";

export const metadata: Metadata = {
  title: "서비스 점검 중 - Globber",
  robots: { index: false, follow: false },
};

export default function MaintenancePage() {
  return <MaintenancePageContent />;
}
