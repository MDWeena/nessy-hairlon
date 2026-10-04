import { LOGO_ICON } from "../../assets/logos";

export function ClientLoader() {
  return (
    <div className="fixed inset-0 z-[9999] bg-bg flex flex-col items-center justify-center gap-6">
      <div className="w-40 h-40 relative flex items-center justify-center">
        <div className="absolute -inset-2.5 rounded-full border-[1.5px] border-gold opacity-0 [animation:ringExpand_2s_ease-out_infinite]" />
        <div className="absolute -inset-2.5 rounded-full border-[1.5px] border-gold opacity-0 [animation:ringExpand_2s_ease-out_0.6s_infinite]" />
        <div className="absolute -inset-2.5 rounded-full border-[1.5px] border-gold opacity-0 [animation:ringExpand_2s_ease-out_1.2s_infinite]" />
        <img src={LOGO_ICON} alt="" className="w-[120px] h-[120px] rounded-full relative z-[2] [animation:loaderPulse_2s_ease-in-out_infinite]" />
      </div>
      <span className="font-cursive text-[32px] text-gold opacity-70">Loading...</span>
    </div>
  );
}
