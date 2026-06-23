import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import numpy as np

# Data Skenario 1
timestamps_s1 = list(range(0, 180))
s1_temp = [32.4248,32.3351,32.1043,32.0769,31.8213,31.6949,31.57,31.4277,31.314,31.2546,30.9577,30.9928,30.7495,30.7202,30.5495,30.3862,30.2958,30.1985,29.9916,29.8461,29.7297,29.6392,29.4742,29.234,29.1291,29.0453,28.8592,28.8375,28.6538,28.508,28.3829,28.2382,28.1324,27.9958,27.8649,27.6758,27.5931,27.5762,27.3125,27.2303,27.0207,26.9797,26.8522,26.6726,26.5033,26.4148,26.4338,26.3275,26.4101,26.3632,26.3967,26.3081,26.241,26.4649,26.394,26.3206,26.2958,26.3322,26.2951,26.345,26.3103,26.3467,26.2746,26.2336,26.2291,26.252,26.2739,26.2361,26.1302,26.2697,26.1618,26.2148,26.1643,26.2447,26.1182,26.0618,26.2838,26.1186,26.0549,26.1013,26.0554,26.0744,26.1154,26.021,26.0983,26.0883,26.0345,25.9503,26.075,26.0099,25.9794,25.9619,25.8999,25.9625,25.9029,25.8927,25.9772,25.9772,25.9689,25.9129,25.9559,26.0454,25.9551,26.0462,26.1768,26.1558,26.2042,26.0407,26.1377,26.0561,26.176,26.1544,26.0629,26.2116,26.2249,26.2136,26.1462,26.1572,26.1284,26.1988,26.172,26.1227,26.0072,26.135,26.08,26.0834,25.9934,25.9065,25.9751,25.987,25.9534,25.8792,25.8745,25.8916,25.8796,25.8655,25.938,25.8753,25.8095,25.7861,25.938,25.9675,25.7902,25.9057,25.8693,25.7867,25.8865,25.9418,25.9271,25.8764,26.0345,26.0172,25.9851,26.012,26.0549,26.0236,26.0952,26.1398,26.1447,26.1586,26.1646,26.1013,26.1822,26.1884,26.1489,26.1593,26.1171,26.2268,26.112,26.2631,26.1706,26.0245,26.1114,26.1859,26.0413,26.0395,25.9673,26.0276,25.9322,25.9123]
s1_hum = [78.9723,78.6538,78.2404,78.0226,77.4084,77.3587,77.2259,76.8989,76.1501,76.6102,75.5185,75.5571,74.7561,74.7647,74.3412,73.7783,73.9412,73.4787,73.342,73.0178,72.6553,72.0043,71.7773,71.4288,71.1835,70.9185,70.4451,70.0981,69.7628,69.2471,69.0214,68.4362,68.1926,68.4474,67.639,67.3904,67.4984,66.6928,66.7351,66.0923,66.2191,65.6229,65.3598,64.9398,64.4307,64.3228,64.3032,63.0423,63.1,63.2323,63.0157,62.4848,61.8123,61.7797,61.4066,61.1214,60.5633,60.7686,60.3792,60.5299,60.9897,60.7209,61.7041,60.7013,60.9863,60.7738,61.219,60.9189,60.9972,61.3959,61.4847,62.0076,61.5164,61.6765,61.3002,61.6624,61.7912,61.92,61.8397,61.887,61.6179,61.4672,61.6597,62.112,61.7451,61.7491,61.611,61.5665,61.6395,61.5372,61.5265,61.48,61.304,61.1176,60.9184,60.9487,60.7651,61.0479,61.0019,60.3167,60.5551,60.2791,60.2713,60.4054,60.419,60.3696,60.1001,60.4412,60.5905,60.0744,60.4953,60.4843,60.4874,60.2805,60.327,60.1517,60.4446,60.3901,60.7554,60.4557,60.7463,60.6511,60.3056,60.9626,60.9337,61.0391,61.1075,61.2036,60.9972,61.0648,61.2304,61.1201,61.3099,61.5132,61.4373,61.7968,61.6375,61.6531,61.574,61.7927,61.9688,61.8798,61.5712,61.3736,61.7248,61.9074,61.8669,62.0853,61.7295,61.2528,61.6731,62.0137,60.9614,61.4845,61.0377,61.1991,61.0551,61.1096,61.1335,61.1892,60.8288,60.3783,60.1541,60.2578,60.7004,60.3387,60.4549,60.249,60.0942,60.5396,60.4326,59.857,59.9022,60.1596,60.351,60.2695,60.1418,60.059,60.2796,60.1664]
s1_voc = [23.231,23.138,23.469,23.236,23.712,24.043,22.676,23.387,22.797,23.525,23.106,24.092,24.1,23.695,23.644,23.509,23.868,23.928,23.751,23.575,23.558,23.854,23.761,23.783,23.584,23.858,23.404,23.185,23.084,23.929,22.956,23.269,22.713,22.33,22.738,22.595,22.401,21.963,22.177,21.738,23.092,22.131,22.438,21.356,21.228,21.058,20.605,20.54,20.305,20.361,20.119,20.329,20.262,20.064,20.238,20.128,20.089,20.116,19.926,19.981,20.386,19.899,20.244,20.954,20.433,20.735,21.266,20.887,20.766,21.006,20.902,21.613,21.438,21.41,22.199,21.973,22.04,22.271,22.559,22.505,22.569,23.089,22.632,23.055,23.025,23.114,23.514,23.749,23.888,23.553,24.783,25.597,25.144,23.811,24.021,23.502,23.827,23.514,23.515,23.555,23.736,23.713,23.493,23.149,23.013,23.177,22.964,22.423,23.174,22.502,22.152,22.201,22.229,21.894,21.704,21.553,21.653,21.318,21.8,21.393,21.079,20.959,20.874,20.652,20.532,20.64,20.51,19.835,20.281,20.38,20.02,20.158,20.025,20.152,20.426,20.063,20.518,20.583,21.878,21.707,21.725,22.295,20.442,20.906,20.983,21.2,21.432,21.845,21.394,21.744,21.596,21.628,22.432,22.046,22.032,22.64,22.889,23.009,22.948,23.343,23.512,23.357,23.506,23.817,23.65,23.454,23.705,23.822,23.528,23.679,23.606,24.163,23.811,23.742,23.737,23.339,23.435,23.29,23.535,23.342]

