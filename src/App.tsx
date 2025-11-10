import { HashRouter, NavLink, Route, Routes } from "react-router-dom";
import UsersPage from "./pages/UsersPage";
import SettingsPage from "./pages/SettingsPage";
import ImportPage from "./pages/ImportPage";
import "./App.css";

function App() {
  return (
    <HashRouter>
      <div className="app-shell">
        <header className="app-header">
          <div className="app-brand">
            <img src="/tauri.svg" alt="SAFEQ" className="brand-mark" />
            <div>
              <h1>SAFEQ Cloud User Manager</h1>
              <p>Manage tenant users and credentials from a single desktop tool.</p>
            </div>
          </div>
          <nav className="app-nav">
            <NavLink to="/" end>
              Users
            </NavLink>
            <NavLink to="/import">Import</NavLink>
            <NavLink to="/settings">Settings</NavLink>
          </nav>
        </header>
        <main className="app-main">
          <Routes>
            <Route path="/" element={<UsersPage />} />
            <Route path="/import" element={<ImportPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  );
}

export default App;
