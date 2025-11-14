import { useState } from "react";
import type { SafeQUser } from "../types/safeq";
import { updateUserCard, updateUserPin, updateUserShortId, generateUserPin, generateUserOtp } from "../services/safeqClient";
import "./EditUserModal.css";

interface EditUserModalProps {
  user: SafeQUser | null;
  onClose: () => void;
  onSuccess: () => void;
}

function EditUserModal({ user, onClose, onSuccess }: EditUserModalProps) {
  const [cards, setCards] = useState<string[]>([]);
  const [newCard, setNewCard] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [generatedOtp, setGeneratedOtp] = useState<string | null>(null);

  if (!user) {
    return null;
  }

  // Initialize state when user changes
  const currentCards = user.cards || [];
  const currentShortId = user.shortId || "";

  const handleAddCard = () => {
    if (newCard.trim() && !cards.includes(newCard.trim())) {
      setCards([...cards, newCard.trim()]);
      setNewCard("");
    }
  };

  const handleDeleteCard = async (cardId: string) => {
    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      // Delete by sending null
      await updateUserCard(user.userName, user.providerId || null, null);
      setSuccessMessage(`Card ${cardId} deleted successfully`);
      // Refresh data but keep modal open
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete card");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveCard = async (cardId: string) => {
    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      await updateUserCard(user.userName, user.providerId || null, cardId);
      setSuccessMessage("Card updated successfully");
      setNewCard("");
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update card");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGeneratePin = async () => {
    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      await generateUserPin(user.userName, user.providerId || null);
      setSuccessMessage("PIN generated successfully");
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate PIN");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePin = async () => {
    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      await updateUserPin(user.userName, user.providerId || null, null);
      setSuccessMessage("PIN deleted successfully");
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete PIN");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGenerateOtp = async () => {
    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const result = await generateUserOtp(user.userName, user.providerId || null);
      setGeneratedOtp(result.otp);
      setSuccessMessage(`OTP generated successfully: ${result.otp}`);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate OTP");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteOtp = async () => {
    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      await updateUserShortId(user.userName, user.providerId || null, null);
      setGeneratedOtp(null);
      setSuccessMessage("OTP deleted successfully");
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete OTP");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content edit-modal" onClick={(e) => e.stopPropagation()}>
        {isSubmitting && (
          <div className="loading-overlay">
            <div className="spinner"></div>
            <span>Processing...</span>
          </div>
        )}

        <div className="modal-header">
          <h3>User Details: {user.userName}</h3>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="modal-body">
          {error && <div className="status error">{error}</div>}
          {successMessage && <div className="status success">{successMessage}</div>}

          {/* Read-only User Information */}
          <div className="edit-section">
            <h4>User Information</h4>
            <div className="info-grid">
              <div className="info-item">
                <span className="info-label">Username:</span>
                <span className="info-value">{user.userName || "—"}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Full Name:</span>
                <span className="info-value">{user.fullName || "—"}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Email:</span>
                <span className="info-value">{user.email || "—"}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Department:</span>
                <span className="info-value">{user.department || "—"}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Status:</span>
                <span className="info-value">
                  <span className={`status-badge ${user.isExpired === false ? "enabled" : "disabled"}`}>
                    {user.isExpired === false ? "Active" : user.isExpired === true ? "Expired" : "Active"}
                  </span>
                </span>
              </div>
              <div className="info-item">
                <span className="info-label">Groups:</span>
                <span className="info-value">
                  {user.groupIds && user.groupIds.length > 0 ? `${user.groupIds.length} group${user.groupIds.length !== 1 ? "s" : ""}` : "—"}
                </span>
              </div>
            </div>
          </div>

          {/* Cards Section */}
          <div className="edit-section">
            <h4>Card Management</h4>
            <div className="cards-list">
              {currentCards.length > 0 ? (
                currentCards.map((card) => (
                  <div key={card} className="card-item">
                    <span className="card-id">{card}</span>
                    <button type="button" className="btn-small btn-danger" onClick={() => handleDeleteCard(card)} disabled={isSubmitting}>
                      Delete
                    </button>
                  </div>
                ))
              ) : (
                <p className="helper-text">No cards assigned</p>
              )}
            </div>

            <div className="add-card-form">
              <input
                type="text"
                placeholder="Enter new card ID"
                value={newCard}
                onChange={(e) => setNewCard(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddCard()}
                disabled={isSubmitting}
              />
              <button type="button" onClick={() => handleSaveCard(newCard)} disabled={isSubmitting || !newCard.trim()}>
                Add Card
              </button>
            </div>
          </div>

          {/* PIN Section */}
          <div className="edit-section">
            <h4>PIN</h4>
            <div className="field-row">
              <span className="field-value">{currentShortId || "Not set"}</span>
              <div className="field-actions">
                <button type="button" onClick={handleGeneratePin} disabled={isSubmitting}>
                  Generate New
                </button>
                {currentShortId && (
                  <button type="button" className="btn-danger" onClick={handleDeletePin} disabled={isSubmitting}>
                    Delete
                  </button>
                )}
              </div>
            </div>
            <p className="helper-text">PIN is a numeric code</p>
          </div>

          {/* OTP Section */}
          <div className="edit-section">
            <h4>OTP</h4>
            {generatedOtp ? (
              <div className="field-row">
                <span className="field-value" style={{ fontFamily: "monospace", fontSize: "16px", fontWeight: 600 }}>
                  {generatedOtp}
                </span>
                <div className="field-actions">
                  <button type="button" onClick={handleGenerateOtp} disabled={isSubmitting}>
                    Generate New
                  </button>
                  <button type="button" className="btn-danger" onClick={handleDeleteOtp} disabled={isSubmitting}>
                    Delete
                  </button>
                </div>
              </div>
            ) : (
              <div className="field-row">
                <span className="field-value helper-text">Click Generate to create an OTP</span>
                <div className="field-actions">
                  <button type="button" onClick={handleGenerateOtp} disabled={isSubmitting}>
                    Generate OTP
                  </button>
                  <button type="button" className="btn-danger" onClick={handleDeleteOtp} disabled={isSubmitting}>
                    Delete
                  </button>
                </div>
              </div>
            )}
            <p className="helper-text">OTP is an alphanumeric code</p>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" onClick={onClose} disabled={isSubmitting}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default EditUserModal;
