import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";
import AuthGate from "./components/AuthGate";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthGate>
      {({ user, logout }) => <App key={user.id} authUser={user} onLogout={logout} />}
    </AuthGate>
  </React.StrictMode>
);