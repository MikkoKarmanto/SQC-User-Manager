import type { SafeQUser } from "../types/safeq";
import "./UserDetailsModal.css";

interface UserDetailsModalProps {
  user: SafeQUser | null;
  onClose: () => void;
}

function UserDetailsModal({ user, onClose }: UserDetailsModalProps) {
  if (!user) {
    return null;
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>User Details</h3>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="modal-body">
          <div className="detail-section">
            <h4>Basic Information</h4>
            <dl className="detail-list">
              <dt>Username</dt>
              <dd className="mono">{user.userName || "—"}</dd>

              <dt>Full Name</dt>
              <dd>{user.fullName || "—"}</dd>

              <dt>Email</dt>
              <dd className="mono">{user.email || "—"}</dd>

              <dt>ID</dt>
              <dd className="mono">{user.id}</dd>

              <dt>Short ID</dt>
              <dd className="mono">{user.shortId || "—"}</dd>

              <dt>Department</dt>
              <dd>{user.department || "—"}</dd>

              <dt>Status</dt>
              <dd>
                <span className={`status-badge ${user.isExpired === false ? "enabled" : "disabled"}`}>
                  {user.isExpired === false ? "Active" : user.isExpired === true ? "Expired" : "Active"}
                </span>
              </dd>

              <dt>Created Date</dt>
              <dd>{user.createdDate ? new Date(user.createdDate).toLocaleString() : "—"}</dd>
            </dl>
          </div>

          {user.groupIds && user.groupIds.length > 0 && (
            <div className="detail-section">
              <h4>Groups ({user.groupIds.length})</h4>
              <ul className="group-list">
                {user.groupIds.map((groupId) => (
                  <li key={groupId} className="group-item">
                    Group ID: {groupId}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {user.cards && user.cards.length > 0 && (
            <div className="detail-section">
              <h4>Cards ({user.cards.length})</h4>
              <ul className="group-list">
                {user.cards.map((card, index) => (
                  <li key={index} className="group-item">
                    {card}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="detail-section">
            <h4>Raw JSON</h4>
            <pre className="json-preview">{JSON.stringify(user, null, 2)}</pre>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default UserDetailsModal;
