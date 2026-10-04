import { X } from "lucide-react";

interface ErrorNoticeProps {
  message: string;
}

export function ErrorNotice({ message }: ErrorNoticeProps) {
  return (
    <div className="bg-[#FEE2E2] border border-[#FCA5A5] rounded-lg py-2.5 px-3.5 mb-4 text-[13px] text-[#DC2626] flex items-center gap-2">
      <X size={14} /> {message}
    </div>
  );
}
