'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from '@/contexts/AuthContext';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const router = useRouter();

  const MIN_PASSWORD_LENGTH = 10;
  
  const { login, register, isAuthenticated, error, isLoading } = useAuth();

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      router.push('/');
    }
  }, [isAuthenticated, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isRegister) {
      await register(username, password, inviteCode, email);
    } else {
      await login(username, password);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-ui-bg">
      <Card className="w-full max-w-md overflow-hidden rounded-ui border-frame border-ui-line bg-ui-paper shadow-frame">
        <CardHeader className="border-b-frame border-ui-line bg-main kron:bg-ui-surface">
          <CardTitle className="font-monument ui-heading text-2xl text-black kron:text-ui-ink">
            {isRegister ? 'Skapa konto' : 'Logga in'}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          {error && (
            <div className="mb-4 rounded border-frame border-ui-line bg-rose-50 p-3 text-sm text-rose-800 kron:text-ui-danger">
              {error}
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Användarnamn</Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="border-frame border-ui-line"
              />
            </div>
            
            {isRegister && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="inviteCode">Inbjudningskod</Label>
                  <Input
                    id="inviteCode"
                    type="text"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                    required
                    autoComplete="off"
                    className="border-frame border-ui-line"
                  />
                  <p className="text-xs text-gray-600 kron:text-ui-muted">
                    Krävs för att skapa konto. Fråga den som äger appen.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">E-post (valfritt)</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="border-frame border-ui-line"
                  />
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="password">Lösenord</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={isRegister ? MIN_PASSWORD_LENGTH : undefined}
                className="border-frame border-ui-line"
              />
              {isRegister && (
                <p className="text-xs text-gray-600 kron:text-ui-muted">
                  Minst {MIN_PASSWORD_LENGTH} tecken.
                </p>
              )}
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? 'Laddar…' : isRegister ? 'Registrera' : 'Logga in'}
            </Button>
          </form>
          
          <div className="mt-4 text-center">
            <button
              onClick={() => setIsRegister(!isRegister)}
              className="font-medium text-black underline underline-offset-2 hover:no-underline"
              type="button"
            >
              {isRegister ? 'Har du redan ett konto? Logga in' : 'Inget konto? Registrera dig'}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}