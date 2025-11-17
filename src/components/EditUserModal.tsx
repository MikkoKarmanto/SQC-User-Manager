import { useState, useEffect } from "react";
import type { SafeQUser } from "../types/safeq";
import { updateUserCard, updateUserPin, updateUserShortId, generateUserPin, generateUserOtp } from "../services/safeqClient";
import { sendCredentialEmails, type CredentialType } from "../services/emailDelivery";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Trash2, Plus, Mail } from "lucide-react";
import MessageBox from "./MessageBox";

interface EditUserModalProps {
  user: SafeQUser | null;
  onClose: () => void;
  onSuccess: () => void;
}

function EditUserModal({ user, onClose, onSuccess }: EditUserModalProps) {
  const [newCard, setNewCard] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [generatedOtp, setGeneratedOtp] = useState<string | null>(null);
  const [generatedPin, setGeneratedPin] = useState<string | null>(null);
  const [sendingEmail, setSendingEmail] = useState<CredentialType | null>(null);

  // Auto-dismiss messages after 5 seconds
  useEffect(() => {
    if (error || successMessage) {
      const timer = setTimeout(() => {
        setError(null);
        setSuccessMessage(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, successMessage]);

  // Reset messages and state when modal closes
  useEffect(() => {
    if (!user) {
      setError(null);
      setSuccessMessage(null);
      setGeneratedOtp(null);
      setGeneratedPin(null);
      setSendingEmail(null);
      setNewCard("");
    }
  }, [user]);

  if (!user) {
    return null;
  }

  // Initialize state when user changes
  const currentCards = user.cards || [];
  const currentShortId = (generatedPin ?? user.shortId) || "";

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
      const result = await generateUserPin(user.userName, user.providerId || null);
      setGeneratedPin(result.pin);
      setSuccessMessage(`PIN generated successfully: ${result.pin}`);
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
      setGeneratedPin(null);
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

  const handleSendEmail = async (type: CredentialType) => {
    if (!user.email) {
      setError("User has no email address configured");
      setSuccessMessage(null);
      return;
    }

    const credentialValue = type === "pin" ? currentShortId : generatedOtp;
    if (!credentialValue) {
      setError(`No ${type.toUpperCase()} value available to send`);
      setSuccessMessage(null);
      return;
    }

    setSendingEmail(type);
    setError(null);
    setSuccessMessage(null);

    try {
      const result = await sendCredentialEmails(
        [
          {
            user,
            pinOverride: type === "pin" ? credentialValue : undefined,
            otpOverride: type === "otp" ? credentialValue : undefined,
          },
        ],
        type
      );

      if (result.success > 0) {
        setSuccessMessage(`${type.toUpperCase()} sent successfully to ${user.email}`);
      } else {
        setError(result.errors[0] || "Failed to send email");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send email");
    } finally {
      setSendingEmail(null);
    }
  };

  return (
    <Dialog open={!!user} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>User Details</DialogTitle>
          <DialogDescription>{user.userName}</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-6">
          {error && <MessageBox type="error" message={error} onDismiss={() => setError(null)} />}
          {successMessage && <MessageBox type="success" message={successMessage} onDismiss={() => setSuccessMessage(null)} />}

          {/* User Information */}
          <Card>
            <CardHeader>
              <CardTitle>User Information</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Username</p>
                <p className="text-sm font-mono">{user.userName || "—"}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Full Name</p>
                <p className="text-sm">{user.fullName || "—"}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Email</p>
                <p className="text-sm font-mono">{user.email || "—"}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Department</p>
                <p className="text-sm">{user.department || "—"}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Status</p>
                <Badge variant={user.isExpired === false ? "default" : "secondary"}>
                  {user.isExpired === false ? "Active" : user.isExpired === true ? "Expired" : "Active"}
                </Badge>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Groups</p>
                <p className="text-sm">
                  {user.groupIds && user.groupIds.length > 0 ? `${user.groupIds.length} group${user.groupIds.length !== 1 ? "s" : ""}` : "—"}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Card Management */}
          <Card>
            <CardHeader>
              <CardTitle>Card Management</CardTitle>
              <CardDescription>Manage user's access cards</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {currentCards.length > 0 && (
                <div className="space-y-2">
                  {currentCards.map((card) => (
                    <div key={card} className="flex items-center justify-between rounded-md border bg-muted/50 p-3">
                      <span className="font-mono text-sm">{card}</span>
                      <Button variant="destructive" size="sm" onClick={() => handleDeleteCard(card)} disabled={isSubmitting}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              {currentCards.length === 0 && <p className="text-sm text-muted-foreground">No cards assigned</p>}
              <div className="flex gap-2">
                <Input
                  type="text"
                  placeholder="Enter new card ID"
                  value={newCard}
                  onChange={(e) => setNewCard(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && newCard.trim() && handleSaveCard(newCard)}
                  disabled={isSubmitting}
                  className="font-mono"
                />
                <Button onClick={() => handleSaveCard(newCard)} disabled={isSubmitting || !newCard.trim()}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* PIN Management */}
          <Card>
            <CardHeader>
              <CardTitle>PIN</CardTitle>
              <CardDescription>Numeric authentication code</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-md border bg-muted/50 p-3">
                <span className="font-mono text-sm font-semibold">{currentShortId || "Not set"}</span>
                <div className="flex gap-2">
                  {currentShortId && user.email && (
                    <Button
                      onClick={() => handleSendEmail("pin")}
                      disabled={isSubmitting || sendingEmail !== null}
                      size="sm"
                      variant="outline"
                      title="Send PIN via email"
                    >
                      {sendingEmail === "pin" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Mail className="h-4 w-4 mr-2" />}
                      Send
                    </Button>
                  )}
                  <Button onClick={handleGeneratePin} disabled={isSubmitting || sendingEmail !== null} size="sm">
                    Generate
                  </Button>
                  {currentShortId && (
                    <Button variant="destructive" onClick={handleDeletePin} disabled={isSubmitting || sendingEmail !== null} size="sm">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* OTP Management */}
          <Card>
            <CardHeader>
              <CardTitle>OTP</CardTitle>
              <CardDescription>Alphanumeric one-time password (only visible when freshly generated)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-md border bg-muted/50 p-3">
                <span className="font-mono text-sm font-semibold">{generatedOtp || "Not generated"}</span>
                <div className="flex gap-2">
                  {generatedOtp && user.email && (
                    <Button
                      onClick={() => handleSendEmail("otp")}
                      disabled={isSubmitting || sendingEmail !== null}
                      size="sm"
                      variant="outline"
                      title="Send OTP via email"
                    >
                      {sendingEmail === "otp" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Mail className="h-4 w-4 mr-2" />}
                      Send
                    </Button>
                  )}
                  <Button onClick={handleGenerateOtp} disabled={isSubmitting || sendingEmail !== null} size="sm">
                    Generate
                  </Button>
                  <Button variant="destructive" onClick={handleDeleteOtp} disabled={isSubmitting || sendingEmail !== null} size="sm">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              "Close"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default EditUserModal;
