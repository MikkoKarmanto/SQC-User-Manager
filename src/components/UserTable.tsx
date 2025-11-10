import { useMemo } from "react";
import type { SafeQUser } from "../types/safeq";
import "./UserTable.css";

interface UserTableProps {
  users: SafeQUser[];
  onUserSelect?: (user: SafeQUser) => void;
}

function UserTable({ users, onUserSelect }: UserTableProps) {
  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) => {
      const nameA = a.userName?.toLowerCase() || "";
      const nameB = b.userName?.toLowerCase() || "";
      return nameA.localeCompare(nameB);
    });
  }, [users]);

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
            <th>Username</th>
            <th>Full Name</th>
            <th>Email</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {sortedUsers.map((user) => (
            <tr key={user.id}>
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
        </span>
      </div>
    </div>
  );
}

export default UserTable;
