import React from "react";
import ReactDOM from "react-dom/client";
import Popup from "./Popup";
import "../sidepanel/globals.css"; // Reuse sidepanel global CSS (compiled by Tailwind)

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Popup />
  </React.StrictMode>
);
