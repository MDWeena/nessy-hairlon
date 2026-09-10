import { X } from "lucide-react";

interface ErrorNoticeProps {
  message: string;
}

export function ErrorNotice({ message }: ErrorNoticeProps) {
  return (
    <div style={{
      background: "#FEE2E2", border: "1px solid #FCA5A5", borderRadius: 8,
      padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#DC2626",
      display: "flex", alignItems: "center", gap: 8,
    }}>
      <X size={14} /> {message}
    </div>
  );
}
