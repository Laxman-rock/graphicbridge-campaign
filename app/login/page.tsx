'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Send,
  Eye,
  EyeOff,
  Lock,
  User as UserIcon,
  AlertCircle,
  CheckCircle2,
  Mail,
  MessageSquare,
  ShieldCheck,
  Server,
} from 'lucide-react';
import { loginUser, API_BASE_URL } from '@/lib/api';
import { saveAuthSession, isAuthenticated } from '@/lib/auth';
import { useToast } from '@/components/ui/Toast';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { error: toastError, success: toastSuccess } = useToast();

  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Check if session expired
  useEffect(() => {
    if (searchParams.get('expired')) {
      setErrorMessage('Your session has expired. Please sign in again.');
    }
  }, [searchParams]);

  // If already authenticated, redirect to dashboard
  useEffect(() => {
    if (isAuthenticated()) {
      router.replace('/dashboard');
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedUserId = userId.trim();
    if (!trimmedUserId) {
      setErrorMessage('User ID is required.');
      return;
    }
    if (!password) {
      setErrorMessage('Password is required.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await loginUser({
        user_id: trimmedUserId,
        password: password,
      });

      if (response.success) {
        // Backend returned success
        const token =
          response.token ||
          response.data?.token ||
          (typeof response.data === 'string' ? response.data : undefined) ||
          'session_authenticated';

        const userObj = response.user ||
          response.data?.user || {
            user_id: trimmedUserId,
            name: trimmedUserId,
          };

        saveAuthSession(token, userObj, rememberMe);
        toastSuccess('Successfully signed in. Welcome back!', 'Authentication Successful');
        router.push('/dashboard');
      } else {
        const errorText = response.error || response.message || 'Authentication failed. Please verify your credentials.';
        setErrorMessage(errorText);
        toastError(errorText, 'Login Failed');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unable to connect to login server.';
      setErrorMessage(message);
      toastError(message, 'Connection Error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-md w-full mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
          Welcome Back
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          Manage your email and WhatsApp campaigns in one place.
        </p>
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div
          role="alert"
          className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-start gap-3 animate-in fade-in"
        >
          <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 font-medium leading-relaxed">{errorMessage}</div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* User ID Field */}
        <div>
          <label
            htmlFor="user_id"
            className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5"
          >
            User ID
          </label>
          <div className="relative rounded-xl shadow-sm">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <UserIcon className="w-5 h-5" />
            </div>
            <input
              id="user_id"
              name="user_id"
              type="text"
              required
              autoComplete="username"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="Enter your user ID"
              className="block w-full pl-11 pr-4 py-3 rounded-xl border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent text-sm transition-all"
            />
          </div>
        </div>

        {/* Password Field */}
        <div>
          <label
            htmlFor="password"
            className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5"
          >
            Password
          </label>
          <div className="relative rounded-xl shadow-sm">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Lock className="w-5 h-5" />
            </div>
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="block w-full pl-11 pr-11 py-3 rounded-xl border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent text-sm transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Remember Me */}
        <div className="flex items-center justify-between text-sm">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 transition-colors"
            />
            <span className="text-slate-600 text-xs sm:text-sm">Remember me on this device</span>
          </label>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl shadow-md text-white font-medium bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed transition-all text-sm"
        >
          {isLoading ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Signing in...</span>
            </>
          ) : (
            <>
              <span>Sign In</span>
              <Send className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      {/* Staging API Endpoint Helper */}
      <div className="mt-8 pt-6 border-t border-slate-100 text-center">
        <p className="text-xs text-slate-400">
          Connected to Staging Server: <br />
          <code className="text-[11px] text-slate-600 font-mono bg-slate-100 px-2 py-0.5 rounded mt-1 inline-block">
            POST /api/users/login
          </code>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-center py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 rounded-3xl overflow-hidden shadow-2xl border border-slate-200/80 bg-white">
        
        {/* Left Column: Branding & Marketing Showcase */}
        <div className="lg:col-span-5 bg-gradient-to-br from-indigo-900 via-indigo-800 to-indigo-950 p-8 sm:p-12 text-white flex flex-col justify-between relative overflow-hidden">
          <div className="absolute -top-24 -left-24 w-72 h-72 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-72 h-72 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />

          {/* Brand Mark */}
          <div className="relative z-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/30 ring-1 ring-white/20">
                <Send className="w-5 h-5 text-white transform -rotate-12" />
              </div>
              <span className="text-2xl font-bold tracking-tight text-white">Campaign</span>
            </div>

            <div className="mt-12 space-y-4">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-300" /> Enterprise Marketing Suite
              </span>
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-tight text-white">
                Reach Your Audience. <br />
                <span className="text-indigo-300">Grow Your Business.</span>
              </h1>
              <p className="text-sm text-indigo-100/90 leading-relaxed max-w-sm">
                Empower your business with direct Email and WhatsApp campaign workflows. Validate contacts in seconds and dispatch with confidence.
              </p>
            </div>
          </div>

          {/* Feature highlights */}
          <div className="relative z-10 mt-10 space-y-3.5 pt-6 border-t border-indigo-700/50">
            <div className="flex items-center gap-3 text-sm text-indigo-100">
              <div className="w-7 h-7 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-300 border border-blue-400/20">
                <Mail className="w-4 h-4" />
              </div>
              <span>Email CSV validation & duplicate filtering</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-indigo-100">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-300 border border-emerald-400/20">
                <MessageSquare className="w-4 h-4" />
              </div>
              <span>WhatsApp E.164 phone number sanitation</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-indigo-100">
              <div className="w-7 h-7 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-300 border border-indigo-400/20">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <span>Real-time error reporting & CSV download</span>
            </div>
          </div>

          {/* Backend Info Badge */}
          <div className="relative z-10 mt-8 pt-4 border-t border-indigo-800/80 flex items-center gap-2 text-xs text-indigo-300">
            <Server className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
            <span className="truncate">Staging: {API_BASE_URL.replace('https://', '')}</span>
          </div>
        </div>

        {/* Right Column: Sign In Form with Suspense Boundary */}
        <div className="lg:col-span-7 p-8 sm:p-12 flex flex-col justify-center bg-white">
          <Suspense
            fallback={
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              </div>
            }
          >
            <LoginForm />
          </Suspense>
        </div>

      </div>
    </div>
  );
}
