import ReactDOM from "react-dom/client";
import SplashScreen from "./components/SplashScreen";
import "./index.css";
import { invoke } from "@tauri-apps/api/core";

function SplashApp() {
  const handleComplete = async () => {
    try {
      await invoke("close_splashscreen");
    } catch (error) {
      console.error("Failed to close splashscreen:", error);
    }
  };

  return <SplashScreen onComplete={handleComplete} />;
}

ReactDOM.createRoot(document.getElementById("splash-root") as HTMLElement).render(<SplashApp />);
