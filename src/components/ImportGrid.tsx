import { useState } from "react";
import type { ImportUser } from "../types/safeq";
import { validateImportUser } from "../types/safeq";
import "./ImportGrid.css";

interface ImportGridProps {
  users: ImportUser[];
  onUpdate: (users: ImportUser[]) => void;
}

function ImportGrid({ users, onUpdate }: ImportGridProps) {
  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState("");

  const editableFields: (keyof ImportUser)[] = ["userName", "fullName", "email", "cardId", "shortId", "otp", "providerId"];

  const moveToNextField = (currentUserId: string, currentField: string, direction: "next" | "prev" = "next") => {
    const currentFieldIndex = editableFields.indexOf(currentField as keyof ImportUser);
    const currentUserIndex = users.findIndex((u) => u.id === currentUserId);

    if (currentFieldIndex === -1 || currentUserIndex === -1) return;

    let nextFieldIndex = direction === "next" ? currentFieldIndex + 1 : currentFieldIndex - 1;
    let nextUserIndex = currentUserIndex;

    // Move to next row if at end of fields
    if (nextFieldIndex >= editableFields.length) {
      nextFieldIndex = 0;
      nextUserIndex = currentUserIndex + 1;
    } else if (nextFieldIndex < 0) {
      nextFieldIndex = editableFields.length - 1;
      nextUserIndex = currentUserIndex - 1;
    }

    // Check if there's a next user
    if (nextUserIndex >= 0 && nextUserIndex < users.length) {
      const nextUser = users[nextUserIndex];
      const nextField = editableFields[nextFieldIndex];
      handleCellClick(nextUser, nextField);
    }
  };

  const handleCellClick = (user: ImportUser, field: string) => {
    setEditingCell({ id: user.id, field });
    const value = (user as any)[field];
    setEditValue(value !== undefined ? String(value) : "");
  };

  const handleCellBlur = () => {
    if (!editingCell) return;

    const updatedUsers = users.map((user) => {
      if (user.id !== editingCell.id) return user;

      const updated = { ...user };
      if (editingCell.field === "providerId") {
        const parsed = parseInt(editValue, 10);
        (updated as any)[editingCell.field] = isNaN(parsed) ? undefined : parsed;
      } else {
        (updated as any)[editingCell.field] = editValue;
      }

      // Revalidate
      const errors = validateImportUser(updated);
      updated.errors = errors;
      updated.isValid = errors.length === 0;

      return updated;
    });

    onUpdate(updatedUsers);
    setEditingCell(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!editingCell) return;

    if (e.key === "Tab") {
      e.preventDefault();
      handleCellBlur();
      moveToNextField(editingCell.id, editingCell.field, e.shiftKey ? "prev" : "next");
    } else if (e.key === "Enter") {
      handleCellBlur();
    } else if (e.key === "Escape") {
      setEditingCell(null);
    }
  };

  const handleAddRow = () => {
    const newUser: ImportUser = {
      id: crypto.randomUUID(),
      userName: "",
      fullName: "",
      email: "",
      cardId: "",
      shortId: "",
      otp: "",
      providerId: undefined,
      errors: ["Username is required"],
      isValid: false,
    };
    onUpdate([...users, newUser]);
  };

  const handleDeleteRow = (id: string) => {
    onUpdate(users.filter((u) => u.id !== id));
  };

  const renderCell = (user: ImportUser, field: keyof ImportUser) => {
    if (field === "errors" || field === "isValid" || field === "id") return null;

    const isEditing = editingCell?.id === user.id && editingCell?.field === field;
    const value = (user as any)[field];
    const displayValue = value !== undefined && value !== null ? String(value) : "";
    const hasError = !user.isValid && field === "userName" && !user.userName;

    return (
      <td key={field} className={hasError ? "cell-error" : ""}>
        {isEditing ? (
          <input
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleCellBlur}
            onKeyDown={handleKeyDown}
            autoFocus
            className="cell-input"
          />
        ) : (
          <div className="cell-content" onClick={() => handleCellClick(user, field)} title={displayValue}>
            {displayValue || <span className="cell-empty">—</span>}
          </div>
        )}
      </td>
    );
  };

  return (
    <div className="import-grid-container">
      <div className="grid-actions">
        <button type="button" onClick={handleAddRow}>
          Add Row
        </button>
        <span className="grid-stats">
          {users.length} user(s) • {users.filter((u) => u.isValid).length} valid • {users.filter((u) => !u.isValid).length} with errors
        </span>
      </div>

      <div className="grid-wrapper">
        <table className="import-grid">
          <thead>
            <tr>
              <th>Username</th>
              <th>Full Name</th>
              <th>Email</th>
              <th>Card ID</th>
              <th>Short ID/PIN</th>
              <th>OTP</th>
              <th>Provider ID</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan={9} className="empty-message">
                  No users imported yet. Upload a CSV file to get started.
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id} className={!user.isValid ? "row-invalid" : ""}>
                  {renderCell(user, "userName")}
                  {renderCell(user, "fullName")}
                  {renderCell(user, "email")}
                  {renderCell(user, "cardId")}
                  {renderCell(user, "shortId")}
                  {renderCell(user, "otp")}
                  {renderCell(user, "providerId")}
                  <td>
                    {user.isValid ? (
                      <span className="status-badge status-valid">Valid</span>
                    ) : (
                      <span className="status-badge status-error" title={user.errors.join(", ")}>
                        {user.errors.length} error(s)
                      </span>
                    )}
                  </td>
                  <td>
                    <button type="button" className="btn-small btn-danger" onClick={() => handleDeleteRow(user.id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ImportGrid;
