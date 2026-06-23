'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '../lib/supabaseClient';
import { LayoutDashboard, BarChart3, Cpu, ChevronLeft, ChevronRight, Settings, LogOut, User } from 'lucide-react';

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setUserEmail(session?.user?.email ?? null);
      } catch (err) {
        console.error(err);
      }
    };
    fetchUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUserEmail(session?.user?.email ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      window.location.href = '/login';
    } catch (err) {
      console.error("Gagal logout:", err);
    }
  };

  // Hide Sidebar completely on Login screen
  if (pathname === '/login') {
    return null;
  }

  const navItems = [
    { name: 'Ringkasan', href: '/', icon: LayoutDashboard },
    { name: 'Smart Auto-Pilot', href: '/automation', icon: Cpu },
    { name: 'Analitik & Historis', href: '/analytics', icon: BarChart3 },
    { name: 'Konfigurasi Jaringan', href: '/config', icon: Settings },
  ];

  return (
    <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`} style={{ position: 'relative', display: 'flex', flexDirection: 'column', height: '100vh' }}>
      
      <button 
        className="sidebar-toggle" 
        onClick={() => setIsCollapsed(!isCollapsed)}
        style={{ zIndex: 100 }}
      >
        {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>

      <div className="sidebar-brand" style={{ display: 'flex', alignItems: 'center', justifyContent: isCollapsed ? 'center' : 'flex-start', padding: isCollapsed ? '25px 0' : '30px 24px', borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: '20px' }}>
        {isCollapsed ? (
          <div style={{ color: '#00f2fe', fontWeight: 900, fontSize: '22px' }}>SC</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ color: '#00f2fe', fontWeight: 800, fontSize: '20px', lineHeight: 1.1, letterSpacing: '-0.5px' }}>SMART COMPACT</span>
            <span style={{ color: '#00f2fe', fontWeight: 600, fontSize: '11px', opacity: 0.8, letterSpacing: '1px' }}>CLIMATE CONTROLLER</span>
          </div>
        )}
      </div>

      <nav className="sidebar-nav" style={{ flexGrow: 1 }}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          
          return (
            <Link 
              href={item.href} 
              key={item.href}
              className={`sidebar-item ${isActive ? 'sidebar-item-active' : ''}`}
              title={isCollapsed ? item.name : ''}
            >
              <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* User Session Info & Logout Button */}
      {userEmail && (
        <div style={{ 
          borderTop: '1px solid rgba(255,255,255,0.05)', 
          padding: '20px 15px', 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '12px' 
        }}>
          {!isCollapsed ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '0 8px' }}>
              <div style={{ 
                background: 'rgba(0, 242, 254, 0.1)', 
                color: '#00f2fe', 
                borderRadius: '50%', 
                width: '32px', 
                height: '32px', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <User size={16} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <span style={{ fontSize: '12px', color: '#fff', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {userEmail}
                </span>
                <span style={{ fontSize: '10px', color: '#888' }}>
                  Pemilik Akun
                </span>
              </div>
            </div>
          ) : (
            <div 
              title={userEmail}
              style={{ 
                margin: '0 auto',
                background: 'rgba(0, 242, 254, 0.1)', 
                color: '#00f2fe', 
                borderRadius: '50%', 
                width: '32px', 
                height: '32px', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center'
              }}
            >
              <User size={16} />
            </div>
          )}

          <button 
            onClick={handleSignOut}
            className="sidebar-item" 
            style={{ 
              width: '100%', 
              background: 'rgba(231, 76, 60, 0.05)', 
              border: '1px solid rgba(231, 76, 60, 0.15)',
              color: '#e74c3c',
              padding: '10px 15px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: isCollapsed ? 'center' : 'flex-start',
              gap: '10px',
              cursor: 'pointer',
              fontWeight: 500,
              fontSize: '13px',
              transition: 'all 0.2s ease',
              margin: 0
            }}
            title={isCollapsed ? 'Keluar' : ''}
          >
            <LogOut size={16} />
            {!isCollapsed && <span>Keluar</span>}
          </button>
        </div>
      )}
      
      {!userEmail && (
        <div style={{ padding: '20px', fontSize: '12px', color: '#666', textAlign: 'center', opacity: isCollapsed ? 0 : 1, transition: 'opacity 0.2s' }}>
          v1.0.0 IoT Controller
        </div>
      )}
    </aside>
  );
}
