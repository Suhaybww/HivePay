"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/src/components/ui/tabs";
import { ProfileSettings } from "@/src/components/settings/ProfileSettings";
import { SecuritySettings } from "@/src/components/settings/SecuritySettings";
import { BillingSettings } from "@/src/components/settings/BillingSettings";
import { Card } from "@/src/components/ui/card";
import { trpc } from "../_trpc/client";

export default function SettingsPage() {
  const { data: user } = trpc.auth.getUser.useQuery();

  if (!user) return null;

  return (
    <div className="container mx-auto py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your account settings and preferences.</p>
      </div>

      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card className="p-6">
            <ProfileSettings user={user} />
          </Card>
        </TabsContent>

        <TabsContent value="security">
          <Card className="p-6">
            <SecuritySettings user={user} />
          </Card>
        </TabsContent>

        <TabsContent value="billing">
          <Card className="p-6">
            <BillingSettings user={user} />
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}