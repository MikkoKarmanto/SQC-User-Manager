import { useState, useCallback, useEffect } from "react";
import type { ImportUser, SafeQAuthProvider, SafeQUser } from "../types/safeq";
import { parseCsv, readFileAsText } from "../utils/csvParser";
import ImportGrid from "../components/ImportGrid";
import ResultsDialog from "../components/ResultsDialog";
import { createUsers, listAuthProviders } from "../services/safeqClient";
import { type CredentialType } from "../services/emailDelivery";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Upload, X, AlertCircle, AlertTriangle } from "lucide-react";

function ImportPage() {
  const [users, setUsers] = useState<ImportUser[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [parseWarnings, setParseWarnings] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [providers, setProviders] = useState<SafeQAuthProvider[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState<number | null>(null);
  const [autoGeneratePin, setAutoGeneratePin] = useState(false);
  const [autoGenerateOtp, setAutoGenerateOtp] = useState(false);
  const [resultsDialog, setResultsDialog] = useState<{
    open: boolean;
    type: CredentialType;
    results: Array<{ user: SafeQUser; success: boolean; error?: string; pin?: string; otp?: string }>;
    selectedUsers: SafeQUser[];
  }>({
    open: false,
    type: "pin",
    results: [],
    selectedUsers: [],
  });

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

    try {
      const result = await createUsers(usersWithProvider, autoGeneratePin, autoGenerateOtp);

      // Determine the credential type based on what was generated
      const credentialType: CredentialType = autoGeneratePin ? "pin" : autoGenerateOtp ? "otp" : "pin";

      // Show results dialog with detailed user information
      const dialogResults = result.results.map((item) => ({
        user: item.user as SafeQUser,
        success: item.success,
        error: item.error,
        pin: item.pin,
        otp: item.otp,
      }));

      setResultsDialog({
        open: true,
        type: credentialType,
        results: dialogResults,
        selectedUsers: validUsers.map((u) => ({
          id: 0, // Import users don't have IDs yet
          userName: u.userName,
          fullName: u.fullName,
          email: u.email,
          shortId: u.shortId,
          otp: u.otp,
          providerId: u.providerId ?? selectedProviderId ?? undefined,
        })),
      });

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
            className={`rounded-lg border-2 border-dashed transition-colors ${
              isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary hover:bg-accent"
            }`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            {/* Main drop zone area */}
            <div className="flex cursor-pointer flex-col items-center justify-center p-8">
              <Upload className="mb-3 h-10 w-10 text-muted-foreground" />
              <p className="mb-1 text-base font-medium">Drag and drop CSV file here</p>
              <p className="mb-3 text-sm text-muted-foreground">or</p>
              <label htmlFor="file-upload">
                <Button variant="secondary" type="button" onClick={() => document.getElementById("file-upload")?.click()}>
                  Browse Files
                </Button>
                <input id="file-upload" type="file" accept=".csv" onChange={handleFileInputChange} className="hidden" />
              </label>
            </div>

            {/* CSV Format Info as footer */}
            <div className="border-t bg-muted/30 px-6 py-3">
              <div className="flex items-start gap-6">
                <div className="flex-1">
                  <p className="mb-1.5 text-xs font-semibold text-foreground">Required:</p>
                  <p className="text-xs text-muted-foreground">
                    <strong>UPN</strong> or <strong>Username</strong>
                  </p>
                </div>
                <div className="flex-[2]">
                  <p className="mb-1.5 text-xs font-semibold text-foreground">Optional:</p>
                  <p className="text-xs text-muted-foreground">
                    <strong>FullName</strong>, <strong>Email</strong>, <strong>CardID</strong>, <strong>PIN</strong>, <strong>OTP</strong>,{" "}
                    <strong>ProviderID</strong>
                  </p>
                </div>
                <div className="flex-shrink-0">
                  <p className="text-xs text-muted-foreground/70">Delimiter auto-detected</p>
                </div>
              </div>
            </div>
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
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Import Configuration</CardTitle>
          <CardDescription>Configure import options and upload users to SafeQ Cloud</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-4 mb-4">
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

      <ResultsDialog
        open={resultsDialog.open}
        onClose={() => setResultsDialog({ open: false, type: "pin", results: [], selectedUsers: [] })}
        type={resultsDialog.type}
        results={resultsDialog.results}
        selectedUsers={resultsDialog.selectedUsers}
      />
    </div>
  );
}

export default ImportPage;
