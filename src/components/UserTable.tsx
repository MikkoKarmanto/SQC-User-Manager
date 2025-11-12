import { useMemo } from "react";
import type { SafeQUser } from "../types/safeq";
import "./UserTable.css";

interface UserTableProps {
  users: SafeQUser[];
  onUserSelect?: (user: SafeQUser) => void;
  selectedUserIds?: Set<number>;
  onSelectionChange?: (selectedIds: Set<number>) => void;
}

function UserTable({ users, onUserSelect, selectedUserIds = new Set(), onSelectionChange }: UserTableProps) {
  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) => {
      const nameA = a.userName?.toLowerCase() || "";
      const nameB = b.userName?.toLowerCase() || "";
      return nameA.localeCompare(nameB);
    });
  }, [users]);

  const handleSelectAll = (checked: boolean) => {
    if (!onSelectionChange) return;
    
    if (checked) {
      const allIds = new Set(sortedUsers.map(u => u.id));
      onSelectionChange(allIds);
    } else {
      onSelectionChange(new Set());
    }
  };

  const handleSelectUser = (userId: number, checked: boolean) => {
    if (!onSelectionChange) return;
    
    const newSelection = new Set(selectedUserIds);
    if (checked) {
      newSelection.add(userId);
    } else {
      newSelection.delete(userId);
    }
    onSelectionChange(newSelection);
  };

  const allSelected = sortedUsers.length > 0 && sortedUsers.every(u => selectedUserIds.has(u.id));
  const someSelected = sortedUsers.some(u => selectedUserIds.has(u.id)) && !allSelected;

  if (users.length === 0) {
    return (
      <div className="empty-state">
        <p>No users found.</p>
        <p className="helper-text">Users from your SafeQ Cloud tenant will appear here.</p>
      </div>
    );
  }

  return (
    <div className="user-table-container">
      <table className="user-table">
        <thead>
          <tr>
            {onSelectionChange && (
              <th className="checkbox-column">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(input) => {
                    if (input) {
                      input.indeterminate = someSelected;
                    }
                  }}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  title={allSelected ? "Deselect all" : "Select all"}
                />
              </th>
            )}
            <th>Username</th>
            <th>Full Name</th>
            <th>Email</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {sortedUsers.map((user) => (
            <tr key={user.id} className={selectedUserIds.has(user.id) ? "selected" : ""}>
              {onSelectionChange && (
                <td className="checkbox-column">
                  <input
                    type="checkbox"
                    checked={selectedUserIds.has(user.id)}
                    onChange={(e) => handleSelectUser(user.id, e.target.checked)}
                    title={`Select ${user.userName}`}
                  />
                </td>
              )}
              <td className="username">{user.userName || "—"}</td>
              <td>{user.fullName || "—"}</td>
              <td className="email">{user.email || "—"}</td>
              <td className="actions">
                <button type="button" className="btn-small btn-primary" onClick={() => onUserSelect?.(user)} title="View and edit user">
                  Details
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="table-footer">
        <span className="user-count">
          {users.length} user{users.length !== 1 ? "s" : ""}
          {onSelectionChange && selectedUserIds.size > 0 && (
            <> • {selectedUserIds.size} selected</>
          )}
        </span>
      </div>
    </div>
  );
}

export default UserTable;
