// src/components/settings/SecuritySettings.tsx
"use client";

import { Switch } from "@/src/components/ui/switch";
import { Label } from "@/src/components/ui/label";
import { Button } from "@/src/components/ui/button";
import { useToast } from "@/src/components/ui/use-toast";
import { trpc } from "@/src/app/_trpc/client";

export function SecuritySettings({ user }: { user: any }) {
  const { toast } = useToast();

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Two-Factor Authentication</h3>
        <p className="text-sm text-muted-foreground">
          Add an extra layer of security to your account.
        </p>
        <div className="flex items-center space-x-4 mt-4">
          <Switch 
            id="2fa"
            checked={user.twoFactorEnabled}
            onCheckedChange={() => {
              toast({
                title: "Coming Soon",
                description: "This feature will be available soon.",
                className: "fixed bottom-4 left-1/2 transform -translate-x-1/2 w-[360px]",
              });
            }}
          />
          <Label htmlFor="2fa">Enable two-factor authentication</Label>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-medium">Account Verification</h3>
        <p className="text-sm text-muted-foreground">
          Verify your identity to unlock additional features.
        </p>
        <Button
          variant="outline"
          onClick={() => {
            toast({
              title: "Coming Soon",
              description: "This feature will be available soon.",
              className: "fixed bottom-4 left-1/2 transform -translate-x-1/2 w-[360px]",
            });
          }}
        >
          Verify Identity
        </Button>
      </div>
    </div>
  );
}