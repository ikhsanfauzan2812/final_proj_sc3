'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Airplay, BarChart3, Cpu, ChevronLeft, ChevronRight } from 'lucide-react';

export default function Sidebar() {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const navItems = [
    { name: 'Ringkasan', href: '/', icon: LayoutDashboard },
    { name: 'Kontrol AC', href: '/remote', icon: Airplay },
    { name: 'Smart Auto-Pilot', href: '/automation', icon: Cpu },
    { name: 'Analitik & Historis', href: '/analytics', icon: BarChart3 },
  ];

  return (
    <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`} style={{ position: 'relative' }}>
      
      <button 
        className="sidebar-toggle" 
        onClick={() => setIsCollapsed(!isCollapsed)}
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

      <nav className="sidebar-nav">
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
      
      <div style={{ padding: '20px', marginTop: 'auto', borderTop: '1px solid rgba(255,255,255,0.05)', fontSize: '12px', color: '#666', textAlign: 'center', opacity: isCollapsed ? 0 : 1, transition: 'opacity 0.2s' }}>
        v1.0.0 IoT Controller
      </div>
    </aside>
  );
}
