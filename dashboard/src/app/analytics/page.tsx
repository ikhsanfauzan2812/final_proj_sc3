'use client';

import React, { useState, useEffect } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine 
} from 'recharts';
import { format } from 'date-fns';
import { supabase } from '../../lib/supabaseClient';

export default function Analytics() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const today = new Date();
  const lastWeek = new Date();
  lastWeek.setDate(today.getDate() - 7);
  
  const [startDate, setStartDate] = useState(lastWeek.toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(today.toISOString().split('T')[0]);
  const [forecastHours, setForecastHours] = useState('12');

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const { data: supaData, error: supaErr } = await supabase
        .from('sensor_data')
        .select('*')
        .gte('created_at', startDate + 'T00:00:00Z')
        .lte('created_at', endDate + 'T23:59:59Z')
        .order('created_at', { ascending: true });
        
      if (supaErr) throw supaErr;

      const parsedData = (supaData || []).map((d: any) => ({
        ...d,
        timestamp: new Date(d.created_at).getTime(),
        timeFormatted: format(new Date(d.created_at), 'dd MMM HH:mm')
      }));
      
      setData(parsedData);
    } catch (err: any) {
      setError(err.message || 'Gagal mengambil riwayat data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();
    fetchData();
  };

  const lastDataTime = data.length > 0 ? data[data.length - 1].timestamp : null;

  const renderMetric = (label: string, dataKey: string, unit: string) => {
    if (data.length === 0) return '--';
    const sum = data.reduce((acc, curr) => acc + (curr[dataKey] || 0), 0);
    const avg = sum / data.length;
    return `${avg.toFixed(2)} ${unit}`;
  };

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1>Analitik & Historis</h1>
        <p className="page-subtitle">Pantau pola kualitas udara dan optimalkan kenyamanan ruangan Anda.</p>
      </div>

      <div className="main-grid">
        <aside className="glass-card sidebar" style={{ position: 'relative', width: 'auto', borderRight: 'none', padding: '24px' }}>
          <h3>Filter Data</h3>
          <form onSubmit={handleApply}>
            <div className="input-group">
              <label>Tanggal Mulai</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
            </div>
            <div className="input-group">
              <label>Tanggal Selesai</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
            </div>
            <div className="input-group">
              <label>Forecasting (Jam)</label>
              <select value={forecastHours} onChange={(e) => setForecastHours(e.target.value)}>
                <option value="6">6 Jam Kedepan</option>
                <option value="12">12 Jam Kedepan</option>
                <option value="24">24 Jam Kedepan</option>
                <option value="48">48 Jam Kedepan</option>
              </select>
            </div>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Memuat...' : 'Terapkan Filter'}
            </button>
          </form>

          {error && <div className="error-msg">{error}</div>}

          <div className="metrics-box mt-4" style={{ marginTop: '30px' }}>
            <h4>Rata-rata Periode Ini</h4>
            <div className="metric-row">
              <span>Temperature</span>
              <strong>{renderMetric('Temperature', 'temperature', '°C')}</strong>
            </div>
            <div className="metric-row">
              <span>Humidity</span>
              <strong>{renderMetric('Humidity', 'humidity', '%')}</strong>
            </div>
            <div className="metric-row">
              <span>Pressure</span>
              <strong>{renderMetric('Pressure', 'pressure', 'hPa')}</strong>
            </div>
            <div className="metric-row">
              <span>VOC Gas</span>
              <strong>{renderMetric('VOC', 'voc', 'KΩ')}</strong>
            </div>
          </div>
        </aside>

        <section className="charts-area">
          {loading && data.length === 0 ? (
            <div className="loading-state">Memuat dan menyusun data analitik...</div>
          ) : data.length === 0 ? (
            <div className="empty-state">Tidak ada data di rentang waktu tersebut.</div>
          ) : (
            <>
              <ChartCard 
                title="Suhu / Temperature (°C)" 
                data={data} 
                histKey="temperature" 
                fcKey="tempForecast" 
                lastTime={lastDataTime} 
              />
              <ChartCard 
                title="Kelembapan / Humidity (%)" 
                data={data} 
                histKey="humidity" 
                fcKey="humForecast" 
                lastTime={lastDataTime} 
              />
              <ChartCard 
                title="Gas Volatile / VOC (KΩ)" 
                data={data} 
                histKey="voc" 
                fcKey="vocForecast" 
                lastTime={lastDataTime} 
              />
              <ChartCard 
                title="Tekanan Udara / Pressure (hPa)" 
                data={data} 
                histKey="pressure" 
                fcKey="pressureForecast" 
                lastTime={lastDataTime} 
              />
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function ChartCard({ title, data, histKey, fcKey, lastTime }: { title: string, data: any[], histKey: string, fcKey: string, lastTime: number | null }) {
  return (
    <div className="glass-card chart-card">
      <h3>{title}</h3>
      <div className="chart-wrapper">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
            <XAxis 
              dataKey="timeFormatted" 
              stroke="#888" 
              tick={{fill: '#888', fontSize: 12}}
              minTickGap={50}
            />
            <YAxis 
              stroke="#888" 
              tick={{fill: '#888'}} 
              domain={['auto', 'auto']}
            />
            <Tooltip 
              contentStyle={{ backgroundColor: 'rgba(15, 32, 39, 0.9)', border: '1px solid #333', borderRadius: '10px' }}
              labelStyle={{ color: '#fff' }}
            />
            <Legend wrapperStyle={{ paddingTop: '20px' }} />
            
            {lastTime && (
              <ReferenceLine x={format(new Date(lastTime), 'dd MMM HH:mm')} stroke="rgba(255,255,255,0.5)" strokeDasharray="3 3" label={{ position: 'top', value: 'Sekarang', fill: '#fff' }} />
            )}
            
            <Line 
              type="monotone" 
              dataKey={histKey} 
              name="Data Historis (Asli)" 
              stroke="#00f2fe" 
              strokeWidth={2} 
              dot={false}
              activeDot={{ r: 8 }} 
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
