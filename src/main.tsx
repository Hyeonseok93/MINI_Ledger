import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import TitleBar from "./TitleBar";
import "pretendard/dist/web/variable/pretendardvariable.css";
import "@fontsource/ibm-plex-mono/latin-400.css";
import "@fontsource/ibm-plex-mono/latin-500.css";
import "./styles.css";
import { installDevMock } from "./devMock";

if (import.meta.env.DEV) installDevMock();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <div className="window">
      <TitleBar />
      <App />
    </div>
  </StrictMode>
);
