'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';
import { Lock, Mail, UserPlus, LogIn, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState(''); // for profile if needed
  
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setStatus('error');
      setMessage('Email dan Password wajib diisi.');
      return;
    }

    setLoading(true);
    setStatus('idle');

    try {
      if (isLogin) {
        // LOGIN FLOW
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password
        });
        
        if (error) throw error;
        
        setStatus('success');
        setMessage('Login berhasil! Mengalihkan ke Dashboard...');
        
        setTimeout(() => {
          router.push('/');
          router.refresh();
        }, 1500);
      } else {
        // SIGNUP FLOW
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName || 'Smart User'
            }
          }
        });
        
        if (error) throw error;

        setStatus('success');
        setMessage('Registrasi berhasil! Silakan cek email Anda untuk verifikasi atau langsung login jika fitur konfirmasi email dinonaktifkan.');
        
        // Switch to login tab after brief delay
        setTimeout(() => {
          setIsLogin(true);
          setPassword('');
          setStatus('idle');
        }, 3000);
      }
    } catch (err: any) {
      setStatus('error');
      setMessage(err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      minHeight: '85vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      padding: '20px',
      position: 'relative'
    }}>
      {/* Dynamic Background Glows */}
      <div style={{
        position: 'absolute',
        width: '350px',
        height: '350px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(0, 242, 254, 0.15) 0%, transparent 70%)',
        top: '10%',
        left: '20%',
        zIndex: 0,
        pointerEvents: 'none'
      }} />
      <div style={{
        position: 'absolute',
        width: '400px',
        height: '400px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(79, 172, 254, 0.12) 0%, transparent 70%)',
        bottom: '10%',
        right: '20%',
        zIndex: 0,
        pointerEvents: 'none'
      }} />

      <div className="glass-card animate-fade-in" style={{ 
        width: '100%', 
        maxWidth: '450px', 
        padding: '40px', 
        zIndex: 10,
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.4)',
        border: '1px solid rgba(255, 255, 255, 0.08)'
      }}>
        
        {/* Title / Branding */}
        <div style={{ textAlign: 'center', marginBottom: '35px' }}>
          <h1 style={{ 
            fontSize: '28px', 
            fontWeight: 800, 
            background: 'linear-gradient(135deg, #00f2fe 0%, #4facfe 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            margin: '0 0 8px 0'
          }}>
            Smart Compact
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: 0, letterSpacing: '1px', textTransform: 'uppercase' }}>
            Climate Controller
          </p>
        </div>

        {/* Auth Tab Switcher */}
        <div style={{ 
          display: 'flex', 
          background: 'rgba(0, 0, 0, 0.3)', 
          borderRadius: '10px', 
          padding: '4px', 
          marginBottom: '30px',
          border: '1px solid rgba(255,255,255,0.05)'
        }}>
          <button
            onClick={() => { setIsLogin(true); setStatus('idle'); }}
            style={{
              flex: 1,
              padding: '12px 0',
              border: 'none',
              background: isLogin ? 'linear-gradient(135deg, rgba(0, 242, 254, 0.15) 0%, rgba(79, 172, 254, 0.15) 100%)' : 'transparent',
              color: isLogin ? '#00f2fe' : '#888',
              fontWeight: 600,
              fontSize: '14px',
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              borderBottom: isLogin ? '1px solid rgba(0, 242, 254, 0.4)' : 'none'
            }}
          >
            Masuk
          </button>
          <button
            onClick={() => { setIsLogin(false); setStatus('idle'); }}
            style={{
              flex: 1,
              padding: '12px 0',
              border: 'none',
              background: !isLogin ? 'linear-gradient(135deg, rgba(0, 242, 254, 0.15) 0%, rgba(79, 172, 254, 0.15) 100%)' : 'transparent',
              color: !isLogin ? '#00f2fe' : '#888',
              fontWeight: 600,
              fontSize: '14px',
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              borderBottom: !isLogin ? '1px solid rgba(0, 242, 254, 0.4)' : 'none'
            }}
          >
            Daftar Akun
          </button>
        </div>

        {/* Notification Status */}
        {status === 'success' && (
          <div style={{ padding: '15px', borderRadius: '10px', background: 'rgba(46, 204, 113, 0.1)', border: '1px solid rgba(46, 204, 113, 0.3)', color: '#2ecc71', display: 'flex', gap: '10px', marginBottom: '20px', alignItems: 'flex-start' }}>
            <CheckCircle2 size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div style={{ fontSize: '13px', lineHeight: 1.5 }}>{message}</div>
          </div>
        )}

        {status === 'error' && (
          <div style={{ padding: '15px', borderRadius: '10px', background: 'rgba(231, 76, 60, 0.1)', border: '1px solid rgba(231, 76, 60, 0.3)', color: '#e74c3c', display: 'flex', gap: '10px', marginBottom: '20px', alignItems: 'flex-start' }}>
            <AlertCircle size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div style={{ fontSize: '13px', lineHeight: 1.5 }}>{message}</div>
          </div>
        )}

        {/* Input Form */}
        <form onSubmit={handleSubmit}>
          {!isLogin && (
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: '#ccc', fontWeight: 500 }}>
                Nama Lengkap
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Masukkan nama lengkap..."
                style={{
                  width: '100%',
                  padding: '14px 15px',
                  borderRadius: '8px',
                  background: 'rgba(0, 0, 0, 0.2)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  color: '#fff',
                  fontSize: '14px',
                  outline: 'none',
                  transition: 'border-color 0.2s'
                }}
                required={!isLogin}
              />
            </div>
          )}

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: '#ccc', fontWeight: 500 }}>
              Email
            </label>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', top: '14px', left: '15px', color: '#666' }}>
                <Mail size={18} />
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Masukkan email Anda..."
                style={{
                  width: '100%',
                  padding: '14px 15px 14px 45px',
                  borderRadius: '8px',
                  background: 'rgba(0, 0, 0, 0.2)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  color: '#fff',
                  fontSize: '14px',
                  outline: 'none'
                }}
                required
              />
            </div>
          </div>

          <div style={{ marginBottom: '30px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: '#ccc', fontWeight: 500 }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', top: '14px', left: '15px', color: '#666' }}>
                <Lock size={18} />
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Masukkan password Anda..."
                style={{
                  width: '100%',
                  padding: '14px 15px 14px 45px',
                  borderRadius: '8px',
                  background: 'rgba(0, 0, 0, 0.2)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  color: '#fff',
                  fontSize: '14px',
                  outline: 'none'
                }}
                required
              />
            </div>
          </div>

          {/* Action Button */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '15px',
              borderRadius: '8px',
              background: loading ? '#444' : 'linear-gradient(135deg, #00f2fe 0%, #4facfe 100%)',
              border: 'none',
              color: '#fff',
              fontSize: '15px',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '10px',
              transition: 'opacity 0.2s, transform 0.1s',
              boxShadow: '0 8px 25px rgba(0, 242, 254, 0.2)'
            }}
          >
            {isLogin ? <LogIn size={18} /> : <UserPlus size={18} />}
            {loading ? 'Memproses...' : isLogin ? 'Masuk ke Dashboard' : 'Buat Akun Sekarang'}
          </button>
        </form>

      </div>
    </div>
  );
}
