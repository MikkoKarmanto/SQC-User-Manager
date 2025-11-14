import { useState, useCallback, useEffect } from "react";
import type { ImportUser, SafeQAuthProvider } from "../types/safeq";
import { parseCsv, readFileAsText } from "../utils/csvParser";
import ImportGrid from "../components/ImportGrid";
import { createUsers, listAuthProviders } from "../services/safeqClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Upload, X, AlertCircle, CheckCircle2, AlertTriangle } from "lucide-react";

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
    <div className="container mx-auto max-w-7xl p-6">
      <div className="mb-6">
        <h2 className="text-3xl font-bold tracking-tight">Import Users</h2>
        <p className="mt-2 text-muted-foreground">Bulk import users from a CSV file. Upload, review, edit, and create users in SafeQ Cloud.</p>
      </div>

      <Card className="mb-6">
        <CardContent className="pt-6">
          <div
            className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 transition-colors ${
              isDragging
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25 hover:border-primary hover:bg-accent"
            }`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <Upload className="mb-4 h-12 w-12 text-muted-foreground" />
            <p className="mb-2 text-lg font-medium">Drag and drop CSV file here</p>
            <p className="mb-4 text-sm text-muted-foreground">or</p>
            <label htmlFor="file-upload">
              <Button variant="secondary" type="button" onClick={() => document.getElementById('file-upload')?.click()}>
                Browse Files
              </Button>
              <input id="file-upload" type="file" accept=".csv" onChange={handleFileInputChange} className="hidden" />
            </label>
          </div>

          {parseErrors.length > 0 && (
            <div className="mt-4 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-4 text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-100">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <div className="flex-1">
                <strong>Parsing Errors:</strong>
                <ul className="mt-2 list-inside list-disc space-y-1">
                  {parseErrors.map((error, i) => (
                    <li key={i}>{error}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {parseWarnings.length > 0 && (
            <div className="mt-4 flex items-start gap-2 rounded-md border border-yellow-200 bg-yellow-50 p-4 text-yellow-900 dark:border-yellow-900 dark:bg-yellow-950 dark:text-yellow-100">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              <div className="flex-1">
                <strong>Parsing Info:</strong>
                <ul className="mt-2 list-inside list-disc space-y-1">
                  {parseWarnings.map((warning, i) => (
                    <li key={i}>{warning}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {uploadStatus && (
            <div
              className={`mt-4 flex items-center gap-2 rounded-md border p-4 ${
                uploadStatus.failed === 0
                  ? "border-green-200 bg-green-50 text-green-900 dark:border-green-900 dark:bg-green-950 dark:text-green-100"
                  : "border-yellow-200 bg-yellow-50 text-yellow-900 dark:border-yellow-900 dark:bg-yellow-950 dark:text-yellow-100"
              }`}
            >
              {uploadStatus.failed === 0 ? <CheckCircle2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
              <span>
                Upload complete: {uploadStatus.success} succeeded, {uploadStatus.failed} failed
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Import Configuration</CardTitle>
          <CardDescription>Configure import options and upload users to SafeQ Cloud</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Label className="text-sm font-medium">Default Provider:</Label>
              <select
                value={selectedProviderId || ""}
                onChange={(e) => setSelectedProviderId(e.target.value ? parseInt(e.target.value, 10) : null)}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">None (use CSV value)</option>
                {providers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={autoGeneratePin}
                onChange={(e) => setAutoGeneratePin(e.target.checked)}
                className="h-4 w-4 cursor-pointer rounded border-gray-300 text-primary focus:ring-2 focus:ring-ring"
              />
              <span className="text-sm">Auto-generate PIN if empty</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={autoGenerateOtp}
                onChange={(e) => setAutoGenerateOtp(e.target.checked)}
                className="h-4 w-4 cursor-pointer rounded border-gray-300 text-primary focus:ring-2 focus:ring-ring"
              />
              <span className="text-sm">Auto-generate OTP if empty</span>
            </label>
            <div className="ml-auto flex gap-2">
              <Button variant="default" onClick={handleUpload} disabled={isUploading || validCount === 0}>
                <Upload className="h-4 w-4" />
                {isUploading ? "Uploading..." : `Upload ${validCount} Valid User${validCount !== 1 ? "s" : ""}`}
              </Button>
              <Button variant="outline" onClick={handleClear} disabled={isUploading}>
                <X className="h-4 w-4" />
                Clear All
              </Button>
            </div>
          </div>

          <div className="mt-4">
            <ImportGrid users={users} onUpdate={setUsers} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>CSV Format</CardTitle>
          <CardDescription>Your CSV file should include the following columns</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-muted-foreground">Delimiter will be auto-detected. Supported columns:</p>
          <ul className="space-y-2 text-sm text-muted-foreground">
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
        </CardContent>
      </Card>
    </div>
  );
}

export default ImportPage;
