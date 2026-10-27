export function FixedSaveButton({ onClick, disabled }: { onClick?: () => void; disabled?: boolean }) {
  return (
    <div className="fixed left-0 right-0 bottom-5 px-6 z-40">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={`w-full py-4 rounded-[18px] text-base font-medium ${disabled ? "bg-[#1b1c20] text-gray-500 cursor-not-allowed" : "bg-gray-700 text-white"}`}
      >
        저장하기
      </button>
    </div>
  );
}