# Data Skenario 2
s2_temp = [32.1822,32.113,32.0014,31.8318,31.8192,31.6712,31.6807,31.5219,31.379,31.235,31.0865,31.0421,30.9536,31.0358,30.759,30.7529,30.7043,30.5061,30.5373,30.2552,30.0903,29.9978,29.9394,29.9991,29.7319,29.5754,29.7281,29.521,29.299,29.4246,29.279,29.1596,29.0101,28.9765,28.876,28.6475,28.5443,28.4109,28.3489,28.277,28.2454,28.142,27.8804,27.9364,27.7891,27.5939,27.6699,27.455,27.3932,27.3245,27.1507,27.5899,27.5427,27.5786,27.7804,27.9179,28.0055,28.3419,28.3687,28.3505,28.4701,28.5985,28.6588,28.4774,28.3812,28.318,28.2644,28.212,28.1321,27.7531,27.7956,27.8488,27.8619,27.6911,27.7137,27.4303,27.3307,27.4976,27.4234,27.5166,27.4565,27.5427,27.4412,27.2614,27.3543,27.2997,27.1221,27.0612,26.8298,27.0135,26.9971,27.0819,27.047,27.1485,27.0487,27.0102,26.9671,26.8269,26.9971,27.0731,27.0409,27.2118,27.3746,27.8122,27.844,28.0412,28.0811,28.0868,28.2404,28.2083,28.4562,28.3995,28.2364,28.1797,28.1756,28.0498,28.0298,27.9574,28.0713,28.1562,27.8584,28.2224,28.1267,28.1988,28.1162,28.0956,28.0845,28.0167,27.9825,27.6155,27.5693,27.4245]
s2_hum = [80.6623,80.9185,80.0694,80.0612,79.9997,80.2096,80.0329,79.4124,79.3179,79.0607,79.3333,79.0268,78.4755,78.4553,78.1172,78.4439,77.3783,78.4157,77.1013,76.5514,77.3299,76.8138,76.4798,76.4348,77.0737,76.3694,76.1588,76.0439,76.1197,75.5554,75.0858,75.5071,74.7244,75.1174,75.2741,74.2674,74.8806,74.2601,74.4118,73.8696,73.3255,73.1529,73.7603,72.7061,73.374,72.8919,72.4496,71.598,71.9491,71.3177,71.7913,71.3902,71.1674,70.8487,70.9492,70.2931,70.3015,70.024,69.5595,69.8233,69.8819,70.1904,70.2229,69.2325,69.7605,68.5204,69.2439,68.6119,68.6548,68.0957,67.6188,66.9583,66.7341,66.8576,65.8674,65.436,65.4038,65.7795,65.7,66.0423,65.7937,66.8956,67.5272,67.3054,67.644,68.1248,68.5846,68.7812,68.4868,69.4373,69.2027,69.0043,69.7482,71.4475,71.7727,71.5008,71.01,70.3956,70.3551,69.727,70.128,70.1723,69.5314,69.8715,69.4056,69.1475,68.746,68.5101,68.8536,67.7729,67.1444,66.8631,66.9221,66.551,66.8893,66.0479,66.6226,66.7342,66.938,66.5439,66.2422,67.308,67.0709,67.0891,67.1976,67.4613,68.1166,68.7779,68.3727,68.8577,69.0408,69.6254]
s2_voc = [27.841,26.993,27.775,29.081,26.616,28.939,28.823,29.058,29.264,27.923,28.426,29.05,28.709,28.644,28.302,28.74,28.867,29.994,27.89,30.531,29.305,30.157,28.471,27.107,29.578,28.801,30.097,26.758,28.804,28.832,28.622,26.71,28.242,28.194,28.163,27.112,26.723,24.848,26.633,25.072,27.729,26.817,25.325,25.952,23.822,24.763,24.712,25.075,26.658,26.621,26.209,24.469,25.017,25.647,27.255,27.559,27.432,26.744,26.499,25.811,26.798,28.162,27.673,27.32,28.787,26.661,26.435,29.882,28.628,27.502,28.059,30.131,28.624,29.183,27.626,26.206,26.329,26.13,26.611,26.03,30.055,28.41,29.776,30.608,30.135,27.328,29.742,30.441,27.096,28.765,27.686,27.832,29.14,30.51,28.962,30.337,25.696,25.67,26.103,25.969,25.532,25.131,27.58,29.554,28.998,28.708,27.975,28.403,28.356,25.492,27.507,25.823,25.244,25.004,26.099,28.093,24.751,25.856,26.81,27.2,25.78,25.253,26.029,24.473,24.682,25.107,25.72,26.158,27.223,25.872,26.273,26.273]

