"use client";

import { useState } from "react";
import { ProfileSettings } from "@/src/components/settings/ProfileSettings";
import { AccountSettings } from "@/src/components/settings/AccountSettings";
import { BillingSettings } from "@/src/components/settings/BillingSettings";
import { trpc } from "../_trpc/client";

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState('profile');
  const { data: user } = trpc.auth.getUser.useQuery();

  if (!user) return null;

  return (
    <div>
      <div className="space-y-0.5">
        <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
        <p className="text-muted-foreground">
          Manage your account settings and preferences.
        </p>
      </div>

      <div className="flex border-b mt-6">
        <button
          onClick={() => setActiveSection('profile')}
          className={`px-4 pb-4 pt-2 text-sm font-medium transition-colors relative
            ${activeSection === 'profile' 
              ? 'text-foreground' 
              : 'text-muted-foreground'
            }`}
        >
          Profile
          {activeSection === 'profile' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-yellow-400" />
          )}
        </button>
        <button
          onClick={() => setActiveSection('billing')}
          className={`px-4 pb-4 pt-2 text-sm font-medium transition-colors relative
            ${activeSection === 'billing' 
              ? 'text-foreground' 
              : 'text-muted-foreground'
            }`}
        >
          Billing
          {activeSection === 'billing' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-yellow-400" />
          )}
        </button>
        <button
          onClick={() => setActiveSection('account')}
          className={`px-4 pb-4 pt-2 text-sm font-medium transition-colors relative
            ${activeSection === 'account' 
              ? 'text-foreground' 
              : 'text-muted-foreground'
            }`}
        >
          Account
          {activeSection === 'account' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-yellow-400" />
          )}
        </button>
      </div>

      <div className="mt-4 space-y-4">
        {activeSection === 'profile' && <ProfileSettings user={user} />}
        {activeSection === 'account' && <AccountSettings user={user} />}
        {activeSection === 'billing' && <BillingSettings user={user} />}
      </div>
    </div>
  );
}