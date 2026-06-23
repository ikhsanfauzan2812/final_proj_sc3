'use client';

import React, { useState, useEffect } from 'react';
import { Wifi, Save, AlertCircle, CheckCircle2, Cloud, Router } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

export default function ConfigPage() {
  const [ssid, setSsid] = useState('');
  const [password, setPassword] = useState('');
  const [method, setMethod] = useState<'cloud' | 'direct'>('cloud');
  const [deviceIp, setDeviceIp] = useState('192.168.4.1');
  const [pairedDevice, setPairedDevice] = useState<any>(null);

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  // Ambil device yang ter-pair untuk mendapatkan mac_address
  useEffect(() => {
    const fetchDevice = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      const { data } = await supabase
        .from('devices')
        .select('*')
        .eq('owner_id', session.user.id)
        .limit(1)
        .single();
      if (data) setPairedDevice(data);
    };
    fetchDevice();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ssid) {
      setStatus('error');
      setMessage('Nama Wi-Fi (SSID) tidak boleh kosong.');
      return;
    }

    setLoading(true);
    setStatus('idle');

    try {
      if (method === 'cloud') {
        // Kirim perintah SET_WIFI via Supabase — ESP32 polling dan eksekusi
        if (!pairedDevice) throw new Error('Tidak ada perangkat yang terpasang. Lakukan pairing terlebih dahulu.');

        const payload = JSON.stringify({ ssid, password });
        const { error } = await supabase
          .from('device_commands')
          .insert({
            mac_address: pairedDevice.mac_address,
            command: 'SET_WIFI',
            payload,
            status: 'pending'
          });

        if (error) throw error;

        setStatus('success');
        setMessage(`Perintah ganti Wi-Fi ke "${ssid}" berhasil dikirim ke cloud. ESP32 akan mengambil perintah ini saat polling berikutnya (~5 detik) dan restart otomatis.`);
      } else {
        // Kirim langsung ke ESP32 via HTTP (harus 1 jaringan)
        const params = new URLSearchParams();
        params.append('ssid', ssid);
        params.append('password', password);

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);

        const response = await fetch(`http://${deviceIp}/api/wifi`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: params.toString(),
          signal: controller.signal
        });
        clearTimeout(timeout);

        if (response.ok) {
          setStatus('success');
          setMessage('Konfigurasi berhasil dikirim langsung! Perangkat akan restart dan mencoba terhubung ke jaringan baru.');
        } else {
          throw new Error(`Perangkat merespons dengan status ${response.status}`);
        }
      }
      setSsid('');
      setPassword('');
    } catch (err: any) {
      setStatus('error');
      if (err.name === 'AbortError') {
        setMessage('Koneksi timeout. Pastikan Anda terhubung ke jaringan yang sama dengan ESP32.');
      } else {
        setMessage(err.message || 'Terjadi kesalahan.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1>Konfigurasi Jaringan</h1>
        <p className="page-subtitle">Atur koneksi Wi-Fi untuk perangkat Smart Climate Controller</p>
      </div>

      <div style={{ maxWidth: '600px', margin: '0 auto' }}>

        {/* Method Selector */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
          <button
            onClick={() => setMethod('cloud')}
            style={{
              flex: 1, padding: '16px', borderRadius: '12px', cursor: 'pointer',
              border: method === 'cloud' ? '1px solid #00f2fe' : '1px solid rgba(255,255,255,0.08)',
              background: method === 'cloud' ? 'rgba(0,242,254,0.08)' : 'rgba(255,255,255,0.02)',
              color: method === 'cloud' ? '#00f2fe' : '#aaa',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
              transition: 'all 0.2s'
            }}
          >
            <Cloud size={22} />
            <span style={{ fontSize: '13px', fontWeight: 600 }}>Via Cloud</span>
            <span style={{ fontSize: '11px', opacity: 0.7, textAlign: 'center' }}>Kirim lewat Supabase.<br/>ESP32 tidak perlu 1 jaringan.</span>
          </button>

          <button
            onClick={() => setMethod('direct')}
            style={{
              flex: 1, padding: '16px', borderRadius: '12px', cursor: 'pointer',
              border: method === 'direct' ? '1px solid #4facfe' : '1px solid rgba(255,255,255,0.08)',
              background: method === 'direct' ? 'rgba(79,172,254,0.08)' : 'rgba(255,255,255,0.02)',
              color: method === 'direct' ? '#4facfe' : '#aaa',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
              transition: 'all 0.2s'
            }}
          >
            <Router size={22} />
            <span style={{ fontSize: '13px', fontWeight: 600 }}>Via Langsung</span>
            <span style={{ fontSize: '11px', opacity: 0.7, textAlign: 'center' }}>HTTP ke ESP32.<br/>Harus 1 jaringan / hotspot.</span>
          </button>
        </div>

        <div className="glass-card" style={{ padding: '30px' }}>

          {/* Info banner */}
          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px 20px', borderRadius: '10px', marginBottom: '25px', fontSize: '13px', color: '#ccc', lineHeight: 1.7 }}>
            {method === 'cloud' ? (
              <>
                <strong style={{ color: '#00f2fe' }}>Mode Cloud (Direkomendasikan)</strong><br />
                Perintah dikirim ke Supabase. ESP32 yang sedang online akan mengambil
                perintah ini saat polling berikutnya (~5 detik) dan restart otomatis.<br />
                <span style={{ color: '#f1c40f' }}>⚠ ESP32 harus sedang online dan terhubung ke internet.</span>
              </>
            ) : (
              <>
                <strong style={{ color: '#4facfe' }}>Mode Langsung (Fallback)</strong><br />
                1. Jika ESP32 tidak konek WiFi manapun, ia membuat hotspot <strong>ClimateController</strong> (password: <code>12345678</code>).<br />
                2. Hubungkan laptop ke hotspot tersebut, biarkan IP <strong>192.168.4.1</strong>.<br />
                3. Jika ESP32 sudah online di jaringan lokal, ganti IP dengan IP lokalnya.
              </>
            )}
          </div>

          <form onSubmit={handleSave}>
            {/* IP field — hanya untuk mode direct */}
            {method === 'direct' && (
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: '#eee', fontWeight: 500 }}>
                  IP Perangkat
                </label>
                <input
                  type="text"
                  value={deviceIp}
                  onChange={(e) => setDeviceIp(e.target.value)}
                  placeholder="192.168.4.1"
                  style={{
                    width: '100%', padding: '14px 15px', borderRadius: '10px', boxSizing: 'border-box',
                    background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)',
                    color: '#fff', fontSize: '15px', outline: 'none'
                  }}
                  required
                />
              </div>
            )}

            {/* Device info untuk mode cloud */}
            {method === 'cloud' && (
              <div style={{ marginBottom: '20px', padding: '12px 16px', borderRadius: '10px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.05)', fontSize: '13px', color: '#aaa' }}>
                Target perangkat: {pairedDevice
                  ? <strong style={{ color: '#00f2fe' }}>{pairedDevice.device_name} ({pairedDevice.mac_address})</strong>
                  : <span style={{ color: '#e74c3c' }}>Belum ada perangkat terpasang</span>
                }
              </div>
            )}

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: '#eee', fontWeight: 500 }}>
                Nama Wi-Fi Baru (SSID)
              </label>
              <input
                type="text"
                value={ssid}
                onChange={(e) => setSsid(e.target.value)}
                placeholder="Masukkan nama Wi-Fi..."
                style={{
                  width: '100%', padding: '14px 15px', borderRadius: '10px', boxSizing: 'border-box',
                  background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)',
                  color: '#fff', fontSize: '15px', outline: 'none'
                }}
                required
              />
            </div>

            <div style={{ marginBottom: '30px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: '#eee', fontWeight: 500 }}>
                Password Wi-Fi
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Masukkan password Wi-Fi..."
                style={{
                  width: '100%', padding: '14px 15px', borderRadius: '10px', boxSizing: 'border-box',
                  background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)',
                  color: '#fff', fontSize: '15px', outline: 'none'
                }}
              />
              <div style={{ fontSize: '12px', color: '#666', marginTop: '6px' }}>Kosongkan jika jaringan tidak menggunakan password.</div>
            </div>

            {status === 'success' && (
              <div style={{ padding: '15px', borderRadius: '10px', background: 'rgba(46,204,113,0.1)', border: '1px solid rgba(46,204,113,0.3)', color: '#2ecc71', display: 'flex', gap: '10px', marginBottom: '20px', alignItems: 'flex-start' }}>
                <CheckCircle2 size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
                <div style={{ fontSize: '13px', lineHeight: 1.6 }}>{message}</div>
              </div>
            )}

            {status === 'error' && (
              <div style={{ padding: '15px', borderRadius: '10px', background: 'rgba(231,76,60,0.1)', border: '1px solid rgba(231,76,60,0.3)', color: '#e74c3c', display: 'flex', gap: '10px', marginBottom: '20px', alignItems: 'flex-start' }}>
                <AlertCircle size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
                <div style={{ fontSize: '13px', lineHeight: 1.6 }}>{message}</div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || (method === 'cloud' && !pairedDevice)}
              style={{
                width: '100%', padding: '16px', borderRadius: '10px',
                background: loading ? '#444' : `linear-gradient(135deg, ${method === 'cloud' ? '#00f2fe 0%, #4facfe' : '#4facfe 0%, #00f2fe'} 100%)`,
                border: 'none', color: '#fff', fontSize: '16px', fontWeight: 600,
                cursor: (loading || (method === 'cloud' && !pairedDevice)) ? 'not-allowed' : 'pointer',
                display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px',
                opacity: (loading || (method === 'cloud' && !pairedDevice)) ? 0.6 : 1,
                transition: 'opacity 0.2s'
              }}
            >
              <Save size={20} />
              {loading ? 'Mengirim...' : method === 'cloud' ? 'Kirim via Cloud' : 'Kirim Langsung ke ESP32'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