def classify(temp, hum):
    if hum <= 65.03:
        return 'Nyaman'
    elif temp <= 31.99:
        return 'Kurang Nyaman'
    else:
        return 'Tidak Nyaman'

s1_labels = [classify(t, h) for t, h in zip(s1_temp, s1_hum)]
s2_labels = [classify(t, h) for t, h in zip(s2_temp, s2_hum)]

# Label tick sumbu X (setiap 30 menit = 30 data)
def get_xticks(n):
    ticks = list(range(0, n, 30))
    labels_tick = []
    for t in ticks:
        h = 14 + t // 60
        m = t % 60
        labels_tick.append(f'{h:02d}:{m:02d}')
    return ticks, labels_tick

COLORS = {'Nyaman': '#2ecc71', 'Kurang Nyaman': '#f1c40f', 'Tidak Nyaman': '#e74c3c'}
plt.rcParams.update({'font.size': 11, 'font.family': 'sans-serif'})

# ============================================================
# GRAFIK 1: Time-series Skenario 1
# ============================================================
fig, axes = plt.subplots(3, 1, figsize=(12, 9), sharex=True)
fig.suptitle('Grafik Data Sensor Skenario 1 - Ruang Kamar (14:00-17:00 WIB)', fontsize=13, fontweight='bold', y=0.98)

