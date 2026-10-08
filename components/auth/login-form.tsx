"use client";

import * as React from "react";
import { useActionState } from "react";
import { loginAction, type LoginState } from "@/lib/actions/auth";
import { usePrefs } from "@/components/prefs/prefs-provider";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/form";
import { Alert } from "@/components/ui/alert";
import { Info, ShieldCheck } from "lucide-react";

export function LoginForm() {
  const { t } = usePrefs();
  const [state, formAction, pending] = useActionState<LoginState | null, FormData>(loginAction, null);
  const errors = state?.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <div className="space-y-2">
        <Label htmlFor="abhaNumber">{t("login.abha")}</Label>
        <Input
          id="abhaNumber"
          name="abhaNumber"
          inputMode="numeric"
          autoComplete="off"
          placeholder="12-3456-7890-1234"
          aria-describedby="abhaNumber-help abhaNumber-error"
          aria-invalid={Boolean(errors.abhaNumber)}
        />
        <p id="abhaNumber-help" className="text-sm text-muted-foreground">{t("login.abhaHelp")}</p>
        <FieldError id="abhaNumber-error" message={errors.abhaNumber} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="name">{t("login.name")}</Label>
        <Input id="name" name="name" autoComplete="name" required aria-describedby="name-error" aria-invalid={Boolean(errors.name)} />
        <FieldError id="name-error" message={errors.name} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">{t("login.email")}</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          aria-describedby="email-error"
          aria-invalid={Boolean(errors.email)}
        />
        <FieldError id="email-error" message={errors.email} />
      </div>
      {state?.errorKey ? (
        <Alert variant="attention" role="alert">
          <Info className="size-5 shrink-0" aria-hidden />
          <span>{t(state.errorKey)}</span>
        </Alert>
      ) : null}
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? t("common.loading") : t("login.continue")}
      </Button>
      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
        {t("login.noTransmit")}
      </p>
    </form>
  );
}
