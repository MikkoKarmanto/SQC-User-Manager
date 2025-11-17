import "./BulkActionsBar.css";

interface BulkActionsBarProps {
  selectedCount: number;
  onGeneratePins: () => void;
  onGenerateOtps: () => void;
  onClearSelection: () => void;
  isProcessing?: boolean;
}

function BulkActionsBar({
  selectedCount,
  onGeneratePins,
  onGenerateOtps,
  onClearSelection,
  isProcessing = false,
}: BulkActionsBarProps) {
  if (selectedCount === 0) {
    return null;
  }

  return (
    <div className="bulk-actions-bar">
      <div className="bulk-info">
        <span className="bulk-count">
          {selectedCount} user{selectedCount !== 1 ? "s" : ""} selected
        </span>
      </div>

      <div className="bulk-buttons">
        <button
          type="button"
          className="bulk-btn bulk-btn-primary"
          onClick={onGeneratePins}
          disabled={isProcessing}
          title="Generate PINs for all selected users"
        >
          {isProcessing ? "Processing..." : "Generate PINs"}
        </button>

        <button
          type="button"
          className="bulk-btn bulk-btn-primary"
          onClick={onGenerateOtps}
          disabled={isProcessing}
          title="Generate OTPs for all selected users"
        >
          {isProcessing ? "Processing..." : "Generate OTPs"}
        </button>

        <button type="button" className="bulk-btn bulk-btn-secondary" onClick={onClearSelection} disabled={isProcessing} title="Clear selection">
          Clear Selection
        </button>
      </div>
    </div>
  );
}

export default BulkActionsBar;