x = list(range(len(s1_temp)))
ticks, tlabels = get_xticks(len(s1_temp))

# Suhu
axes[0].plot(x, s1_temp, color='#e74c3c', linewidth=1.5, label='Suhu')
axes[0].axhline(y=31.99, color='gray', linestyle='--', linewidth=0.8, alpha=0.7, label='Batas Tidak Nyaman (31.99°C)')
axes[0].set_ylabel('Suhu (°C)')
axes[0].set_ylim(24, 34)
axes[0].legend(fontsize=9, loc='upper right')
axes[0].grid(True, alpha=0.3)
axes[0].fill_between(x, s1_temp, 31.99, where=[t > 31.99 for t in s1_temp], alpha=0.15, color='#e74c3c')

# Kelembapan
axes[1].plot(x, s1_hum, color='#3498db', linewidth=1.5, label='Kelembapan')
axes[1].axhline(y=65.03, color='gray', linestyle='--', linewidth=0.8, alpha=0.7, label='Batas Nyaman (65.03%)')
axes[1].set_ylabel('Kelembapan (%)')
axes[1].set_ylim(55, 85)
axes[1].legend(fontsize=9, loc='upper right')
axes[1].grid(True, alpha=0.3)
axes[1].fill_between(x, s1_hum, 65.03, where=[h > 65.03 for h in s1_hum], alpha=0.15, color='#3498db')

# VOC
axes[2].plot(x, s1_voc, color='#9b59b6', linewidth=1.5, label='VOC Gas')
axes[2].set_ylabel('VOC (kΩ)')
axes[2].set_xlabel('Waktu (WIB)')
axes[2].set_ylim(18, 28)
axes[2].legend(fontsize=9, loc='upper right')
axes[2].grid(True, alpha=0.3)
axes[2].set_xticks(ticks)
axes[2].set_xticklabels(tlabels)

plt.tight_layout()
plt.savefig(r'c:\Users\Ikhsan\Documents\TA_v1\scratch\grafik_sensor_skenario1.png', dpi=150, bbox_inches='tight')
plt.close()
print('Grafik sensor skenario 1 selesai')

# ============================================================
# GRAFIK 2: Time-series Skenario 2
# ============================================================
fig, axes = plt.subplots(3, 1, figsize=(12, 9), sharex=True)
fig.suptitle('Grafik Data Sensor Skenario 2 - Ruang Keluarga (14:00-17:00 WIB)', fontsize=13, fontweight='bold', y=0.98)

x2 = list(range(len(s2_temp)))
ticks2, tlabels2 = get_xticks(len(s2_temp))

axes[0].plot(x2, s2_temp, color='#e74c3c', linewidth=1.5, label='Suhu')
axes[0].axhline(y=31.99, color='gray', linestyle='--', linewidth=0.8, alpha=0.7, label='Batas Tidak Nyaman (31.99°C)')
axes[0].set_ylabel('Suhu (°C)')
axes[0].set_ylim(24, 34)
axes[0].legend(fontsize=9, loc='upper right')
axes[0].grid(True, alpha=0.3)

axes[1].plot(x2, s2_hum, color='#3498db', linewidth=1.5, label='Kelembapan')
axes[1].axhline(y=65.03, color='gray', linestyle='--', linewidth=0.8, alpha=0.7, label='Batas Nyaman (65.03%)')
axes[1].set_ylabel('Kelembapan (%)')
axes[1].set_ylim(60, 85)
axes[1].legend(fontsize=9, loc='upper right')
axes[1].grid(True, alpha=0.3)
axes[1].fill_between(x2, s2_hum, 65.03, where=[h > 65.03 for h in s2_hum], alpha=0.15, color='#e74c3c')

