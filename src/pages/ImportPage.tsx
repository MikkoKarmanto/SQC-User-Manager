import { useState, useCallback, useEffect } from "react";
import type { ImportUser, SafeQAuthProvider } from "../types/safeq";
import { parseCsv, readFileAsText } from "../utils/csvParser";
import ImportGrid from "../components/ImportGrid";
import { createUsers, listAuthProviders } from "../services/safeqClient";

function ImportPage() {
  const [users, setUsers] = useState<ImportUser[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [parseWarnings, setParseWarnings] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{ success: number; failed: number } | null>(null);
  const [providers, setProviders] = useState<SafeQAuthProvider[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState<number | null>(null);
  const [autoGeneratePin, setAutoGeneratePin] = useState(false);
  const [autoGenerateOtp, setAutoGenerateOtp] = useState(false);

  useEffect(() => {
    const fetchProviders = async () => {
      try {
        const response = await listAuthProviders();
        const providersList = Array.isArray(response) ? (response as SafeQAuthProvider[]) : [];
        setProviders(providersList);
        if (providersList.length > 0) {
          setSelectedProviderId(providersList[0].id);
        }
      } catch (error) {
        console.error("Failed to load providers:", error);
      }
    };
    fetchProviders();
  }, []);

  const handleFileSelect = useCallback(async (file: File) => {
    if (!file.name.endsWith(".csv")) {
      setParseErrors(["Please select a CSV file"]);
      return;
    }

    try {
      const content = await readFileAsText(file);
      const result = parseCsv(content);

      setUsers(result.users);
      setParseErrors(result.errors);
      setParseWarnings(result.warnings);
      setUploadStatus(null);
    } catch (error) {
      setParseErrors([`Failed to read file: ${error instanceof Error ? error.message : "Unknown error"}`]);
    }
  }, []);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleUpload = async () => {
    const validUsers = users.filter((u) => u.isValid);
    if (validUsers.length === 0) {
      alert("No valid users to upload");
      return;
    }

    if (!confirm(`Upload ${validUsers.length} user(s) to SafeQ Cloud?`)) {
      return;
    }

    // Apply default provider ID to users without one
    const usersWithProvider = validUsers.map((user) => ({
      ...user,
      providerId: user.providerId ?? selectedProviderId ?? undefined,
    }));

    setIsUploading(true);
    setUploadStatus(null);

    try {
      const result = await createUsers(usersWithProvider, autoGeneratePin, autoGenerateOtp);
      setUploadStatus(result);

      if (result.failed === 0) {
        // Clear successful users
        setUsers(users.filter((u) => !u.isValid));
      }
    } catch (error) {
      alert(`Upload failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleClear = () => {
    if (users.length > 0 && !confirm("Clear all imported users?")) {
      return;
    }

    setUsers([]);
    setParseErrors([]);
    setParseWarnings([]);
    setUploadStatus(null);
  };

  const validCount = users.filter((u) => u.isValid).length;

  return (
    <section className="page">
      <header className="page-header">
        <h2>Import Users</h2>
        <p>Bulk import users from a CSV file. Upload, review, edit, and create users in SafeQ Cloud.</p>
      </header>

      <div className="card">
        <div
          className={`drop-zone ${isDragging ? "drop-zone-active" : ""}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <div className="drop-zone-content">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <p className="drop-zone-title">Drag and drop CSV file here</p>
            <p className="drop-zone-subtitle">or</p>
            <label className="btn-file">
              Browse Files
              <input type="file" accept=".csv" onChange={handleFileInputChange} style={{ display: "none" }} />
            </label>
          </div>
        </div>

        {parseErrors.length > 0 && (
          <div className="status error" style={{ marginTop: "16px" }}>
            <strong>Parsing Errors:</strong>
            <ul style={{ marginTop: "8px", paddingLeft: "20px" }}>
              {parseErrors.map((error, i) => (
                <li key={i}>{error}</li>
              ))}
            </ul>
          </div>
        )}

        {parseWarnings.length > 0 && (
          <div className="status warning" style={{ marginTop: "16px" }}>
            <strong>Parsing Info:</strong>
            <ul style={{ marginTop: "8px", paddingLeft: "20px" }}>
              {parseWarnings.map((warning, i) => (
                <li key={i}>{warning}</li>
              ))}
            </ul>
          </div>
        )}

        {uploadStatus && (
          <div className={`status ${uploadStatus.failed === 0 ? "success" : "warning"}`} style={{ marginTop: "16px" }}>
            Upload complete: {uploadStatus.success} succeeded, {uploadStatus.failed} failed
          </div>
        )}
      </div>

      <div className="card" style={{ marginTop: "24px" }}>
        <div className="card-actions">
          <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontWeight: 500 }}>Default Provider:</span>
              <select
                value={selectedProviderId || ""}
                onChange={(e) => setSelectedProviderId(e.target.value ? parseInt(e.target.value, 10) : null)}
                style={{ padding: "8px 12px", borderRadius: "6px", border: "1px solid #d1d5db" }}
              >
                <option value="">None (use CSV value)</option>
                {providers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={autoGeneratePin}
                onChange={(e) => setAutoGeneratePin(e.target.checked)}
                style={{ cursor: "pointer" }}
              />
              <span>Auto-generate PIN if empty</span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={autoGenerateOtp}
                onChange={(e) => setAutoGenerateOtp(e.target.checked)}
                style={{ cursor: "pointer" }}
              />
              <span>Auto-generate OTP if empty</span>
            </label>
            <div style={{ marginLeft: "auto", display: "flex", gap: "12px" }}>
              <button type="button" onClick={handleUpload} disabled={isUploading || validCount === 0}>
                {isUploading ? "Uploading..." : `Upload ${validCount} Valid User(s)`}
              </button>
              <button type="button" onClick={handleClear} disabled={isUploading}>
                Clear All
              </button>
            </div>
          </div>
        </div>

          <ImportGrid users={users} onUpdate={setUsers} />
        </div>

      <div className="card" style={{ marginTop: "24px" }}>
        <h3>CSV Format</h3>
        <p style={{ marginTop: "8px", color: "#6b7280" }}>Your CSV file should include the following columns (delimiter will be auto-detected):</p>
        <ul style={{ marginTop: "12px", paddingLeft: "20px", color: "#6b7280" }}>
          <li>
            <strong>UPN</strong> or <strong>Username</strong> (required)
          </li>
          <li>
            <strong>FullName</strong> (optional)
          </li>
          <li>
            <strong>EmailAddress</strong> or <strong>Email</strong> (optional)
          </li>
          <li>
            <strong>CardID</strong> (optional)
          </li>
          <li>
            <strong>ShortID</strong> or <strong>PIN</strong> (optional - numeric code, detailtype=5)
          </li>
          <li>
            <strong>OTP</strong> (optional - alphanumeric code, detailtype=10)
          </li>
          <li>
            <strong>PID</strong> or <strong>ProviderID</strong> (optional - authentication provider ID, or use dropdown above)
          </li>
        </ul>
      </div>
    </section>
  );
}

export default ImportPage;
