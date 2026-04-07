'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { loginWithGoogleAction } from '@/actions/auth.actions';

export default function LoginPage() {
  const router = useRouter();

  // The function that runs when Google successfully returns a token
  const handleGoogleSuccess = async (credentialResponse: any) => {
    if (!credentialResponse.credential) return;

    const toastId = toast.loading('Verifying admin credentials...');
    
    // Send it to our Server Action
    const result = await loginWithGoogleAction(credentialResponse.credential);

    if (result.success) {
      toast.success('Login successful!', { id: toastId });
      router.push('/admin/dashboard'); 
    } else {
      toast.error(result.error, { id: toastId });
    }
  };

  return (
    <GoogleOAuthProvider clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!}>
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12 sm:px-6 lg:px-8">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-100">
              <span className="text-2xl text-brand-700">🍃</span>
            </div>
            <h2 className="mt-6 text-3xl font-bold tracking-tight text-slate-900">
              Akripesa Admin
            </h2>
          </div>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="space-y-1">
              <CardTitle className="text-xl font-semibold">Welcome back</CardTitle>
              <CardDescription>Choose your preferred sign-in method</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              
              {/* Official Google Button */}
              <div className="flex justify-center w-full">
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={() => toast.error('Google popup failed to open or was closed.')}
                  theme="outline"
                  size="large"
                  width="100%"
                />
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-slate-500">Or continue with credentials</span>
                </div>
              </div>

              {/* Standard Form */}
              
              <form 
                className="space-y-4" 
                onSubmit={(e) => {
                  e.preventDefault();
                  toast.info('Standard login coming next!');
                }}
              >
                <div className="space-y-2">
                  <Label htmlFor="email">Email or Phone Number</Label>
                  <Input id="email" name="email" type="text" placeholder="admin@akripesa.com" required />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    <Link href="/forgot-password" className="text-xs font-medium text-brand-600 hover:text-brand-500">
                      Forgot password?
                    </Link>
                  </div>
                  <Input id="password" name="password" type="password" required />
                </div>
                <Button type="submit" className="w-full bg-slate-900 text-white hover:bg-slate-800">
                  Sign In
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </GoogleOAuthProvider>
  );
}