axes[2].plot(x2, s2_voc, color='#9b59b6', linewidth=1.5, label='VOC Gas')
axes[2].set_ylabel('VOC (kΩ)')
axes[2].set_xlabel('Waktu (WIB)')
axes[2].set_ylim(20, 33)
axes[2].legend(fontsize=9, loc='upper right')
axes[2].grid(True, alpha=0.3)
axes[2].set_xticks(ticks2)
axes[2].set_xticklabels(tlabels2)

plt.tight_layout()
plt.savefig(r'c:\Users\Ikhsan\Documents\TA_v1\scratch\grafik_sensor_skenario2.png', dpi=150, bbox_inches='tight')
plt.close()
print('Grafik sensor skenario 2 selesai')

# ============================================================
# GRAFIK 3: Distribusi Klasifikasi Skenario 1 (Bar)
# ============================================================
s1_counts = {k: s1_labels.count(k) for k in ['Tidak Nyaman', 'Kurang Nyaman', 'Nyaman']}
s1_pct = {k: v/len(s1_labels)*100 for k, v in s1_counts.items()}

fig, ax = plt.subplots(figsize=(7, 5))
labels_bar = ['Tidak Nyaman', 'Kurang Nyaman', 'Nyaman']
values = [s1_counts[k] for k in labels_bar]
colors = [COLORS[k] for k in labels_bar]
bars = ax.bar(labels_bar, values, color=colors, edgecolor='white', linewidth=0.8, width=0.5)
for bar, v, k in zip(bars, values, labels_bar):
    pct = s1_pct[k]
    ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 1.5,
            f'{v} data\n({pct:.1f}%)', ha='center', va='bottom', fontsize=10, fontweight='bold')
ax.set_ylabel('Jumlah Data (titik)')
ax.set_title('Distribusi Klasifikasi Kondisi Kenyamanan\nSkenario 1 — Ruang Kamar', fontweight='bold')
ax.set_ylim(0, max(values) * 1.25)
ax.grid(axis='y', alpha=0.3)
ax.spines['top'].set_visible(False)
ax.spines['right'].set_visible(False)
plt.tight_layout()
plt.savefig(r'c:\Users\Ikhsan\Documents\TA_v1\scratch\distribusi_skenario1.png', dpi=150, bbox_inches='tight')
plt.close()
print('Distribusi skenario 1 selesai')

# ============================================================
# GRAFIK 4: Distribusi Klasifikasi Skenario 2 (Bar)
# ============================================================
s2_counts = {k: s2_labels.count(k) for k in ['Tidak Nyaman', 'Kurang Nyaman', 'Nyaman']}
s2_pct = {k: v/len(s2_labels)*100 for k, v in s2_counts.items()}

fig, ax = plt.subplots(figsize=(7, 5))
values2 = [s2_counts[k] for k in labels_bar]
bars2 = ax.bar(labels_bar, values2, color=colors, edgecolor='white', linewidth=0.8, width=0.5)
for bar, v, k in zip(bars2, values2, labels_bar):
    pct = s2_pct[k]
    ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 1.5,
            f'{v} data\n({pct:.1f}%)', ha='center', va='bottom', fontsize=10, fontweight='bold')
ax.set_ylabel('Jumlah Data (titik)')
ax.set_title('Distribusi Klasifikasi Kondisi Kenyamanan\nSkenario 2 — Ruang Keluarga', fontweight='bold')
ax.set_ylim(0, max(values2) * 1.25)
ax.grid(axis='y', alpha=0.3)
ax.spines['top'].set_visible(False)
ax.spines['right'].set_visible(False)
plt.tight_layout()
plt.savefig(r'c:\Users\Ikhsan\Documents\TA_v1\scratch\distribusi_skenario2.png', dpi=150, bbox_inches='tight')
plt.close()
print('Distribusi skenario 2 selesai')

