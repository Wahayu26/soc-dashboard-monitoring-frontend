import { Suspense } from 'react';
import type { Metadata } from 'next';
import LoginView from '@/components/auth/LoginView';

export const metadata: Metadata = {
  title: 'Sign In',
  description: 'Secure sign-in to the Sentinel SOC security command center.',
};

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen w-full bg-slate-950 flex items-center justify-center" />}>
      <LoginView />
    </Suspense>
  );
}
