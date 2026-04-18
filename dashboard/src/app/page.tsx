'use client';

import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { supabase } from '../lib/supabaseClient';

export default function Dashboard() {
  const [data, setData] = useState<any[]>([]);
  const [realtimeStatus, setRealtimeStatus] = useState('Initializing App...');
  const [realtimeCount, setRealtimeCount] = useState(0);

  // Ambil 10 data terakhir saat halaman dimuat
  useEffect(() => {
    setRealtimeStatus('Connecting to Supabase...');
    const fetchInitialData = async () => {
      try {
        const { data: supaData, error } = await supabase
          .from('sensor_data')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(10);
          
        if (error) throw error;

        if (supaData && supaData.length > 0) {
          const parsed = supaData.reverse().map((d: any) => {
            // Handle cross-browser date parsing safely (Safari issue fix)
            const safeDateStr = typeof d.created_at === 'string' ? d.created_at.replace(' ', 'T') : d.created_at;
            const dateObj = new Date(safeDateStr);
            const ts = isNaN(dateObj.getTime()) ? Date.now() : dateObj.getTime();
            
            return {
              ...d,
              timestamp: ts,
              timeFormatted: format(ts, 'dd MMM HH:mm')
            };
          });
          setData(parsed);
        }
      } catch (err: any) {
        setRealtimeStatus(`Fetch Error: ${err.message}`);
      }
    };
    
    fetchInitialData();

    // Supabase Realtime Subscription
    // Hapus channel lama jika ada (menghindari error Strict Mode dan limit channel)
    const channelName = 'sensor-stream';
    const existingChannels = supabase.getChannels();
    existingChannels.forEach(c => {
      if (c.topic === `realtime:${channelName}`) supabase.removeChannel(c);
    });

    const channel = supabase.channel(channelName);
      
    channel
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sensor_data' },
        (payload) => {
          const newDoc = payload.new;
          if (!newDoc || !newDoc.temperature) return; 
          
          const safeDateStr = typeof newDoc.created_at === 'string' ? newDoc.created_at.replace(' ', 'T') : newDoc.created_at;
          const dateObj = new Date(safeDateStr);
          const ts = isNaN(dateObj.getTime()) ? Date.now() : dateObj.getTime();
          
          const formatted = {
            ...newDoc,
            timestamp: ts,
            timeFormatted: format(ts, 'dd MMM HH:mm')
          };
          
          setData((prevData) => {
            if (prevData.length > 0 && prevData[prevData.length - 1].timestamp === ts) {
              return prevData;
            }
            return [...prevData, formatted].slice(-50);
          });
          setRealtimeCount(c => c + 1);
        }
      )
      .subscribe((status, err) => {
        if (err) {
          setRealtimeStatus(`WS Error: ${err.message || 'Unknown'}`);
        } else {
          setRealtimeStatus(status);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const latestData = data.length > 0 ? data[data.length - 1] : null;
  let comfortStatus = "Menganalisis...";
  let comfortColor = "#aaa";
  let comfortBg = "transparent";
  let comfortBorder = "transparent";

  if (latestData) {
    if (latestData.humidity <= 64.98) {
      comfortStatus = "Nyaman";
      comfortColor = "#2ecc71";
      comfortBg = "rgba(46, 204, 113, 0.2)";
      comfortBorder = "#2ecc71";
    } else {
      if (latestData.temperature <= 32.00) {
        comfortStatus = "Kurang Nyaman";
        comfortColor = "#f1c40f";
        comfortBg = "rgba(241, 196, 15, 0.2)";
        comfortBorder = "#f1c40f";
      } else {
        comfortStatus = "Tidak Nyaman";
        comfortColor = "#e74c3c";
        comfortBg = "rgba(231, 76, 60, 0.2)";
        comfortBorder = "#e74c3c";
      }
    }
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1>Ringkasan Real-time</h1>
        <p className="page-subtitle">Pemantauan Kualitas Udara Secara Langsung</p>
        <div style={{ marginTop: '10px', fontSize: '12px', color: realtimeStatus === 'SUBSCRIBED' ? '#2ecc71' : '#e74c3c' }}>
          Status Realtime: {realtimeStatus === 'SUBSCRIBED' ? `Terkoneksi (Live) - Data Masuk: ${realtimeCount}x` : realtimeStatus}
        </div>
      </div>

      {latestData ? (
        <div>
          {/* Comfort Badge Panel */}
          <div className="glass-card" style={{ textAlign: 'center', padding: '40px', marginBottom: '30px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: '-50%', left: '-50%', width: '200%', height: '200%', background: `radial-gradient(circle, ${comfortBg} 0%, transparent 70%)`, opacity: 0.5, zIndex: 0, pointerEvents: 'none' }}></div>
            
            <div style={{ position: 'relative', zIndex: 1 }}>
              <h3 style={{ margin: '0 0 20px 0', fontWeight: 600, color: '#eee', fontSize: '20px' }}>Status Kondisi Ruangan</h3>
              <div style={{ 
                display: 'inline-block',
                padding: '15px 45px',
                borderRadius: '50px',
                fontWeight: 800,
                fontSize: '28px',
                color: comfortColor,
                backgroundColor: comfortBg,
                border: `2px solid ${comfortBorder}`,
                boxShadow: `0 0 30px ${comfortBg}`,
                textTransform: 'uppercase',
                letterSpacing: '1px'
              }}>
                {comfortStatus}
              </div>
              <p style={{ fontSize: '14px', color: '#aaa', marginTop: '25px' }}>
                Pembaruan Terakhir: {latestData.timeFormatted}
              </p>
            </div>
          </div>

          {/* Sensor Cards Panel */}
          <div className="glass-card" style={{ padding: '30px' }}>
            <h3 style={{ margin: '0 0 25px 0', fontWeight: 600, color: '#eee', fontSize: '18px' }}>Parameter Sensor Saat Ini</h3>
            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '180px', background: 'rgba(0,0,0,0.2)', padding: '25px', borderRadius: '15px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.05)', transition: 'transform 0.3s', cursor: 'default' }} onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-5px)'} onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
                <div style={{ fontSize: '13px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '15px' }}>Temperature</div>
                <div style={{ fontSize: '36px', fontWeight: '800', color: '#00f2fe' }}>{latestData.temperature?.toFixed(2)}<span style={{fontSize:'18px', marginLeft:'5px', color:'#fff'}}>°C</span></div>
              </div>
              
              <div style={{ flex: 1, minWidth: '180px', background: 'rgba(0,0,0,0.2)', padding: '25px', borderRadius: '15px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.05)', transition: 'transform 0.3s', cursor: 'default' }} onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-5px)'} onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
                <div style={{ fontSize: '13px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '15px' }}>Humidity</div>
                <div style={{ fontSize: '36px', fontWeight: '800', color: '#00f2fe' }}>{latestData.humidity?.toFixed(2)}<span style={{fontSize:'18px', marginLeft:'5px', color:'#fff'}}>%</span></div>
              </div>
              
              <div style={{ flex: 1, minWidth: '180px', background: 'rgba(0,0,0,0.2)', padding: '25px', borderRadius: '15px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.05)', transition: 'transform 0.3s', cursor: 'default' }} onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-5px)'} onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
                <div style={{ fontSize: '13px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '15px' }}>Pressure</div>
                <div style={{ fontSize: '36px', fontWeight: '800', color: '#00f2fe' }}>{latestData.pressure?.toFixed(0)}<span style={{fontSize:'16px', marginLeft:'5px', color:'#fff'}}>hPa</span></div>
              </div>
              
              <div style={{ flex: 1, minWidth: '180px', background: 'rgba(0,0,0,0.2)', padding: '25px', borderRadius: '15px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.05)', transition: 'transform 0.3s', cursor: 'default' }} onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-5px)'} onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
                <div style={{ fontSize: '13px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '15px' }}>VOC Gas</div>
                <div style={{ fontSize: '36px', fontWeight: '800', color: '#00f2fe' }}>{latestData.voc?.toFixed(2)}<span style={{fontSize:'16px', marginLeft:'5px', color:'#fff'}}>KΩ</span></div>
              </div>
              
              <div style={{ flex: 1, minWidth: '180px', background: 'rgba(0,0,0,0.2)', padding: '25px', borderRadius: '15px', textAlign: 'center', border: latestData.pir === 1 ? '1px solid #e74c3c' : '1px solid rgba(255,255,255,0.05)', transition: 'transform 0.3s', cursor: 'default' }} onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-5px)'} onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
                <div style={{ fontSize: '13px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '15px' }}>Motion (PIR)</div>
                <div style={{ fontSize: '32px', fontWeight: '800', color: latestData.pir === 1 ? '#e74c3c' : '#eee' }}>
                  {latestData.pir === 1 ? 'Terdeteksi' : 'Aman'}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="glass-card" style={{ padding: '50px', textAlign: 'center', color: 'var(--text-muted)' }}>
          Mengambil data real-time...
        </div>
      )}
    </div>
  );
}
