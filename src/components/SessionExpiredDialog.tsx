'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { clearStoredAuth, reauthenticate } from '@/services/authService';
import type { User } from '@/services/authService';

/**
 * Inloggningsrutan när inloggningen gått ut mitt i arbetet (dataintegritet
 * F14). Sidan ligger kvar bakom, och anropen som fick 401 skickas om när
 * läraren loggat in. Rutan går inte att stänga: utan inloggning sparas inget.
 */
export default function SessionExpiredDialog({ user }: { user: User }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await reauthenticate(user.username, password, user.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunde inte logga in.');
      setBusy(false);
    }
  };

  const handleLogout = () => {
    // Sidbytet varnar själv om något inte är sparat (beforeunload).
    clearStoredAuth();
    window.location.href = '/login';
  };

  return (
    <Dialog open>
      <DialogContent
        hideClose
        className="max-w-sm"
        onEscapeKeyDown={e => e.preventDefault()}
        onPointerDownOutside={e => e.preventDefault()}
        onInteractOutside={e => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Logga in igen</DialogTitle>
          <DialogDescription>
            Inloggningen har gått ut. Det du ändrat ligger kvar och sparas när du loggat in.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="session-username">Användarnamn</Label>
            <Input id="session-username" value={user.username} readOnly autoComplete="username" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="session-password">Lösenord</Label>
            <Input
              id="session-password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
              autoFocus
              required
            />
          </div>
          {error && <p className="text-sm text-ui-danger" role="alert">{error}</p>}
          <div className="flex items-center justify-between gap-2">
            <Button type="button" variant="secondary" onClick={handleLogout}>
              Logga ut
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? 'Loggar in…' : 'Logga in'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
