'use client';

import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { supabase } from '../lib/supabaseClient';
import { Wifi, Plus, CheckCircle2, AlertCircle, RefreshCw, Cpu, Activity, Link2Off, Circle } from 'lucide-react';

export default function Dashboard() {
  const [data, setData] = useState<any[]>([]);
  const [realtimeStatus, setRealtimeStatus] = useState('Initializing App...');
  const [realtimeCount, setRealtimeCount] = useState(0);

  // Auth & Device Pairing States
  const [user, setUser] = useState<any>(null);
  const [pairedDevices, setPairedDevices] = useState<any[]>([]);
  const [publicIp, setPublicIp] = useState<string>('');
  const [discoveredDevice, setDiscoveredDevice] = useState<any | null>(null);
  const [deviceOnline, setDeviceOnline] = useState<boolean>(false);
  
  // Pairing Form States
  const [deviceName, setDeviceName] = useState('AC Kamar Utama');
  const [pairingLoading, setPairingLoading] = useState(false);
  const [pairingStatus, setPairingStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [pairingMessage, setPairingMessage] = useState('');

  // Unpair Confirmation Modal
  const [unpairModal, setUnpairModal] = useState<{ open: boolean; macAddress: string }>({ open: false, macAddress: '' });
  const [unpairLoading, setUnpairLoading] = useState(false);

  // Fetch Session & Public IP on mount
  useEffect(() => {
    const initAuthAndDiscovery = async () => {
      try {
        // 1. Get active user session
        const { data: { session } } = await supabase.auth.getSession();
        let currentDevices: any[] = [];

        if (session?.user) {
          setUser(session.user);
          
          // Fetch user's currently paired devices
          const { data: devices } = await supabase
            .from('devices')
            .select('*')
            .eq('owner_id', session.user.id);
          
          currentDevices = devices || [];
          setPairedDevices(currentDevices);
        }

        // 2. Fetch browser public IP
        const ipRes = await fetch('https://api.ipify.org?format=json');
        const ipData = await ipRes.json();
        const userIp = ipData.ip;
        setPublicIp(userIp);

        console.log('[Discovery] currentDevices.length:', currentDevices.length);
        if (currentDevices.length === 0) {
          const { data: unpaired } = await supabase
            .from('devices')
            .select('mac_address, device_name, last_seen, status, last_ip')
            .is('owner_id', null);

          if (unpaired && unpaired.length > 0) {
            const now = Date.now();
            const activeDevice = unpaired.find((d: any) => {
              if (!d.last_seen) return false;
              const lastSeen = new Date(d.last_seen).getTime();
              const ageMs = now - lastSeen;
              return ageMs <= 60 * 1000; // aktif dalam 60 detik (heartbeat ESP32 = 20 detik)
            });

            if (activeDevice) setDiscoveredDevice(activeDevice);
          }
        }
      } catch (err) {
        console.error("Auth / Discovery init failed:", err);
      }
    };

    initAuthAndDiscovery();

    // Listen for auth session changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setUser(session.user);
        const { data: devices } = await supabase
          .from('devices')
          .select('*')
          .eq('owner_id', session.user.id);
        setPairedDevices(devices || []);
      } else {
        setUser(null);
        setPairedDevices([]);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Fetch data sensor realtime dari Supabase berdasarkan mac_address perangkat yang ter-pair
  useEffect(() => {
    if (pairedDevices.length === 0) {
      setData([]);
      setRealtimeStatus('Belum ada perangkat terhubung.');
      setRealtimeCount(0);
      return;
    }

    setRealtimeStatus('Connecting to Supabase...');

    const macs = pairedDevices.map((d: any) => d.mac_address);

    const parseRow = (d: any) => {
      const safeDateStr = typeof d.created_at === 'string' ? d.created_at.replace(' ', 'T') : d.created_at;
      const dateObj = new Date(safeDateStr);
      const ts = isNaN(dateObj.getTime()) ? Date.now() : dateObj.getTime();
      return {
        ...d,
        timestamp: ts,
        timeFormatted: format(ts, 'dd MMM HH:mm:ss'),
      };
    };

    const checkDeviceOnline = (latestTs: number) => {
      // Device dianggap online jika data terakhir masuk dalam 30 detik terakhir
      const ageSeconds = (Date.now() - latestTs) / 1000;
      setDeviceOnline(ageSeconds <= 30);
    };

    const fetchInitialData = async () => {
      try {
        const { data: supaData, error } = await supabase
          .from('sensor_data')
          .select('*')
          .in('mac_address', macs)
          .order('created_at', { ascending: false })
          .limit(50);

        if (error) throw error;

        if (supaData && supaData.length > 0) {
          const parsed = supaData.reverse().map(parseRow);
          setData(parsed);
          checkDeviceOnline(parsed[parsed.length - 1].timestamp);
        } else {
          setData([]);
          setRealtimeStatus('Menunggu data dari perangkat...');
        }
      } catch (err: any) {
        setRealtimeStatus(`Fetch Error: ${err.message}`);
      }
    };

    fetchInitialData();

    let pollInterval: NodeJS.Timeout | null = null;

    // Bersihkan channel lama sebelum membuat yang baru
    const channelName = 'sensor-stream';
    const existingChannels = supabase.getChannels();
    existingChannels.forEach(c => {
      if (c.topic === `realtime:${channelName}`) supabase.removeChannel(c);
    });

    const channel = supabase.channel(channelName);

    channel
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'sensor_data' },
        (payload) => {
          const newDoc = payload.new as any;
          if (!newDoc || newDoc.temperature == null) return;

          // Terima data hanya jika mac_address cocok dengan perangkat yang ter-pair
          const macMatches = macs.includes(newDoc.mac_address);
          if (!macMatches) return;

          const formatted = parseRow(newDoc);

          setData((prevData) => {
            // Hindari duplikat berdasarkan id atau timestamp
            const isDuplicate = prevData.some(
              (d) => d.id === formatted.id || (d.timestamp === formatted.timestamp && d.temperature === formatted.temperature)
            );
            if (isDuplicate) return prevData;
            const next = [...prevData, formatted].slice(-50);
            checkDeviceOnline(formatted.timestamp);
            return next;
          });
          setRealtimeCount((c) => c + 1);
        }
      )
      .subscribe((status, err) => {
        if (err) {
          setRealtimeStatus(`WS Error: ${err.message || 'Unknown'}`);
          // Aktifkan polling sebagai fallback
          if (!pollInterval) {
            pollInterval = setInterval(fetchInitialData, 10000);
          }
        } else {
          if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR') {
            setRealtimeStatus(`Polling Mode (WS ${status})`);
            if (!pollInterval) {
              pollInterval = setInterval(fetchInitialData, 10000);
            }
          } else if (status === 'SUBSCRIBED') {
            setRealtimeStatus('SUBSCRIBED');
            if (pollInterval) {
              clearInterval(pollInterval);
              pollInterval = null;
            }
          } else {
            setRealtimeStatus(status);
          }
        }
      });

    return () => {
      supabase.removeChannel(channel);
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [pairedDevices]);

  // Handle Pairing submission
  const handlePairDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!discoveredDevice || !user) return;

    setPairingLoading(true);
    setPairingStatus('idle');

    try {
      const macAddress = discoveredDevice.mac_address;

      // 1. Claim device ownership in Supabase
      const { data, error } = await supabase
        .from('devices')
        .upsert({
          mac_address: macAddress,
          device_name: deviceName,
          owner_id: user.id,
          paired_at: new Date().toISOString(),
          last_ip: publicIp || '127.0.0.1',
          status: 'online'
        })
        .select();

      if (error) throw error;

      // 2. Backfill: update semua baris sensor_data yang mac_address-nya NULL
      //    dengan MAC address perangkat yang baru saja di-pair.
      //    Ini memperbaiki data historis yang dikirim sebelum kolom mac_address ada.
      const { error: backfillError, count } = await supabase
        .from('sensor_data')
        .update({ mac_address: macAddress })
        .is('mac_address', null);

      if (backfillError) {
        // Backfill gagal tidak fatal — tampilkan warning tapi lanjutkan
        console.warn('[Backfill] Gagal update data lama:', backfillError.message);
      } else {
        console.log(`[Backfill] Berhasil update ${count ?? 'semua'} baris data lama dengan MAC ${macAddress}`);
      }

      setPairingStatus('success');
      setPairingMessage(`Perangkat "${deviceName}" berhasil dipasangkan! Data historis telah diperbarui.`);

      // Update local paired list
      setPairedDevices(data);

      // Hide pairing banner after success
      setTimeout(() => {
        setDiscoveredDevice(null);
        setPairingStatus('idle');
      }, 3000);
    } catch (err: any) {
      setPairingStatus('error');
      setPairingMessage(err.message || 'Gagal memasangkan perangkat.');
    } finally {
      setPairingLoading(false);
    }
  };

  // Handle Unpair action
  const handleUnpairDevice = async (macAddress: string) => {
    setUnpairModal({ open: true, macAddress });
  };

  const confirmUnpair = async () => {
    setUnpairLoading(true);
    try {
      const { error } = await supabase
        .from('devices')
        .update({
          owner_id: null,
          paired_at: null
        })
        .eq('mac_address', unpairModal.macAddress);

      if (error) throw error;

      setPairedDevices([]);
      setUnpairModal({ open: false, macAddress: '' });
      window.location.reload();
    } catch (err: any) {
      setUnpairModal({ open: false, macAddress: '' });
      alert(`Gagal memutuskan hubungan: ${err.message}`);
    } finally {
      setUnpairLoading(false);
    }
  };

  const latestData = data.length > 0 ? data[data.length - 1] : null;
  let comfortStatus = "Menganalisis...";
  let comfortColor = "#aaa";
  let comfortBg = "transparent";
  let comfortBorder = "transparent";

  if (latestData) {
    if (latestData.humidity > 79.99) {
      comfortStatus = "Tidak Nyaman";
      comfortColor = "#e74c3c";
      comfortBg = "rgba(231, 76, 60, 0.2)";
      comfortBorder = "#e74c3c";
    } else if (latestData.temperature <= 29.01) {
      comfortStatus = "Nyaman";
      comfortColor = "#2ecc71";
      comfortBg = "rgba(46, 204, 113, 0.2)";
      comfortBorder = "#2ecc71";
    } else {
      comfortStatus = "Kurang Nyaman";
      comfortColor = "#f1c40f";
      comfortBg = "rgba(241, 196, 15, 0.2)";
      comfortBorder = "#f1c40f";
    }
  }

  return (
    <div className="animate-fade-in" style={{ width: '100%' }}>
      
      {/* PAGE HEADER */}
      <div className="page-header">
        <h1>Ringkasan Real-time</h1>
        <p className="page-subtitle">Pemantauan Kualitas Udara Secara Langsung</p>
        <div style={{ marginTop: '10px', display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', color: realtimeStatus === 'SUBSCRIBED' ? '#2ecc71' : '#e74c3c', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Activity size={14} /> Realtime: {realtimeStatus === 'SUBSCRIBED' ? `Terkoneksi (Live) - ${realtimeCount}x` : realtimeStatus}
          </span>
          {pairedDevices.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              {/* Status dot online/offline */}
              <span style={{ fontSize: '12px', color: '#00f2fe', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Cpu size={14} />
                <strong>{pairedDevices[0].device_name}</strong>
                <span style={{ color: '#aaa', fontSize: '11px' }}>({pairedDevices[0].mac_address})</span>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '4px',
                  padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: 600,
                  background: deviceOnline ? 'rgba(46,204,113,0.15)' : 'rgba(150,150,150,0.15)',
                  border: `1px solid ${deviceOnline ? 'rgba(46,204,113,0.4)' : 'rgba(150,150,150,0.3)'}`,
                  color: deviceOnline ? '#2ecc71' : '#888',
                }}>
                  <Circle size={6} fill={deviceOnline ? '#2ecc71' : '#888'} stroke="none" />
                  {deviceOnline ? 'Online' : 'Offline'}
                </span>
              </span>
              <button
                onClick={() => handleUnpairDevice(pairedDevices[0].mac_address)}
                style={{
                  background: 'rgba(231, 76, 60, 0.1)',
                  border: '1px solid rgba(231, 76, 60, 0.3)',
                  color: '#e74c3c',
                  padding: '3px 10px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(231, 76, 60, 0.2)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(231, 76, 60, 0.1)'}
              >
                <Link2Off size={12} />
                Unpair
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 1. AUTO-DISCOVERY SCANNING BANNER */}
      {discoveredDevice && (
        <div className="glass-card animate-fade-in" style={{ 
          background: 'linear-gradient(135deg, rgba(0, 242, 254, 0.08) 0%, rgba(79, 172, 254, 0.05) 100%)', 
          borderColor: 'rgba(0, 242, 254, 0.25)',
          padding: '30px', 
          marginBottom: '35px',
          boxShadow: '0 10px 30px rgba(0, 242, 254, 0.1)'
        }}>
          <div style={{ display: 'flex', gap: '25px', flexWrap: 'wrap', alignItems: 'center' }}>
            
            {/* Radar Pulse Animation */}
            <div style={{ position: 'relative', width: '60px', height: '60px', flexShrink: 0 }}>
              <div style={{
                position: 'absolute', width: '100%', height: '100%', borderRadius: '50%',
                background: 'rgba(0, 242, 254, 0.2)', border: '2px solid #00f2fe',
                animation: 'radarPulse 2s infinite ease-out'
              }} />
              <div style={{
                position: 'absolute', width: '100%', height: '100%', borderRadius: '50%',
                background: 'rgba(0, 242, 254, 0.2)', border: '2px solid #00f2fe',
                animation: 'radarPulse 2s infinite ease-out', animationDelay: '1s'
              }} />
              <div style={{
                position: 'absolute', top: '15px', left: '15px', width: '30px', height: '30px', borderRadius: '50%',
                background: 'linear-gradient(135deg, #00f2fe 0%, #4facfe 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
                boxShadow: '0 0 15px #00f2fe'
              }}>
                <Wifi size={16} />
              </div>
            </div>
            
            <style dangerouslySetInnerHTML={{ __html: `
              @keyframes radarPulse {
                0% { transform: scale(0.8); opacity: 1; }
                100% { transform: scale(1.6); opacity: 0; }
              }
            `}} />

            {/* Content text */}
            <div style={{ flex: 1, minWidth: '250px' }}>
              <h3 style={{ margin: '0 0 5px 0', color: '#00f2fe', fontSize: '18px', fontWeight: 700 }}>
                📡 Perangkat Sekitar Terdeteksi!
              </h3>
              <p style={{ margin: 0, fontSize: '14px', color: '#ccc', lineHeight: 1.5 }}>
                Ada 1 perangkat <strong>Smart Climate Controller</strong> yang belum terpasang terdeteksi di Wi-Fi Anda (MAC: <code style={{ color: '#00f2fe', background: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: '4px' }}>{discoveredDevice.mac_address}</code>).
              </p>
            </div>

            {/* Interactive Form */}
            <form onSubmit={handlePairDevice} style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', width: '100%', maxWidth: '420px', marginTop: '10px' }}>
              <input
                type="text"
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                placeholder="Beri nama alat (misal: AC Kamar)"
                style={{
                  flex: 1, padding: '12px 15px', borderRadius: '8px',
                  background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(0,242,254,0.2)',
                  color: '#fff', fontSize: '14px', outline: 'none'
                }}
                required
                disabled={pairingLoading || pairingStatus === 'success'}
              />
              <button
                type="submit"
                disabled={pairingLoading || pairingStatus === 'success'}
                style={{
                  padding: '12px 25px', borderRadius: '8px',
                  background: 'linear-gradient(135deg, #00f2fe 0%, #4facfe 100%)',
                  border: 'none', color: '#fff', fontSize: '14px', fontWeight: 600,
                  cursor: pairingLoading ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 15px rgba(0, 242, 254, 0.25)',
                  display: 'flex', alignItems: 'center', gap: '8px'
                }}
              >
                <Plus size={16} />
                {pairingLoading ? 'Menyambungkan...' : 'Hubungkan Alat'}
              </button>
            </form>
          </div>

          {/* Form Notifications */}
          {pairingStatus === 'success' && (
            <div style={{ padding: '12px', borderRadius: '8px', background: 'rgba(46, 204, 113, 0.1)', border: '1px solid rgba(46, 204, 113, 0.3)', color: '#2ecc71', display: 'flex', gap: '10px', marginTop: '15px', alignItems: 'center', fontSize: '13px' }}>
              <CheckCircle2 size={16} />
              <div>{pairingMessage}</div>
            </div>
          )}

          {pairingStatus === 'error' && (
            <div style={{ padding: '12px', borderRadius: '8px', background: 'rgba(231, 76, 60, 0.1)', border: '1px solid rgba(231, 76, 60, 0.3)', color: '#e74c3c', display: 'flex', gap: '10px', marginTop: '15px', alignItems: 'center', fontSize: '13px' }}>
              <AlertCircle size={16} />
              <div>{pairingMessage}</div>
            </div>
          )}
        </div>
      )}

      {/* 2. ONBOARDING WELCOME CARD IF NO PAIRED DEVICES */}
      {pairedDevices.length === 0 && !discoveredDevice && (
        <div className="glass-card animate-fade-in" style={{ 
          textAlign: 'center', 
          padding: '50px 30px', 
          marginBottom: '35px',
          border: '1px dashed rgba(255, 255, 255, 0.15)',
          background: 'rgba(255, 255, 255, 0.02)'
        }}>
          <div style={{ 
            background: 'rgba(255,255,255,0.03)', 
            borderRadius: '50%', 
            width: '80px', 
            height: '80px', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            margin: '0 auto 25px auto',
            color: 'var(--text-muted)'
          }}>
            <Cpu size={36} />
          </div>
          <h2 style={{ color: '#fff', fontSize: '22px', fontWeight: 700, margin: '0 0 10px 0' }}>
            Selamat Datang di Smart Compact Climate Controller!
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', maxWidth: '550px', margin: '0 auto 30px auto', lineHeight: 1.6 }}>
            Saat ini belum ada perangkat keras AC Controller yang terhubung ke akun Anda. 
            Nyalakan perangkat ESP32-C6 Anda, hubungkan ke Wi-Fi rumah, dan sistem akan secara otomatis mendeteksi dan menawarkan pairing di sini.
          </p>
          <button 
            onClick={() => window.location.reload()}
            style={{ 
              padding: '12px 25px', borderRadius: '30px', background: 'transparent',
              border: '1px solid rgba(255,255,255,0.2)', color: '#fff', fontSize: '13px',
              fontWeight: 500, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px',
              transition: 'background 0.2s'
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <RefreshCw size={14} /> Pindai Ulang Jaringan
          </button>
        </div>
      )}

      {/* 3. CORE SENSOR INDICATORS (HANYA MUNCUL JIKA ADA ALAT TERHUBUNG) */}
      {pairedDevices.length > 0 && (
        latestData ? (
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
                  <div style={{ fontSize: '32px', fontWeight: '800', color: '#e74c3c' }}>
                    Ada
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="glass-card" style={{ padding: '50px', textAlign: 'center', color: 'var(--text-muted)' }}>
            Menunggu data pertama masuk dari perangkat terdaftar Anda...
          </div>
        )
      )}

      {/* UNPAIR CONFIRMATION MODAL */}
      {unpairModal.open && (
        <div
          onClick={() => !unpairLoading && setUnpairModal({ open: false, macAddress: '' })}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.65)',
            backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'fadeIn 0.2s ease',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'linear-gradient(135deg, rgba(28,28,40,0.98) 0%, rgba(20,20,32,0.98) 100%)',
              border: '1px solid rgba(231,76,60,0.3)',
              borderRadius: '20px',
              padding: '36px 32px 28px',
              width: '100%',
              maxWidth: '420px',
              boxShadow: '0 25px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)',
              animation: 'slideUp 0.25s cubic-bezier(0.175,0.885,0.32,1.275)',
              textAlign: 'center',
            }}
          >
            {/* Icon */}
            <div style={{
              width: '64px', height: '64px', borderRadius: '50%',
              background: 'rgba(231,76,60,0.12)',
              border: '1px solid rgba(231,76,60,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px',
              fontSize: '28px',
            }}>
              🔌
            </div>

            {/* Title */}
            <h2 style={{ color: '#fff', margin: '0 0 10px', fontSize: '20px', fontWeight: 700 }}>
              Putuskan Hubungan Perangkat?
            </h2>

            {/* Description */}
            <p style={{ color: '#999', fontSize: '14px', lineHeight: 1.6, margin: '0 0 8px' }}>
              Perangkat <span style={{ color: '#e74c3c', fontWeight: 600 }}>{pairedDevices[0]?.device_name}</span> akan dilepas dari akun Anda.
            </p>
            <p style={{ color: '#666', fontSize: '13px', margin: '0 0 28px' }}>
              Anda dapat mempasangkannya kembali kapan saja.
            </p>

            {/* MAC Address badge */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '8px', padding: '6px 12px', marginBottom: '28px',
              fontSize: '12px', color: '#aaa', fontFamily: 'monospace',
            }}>
              <Cpu size={12} color="#666" />
              {unpairModal.macAddress}
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setUnpairModal({ open: false, macAddress: '' })}
                disabled={unpairLoading}
                style={{
                  flex: 1, padding: '12px', borderRadius: '10px',
                  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                  color: '#ccc', fontSize: '14px', fontWeight: 600, cursor: 'pointer',
                  transition: 'all 0.2s', opacity: unpairLoading ? 0.5 : 1,
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
              >
                Batal
              </button>
              <button
                onClick={confirmUnpair}
                disabled={unpairLoading}
                style={{
                  flex: 1, padding: '12px', borderRadius: '10px',
                  background: unpairLoading
                    ? 'rgba(231,76,60,0.3)'
                    : 'linear-gradient(135deg, #e74c3c, #c0392b)',
                  border: 'none',
                  color: '#fff', fontSize: '14px', fontWeight: 700, cursor: unpairLoading ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: unpairLoading ? 'none' : '0 4px 15px rgba(231,76,60,0.35)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                }}
                onMouseEnter={e => { if (!unpairLoading) e.currentTarget.style.transform = 'translateY(-1px)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
              >
                {unpairLoading ? (
                  <>
                    <span style={{ display: 'inline-block', width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                    Memutuskan...
                  </>
                ) : (
                  <>
                    <Link2Off size={14} />
                    Ya, Putuskan
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