# ============================================================
# GRAFIK 5: Perbandingan kedua skenario (grouped bar)
# ============================================================
fig, axes = plt.subplots(1, 3, figsize=(14, 5))
fig.suptitle('Perbandingan Distribusi Klasifikasi Kenyamanan\nSkenario 1 vs Skenario 2', fontweight='bold')

cats = ['Tidak Nyaman', 'Kurang Nyaman', 'Nyaman']
pct1 = [s1_pct[k] for k in cats]
pct2 = [s2_pct[k] for k in cats]

x_pos = np.arange(len(cats))
width = 0.35

bars_s1 = axes[0].bar(x_pos - width/2, pct1, width, label='Skenario 1', color='#3498db', alpha=0.85)
bars_s2 = axes[0].bar(x_pos + width/2, pct2, width, label='Skenario 2', color='#e67e22', alpha=0.85)
axes[0].set_ylabel('Persentase (%)')
axes[0].set_title('Distribusi Klasifikasi (%)')
axes[0].set_xticks(x_pos)
axes[0].set_xticklabels(['Tidak\nNyaman', 'Kurang\nNyaman', 'Nyaman'], fontsize=9)
axes[0].legend()
axes[0].grid(axis='y', alpha=0.3)
for bar in bars_s1:
    axes[0].text(bar.get_x()+bar.get_width()/2, bar.get_height()+0.5, f'{bar.get_height():.1f}%', ha='center', fontsize=8)
for bar in bars_s2:
    axes[0].text(bar.get_x()+bar.get_width()/2, bar.get_height()+0.5, f'{bar.get_height():.1f}%', ha='center', fontsize=8)

# Rata-rata suhu & kelembapan
params = ['Suhu\n(°C)', 'Kelembapan\n(%)']
val1 = [26.94, 63.80]
val2 = [28.51, 71.50]
x2_pos = np.arange(len(params))
b1 = axes[1].bar(x2_pos - width/2, val1, width, label='Skenario 1', color='#3498db', alpha=0.85)
b2 = axes[1].bar(x2_pos + width/2, val2, width, label='Skenario 2', color='#e67e22', alpha=0.85)
axes[1].set_title('Rata-rata Suhu & Kelembapan')
axes[1].set_xticks(x2_pos)
axes[1].set_xticklabels(params)
axes[1].legend()
axes[1].grid(axis='y', alpha=0.3)
for bar in b1:
    axes[1].text(bar.get_x()+bar.get_width()/2, bar.get_height()+0.3, f'{bar.get_height():.2f}', ha='center', fontsize=9)
for bar in b2:
    axes[1].text(bar.get_x()+bar.get_width()/2, bar.get_height()+0.3, f'{bar.get_height():.2f}', ha='center', fontsize=9)

# Total setpoint changes
scenarios = ['Skenario 1\n(Ruang Kamar)', 'Skenario 2\n(Ruang Keluarga)']
setpoints = [10, 13]
bar_colors = ['#3498db', '#e67e22']
b3 = axes[2].bar(scenarios, setpoints, color=bar_colors, alpha=0.85, width=0.4)
axes[2].set_title('Total Perubahan Setpoint AC')
axes[2].set_ylabel('Jumlah Kejadian')
axes[2].grid(axis='y', alpha=0.3)
for bar in b3:
    axes[2].text(bar.get_x()+bar.get_width()/2, bar.get_height()+0.2, str(int(bar.get_height())), ha='center', fontsize=11, fontweight='bold')
axes[2].set_ylim(0, 16)

for ax in axes:
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)

plt.tight_layout()
plt.savefig(r'c:\Users\Ikhsan\Documents\TA_v1\scratch\perbandingan_skenario.png', dpi=150, bbox_inches='tight')
plt.close()
print('Grafik perbandingan selesai')
print('Semua grafik tersimpan di folder scratch/')
