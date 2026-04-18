'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Power, Droplets, Snowflake, Wind, Flame, Plus, Minus, ChevronDown } from 'lucide-react';

export default function RemoteControl() {
  const [acModel, setAcModel] = useState('GREE');
  const [acLoading, setAcLoading] = useState(false);
  
  // State for HA Climate Card
  const [temp, setTemp] = useState(22);
  const [mode, setMode] = useState('cool'); // cool, dry, fan, heat
  const [fanSpeed, setFanSpeed] = useState('auto'); // auto, low, mid, high
  const [isOn, setIsOn] = useState(true);

  // Interaction state
  const [isDragging, setIsDragging] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);

  const minTemp = 16;
  const maxTemp = 30;

  // Keep track of latest state for immediate syncing
  const stateRef = useRef({ temp, mode, fanSpeed, isOn, acModel });
  useEffect(() => {
    stateRef.current = { temp, mode, fanSpeed, isOn, acModel };
  }, [temp, mode, fanSpeed, isOn, acModel]);

  const sendCommand = async (overrides: Partial<typeof stateRef.current> = {}) => {
    const s = { ...stateRef.current, ...overrides };
    setAcLoading(true);
    
    const payloadJson = {
      model: s.acModel,
      temp: s.temp,
      mode: !s.isOn ? 'off' : s.mode,
      fan: s.fanSpeed,
      power: !s.isOn ? 'off' : 'on'
    };

    const payloadString = JSON.stringify(payloadJson);

    try {
      const { error } = await supabase
        .from('device_commands')
        .insert([
          { command: 'SET_AC', payload: payloadString, status: 'pending' }
        ]);
      if (error) throw error;
    } catch (err: any) {
      console.error('Gagal mengirim perintah: ' + err.message);
    } finally {
      setAcLoading(false);
    }
  };

  // Calculate arc geometry
  const percentage = ((temp - minTemp) / (maxTemp - minTemp));
  const radius = 110;
  const circumference = 2 * Math.PI * radius;
  const arcLength = (circumference * 270) / 360; // 270 degrees
  
  // The active track stroke dasharray
  const activeLength = arcLength * percentage;

  // Calculate dot position
  const angleDeg = 135 + (percentage * 270);
  const angleRad = (angleDeg * Math.PI) / 180;
  const dotX = 140 + radius * Math.cos(angleRad);
  const dotY = 140 + radius * Math.sin(angleRad);

  const handlePointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    setIsDragging(true);
    updateTempFromPointer(e);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    updateTempFromPointer(e);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDragging) return;
    setIsDragging(false);
    (e.target as Element).releasePointerCapture(e.pointerId);
    // Sync to AC after dragging finishes
    sendCommand({ temp: stateRef.current.temp });
  };

  const updateTempFromPointer = (e: React.PointerEvent) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - 140; // 140 is cx
    const y = e.clientY - rect.top - 140;  // 140 is cy
    
    let angle = Math.atan2(y, x) * (180 / Math.PI);
    if (angle < 0) angle += 360;
    
    let shiftedAngle = angle - 135;
    if (shiftedAngle < 0) shiftedAngle += 360;
    
    if (shiftedAngle > 270) {
      if (shiftedAngle < 315) shiftedAngle = 270;
      else shiftedAngle = 0;
    }
    
    const newPercentage = shiftedAngle / 270;
    const newTemp = Math.round(minTemp + newPercentage * (maxTemp - minTemp));
    
    if (newTemp !== stateRef.current.temp) {
      setTemp(newTemp);
    }
  };

  const handleTempChange = (delta: number) => {
    const newTemp = Math.max(minTemp, Math.min(maxTemp, temp + delta));
    if (newTemp !== temp) {
      setTemp(newTemp);
      sendCommand({ temp: newTemp });
    }
  };

  const togglePower = () => {
    const newPower = !isOn;
    setIsOn(newPower);
    sendCommand({ isOn: newPower });
  };

  const changeMode = (newMode: string) => {
    setMode(newMode);
    setIsOn(true);
    sendCommand({ mode: newMode, isOn: true });
  };

  const changeFan = (newFan: string) => {
    setFanSpeed(newFan);
    sendCommand({ fanSpeed: newFan });
  };

  const changeModel = (newModel: string) => {
    setAcModel(newModel);
    // Doesn't immediately sync, just sets target for next command
  };

  // Determine active color based on mode and power
  let activeColor = '#444';
  if (isOn) {
    if (mode === 'cool') activeColor = '#2196f3';
    else if (mode === 'heat') activeColor = '#ff5252';
    else if (mode === 'dry') activeColor = '#00bcd4';
    else if (mode === 'fan') activeColor = '#00e676';
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1>Remote Kontrol AC</h1>
        <p className="page-subtitle">Kendalikan iklim ruangan Anda secara presisi dengan sentuhan cerdas.</p>
      </div>

      <div style={{ maxWidth: '450px', margin: '0 auto', marginTop: '40px' }}>
        
        {/* Model Selector */}
        <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'flex-end', gap: '10px', alignItems: 'center' }}>
          <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Target AC:</span>
          <select 
            value={acModel} 
            onChange={(e) => changeModel(e.target.value)}
            style={{ 
              padding: '8px 15px', 
              borderRadius: '8px', 
              background: 'rgba(255,255,255,0.05)', 
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#fff',
              outline: 'none',
              width: 'auto',
              cursor: 'pointer'
            }}
          >
            <option value="GREE" style={{ background: '#1c1c1c', color: '#fff' }}>GREE</option>
            <option value="SHARP" style={{ background: '#1c1c1c', color: '#fff' }}>SHARP</option>
            <option value="MIDEA" style={{ background: '#1c1c1c', color: '#fff' }}>MIDEA</option>
            <option value="SAMSUNG" style={{ background: '#1c1c1c', color: '#fff' }}>SAMSUNG</option>
          </select>
        </div>

        {/* HA Climate Card */}
        <div className="glass-card" style={{ position: 'relative', background: '#1c1c1c', border: '1px solid #333', borderRadius: '24px', boxShadow: '0 20px 40px rgba(0,0,0,0.5)', overflow: 'hidden' }}>
          
          {acLoading && (
            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '3px', background: activeColor, opacity: 0.7, animation: 'pulse 1s infinite' }}></div>
          )}

          <div style={{ padding: '30px' }}>

            {/* Circular Dial Area */}
            <div style={{ position: 'relative', width: '280px', height: '310px', margin: '0 auto' }}>
              
              {/* SVG Arc Track & Slider */}
              <svg 
                ref={svgRef}
                width="280" height="280" viewBox="0 0 280 280" 
                style={{ position: 'absolute', top: 0, left: 0, touchAction: 'none' }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
              >
                <g style={{ transform: 'rotate(135deg)', transformOrigin: 'center' }}>
                  {/* Background Track */}
                  <circle 
                    cx="140" cy="140" r={radius} 
                    fill="none" stroke="#2a2a2a" strokeWidth="18" strokeLinecap="round"
                    strokeDasharray={`${arcLength} ${circumference}`}
                  />
                  {/* Active Track */}
                  <circle 
                    cx="140" cy="140" r={radius} 
                    fill="none" stroke={activeColor} strokeWidth="18" strokeLinecap="round"
                    strokeDasharray={`${activeLength} ${circumference}`}
                    style={{ transition: isDragging ? 'none' : 'stroke-dasharray 0.3s ease-out, stroke 0.3s' }}
                  />
                </g>
                
                {/* Drag Dot */}
                <circle 
                  cx={dotX} cy={dotY} r="12" 
                  fill="#fff"
                  style={{ 
                    transition: isDragging ? 'none' : 'cx 0.3s ease-out, cy 0.3s ease-out',
                    cursor: 'grab', filter: 'drop-shadow(0 2px 5px rgba(0,0,0,0.5))' 
                  }}
                />
              </svg>

              {/* Center Content */}
              <div style={{ position: 'absolute', top: 0, left: 0, width: '280px', height: '280px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                <div style={{ color: '#aaa', fontSize: '16px', fontWeight: 500, textTransform: 'capitalize', marginBottom: '5px' }}>
                  {isOn ? mode : 'Off'}
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-start', color: isOn ? '#fff' : '#666' }}>
                  <span style={{ fontSize: '72px', fontWeight: 400, lineHeight: 1, marginLeft: '10px' }}>{temp}</span>
                  <span style={{ fontSize: '24px', fontWeight: 500, marginTop: '5px' }}>°C</span>
                </div>
              </div>

              {/* + / - Buttons */}
              <div style={{ position: 'absolute', bottom: '0px', left: 0, width: '100%', display: 'flex', justifyContent: 'center', gap: '30px', zIndex: 10 }}>
                <button 
                  onClick={() => handleTempChange(-1)}
                  style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#2a2a2a', border: 'none', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'background 0.2s', boxShadow: '0 4px 10px rgba(0,0,0,0.3)' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#444'}
                  onMouseLeave={e => e.currentTarget.style.background = '#2a2a2a'}
                >
                  <Minus size={24} />
                </button>
                <button 
                  onClick={() => handleTempChange(1)}
                  style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#2a2a2a', border: 'none', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'background 0.2s', boxShadow: '0 4px 10px rgba(0,0,0,0.3)' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#444'}
                  onMouseLeave={e => e.currentTarget.style.background = '#2a2a2a'}
                >
                  <Plus size={24} />
                </button>
              </div>
            </div>

            {/* Controls Area */}
            <div style={{ marginTop: '30px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
              
              {/* Fan Speed Selector */}
              <div style={{ position: 'relative' }}>
                <select 
                  value={fanSpeed}
                  onChange={(e) => changeFan(e.target.value)}
                  style={{ 
                    width: '100%', padding: '15px 20px', borderRadius: '12px', 
                    background: '#2a2a2a', border: 'none', color: '#e0e0e0', fontSize: '16px',
                    appearance: 'none', cursor: 'pointer', fontWeight: 500
                  }}
                >
                  <option value="auto" style={{ background: '#2a2a2a', color: '#fff' }}>• Auto Fan</option>
                  <option value="low" style={{ background: '#2a2a2a', color: '#fff' }}>• Low Fan</option>
                  <option value="mid" style={{ background: '#2a2a2a', color: '#fff' }}>• Mid Fan</option>
                  <option value="high" style={{ background: '#2a2a2a', color: '#fff' }}>• High Fan</option>
                </select>
                <ChevronDown size={20} color="#888" style={{ position: 'absolute', right: '20px', top: '15px', pointerEvents: 'none' }} />
              </div>

              {/* Mode Icons Row */}
              <div style={{ display: 'flex', background: '#2a2a2a', borderRadius: '12px', padding: '5px', gap: '5px' }}>
                
                <button 
                  onClick={togglePower}
                  style={{ flex: 1, padding: '15px 0', border: 'none', background: !isOn ? '#444' : 'transparent', borderRadius: '8px', color: !isOn ? '#fff' : '#888', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', justifyContent: 'center' }}
                >
                  <Power size={22} />
                </button>

                <button 
                  onClick={() => changeMode('dry')}
                  style={{ flex: 1, padding: '15px 0', border: 'none', background: isOn && mode === 'dry' ? 'rgba(0, 188, 212, 0.2)' : 'transparent', borderRadius: '8px', color: isOn && mode === 'dry' ? '#00bcd4' : '#888', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', justifyContent: 'center' }}
                >
                  <Droplets size={22} />
                </button>

                <button 
                  onClick={() => changeMode('cool')}
                  style={{ flex: 1, padding: '15px 0', border: 'none', background: isOn && mode === 'cool' ? '#2196f3' : 'transparent', borderRadius: '8px', color: isOn && mode === 'cool' ? '#fff' : '#888', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', justifyContent: 'center' }}
                >
                  <Snowflake size={22} />
                </button>

                <button 
                  onClick={() => changeMode('heat')}
                  style={{ flex: 1, padding: '15px 0', border: 'none', background: isOn && mode === 'heat' ? 'rgba(255, 82, 82, 0.2)' : 'transparent', borderRadius: '8px', color: isOn && mode === 'heat' ? '#ff5252' : '#888', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', justifyContent: 'center' }}
                >
                  <Flame size={22} />
                </button>

                <button 
                  onClick={() => changeMode('fan')}
                  style={{ flex: 1, padding: '15px 0', border: 'none', background: isOn && mode === 'fan' ? 'rgba(0, 230, 118, 0.2)' : 'transparent', borderRadius: '8px', color: isOn && mode === 'fan' ? '#00e676' : '#888', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', justifyContent: 'center' }}
                >
                  <Wind size={22} />
                </button>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
