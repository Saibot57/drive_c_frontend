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
  const router = useRouter();
  
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
      await register(username, password, email);
    } else {
      await login(username, password);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-t-login">
      <Card className="w-full max-w-md border-2 border-t-border shadow-neo">
        <CardHeader className="bg-t-accent border-b-2 border-t-border">
          <CardTitle className="text-t-text-on-accent font-monument text-2xl">
            {isRegister ? 'Skapa konto' : 'Logga in'}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
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
                className="border-2 border-t-border"
              />
            </div>

            {isRegister && (
              <div className="space-y-2">
                <Label htmlFor="email">E-post (valfritt)</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="border-2 border-t-border"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="password">Lösenord</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="border-2 border-t-border"
              />
            </div>
            
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-t-accent text-t-text-on-accent hover:bg-t-accent-hover border-2 border-t-border"
            >
              {isLoading ? 'Laddar…' : isRegister ? 'Registrera' : 'Logga in'}
            </Button>
          </form>
          
          <div className="mt-4 text-center">
            <button
              onClick={() => setIsRegister(!isRegister)}
              className="text-t-accent hover:underline"
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