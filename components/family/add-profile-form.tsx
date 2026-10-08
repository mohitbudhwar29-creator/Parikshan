"use client";

import * as React from "react";
import { useActionState } from "react";
import { UserPlus } from "lucide-react";
import { createProfileAction, type ProfileFormState } from "@/lib/actions/profiles";
import { RELATIONSHIPS } from "@/types/health";
import { usePrefs } from "@/components/prefs/prefs-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldError, Input, Label, Select } from "@/components/ui/form";
import { Alert } from "@/components/ui/alert";

export function AddProfileForm() {
  const { t } = usePrefs();
  const [state, formAction, pending] = useActionState<ProfileFormState | null, FormData>(createProfileAction, null);
  const errors = state?.fieldErrors ?? {};
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("family.addTitle")}</CardTitle>
        <CardDescription>{t("family.demoNote")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="grid gap-4 md:grid-cols-3" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="profile-name">{t("family.name")}</Label>
            <Input id="profile-name" name="name" required aria-invalid={Boolean(errors.name)} aria-describedby="profile-name-error" />
            <FieldError id="profile-name-error" message={errors.name ? t("family.errorName") : null} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="profile-dob">{t("family.dob")}</Label>
            <Input id="profile-dob" name="dateOfBirth" type="date" aria-invalid={Boolean(errors.dateOfBirth)} aria-describedby="profile-dob-error" />
            <FieldError id="profile-dob-error" message={errors.dateOfBirth ? t("family.errorDob") : null} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="profile-relationship">{t("family.relationship")}</Label>
            <Select id="profile-relationship" name="relationship" defaultValue="OTHER">
              {RELATIONSHIPS.filter((item) => item !== "SELF").map((item) => (
                <option key={item} value={item}>{t(`family.rel.${item}` as const)}</option>
              ))}
            </Select>
          </div>
          {state?.errorKey ? (
            <div className="md:col-span-3">
              <Alert variant="attention" role="alert">{t(state.errorKey)}</Alert>
            </div>
          ) : null}
          <div className="md:col-span-3">
            <Button type="submit" disabled={pending}>
              <UserPlus aria-hidden /> {t("family.save")}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
