'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '../lib/supabaseClient';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const checkUser = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const current = session?.user ?? null;
        setUser(current);
        
        if (!session && pathname !== '/login') {
          router.push('/login');
        } else if (session && pathname === '/login') {
          router.push('/');
        }
      } catch (err) {
        console.error("AuthGuard check session error:", err);
      } finally {
        setLoading(false);
      }
    };

    checkUser();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const current = session?.user ?? null;
      setUser(current);
      
      if (!session && pathname !== '/login') {
        router.push('/login');
      } else if (session && pathname === '/login') {
        router.push('/');
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [pathname, router]);

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        minHeight: '90vh', 
        alignItems: 'center', 
        justifyContent: 'center', 
        color: '#00f2fe', 
        fontSize: '16px', 
        fontWeight: 500,
        fontFamily: 'system-ui, sans-serif'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ 
            border: '4px solid rgba(0, 242, 254, 0.1)', 
            borderLeft: '4px solid #00f2fe', 
            borderRadius: '50%', 
            width: '40px', 
            height: '40px', 
            animation: 'spin 1s linear infinite', 
            margin: '0 auto 20px auto' 
          }} />
          <style dangerouslySetInnerHTML={{ __html: `
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}} />
          Menghubungkan Sesi Aman...
        </div>
      </div>
    );
  }

  // Hide children layout if unauthenticated and trying to access private page
  if (!user && pathname !== '/login') {
    return null;
  }

  return <>{children}</>;
}
