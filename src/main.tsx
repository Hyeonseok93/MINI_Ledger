import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import TitleBar from "./TitleBar";
import "./fonts.css";
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
