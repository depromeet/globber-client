export function ImageMetadataHeader({ city, onClose }: { city: string; onClose?: () => void }) {
  return (
    <div className="px-6 pt-6 pb-4">
      <button type="button" onClick={onClose} className="text-white text-2xl">
        ×
      </button>
      <div className="mt-6">
        <div className="text-[24px] font-semibold tracking-tight">
          <span className="text-pink-400">{city || "여행"}</span>
          <span className=""> 여행 기록,</span>
        </div>
        <div className="text-[22px] font-semibold mt-1">딱 한 장면으로 남길 수 있다면?</div>
      </div>
    </div>
  );
}
