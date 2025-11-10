import { ReactNode } from "react";
import "./Tabs.css";

export interface Tab {
  id: string;
  label: string;
  badge?: number;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  children: ReactNode;
}

function Tabs({ tabs, activeTab, onTabChange, children }: TabsProps) {
  return (
    <div className="tabs-container">
      <div className="tabs-header">
        {tabs.map((tab) => (
          <button key={tab.id} type="button" className={`tab-button ${activeTab === tab.id ? "active" : ""}`} onClick={() => onTabChange(tab.id)}>
            {tab.label}
            {tab.badge !== undefined && tab.badge > 0 && <span className="tab-badge">{tab.badge}</span>}
          </button>
        ))}
      </div>
      <div className="tabs-content">{children}</div>
    </div>
  );
}

export default Tabs;
