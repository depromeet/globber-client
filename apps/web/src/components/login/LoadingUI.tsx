const LoadingUI = () => (
  <main className="min-h-dvh w-full bg-gradient-to-br from-[#0f172a] via-[#0b1024] to-black text-white flex items-center justify-center p-6">
    <div className="relative w-full max-w-md">
      <div
        className="absolute -inset-1 rounded-3xl bg-gradient-to-tr from-[#3b82f6]/30 via-[#22d3ee]/20 to-[#a855f7]/20 blur-2xl"
        aria-hidden="true"
      />
      <section className="relative rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl px-6 py-8 shadow-2xl">
        <header className="mb-6 text-center">
          <h1 className="text-xl font-semibold tracking-tight">로그인 처리 중이에요</h1>
          <p className="mt-2 text-sm text-white/70">잠시만 기다려 주세요. 곧 자동으로 이동해요.</p>
        </header>
        <div className="flex flex-col items-center justify-center gap-4 py-4">
          <div className="relative h-12 w-12">
            <span className="absolute inset-0 rounded-full border-4 border-white/10" aria-hidden="true" />
            <span
              className="absolute inset-0 rounded-full border-4 border-transparent border-t-white/80 animate-spin"
              aria-hidden="true"
            />
          </div>
          <div className="text-center">
            <p className="text-sm text-white/80">카카오에서 인증 정보를 확인하는 중...</p>
            <p className="mt-1 text-xs text-white/50">브라우저를 닫지 말고 잠시만 기다려 주세요.</p>
          </div>
        </div>
      </section>
    </div>
  </main>
);

export default LoadingUI;
