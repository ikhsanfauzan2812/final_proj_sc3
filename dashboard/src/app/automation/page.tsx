'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';

export default function Automation() {
  const [autoMode, setAutoMode] = useState(false);
  const [loading, setLoading] = useState(true);

  // Ambil state awal dari database
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const { data, error } = await supabase
          .from('app_settings')
          .select('auto_mode')
          .eq('id', 1)
          .single();
        
        if (error) {
          if (error.code === 'PGRST116') {
            // Jika baris belum ada, buat baru
            await supabase.from('app_settings').insert([{ id: 1, auto_mode: false }]);
          } else {
            console.error('Error fetching settings:', error);
          }
        } else if (data) {
          setAutoMode(data.auto_mode);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();

    // Subscribe ke perubahan app_settings
    const channelName = `settings-stream-${Math.random().toString(36).substring(7)}`;
    const channel = supabase.channel(channelName);
      
    channel.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'app_settings' }, (payload) => {
      if (payload.new && payload.new.id === 1) {
        setAutoMode(payload.new.auto_mode);
      }
    }).subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const toggleAutoMode = async () => {
    const newValue = !autoMode;
    setAutoMode(newValue); // Optimistic UI update
    
    try {
      const { error } = await supabase
        .from('app_settings')
        .update({ auto_mode: newValue })
        .eq('id', 1);
        
      if (error) {
        // Revert jika gagal
        setAutoMode(!newValue);
        console.error("Gagal mengupdate mode otomatis:", error);
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1>Smart Auto-Pilot</h1>
        <p className="page-subtitle">Pusat kendali cerdas yang memastikan ruangan Anda selalu nyaman secara otomatis.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', marginTop: '40px' }}>
        
        {/* Toggle Panel */}
        <div className="glass-card" style={{ padding: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <h2 style={{ color: '#fff', marginBottom: '10px' }}>Master Switch</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '40px', textAlign: 'center' }}>
            Saat mode ini diaktifkan, perangkat akan secara otomatis menyesuaikan iklim ruangan untuk memberikan Anda kenyamanan terbaik tanpa perlu repot.
          </p>

          {loading ? (
            <div style={{ color: '#aaa' }}>Memuat status...</div>
          ) : (
            <div 
              onClick={toggleAutoMode}
              style={{
                width: '120px',
                height: '60px',
                borderRadius: '30px',
                background: autoMode ? 'linear-gradient(to right, #00b09b, #96c93d)' : 'rgba(255,255,255,0.1)',
                display: 'flex',
                alignItems: 'center',
                padding: '5px',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                boxShadow: autoMode ? '0 10px 20px rgba(0, 176, 155, 0.3)' : 'inset 0 2px 10px rgba(0,0,0,0.3)'
              }}
            >
              <div style={{
                width: '50px',
                height: '50px',
                borderRadius: '50%',
                background: '#fff',
                boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
                transform: autoMode ? 'translateX(60px)' : 'translateX(0)',
                transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
              }} />
            </div>
          )}

          <div style={{ 
            marginTop: '30px', 
            padding: '10px 20px', 
            borderRadius: '20px', 
            border: `1px solid ${autoMode ? '#2ecc71' : '#e74c3c'}`,
            color: autoMode ? '#2ecc71' : '#e74c3c',
            fontWeight: 'bold'
          }}>
            STATUS: {autoMode ? 'AKTIF (AUTO)' : 'NON-AKTIF (MANUAL)'}
          </div>
        </div>

        {/* Explanation Panel */}
        <div className="glass-card" style={{ padding: '30px', background: 'rgba(0, 242, 254, 0.05)', borderColor: 'rgba(0, 242, 254, 0.2)' }}>
          <h3 style={{ color: '#00f2fe', marginTop: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '24px' }}>✨</span> Sentuhan Cerdas
          </h3>
          <p style={{ color: '#ddd', fontSize: '15px', lineHeight: '1.6' }}>
            Kenyamanan adalah prioritas utama <strong>Smart Compact Climate Controller</strong>. 
            Sistem kami secara diam-diam memonitor ruangan Anda untuk menciptakan atmosfer yang sempurna.
          </p>

          <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '15px', borderRadius: '10px', borderLeft: '3px solid #f1c40f' }}>
              <strong style={{ color: '#f1c40f' }}>Kondisi 1: Tidak Ada Orang (PIR Aman)</strong>
              <p style={{ margin: '5px 0 0 0', fontSize: '13px', color: '#bbb' }}>Jika ruangan kosong selama periode waktu tertentu, sistem akan secara otomatis menaikkan setpoint AC (misal ke 26°C) atau mematikannya untuk menghemat listrik.</p>
            </div>
            
            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '15px', borderRadius: '10px', borderLeft: '3px solid #e74c3c' }}>
              <strong style={{ color: '#e74c3c' }}>Kondisi 2: Suhu / VOC Tinggi</strong>
              <p style={{ margin: '5px 0 0 0', fontSize: '13px', color: '#bbb' }}>Jika terdeteksi suhu panas di atas ambang batas wajar dan ruangan terisi, sistem akan otomatis menurunkan setpoint AC (Pendinginan Ekstra) dan memaksimalkan kecepatan kipas.</p>
            </div>

            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '15px', borderRadius: '10px', borderLeft: '3px solid #2ecc71' }}>
              <strong style={{ color: '#2ecc71' }}>Kondisi 3: Zona Nyaman</strong>
              <p style={{ margin: '5px 0 0 0', fontSize: '13px', color: '#bbb' }}>Jika rasio Suhu dan Kelembapan (Comfort Index) sudah ideal (suhu 22-24°C, kelembapan &lt; 65%), sistem akan menahan setpoint AC pada mode Auto Fan untuk menjaga suhu stabil secara efisien.</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
