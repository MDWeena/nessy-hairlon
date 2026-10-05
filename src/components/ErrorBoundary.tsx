import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { LOGO_ICON } from "../assets/logos";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * Top-level crash guard (wraps <App/> in main.tsx). Without this, any uncaught render
 * error anywhere in the tree unmounts the whole app and leaves a blank white screen —
 * the worst possible first impression for a paying customer trying to book. Deliberately
 * has no dependency on ThemeContext/useAuth/etc: if something is broken badly enough to
 * reach here, the fallback must not assume any of the app's own providers still work.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Uncaught render error:", error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="font-sans min-h-screen flex items-center justify-center bg-[#0A0A0A] px-6 text-center">
        <div>
          <img src={LOGO_ICON} alt="Nessy Hairlon" className="w-16 h-16 rounded-full mx-auto mb-5" />
          <h1 className="font-cursive text-[40px] font-bold text-white mb-2">
            Nessy <span className="text-[#C49A6C]">Hairlon</span>
          </h1>
          <p className="text-sm text-[#bbb] max-w-[380px] mx-auto mb-6 leading-[1.6]">
            Something went wrong loading this page. Please try returning home — if it
            keeps happening, reach out on WhatsApp and we'll sort it out.
          </p>
          <button
            onClick={() => { window.location.href = "/"; }}
            className="bg-[#C49A6C] text-[#0A0A0A] border-none py-3 px-8 text-sm font-bold cursor-pointer rounded-md"
          >Return Home</button>
        </div>
      </div>
    );
  }
}
