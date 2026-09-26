import { useEffect, useState } from "react";
import ledgerIcon from "../assets/ledger-icon-bold.png";

export default function TitleBar() {
  const [maximized, setMaximized] = useState(false);
  const controls = window.windowControls;

  useEffect(() => {
    if (!controls) return;
    controls.isMaximized().then(setMaximized);
    return controls.onMaximizedChange(setMaximized);
  }, [controls]);

  return (
    <header className="titlebar">
      <div className="titlebar-brand">
        <img src={ledgerIcon} alt="" />
        <span>Ledger</span>
      </div>
      <div className="titlebar-controls">
        <button type="button" aria-label="최소화" onClick={() => controls?.minimize()}>
          <svg viewBox="0 0 10 10" aria-hidden="true">
            <path d="M0 5h10" />
          </svg>
        </button>
        <button
          type="button"
          aria-label={maximized ? "이전 크기로" : "최대화"}
          onClick={() => controls?.toggleMaximize()}
        >
          {maximized ? (
            <svg viewBox="0 0 10 10" aria-hidden="true">
              <path d="M2.5 2.5V0.5h7v7h-2" />
              <rect x="0.5" y="2.5" width="7" height="7" />
            </svg>
          ) : (
            <svg viewBox="0 0 10 10" aria-hidden="true">
              <rect x="0.5" y="0.5" width="9" height="9" />
            </svg>
          )}
        </button>
        <button
          type="button"
          className="close"
          aria-label="닫기"
          onClick={() => controls?.close()}
        >
          <svg viewBox="0 0 10 10" aria-hidden="true">
            <path d="M0.5 0.5l9 9M9.5 0.5l-9 9" />
          </svg>
        </button>
      </div>
    </header>
  );
}
