import { HashRouter, NavLink, Route, Routes } from "react-router-dom";
import UsersPage from "./pages/UsersPage";
import SettingsPage from "./pages/SettingsPage";
import ImportPage from "./pages/ImportPage";
import { Users, Upload, Settings } from "lucide-react";

function App() {
  return (
    <HashRouter>
      <div className="flex h-screen flex-col bg-background">
        <header className="border-b bg-card">
          <div className="container mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img src="/tauri.svg" alt="SAFEQ" className="h-10 w-10" />
                <div>
                  <h1 className="text-xl font-bold tracking-tight">SAFEQ Cloud User Manager</h1>
                  <p className="text-sm text-muted-foreground">Manage tenant users from a single desktop tool</p>
                </div>
              </div>
            </div>
            <nav className="mt-4 flex gap-1">
              <NavLink
                to="/"
                end
                className={({ isActive }) =>
                  `flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  }`
                }
              >
                <Users className="h-4 w-4" />
                Users
              </NavLink>
              <NavLink
                to="/import"
                className={({ isActive }) =>
                  `flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  }`
                }
              >
                <Upload className="h-4 w-4" />
                Import
              </NavLink>
              <NavLink
                to="/settings"
                className={({ isActive }) =>
                  `flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  }`
                }
              >
                <Settings className="h-4 w-4" />
                Settings
              </NavLink>
            </nav>
          </div>
        </header>
        <main className="flex-1 overflow-auto">
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
