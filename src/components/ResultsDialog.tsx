import { useState } from "react";
import type { SafeQUser } from "../types/safeq";
import { sendCredentialEmails, type CredentialType } from "../services/emailDelivery";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle2, XCircle, Mail, Download, Loader2 } from "lucide-react";

interface ResultItem {
  user: SafeQUser;
  success: boolean;
  value?: string;
  error?: string;
}

interface ResultsDialogProps {
  open: boolean;
  onClose: () => void;
  type: CredentialType;
  results: ResultItem[];
}

function ResultsDialog({ open, onClose, type, results }: ResultsDialogProps) {
  const [sendingEmails, setSendingEmails] = useState(false);
  const [emailResults, setEmailResults] = useState<{ success: number; failed: number; errors: string[] } | null>(null);

  const successCount = results.filter((r) => r.success).length;
  const failedCount = results.filter((r) => !r.success).length;
  const label = type === "pin" ? "PIN" : "OTP";

  const handleSendEmails = async () => {
    setSendingEmails(true);
    setEmailResults(null);

    try {
      const successfulResults = results.filter((r) => r.success && r.user.email);
      const requests = successfulResults.map((result) => ({
        user: result.user,
        pinOverride: type === "pin" ? result.value ?? null : undefined,
        otpOverride: type === "otp" ? result.value ?? null : undefined,
      }));

      const result = await sendCredentialEmails(requests, type);
      setEmailResults(result);
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

  const handleDownloadCSV = () => {
    const headers = ["Username", "Full Name", "Email", label, "Status", "Error"];
    const rows = results.map((result) => [
      result.user.userName || "",
      result.user.fullName || "",
      result.user.email || "",
      result.value || "",
      result.success ? "Success" : "Failed",
      result.error || "",
    ]);

    const csvContent = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `${type}_generation_results_${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
          {emailResults && (
            <div
              className={`mb-4 flex items-center gap-2 rounded-md border p-4 ${
                emailResults.failed === 0
                  ? "border-green-200 bg-green-50 text-green-900 dark:border-green-900 dark:bg-green-950 dark:text-green-100"
                  : "border-yellow-200 bg-yellow-50 text-yellow-900 dark:border-yellow-900 dark:bg-yellow-950 dark:text-yellow-100"
              }`}
            >
              {emailResults.failed === 0 ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
              <div className="flex-1">
                <p>
                  Sent emails to {emailResults.success} user{emailResults.success !== 1 ? "s" : ""}
                </p>
                {emailResults.failed > 0 && (
                  <p className="text-sm mt-1">
                    Failed: {emailResults.failed}. {emailResults.errors.slice(0, 2).join("; ")}
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">Status</TableHead>
                  <TableHead>Username</TableHead>
                  <TableHead>Full Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="w-32">{label}</TableHead>
                  <TableHead>Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((result) => (
                  <TableRow key={result.user.id}>
                    <TableCell>
                      {result.success ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-600" />
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-sm">{result.user.userName}</TableCell>
                    <TableCell>{result.user.fullName || "—"}</TableCell>
                    <TableCell className="font-mono text-sm">{result.user.email || "—"}</TableCell>
                    <TableCell className="font-mono font-semibold">{result.value || "—"}</TableCell>
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
