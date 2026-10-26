import { RefreshCw } from "lucide-react";
import { reloadPreservingDrafts } from "../../lib/formDrafts";

interface RefreshPromptProps {
  message: string;
  /** Defaults to saving every open form and reloading onto the latest build. */
  onRefresh?: () => void;
}

/** Shown when this copy of the site is out of date: one tap saves the form and reloads. */
export function RefreshPrompt({ message, onRefresh = () => reloadPreservingDrafts() }: RefreshPromptProps) {
  return (
    <div role="alert" data-testid="refresh-prompt" className="bg-gold-bg border border-[#C49A6C40] rounded-lg py-3 px-3.5 mb-4 grid gap-2.5">
      <p className="m-0 text-[13px] text-text leading-[1.5]">{message}</p>
      <button
        type="button" onClick={onRefresh}
        className="w-full sm:w-fit min-h-11 sm:min-h-0 bg-gold text-theme-black border-none py-2 px-4 rounded-md text-[13px] font-bold cursor-pointer flex items-center justify-center gap-2"
      ><RefreshCw size={14} aria-hidden="true" /> Refresh and continue</button>
    </div>
  );
}
