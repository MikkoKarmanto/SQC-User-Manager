import { useEffect } from "react";
import { CheckCircle2, XCircle, AlertCircle, X } from "lucide-react";

export type MessageType = "success" | "error" | "warning";

interface MessageBoxProps {
  type: MessageType;
  message: string;
  onDismiss?: () => void;
  autoDismiss?: boolean;
  autoDismissDelay?: number;
  className?: string;
}

function MessageBox({ type, message, onDismiss, autoDismiss = true, autoDismissDelay = 5000, className = "" }: MessageBoxProps) {
  useEffect(() => {
    if (autoDismiss && onDismiss) {
      const timer = setTimeout(() => {
        onDismiss();
      }, autoDismissDelay);
      return () => clearTimeout(timer);
    }
  }, [autoDismiss, autoDismissDelay, onDismiss]);

  const getStyles = () => {
    switch (type) {
      case "success":
        return "border-green-200 bg-green-50 text-green-900 dark:border-green-900 dark:bg-green-950 dark:text-green-100";
      case "error":
        return "border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-100";
      case "warning":
        return "border-yellow-200 bg-yellow-50 text-yellow-900 dark:border-yellow-900 dark:bg-yellow-950 dark:text-yellow-100";
    }
  };

  const getIcon = () => {
    switch (type) {
      case "success":
        return <CheckCircle2 className="h-5 w-5 flex-shrink-0" />;
      case "error":
        return <XCircle className="h-5 w-5 flex-shrink-0" />;
      case "warning":
        return <AlertCircle className="h-5 w-5 flex-shrink-0" />;
    }
  };

  return (
    <div className={`flex items-start gap-2 rounded-md border p-4 ${getStyles()} ${className}`}>
      {getIcon()}
      <div className="flex-1 text-sm">{message}</div>
      {onDismiss && (
        <button onClick={onDismiss} className="ml-2 p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded flex-shrink-0" aria-label="Dismiss">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

export default MessageBox;
