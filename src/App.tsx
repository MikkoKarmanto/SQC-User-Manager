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
                <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 120 120" className="text-black-600">
                  <circle cx="60" cy="60" r="58" fill="currentColor" opacity="0.1" />
                  <g transform="translate(30, 35)">
                    <circle cx="15" cy="12" r="8" fill="currentColor" opacity="0.8" />
                    <path d="M 5 32 Q 5 22 15 22 Q 25 22 25 32 L 5 32" fill="currentColor" opacity="0.8" />
                    <circle cx="45" cy="12" r="8" fill="currentColor" opacity="0.8" />
                    <path d="M 35 32 Q 35 22 45 22 Q 55 22 55 32 L 35 32" fill="currentColor" opacity="0.8" />
                    <line x1="25" y1="27" x2="35" y2="27" stroke="currentColor" strokeWidth="2" opacity="0.6" />
                  </g>
                  <g transform="translate(75, 75)" opacity="0.7">
                    <circle cx="12" cy="12" r="6" fill="none" stroke="currentColor" strokeWidth="2" />
                    <circle cx="12" cy="12" r="3" fill="currentColor" />
                    <line x1="12" y1="3" x2="12" y2="6" stroke="currentColor" strokeWidth="2" />
                    <line x1="12" y1="18" x2="12" y2="21" stroke="currentColor" strokeWidth="2" />
                    <line x1="3" y1="12" x2="6" y2="12" stroke="currentColor" strokeWidth="2" />
                    <line x1="18" y1="12" x2="21" y2="12" stroke="currentColor" strokeWidth="2" />
                  </g>
                </svg>
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
