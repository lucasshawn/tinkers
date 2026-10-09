import React, { useState } from 'react';
import { Shield, UserPlus, Trash2, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

export interface AdminsTabProps {
  admins: string[];
  currentAdminEmail: string;
  onSave: (updatedAdmins: string[]) => Promise<void>;
}

export const AdminsTab: React.FC<AdminsTabProps> = ({
  admins,
  currentAdminEmail,
  onSave,
}) => {
  const [newEmail, setNewEmail] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const normalizedCurrentEmail = currentAdminEmail.trim().toLowerCase();

  const validateEmail = (email: string): string | null => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      return 'Please enter an email address.';
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      return 'Please enter a valid email address.';
    }
    const alreadyExists = admins.some((a) => a.trim().toLowerCase() === trimmed);
    if (alreadyExists) {
      return 'This admin is already an authorized administrator.';
    }
    return null;
  };

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const validationError = validateEmail(newEmail);
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    const trimmedEmail = newEmail.trim().toLowerCase();
    const updatedAdmins = [...admins, trimmedEmail];

    setIsSaving(true);
    try {
      await onSave(updatedAdmins);
      setNewEmail('');
      setSuccessMessage(`Added ${trimmedEmail} to authorized administrators!`);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to add administrator.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveAdmin = async (emailToRemove: string) => {
    setErrorMessage(null);
    setSuccessMessage(null);

    const isCurrent = emailToRemove.trim().toLowerCase() === normalizedCurrentEmail;
    if (isCurrent) {
      setErrorMessage('You cannot remove yourself from administrators.');
      return;
    }

    if (admins.length <= 1) {
      setErrorMessage('Cannot remove the last remaining administrator.');
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to remove ${emailToRemove} as an administrator?`
    );
    if (!confirmed) {
      return;
    }

    const updatedAdmins = admins.filter(
      (a) => a.trim().toLowerCase() !== emailToRemove.trim().toLowerCase()
    );

    setIsSaving(true);
    try {
      await onSave(updatedAdmins);
      setSuccessMessage(`Removed ${emailToRemove} from administrators.`);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to remove administrator.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Success Notification */}
      {successMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-2xl p-4 flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Error Notification */}
      {errorMessage && (
        <div className="bg-red-50 border border-red-200 text-red-800 text-xs font-bold rounded-2xl p-4 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Add Administrator Card */}
      <div className="bg-white rounded-3xl border-2 border-pink-200 p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-9 h-9 rounded-xl bg-pink-100 flex items-center justify-center text-weeble-pink">
            <UserPlus className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bubble text-lg font-bold text-weeble-text">Add Administrator</h3>
            <p className="text-xs text-weeble-textMuted">Grant management access to a team member</p>
          </div>
        </div>

        <form onSubmit={handleAddAdmin} noValidate className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <input
              type="email"
              value={newEmail}
              onChange={(e) => {
                setNewEmail(e.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
              placeholder="friend@gmail.com"
              disabled={isSaving}
              className="w-full text-sm bg-weeble-pinkWash border border-pink-200 rounded-xl px-3.5 py-2.5 text-weeble-text placeholder-pink-300 focus:outline-none focus:border-weeble-pink disabled:opacity-50"
            />
          </div>
          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-weeble-pink text-white font-bold text-sm rounded-xl shadow-sm hover:bg-pink-600 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4" />
                <span>+ Add Admin</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* Authorized Administrators List */}
      <div className="bg-white rounded-3xl border-2 border-pink-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-pink-100 flex items-center justify-center text-weeble-pink">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bubble text-lg font-bold text-weeble-text">Authorized Administrators</h3>
              <p className="text-xs text-weeble-textMuted">
                {admins.length} {admins.length === 1 ? 'account' : 'accounts'} with portal access
              </p>
            </div>
          </div>
        </div>

        <div className="divide-y divide-pink-100">
          {admins.map((email) => {
            const isCurrent = email.trim().toLowerCase() === normalizedCurrentEmail;
            const canDelete = !isCurrent && admins.length > 1;

            return (
              <div
                key={email}
                className="py-3 flex items-center justify-between gap-3 first:pt-0 last:pb-0"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-pink-100 border border-pink-200 flex items-center justify-center text-weeble-pink font-bold text-sm shrink-0">
                    🍓
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-weeble-text truncate">
                        {email}
                      </span>
                      {isCurrent && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-pink-100 text-weeble-pink border border-pink-200">
                          You (Active Session)
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {canDelete && (
                  <button
                    type="button"
                    onClick={() => handleRemoveAdmin(email)}
                    disabled={isSaving}
                    aria-label="Remove Admin"
                    title="Remove Admin"
                    className="p-2 text-pink-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
