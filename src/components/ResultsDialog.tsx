import { useState, useEffect } from "react";
import type { SafeQUser } from "../types/safeq";
import { sendCredentialEmails, type CredentialType } from "../services/emailDelivery";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle2, XCircle, Mail, Download, Loader2 } from "lucide-react";
import MessageBox from "./MessageBox";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";

interface ResultItem {
  user: SafeQUser;
  success: boolean;
  value?: string;
  pin?: string;
  otp?: string;
  error?: string;
}

interface ResultsDialogProps {
  open: boolean;
  onClose: () => void;
  type: CredentialType;
  results: ResultItem[];
  mode?: "credential" | "import";
  selectedUsers?: SafeQUser[];
}

function ResultsDialog({ open, onClose, type, results, mode = "credential" }: ResultsDialogProps) {
  const [sendingEmails, setSendingEmails] = useState(false);
  const [emailResults, setEmailResults] = useState<{ success: number; failed: number; errors: string[] } | null>(null);
  const [downloadStatus, setDownloadStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const successCount = results.filter((r) => r.success).length;
  const failedCount = results.filter((r) => !r.success).length;
  const label = mode === "import" ? "User" : type === "pin" ? "PIN" : "OTP";

  // Auto-dismiss messages after 5 seconds
  useEffect(() => {
    if (emailResults) {
      const timer = setTimeout(() => setEmailResults(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [emailResults]);

  useEffect(() => {
    if (downloadStatus) {
      const timer = setTimeout(() => setDownloadStatus(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [downloadStatus]);

  // Reset messages when dialog closes
  useEffect(() => {
    if (!open) {
      setEmailResults(null);
      setDownloadStatus(null);
      setSendingEmails(false);
    }
  }, [open]);

  const handleSendEmails = async () => {
    setSendingEmails(true);
    setEmailResults(null);
    setDownloadStatus(null);

    try {
      const successfulResults = results.filter((r) => r.success && r.user.email);
      const requests = successfulResults.map((result) => ({
        user: result.user,
        pinOverride: result.pin ?? (type === "pin" ? result.value ?? null : undefined),
        otpOverride: result.otp ?? (type === "otp" ? result.value ?? null : undefined),
      }));

      // Determine which credential types to send
      const hasPins = results.some((r) => r.pin !== undefined);
      const hasOtps = results.some((r) => r.otp !== undefined);

      let totalSuccess = 0;
      let totalFailed = 0;
      let allErrors: string[] = [];

      // Send PIN emails if PINs are present
      if (hasPins) {
        const pinResult = await sendCredentialEmails(requests, "pin");
        totalSuccess += pinResult.success;
        totalFailed += pinResult.failed;
        allErrors = [...allErrors, ...pinResult.errors];
      }

      // Send OTP emails if OTPs are present
      if (hasOtps) {
        const otpResult = await sendCredentialEmails(requests, "otp");
        totalSuccess += otpResult.success;
        totalFailed += otpResult.failed;
        allErrors = [...allErrors, ...otpResult.errors];
      }

      // If neither, fall back to the original type
      if (!hasPins && !hasOtps) {
        const result = await sendCredentialEmails(requests, type);
        totalSuccess = result.success;
        totalFailed = result.failed;
        allErrors = result.errors;
      }

      setEmailResults({
        success: totalSuccess,
        failed: totalFailed,
        errors: allErrors,
      });
    } catch (err) {
      setEmailResults({
        success: 0,
        failed: results.length,
        errors: [err instanceof Error ? err.message : "Failed to send emails"],
      });
    } finally {
      setSendingEmails(false);
    }
  };

  const handleDownloadCSV = async () => {
    setDownloadStatus(null);
    setEmailResults(null);

    // Determine which credential columns to include
    const hasPins = results.some((r) => r.pin !== undefined);
    const hasOtps = results.some((r) => r.otp !== undefined);
    const hasValues = results.some((r) => r.value !== undefined);

    const headers = ["Username", "Full Name", "Email"];
    if (hasPins) headers.push("PIN");
    if (hasOtps) headers.push("OTP");
    if (hasValues && !hasPins && !hasOtps) headers.push(label);
    headers.push("Status", "Error");

    const rows = results.map((result) => {
      const row = [result.user.userName || "", result.user.fullName || "", result.user.email || ""];
      if (hasPins) row.push(result.pin || "");
      if (hasOtps) row.push(result.otp || "");
      if (hasValues && !hasPins && !hasOtps) row.push(result.value || "");
      row.push(result.success ? "Success" : "Failed", result.error || "");
      return row;
    });

    const csvContent = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n");

    try {
      const filePath = await save({
        defaultPath: `${type}_generation_results_${new Date().toISOString().split("T")[0]}.csv`,
        filters: [{ name: "CSV", extensions: ["csv"] }],
      });

      if (filePath) {
        await writeTextFile(filePath, csvContent);
        setDownloadStatus({ type: "success", message: `File saved successfully to ${filePath}` });
      }
    } catch (err) {
      console.error("Failed to save CSV:", err);
      setDownloadStatus({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to save file",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{label} Generation Results</DialogTitle>
          <DialogDescription>
            Generated {label}s for {successCount} user{successCount !== 1 ? "s" : ""}
            {failedCount > 0 && `, ${failedCount} failed`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto">
          {downloadStatus && (
            <MessageBox type={downloadStatus.type} message={downloadStatus.message} onDismiss={() => setDownloadStatus(null)} className="mb-4" />
          )}

          {emailResults && (
            <MessageBox
              type={emailResults.failed === 0 ? "success" : "warning"}
              message={`Sent emails to ${emailResults.success} user${emailResults.success !== 1 ? "s" : ""}${
                emailResults.failed > 0 ? `. Failed: ${emailResults.failed}. ${emailResults.errors.slice(0, 2).join("; ")}` : ""
              }`}
              onDismiss={() => setEmailResults(null)}
              className="mb-4"
            />
          )}

          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">Status</TableHead>
                  <TableHead>Username</TableHead>
                  <TableHead>Full Name</TableHead>
                  <TableHead>Email</TableHead>
                  {results.some((r) => r.pin !== undefined) && <TableHead className="w-32">PIN</TableHead>}
                  {results.some((r) => r.otp !== undefined) && <TableHead className="w-32">OTP</TableHead>}
                  {results.some((r) => r.value !== undefined) &&
                    !results.some((r) => r.pin !== undefined) &&
                    !results.some((r) => r.otp !== undefined) && <TableHead className="w-32">{label}</TableHead>}
                  <TableHead>Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((result) => (
                  <TableRow key={result.user.id}>
                    <TableCell>
                      {result.success ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <XCircle className="h-4 w-4 text-red-600" />}
                    </TableCell>
                    <TableCell className="font-mono text-sm">{result.user.userName}</TableCell>
                    <TableCell>{result.user.fullName || "—"}</TableCell>
                    <TableCell className="font-mono text-sm">{result.user.email || "—"}</TableCell>
                    {results.some((r) => r.pin !== undefined) && <TableCell className="font-mono font-semibold">{result.pin || "—"}</TableCell>}
                    {results.some((r) => r.otp !== undefined) && <TableCell className="font-mono font-semibold">{result.otp || "—"}</TableCell>}
                    {results.some((r) => r.value !== undefined) &&
                      !results.some((r) => r.pin !== undefined) &&
                      !results.some((r) => r.otp !== undefined) && <TableCell className="font-mono font-semibold">{result.value || "—"}</TableCell>}
                    <TableCell className="text-sm text-red-600">{result.error || ""}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleDownloadCSV}>
            <Download className="h-4 w-4 mr-2" />
            Download CSV
          </Button>
          <Button onClick={handleSendEmails} disabled={sendingEmails || successCount === 0}>
            {sendingEmails ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Mail className="h-4 w-4 mr-2" />
                Send Emails to All
              </>
            )}
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ResultsDialog;
