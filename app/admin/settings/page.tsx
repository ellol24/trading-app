"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { ProfessionalButton } from "@/components/ui/professional-button"
import { useToast } from "@/hooks/use-toast"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Terminal, ShieldCheck, Gift, Percent } from "lucide-react"
import {
  getSettings,
  setBroadcastMessage,
  subscribeSettings,
  updateSetting,
  type PlatformSettings,
} from "@/lib/settings-store"

const mockActivityLogs = [
  { id: 1, timestamp: "2024-07-30 10:30 AM", action: "Trading enabled by AdminUser1" },
  { id: 2, timestamp: "2024-07-29 03:15 PM", action: "Broadcast message updated by AdminUser2" },
  { id: 3, timestamp: "2024-07-28 09:00 AM", action: "Maintenance mode activated by AdminUser1" },
]

export default function AdminPlatformControlsPage() {
  const [settings, setSettings] = useState<PlatformSettings>(getSettings())
  const [broadcastInput, setBroadcastInput] = useState(settings.broadcastMessage)
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  // ✅ sync across tabs
  useEffect(() => {
    const unsub = subscribeSettings(() => setSettings(getSettings()))
    return () => unsub()
  }, [])

  const handleSettingChange = async (key: keyof PlatformSettings, value: PlatformSettings[typeof key]) => {
    setLoading(true)
    await new Promise((r) => setTimeout(r, 200)) // simulate API
    const next = updateSetting(key, value as any)
    setSettings(next)
    toast({
      title: "Setting Updated",
      description: `${String(key)
        .replace(/([A-Z])/g, " $1")
        .toLowerCase()} has been ${typeof value === "boolean" ? (value ? "enabled" : "disabled") : "updated"}.`,
    })
    setLoading(false)
  }

  const handleBroadcastMessage = async () => {
    setLoading(true)
    await new Promise((r) => setTimeout(r, 300))
    setBroadcastMessage(broadcastInput)
    toast({ title: "Message Broadcasted", description: "Your message has been sent to all users." })
    setLoading(false)
  }

  const handleForceLogout = async () => {
    if (!window.confirm("Are you sure you want to force logout all users? This action cannot be undone.")) return
    setLoading(true)
    await new Promise((r) => setTimeout(r, 500))
    toast({
      title: "All Users Logged Out",
      description: "All active user sessions have been terminated.",
      variant: "destructive",
    })
    setLoading(false)
  }

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Platform Controls</h1>
      </div>

      {/* Core Toggles */}
      <Card className="bg-card/50 backdrop-blur-md">
        <CardHeader>
          <CardTitle>Core Functionality Toggles</CardTitle>
          <CardDescription>Enable or disable key features across the entire platform.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="trading-toggle">Trading Enabled</Label>
            <Switch
              id="trading-toggle"
              checked={settings.tradingEnabled}
              onCheckedChange={(v) => handleSettingChange("tradingEnabled", v)}
              disabled={loading}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="withdrawals-toggle">Withdrawals Enabled</Label>
            <Switch
              id="withdrawals-toggle"
              checked={settings.withdrawalsEnabled}
              onCheckedChange={(v) => handleSettingChange("withdrawalsEnabled", v)}
              disabled={loading}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="deposits-toggle">Deposits Enabled</Label>
            <Switch
              id="deposits-toggle"
              checked={settings.depositsEnabled}
              onCheckedChange={(v) => handleSettingChange("depositsEnabled", v)}
              disabled={loading}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="registrations-toggle">User Registrations Enabled</Label>
            <Switch
              id="registrations-toggle"
              checked={settings.registrationsEnabled}
              onCheckedChange={(v) => handleSettingChange("registrationsEnabled", v)}
              disabled={loading}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="maintenance-toggle">Maintenance Mode</Label>
            <Switch
              id="maintenance-toggle"
              checked={settings.maintenanceMode}
              onCheckedChange={(v) => handleSettingChange("maintenanceMode", v)}
              disabled={loading}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="kyc-toggle" className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" /> KYC Required
            </Label>
            <Switch
              id="kyc-toggle"
              checked={settings.kycRequired}
              onCheckedChange={(v) => handleSettingChange("kycRequired", v)}
              disabled={loading}
            />
          </div>

          {settings.maintenanceMode && (
            <Alert className="mt-2">
              <Terminal className="h-4 w-4" />
              <AlertTitle>Heads up!</AlertTitle>
              <AlertDescription>
                When maintenance mode is active, only administrators can access the platform.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Welcome Bonus */}
      <Card className="bg-card/50 backdrop-blur-md">
        <CardHeader>
          <CardTitle>Welcome Bonus</CardTitle>
          <CardDescription>
            Automatically credit new users with a configurable welcome balance on account creation.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="welcome-bonus-toggle" className="flex items-center gap-2">
              <Gift className="w-4 h-4" /> Enable Welcome Bonus
            </Label>
            <Switch
              id="welcome-bonus-toggle"
              checked={settings.welcomeBonusEnabled}
              onCheckedChange={(v) => handleSettingChange("welcomeBonusEnabled", v)}
              disabled={loading}
            />
          </div>

          <div className="grid gap-2 md:grid-cols-[220px_1fr] items-center">
            <Label htmlFor="welcome-bonus-amount">Welcome Amount</Label>
            <div className="flex items-center gap-2">
              <Input
                id="welcome-bonus-amount"
                type="number"
                min={0}
                step="1"
                className="w-40"
                value={Number.isFinite(settings.welcomeBonusAmount) ? settings.welcomeBonusAmount : 0}
                onChange={(e) => {
                  const n = Number(e.target.value)
                  handleSettingChange("welcomeBonusAmount", Number.isFinite(n) ? n : 0)
                }}
                disabled={loading || !settings.welcomeBonusEnabled}
              />
              <span className="text-sm text-muted-foreground">Units: account currency</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Referral Commission Levels */}
      <Card className="bg-card/50 backdrop-blur-md">
        <CardHeader>
          <CardTitle>Referral Commission Levels</CardTitle>
          <CardDescription>Define commission percentages for each referral level.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {[1, 2, 3].map((level) => (
            <div key={level} className="grid gap-2 md:grid-cols-[220px_1fr] items-center">
              <Label htmlFor={`referral-l${level}`} className="flex items-center gap-2">
                <Percent className="w-4 h-4" /> Level {level} Commission (%)
              </Label>
              <Input
                id={`referral-l${level}`}
                type="number"
                min={0}
                max={100}
                step="0.1"
                className="w-40"
                value={
                  level === 1
                    ? settings.referralLevel1Commission
                    : level === 2
                    ? settings.referralLevel2Commission
                    : settings.referralLevel3Commission
                }
                onChange={(e) =>
                  handleSettingChange(
                    level === 1
                      ? "referralLevel1Commission"
                      : level === 2
                      ? "referralLevel2Commission"
                      : "referralLevel3Commission",
                    Number(e.target.value),
                  )
                }
                disabled={loading}
              />
            </div>
          ))}

          <Alert className="mt-2">
            <AlertTitle>Note</AlertTitle>
            <AlertDescription>
              Commissions are applied only when a deposit is approved. Changing these values affects future deposits only.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Broadcast Message */}
      <Card className="bg-card/50 backdrop-blur-md">
        <CardHeader>
          <CardTitle>Broadcast Message</CardTitle>
          <CardDescription>Send a global announcement message to all users.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Textarea
            placeholder="Type your message here..."
            value={broadcastInput}
            onChange={(e) => setBroadcastInput(e.target.value)}
            rows={4}
            className="bg-background/50"
          />
          <ProfessionalButton
            onClick={handleBroadcastMessage}
            loading={loading}
            disabled={broadcastInput.trim() === ""}
          >
            Broadcast Message
          </ProfessionalButton>
        </CardContent>
      </Card>

      {/* Admin Logs */}
      <Card className="bg-card/50 backdrop-blur-md">
        <CardHeader>
          <CardTitle>Admin Activity Logs</CardTitle>
          <CardDescription>Recent administrative actions on the platform.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2">
          {mockActivityLogs.map((log) => (
            <div key={log.id} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{log.timestamp}</span>
              <span>{log.action}</span>
            </div>
          ))}
          <ProfessionalButton variant="ghost" className="mt-2 w-fit">
            View Full Logs (Coming Soon)
          </ProfessionalButton>
        </CardContent>
      </Card>

      {/* Critical Actions */}
      <Card className="bg-card/50 backdrop-blur-md border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive">Critical Actions</CardTitle>
          <CardDescription>Actions that have significant impact on the platform. Use with caution.</CardDescription>
        </CardHeader>
        <CardContent>
          <ProfessionalButton variant="destructive" onClick={handleForceLogout} loading={loading}>
            Force Logout All Users
          </ProfessionalButton>
        </CardContent>
      </Card>
    </div>
  )
}
