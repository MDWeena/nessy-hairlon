import { AlertTriangle } from "lucide-react";

interface SessionToastProps {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

/** Always gold-on-dark regardless of the site's light/dark theme — a deliberate, unmissable
 * system notice, same treatment as the dark CTA bands elsewhere on the site. */
export function SessionToast({ message, actionLabel, onAction }: SessionToastProps) {
  return (
    <div className="fixed bottom-6 inset-x-0 flex justify-center z-[300] px-4 pointer-events-none">
      <div className="pointer-events-auto bg-[#1E1914] border border-[#C49A6C] rounded-xl py-3.5 px-5 shadow-[0_8px_32px_rgba(0,0,0,0.4)] flex items-center gap-3 max-w-[420px] w-full sm:w-auto [animation:slideUp_0.3s_ease_forwards]">
        <AlertTriangle size={18} color="#C49A6C" className="shrink-0" />
        <p className="text-[13px] text-[#F0E8DC] leading-[1.5] flex-1">{message}</p>
        {actionLabel && onAction && (
          <button
            onClick={onAction}
            className="bg-[#C49A6C] text-[#0A0A0A] border-none rounded-md py-1.5 px-3 text-xs font-bold cursor-pointer shrink-0 whitespace-nowrap"
          >{actionLabel}</button>
        )}
      </div>
    </div>
  );
}
