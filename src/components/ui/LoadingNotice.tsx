import { LOGO_ICON } from "../../assets/logos";

interface LoadingNoticeProps {
  label?: string;
  /** Fixed full-screen overlay, matching the app's initial-load screen (ClientLoader). Defaults to a smaller inline/section loader. */
  fullPage?: boolean;
}

export function LoadingNotice({ label = "Loading…", fullPage = false }: LoadingNoticeProps) {
  const boxSizeClass = fullPage ? "w-40 h-40" : "w-[72px] h-[72px]";
  const logoSizeClass = fullPage ? "w-[120px] h-[120px]" : "w-[52px] h-[52px]";
  const ringInsetClass = fullPage ? "-inset-2.5" : "-inset-1";

  const mark = (
    <div className={`${boxSizeClass} relative flex items-center justify-center`}>
      <div className={`absolute ${ringInsetClass} rounded-full border-[1.5px] border-gold opacity-0 [animation:ringExpand_2s_ease-out_infinite]`} />
      <div className={`absolute ${ringInsetClass} rounded-full border-[1.5px] border-gold opacity-0 [animation:ringExpand_2s_ease-out_0.6s_infinite]`} />
      <div className={`absolute ${ringInsetClass} rounded-full border-[1.5px] border-gold opacity-0 [animation:ringExpand_2s_ease-out_1.2s_infinite]`} />
      <img src={LOGO_ICON} alt="" className={`${logoSizeClass} rounded-full relative z-[2] [animation:loaderPulse_2s_ease-in-out_infinite]`} />
    </div>
  );

  if (fullPage) {
    return (
      <div className="fixed inset-0 z-[9999] bg-bg flex flex-col items-center justify-center gap-6">
        {mark}
        <span className="font-cursive text-[32px] text-gold opacity-70">{label}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-3.5 py-8">
      {mark}
      <span className="text-[13px] text-text-muted">{label}</span>
    </div>
  );
}
