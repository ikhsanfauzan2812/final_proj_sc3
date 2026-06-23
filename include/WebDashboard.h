#ifndef WEB_DASHBOARD_H
#define WEB_DASHBOARD_H

// HTML, CSS, JS Template (Glassmorphism Dashboard)
const char* htmlPage = R"rawliteral(
<!DOCTYPE html>
<html>
<head>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>TA v1 - Air Quality Monitor</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;500;700&display=swap');
        body {
            margin: 0;
            padding: 20px;
            font-family: 'Outfit', sans-serif;
            background: linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%);
            color: #fff;
            min-height: 100vh;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
        }
        .glass-panel {
            background: rgba(255, 255, 255, 0.05);
            backdrop-filter: blur(15px);
            -webkit-backdrop-filter: blur(15px);
            border-radius: 20px;
            border: 1px solid rgba(255, 255, 255, 0.1);
            padding: 25px;
            margin-bottom: 25px;
            box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.3);
        }
        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
            gap: 15px;
        }
        .card {
            background: rgba(255, 255, 255, 0.03);
            border-radius: 15px;
            padding: 15px;
            text-align: center;
            border: 1px solid rgba(255, 255, 255, 0.05);
            transition: transform 0.3s ease;
        }
        .card:hover {
            transform: translateY(-5px);
            background: rgba(255, 255, 255, 0.08);
        }
        .value {
            font-size: 26px;
            font-weight: 700;
            margin: 10px 0;
            background: linear-gradient(to right, #00f2fe, #4facfe);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        .label {
            font-size: 13px;
            color: #ccc;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        .comfort-badge {
            display: inline-block;
            padding: 10px 25px;
            border-radius: 30px;
            font-weight: 700;
            font-size: 18px;
            margin-top: 10px;
            transition: all 0.3s;
        }
        .nyaman { background: rgba(46, 204, 113, 0.2); color: #2ecc71; border: 1px solid #2ecc71; box-shadow: 0 0 15px rgba(46,204,113,0.3); }
        .kurang-nyaman { background: rgba(241, 196, 15, 0.2); color: #f1c40f; border: 1px solid #f1c40f; box-shadow: 0 0 15px rgba(241,196,15,0.3); }
        .tidak-nyaman { background: rgba(231, 76, 60, 0.2); color: #e74c3c; border: 1px solid #e74c3c; box-shadow: 0 0 15px rgba(231,76,60,0.3); }
        
        /* Form elements */
        input {
            width: 100%;
            padding: 14px;
            margin: 8px 0 20px;
            border-radius: 12px;
            border: 1px solid rgba(255, 255, 255, 0.2);
            background: rgba(0, 0, 0, 0.3);
            color: white;
            font-family: inherit;
            box-sizing: border-box;
            outline: none;
            transition: border 0.3s;
        }
        input:focus {
            border-color: #00f2fe;
        }
        button {
            background: linear-gradient(to right, #4facfe 0%, #00f2fe 100%);
            border: none;
            padding: 14px 25px;
            color: white;
            font-family: inherit;
            font-weight: bold;
            border-radius: 12px;
            cursor: pointer;
            width: 100%;
            font-size: 16px;
            transition: opacity 0.3s, transform 0.1s;
        }
        button:hover { opacity: 0.9; }
        button:active { transform: scale(0.98); }
        
        .footer {
            text-align: center;
            font-size: 13px;
            color: #888;
            margin-top: 30px;
        }
        
        /* PIR Pulse animation */
        @keyframes pulse {
            0% { box-shadow: 0 0 0 0 rgba(231, 76, 60, 0.4); }
            70% { box-shadow: 0 0 0 15px rgba(231, 76, 60, 0); }
            100% { box-shadow: 0 0 0 0 rgba(231, 76, 60, 0); }
        }
        .pir-active {
            animation: pulse 2s infinite;
            border-color: #e74c3c !important;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Air Quality Dashboard</h1>
            <p style="color: #aaa;">IP Address: <span id="wifi-status" style="color: #00f2fe; font-weight:bold;">Loading...</span></p>
        </div>
        
        <!-- Smart Comfort Card -->
        <div class="glass-panel" style="text-align: center;">
            <h3 style="margin-top: 0; color: #ddd; font-weight: 500;">Status Kondisi Ruangan</h3>
            <div id="comfort-status" class="comfort-badge nyaman">Menganalisis...</div>
            <p id="timestamp" style="font-size: 13px; color: #aaa; margin-top: 15px;">Pembaruan Terakhir: -</p>
        </div>

        <!-- Sensor Grid -->
        <div class="glass-panel">
            <h3 style="margin-top: 0; margin-bottom: 20px; color: #ddd; font-weight: 500;">Parameter Sensor</h3>
            <div class="grid">
                <div class="card">
                    <div class="label">Temperature</div>
                    <div class="value" id="val-temp">--.- &deg;C</div>
                </div>
                <div class="card">
                    <div class="label">Humidity</div>
                    <div class="value" id="val-hum">--.- %</div>
                </div>
                <div class="card">
                    <div class="label">Pressure</div>
                    <div class="value" id="val-press">---- hPa</div>
                </div>
                <div class="card">
                    <div class="label">VOC Gas</div>
                    <div class="value" id="val-voc">--.- K&Omega;</div>
                </div>
                <div class="card" id="card-pir">
                    <div class="label">Motion (PIR)</div>
                    <div class="value" id="val-pir" style="background: none; -webkit-text-fill-color: white;">--</div>
                </div>
            </div>
        </div>

        <!-- AC Controller -->
        <div class="glass-panel">
            <h3 style="margin-top: 0; color: #ddd; font-weight: 500;">AC Controller (IR Blaster)</h3>
            <p style="font-size: 14px; color: #aaa; margin-bottom: 20px;">Pilih model AC Anda untuk melakukan pengujian pengiriman sinyal (Manual Override).</p>
            
            <form onsubmit="saveAcModel(event)">
                <label style="color:#ccc; font-size:14px; display:block; margin-bottom:8px;">Merek & Model AC</label>
                <select id="ac-model" style="width:100%; padding:14px; margin-bottom:20px; border-radius:12px; border:1px solid rgba(255,255,255,0.2); background:rgba(0,0,0,0.3); color:white; outline:none; font-family:inherit;">
                    <optgroup label="DAIKIN">
                        <option value="DAIKIN:Default">DAIKIN (Standard)</option>
                    </optgroup>
                    <optgroup label="FUJITSU">
                        <option value="FUJITSU:Default">FUJITSU (Standard)</option>
                    </optgroup>
                    <optgroup label="GREE">
                        <option value="GREE:Default">GREE (Standard)</option>
                    </optgroup>
                    <optgroup label="HAIER">
                        <option value="HAIER:Default">HAIER (Standard)</option>
                    </optgroup>
                    <optgroup label="HITACHI">
                        <option value="HITACHI:Default">HITACHI (Standard)</option>
                    </optgroup>
                    <optgroup label="LG">
                        <option value="LG:Default">LG (Standard)</option>
                    </optgroup>
                    <optgroup label="MIDEA">
                        <option value="MIDEA:Default">MIDEA (Standard)</option>
                    </optgroup>
                    <optgroup label="MITSUBISHI">
                        <option value="MITSUBISHI:Default">MITSUBISHI Electric</option>
                        <option value="MITSUBISHI_HEAVY:Default">MITSUBISHI Heavy Industries</option>
                    </optgroup>
                    <optgroup label="PANASONIC">
                        <option value="PANASONIC:Default">PANASONIC (Standard)</option>
                    </optgroup>
                    <optgroup label="SAMSUNG">
                        <option value="SAMSUNG:Default">SAMSUNG (Standard)</option>
                    </optgroup>
                    <optgroup label="SANYO">
                        <option value="SANYO:Default">SANYO (Standard)</option>
                    </optgroup>
                    <optgroup label="SHARP">
                        <option value="SHARP:A907">SHARP A907</option>
                        <option value="SHARP:A903">SHARP A903</option>
                        <option value="SHARP:A705">SHARP A705</option>
                    </optgroup>
                    <optgroup label="TCL">
                        <option value="TCL:Default">TCL (Standard)</option>
                    </optgroup>
                    <optgroup label="TOSHIBA">
                        <option value="TOSHIBA:Default">TOSHIBA (Standard)</option>
                    </optgroup>
                    <optgroup label="WHIRLPOOL">
                        <option value="WHIRLPOOL:Default">WHIRLPOOL (Standard)</option>
                    </optgroup>
                </select>
                
                <div style="display:flex; gap:10px; flex-wrap:wrap; margin-bottom:15px;">
                    <button type="submit" style="flex:1; min-width:120px;">Simpan Model</button>
                    <button type="button" onclick="testAc('on')" style="flex:1; min-width:120px; background:linear-gradient(to right, #00b09b, #96c93d);">Test AC ON (16&deg;C)</button>
                    <button type="button" onclick="testAc('off')" style="flex:1; min-width:120px; background:linear-gradient(to right, #ed213a, #93291e);">Test AC OFF</button>
                </div>
                
                <div style="font-size:13px; color:#888;">Model yang tersimpan saat ini: <strong id="current-ac-model" style="color:#00f2fe;">Memuat...</strong></div>
            </form>
        </div>

        <!-- Settings Config -->
        <div class="glass-panel">
            <h3 style="margin-top: 0; color: #ddd; font-weight: 500;">Pengaturan Jaringan</h3>
            <p style="font-size: 14px; color: #aaa; margin-bottom: 20px;">Masukkan SSID dan Password baru. ESP32 akan restart untuk menghubungkan ulang.</p>
            <form onsubmit="saveWifi(event)">
                <label style="color:#ccc; font-size:14px;">SSID WiFi</label>
                <input type="text" id="ssid" placeholder="Nama WiFi" required>
                
                <label style="color:#ccc; font-size:14px;">Password</label>
                <input type="password" id="password" placeholder="Password WiFi">
                
                <button type="submit">Simpan & Restart ESP32</button>
            </form>
        </div>
        
        <div class="footer">TA v1 &bull; ESP32-C6 Data Logger</div>
    </div>

    <script>
        function updateData() {
            fetch('/api/data')
                .then(response => response.json())
                .then(data => {
                    document.getElementById('val-temp').innerHTML = data.temperature.toFixed(2) + ' &deg;C';
                    document.getElementById('val-hum').innerText = data.humidity.toFixed(2) + ' %';
                    document.getElementById('val-press').innerText = data.pressure.toFixed(0) + ' hPa';
                    document.getElementById('val-voc').innerText = data.voc.toFixed(2) + ' KΩ';
                    
                    const pirElem = document.getElementById('val-pir');
                    const pirCard = document.getElementById('card-pir');
                    if (data.pir === 1) {
                        pirElem.innerText = 'Terdeteksi';
                        pirElem.style.color = '#e74c3c';
                        pirCard.classList.add('pir-active');
                    } else {
                        pirElem.innerText = 'Aman';
                        pirElem.style.color = '#2ecc71';
                        pirCard.classList.remove('pir-active');
                    }
                    
                    document.getElementById('timestamp').innerText = 'Pembaruan Terakhir: ' + data.timestamp;
                    document.getElementById('wifi-status').innerText = data.ip_address;
                    
                    // Machine Learning Logic (Decision Tree from Kaggle)
                    let comfort = "Nyaman";
                    let classBadge = "nyaman";
                    
                    if (data.humidity <= 64.98) {
                        comfort = "Nyaman";
                        classBadge = "nyaman";
                    } else {
                        if (data.temperature <= 32.00) {
                            comfort = "Kurang Nyaman";
                            classBadge = "kurang-nyaman";
                        } else {
                            comfort = "Tidak Nyaman";
                            classBadge = "tidak-nyaman";
                        }
                    }
                    
                    const badge = document.getElementById('comfort-status');
                    badge.innerText = comfort;
                    badge.className = 'comfort-badge ' + classBadge;
                    
                    if(data.ac_model) {
                        document.getElementById('current-ac-model').innerText = data.ac_model;
                        if(document.getElementById('ac-model').value === '' || document.getElementById('ac-model').getAttribute('data-loaded') !== 'true') {
                            document.getElementById('ac-model').value = data.ac_model;
                            document.getElementById('ac-model').setAttribute('data-loaded', 'true');
                        }
                    }
                })
                .catch(err => console.error('Error fetching data', err));
        }

        function saveAcModel(e) {
            e.preventDefault();
            const model = document.getElementById('ac-model').value;
            const btn = e.target.querySelector('button[type="submit"]');
            const originalText = btn.innerText;
            btn.innerText = 'Menyimpan...';
            
            fetch('/api/ac/model', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: 'model=' + encodeURIComponent(model)
            }).then(res => {
                if(res.ok) {
                    document.getElementById('current-ac-model').innerText = model;
                    alert('Model AC berhasil disimpan!');
                } else {
                    alert('Gagal menyimpan model.');
                }
            }).catch(() => alert('Terjadi kesalahan jaringan.'))
              .finally(() => btn.innerText = originalText);
        }

        function testAc(action) {
            const endpoint = action === 'on' ? '/api/ac/test-on' : '/api/ac/test-off';
            fetch(endpoint, { method: 'POST' })
                .then(res => {
                    if(res.ok) alert(`Perintah Test AC ${action.toUpperCase()} berhasil dikirim!`);
                    else alert('Gagal mengirim perintah.');
                })
                .catch(() => alert('Terjadi kesalahan jaringan.'));
        }

        function saveWifi(e) {
            e.preventDefault();
            const ssid = document.getElementById('ssid').value;
            const pass = document.getElementById('password').value;
            
            const btn = e.target.querySelector('button');
            const originalText = btn.innerText;
            btn.innerText = 'Menyimpan...';
            btn.style.opacity = '0.5';
            
            fetch('/api/wifi', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: 'ssid=' + encodeURIComponent(ssid) + '&password=' + encodeURIComponent(pass)
            }).then(res => {
                if(res.ok) {
                    alert('Kredensial berhasil disimpan! ESP32 akan melakukan restart.');
                    btn.innerText = 'Tersimpan';
                } else {
                    alert('Gagal menyimpan kredensial.');
                    btn.innerText = originalText;
                    btn.style.opacity = '1';
                }
            }).catch(err => {
                alert('Terjadi kesalahan jaringan.');
                btn.innerText = originalText;
                btn.style.opacity = '1';
            });
        }

        updateData();
        setInterval(updateData, 3000);
    </script>
</body>
</html>
)rawliteral";

#endif
