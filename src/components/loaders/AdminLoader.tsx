import { LOGO_ICON } from "../../assets/logos";
import { useTheme } from "../../context/ThemeContext";

export function AdminLoader() {
  const { t } = useTheme();
  return (
    <div className="fixed inset-0 z-[9999] bg-bg flex flex-col items-center justify-center gap-6">
      <div className="w-40 h-40 relative flex items-center justify-center">
        <div className="absolute inset-0 rounded-full" style={{ border: `1px solid ${t.gold}15` }} />
        <div className="absolute inset-2.5 rounded-full" style={{ border: `1px solid ${t.gold}10` }} />
        <div
          className="absolute inset-0 rounded-full border-[2.5px] border-transparent [animation:loaderSpin_1.4s_linear_infinite]"
          style={{ borderTopColor: t.gold, borderBottomColor: `${t.gold}30` }}
        />
        <div
          className="absolute inset-2.5 rounded-full border-2 border-transparent [animation:loaderSpin_2s_linear_infinite_reverse]"
          style={{ borderLeftColor: "#D4B896", borderRightColor: "#D4B89640" }}
        />
        <img src={LOGO_ICON} alt="" className="w-[100px] h-[100px] rounded-full relative z-[2] [animation:loaderPulseAdmin_2.4s_ease-in-out_infinite]" />
      </div>
      <span className="text-sm text-text-muted">Loading...</span>
    </div>
  );
}
