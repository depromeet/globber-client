"use client";

import { useRouter } from "next/navigation";

import { Header } from "@/components/common/Header";

export default function TermsPage() {
  const router = useRouter();

  return (
    <main className="flex items-center justify-center min-h-dvh w-full bg-surface-secondary">
      <div className="bg-surface-secondary relative w-full max-w-[512px] h-dvh flex flex-col">
        <div className="max-w-[512px] mx-auto w-full">
          <Header variant="navy" leftIcon="back" onLeftClick={() => router.back()} title="약관 및 정책" />
        </div>

        {/* Main Content - Scrollable */}
        <div className="flex-1 overflow-y-auto flex flex-col">
          <div className="px-4 py-5 flex flex-col gap-6">
            {/* Service Overview */}
            <section>
              <h2 className="text-lg font-bold text-text-primary mb-2">서비스 개요</h2>
              <p className="text-sm text-text-secondary leading-relaxed">
                글로버는 사용자의 여행 기록을 시각적으로 저장하고 공유할 수 있는 서비스를 제공합니다.
              </p>
              <p className="text-sm text-text-secondary leading-relaxed mt-3">
                Depromeet 동아리 프로젝트로 제작되어, 개인의 여정을 한눈에 돌아보고 친구들과 경험을 나누는 것을 목표로
                합니다.
              </p>
            </section>

            {/* Account & Login */}
            <section>
              <h2 className="text-lg font-bold text-text-primary mb-2">회원가입 및 로그인</h2>
              <p className="text-sm text-text-secondary leading-relaxed">
                글로버(Globber)는 카카오톡 계정 연동 로그인을 통해 회원가입 및 로그인이 이루어집니다.
              </p>
              <p className="text-sm text-text-secondary leading-relaxed mt-3">
                사용자가 카카오 계정으로 로그인할 경우, 카카오로부터 이메일 주소와 닉네임(프로필 이름) 정보를
                제공받으며, 해당 정보는 계정 식별 및 서비스 이용 편의 제공을 위한 최소한의 정보입니다.
              </p>
              <p className="text-sm text-text-secondary leading-relaxed mt-3">
                광고·홍보 등의 목적으로는 사용되지 않습니다.
              </p>
            </section>

            {/* Data Collection & Usage */}
            <section>
              <h2 className="text-lg font-bold text-text-primary mb-2">정보 수집 및 이용 목적</h2>
              <p className="text-sm text-text-secondary leading-relaxed">
                글로버(Globber)는 서비스 이용을 위한 최소한의 개인정보만 수집합니다.
              </p>
              <p className="text-sm text-text-secondary leading-relaxed mt-3">
                로그인 시 카카오로부터 전달받은 이메일과 닉네임을 이용하여 계정을 인증하며, 제3자에게 해당 정보를
                제공하지 않습니다.
              </p>
            </section>

            {/* Data Retention & Deletion */}
            <section>
              <h2 className="text-lg font-bold text-text-primary mb-2">데이터 보관 및 삭제</h2>
              <p className="text-sm text-text-secondary leading-relaxed">
                글로버(Globber)는 카카오 계정 연동을 통해 가입한 사용자의 이메일과 닉네임을 자체 서버에 저장하지
                않습니다.
              </p>
              <p className="text-sm text-text-secondary leading-relaxed mt-3">
                로그인 과정에서 필요한 인증 정보는 카카오 API를 통해 일시적으로만 참조됩니다.
              </p>
              <p className="text-sm text-text-secondary leading-relaxed mt-3">
                회원 탈퇴 시 카카오 계정 연동이 해제되며, 글로버 내 여행 기록, 리액션, 프로필 이미지 등 사용자 생성
                데이터는 즉시 삭제됩니다.
              </p>
              <p className="text-sm text-text-secondary leading-relaxed mt-3">
                삭제된 데이터는 복구가 불가능하며, 백업 데이터에 포함된 경우 최대 30일 이내 자동 완전 삭제됩니다.
              </p>
            </section>

            {/* Content & Rights */}
            <section>
              <h2 className="text-lg font-bold text-text-primary mb-2">콘텐츠 및 저작권</h2>
              <p className="text-sm text-text-secondary leading-relaxed">
                사용자가 등록한 여행 기록, 사진, 텍스트 등의 콘텐츠에 대한 저작권은 사용자 본인에게 있습니다.
              </p>
              <p className="text-sm text-text-secondary leading-relaxed mt-3">
                글로버(Globber)는 서비스 품질 향상 및 비상업적 AI 인사이트 제공을 위해 콘텐츠를 내부적으로 분석·활용할
                수 있습니다.
              </p>
              <p className="text-sm text-text-secondary leading-relaxed mt-3">
                사용자가 업로드한 콘텐츠의 정확성이나 저작권 분쟁에 대해서는 글로버가 책임을 지지 않습니다.
              </p>
            </section>

            {/* Security */}
            <section>
              <h2 className="text-lg font-bold text-text-primary mb-2">데이터 관리 및 보안</h2>
              <p className="text-sm text-text-secondary leading-relaxed">
                모든 사용자 데이터는 보안이 적용된 서버 환경에서 관리됩니다.
              </p>
              <p className="text-sm text-text-secondary leading-relaxed mt-3">
                글로버(Globber)는 비정상적인 접근, 계정 도용, 외부 API 오류 등으로 인한 데이터 손실에 대해 책임을 지지
                않습니다.
              </p>
              <p className="text-sm text-text-secondary leading-relaxed mt-3">
                사용자의 명시적 요청(회원 탈퇴 등)에 따라 데이터를 즉시 삭제하며, 백업 데이터는 30일 이내 완전
                삭제됩니다.
              </p>
            </section>

            {/* Service Changes */}
            <section>
              <h2 className="text-lg font-bold text-text-primary mb-2">서비스 변경 및 종료</h2>
              <p className="text-sm text-text-secondary leading-relaxed">
                글로버(Globber)는 서비스 개선 및 업데이트를 위해 일부 기능을 사전 고지 없이 수정하거나 종료할 수
                있습니다.
              </p>
              <p className="text-sm text-text-secondary leading-relaxed mt-3">
                서비스 중단 시 사용자는 본인의 데이터 백업 또는 보존에 대한 권리를 가집니다.
              </p>
            </section>

            {/* Limitation of Liability */}
            <section>
              <h2 className="text-lg font-bold text-text-primary mb-2">책임의 한계</h2>
              <p className="text-sm text-text-secondary leading-relaxed">
                글로버(Globber)는 Depromeet에서 시작된 프로젝트로, 외부 지도 API, 카카오 로그인 시스템, 네트워크 장애 등
                제3자 시스템 문제로 발생한 손해에 대해 책임을 지지 않습니다.
              </p>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
