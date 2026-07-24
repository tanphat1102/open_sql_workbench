"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { SapSqlwbUserProfile } from "@/types/sap";
import { Shield, UserCircle } from "lucide-react";

type ProfileSelectionDialogProps = {
  open: boolean;
  profiles: SapSqlwbUserProfile[];
  currentUser?: string;
  onSelect: (profileId: string) => void;
};

export function ProfileSelectionDialog({
  open,
  profiles,
  currentUser,
  onSelect,
}: ProfileSelectionDialogProps) {
  if (profiles.length === 0) return null;

  return (
    <Dialog open={open} modal>
      <DialogContent
        className="flex max-w-md flex-col gap-0 overflow-hidden p-0"
        showCloseButton={false}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="border-b border-border bg-[#f7fbff] px-5 py-4">
          <div className="flex items-center gap-2">
            <Shield className="size-5 text-primary" />
            <div>
              <DialogTitle className="text-base text-foreground">
                Select your profile
              </DialogTitle>
              <DialogDescription className="mt-0.5 text-xs">
                {currentUser ? (
                  <>
                    Signed in as{" "}
                    <span className="font-medium text-foreground">{currentUser}</span>
                    . Choose a profile to continue.
                  </>
                ) : (
                  "Choose a profile to access the SQL Workbench."
                )}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="max-h-[320px] overflow-auto p-2">
          {profiles.map((p) => {
            const pid = p.ProfileId ?? "";
            const roleName = p.PfcgRole ?? "";
            const desc = p.Description ?? "";

            return (
              <button
                key={pid}
                type="button"
                onClick={() => onSelect(pid)}
                className="flex w-full items-start gap-3 rounded-lg px-3 py-3 text-left transition hover:bg-accent"
              >
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <UserCircle className="size-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">
                      {pid}
                    </span>
                    {roleName ? (
                      <Badge
                        variant="outline"
                        className="border-[#b8d6ef] px-1.5 py-px text-[10px] text-primary"
                      >
                        {roleName}
                      </Badge>
                    ) : null}
                  </div>
                  {desc ? (
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {desc}
                    </div>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>

        <div className="border-t border-border bg-[#f7fbff] px-5 py-3">
          <p className="text-[11px] text-muted-foreground">
            You can switch profiles later from the user menu in the toolbar.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
