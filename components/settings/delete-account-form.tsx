"use client";

import * as React from "react";
import { useActionState } from "react";
import { Trash2 } from "lucide-react";
import { deleteAccountAction } from "@/lib/actions/auth";
import { usePrefs } from "@/components/prefs/prefs-provider";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

export function DeleteAccountForm() {
  const { t } = usePrefs();
  const [state, formAction, pending] = useActionState(deleteAccountAction, null);
  const [confirmed, setConfirmed] = React.useState(false);
  return (
    <form action={formAction} className="space-y-4" onSubmit={(event) => {
      if (!window.confirm(t("settings.deleteHelp"))) event.preventDefault();
    }}>
      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          name="confirm"
          className="mt-1 size-5 accent-[hsl(var(--attention))]"
          checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)}
        />
        <span>{t("settings.deleteConfirmLabel")}</span>
      </label>
      {state?.errorKey ? <Alert variant="attention" role="alert">{t(state.errorKey as Parameters<typeof t>[0])}</Alert> : null}
      <Button type="submit" variant="danger" disabled={!confirmed || pending}>
        <Trash2 aria-hidden /> {t("settings.deleteConfirmButton")}
      </Button>
    </form>
  );
}
