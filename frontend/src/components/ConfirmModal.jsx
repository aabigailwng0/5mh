import React, { useState } from "react";
import { X } from "lucide-react";

// Lightweight centered modal. Optionally shows a "Don't ask again" checkbox; the
// confirm handler receives whether that box was ticked so the caller can persist
// the preference.
export default function ConfirmModal({
  open,
  title,
  body,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  allowDisable = false,
  onConfirm,
  onCancel,
}) {
  const [dontAsk, setDontAsk] = useState(false);
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-card border border-purple-400 bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-4">
          <h3 className="font-display text-heading-sm font-medium tracking-tight">{title}</h3>
          <button onClick={onCancel} className="text-black/40 hover:text-black">
            <X className="h-4 w-4" />
          </button>
        </div>

        {body && <p className="text-body text-black/70">{body}</p>}

        {allowDisable && (
          <label className="mt-4 flex items-center gap-2 text-caption uppercase tracking-wide text-black/60">
            <input
              type="checkbox"
              checked={dontAsk}
              onChange={(e) => setDontAsk(e.target.checked)}
              className="h-3.5 w-3.5 accent-purple-600"
            />
            Don't ask again
          </label>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onCancel} className="btn-flat">
            {cancelLabel}
          </button>
          <button onClick={() => onConfirm(dontAsk)} className="btn-primary">
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
