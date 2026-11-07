import { CloseIcon } from "@/assets/icons";

type CircleCloseButtonProps = {
  onClick: () => void;
  disabled?: boolean;
};

export const CircleCloseButton = ({ onClick, disabled = false }: CircleCloseButtonProps) => {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Close"
      disabled={disabled}
      className={`w-6 h-6 rounded-full flex items-center justify-center border-0 p-0 transition-opacity ${
        disabled ? "bg-black/30 cursor-not-allowed opacity-60" : "bg-black/50 hover:opacity-80 cursor-pointer"
      }`}
    >
      <CloseIcon width={8} height={8} />
    </button>
  );
};
