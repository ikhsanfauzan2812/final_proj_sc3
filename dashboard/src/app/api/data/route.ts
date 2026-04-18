import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';
import { linearRegression, linearRegressionLine } from 'simple-statistics';

// Fungsi bantuan untuk membersihkan nama kolom
const normalizeKey = (key: string) => key.trim().toLowerCase();

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const startDateStr = searchParams.get('start');
  const endDateStr = searchParams.get('end');
  const forecastHours = parseInt(searchParams.get('forecast') || '6', 10);

  // Path ke folder datalogger (sesuaikan dengan struktur folder TA_v1)
  const dataloggerPath = path.resolve(process.cwd(), '../datalogger');

  try {
    const files = fs.readdirSync(dataloggerPath).filter(f => f.endsWith('.csv'));
    
    let allData: any[] = [];

    // Baca semua file CSV
    for (const file of files) {
      const filePath = path.join(dataloggerPath, file);
      const fileContent = fs.readFileSync(filePath, 'utf8');
      
      const parsed = Papa.parse(fileContent, {
        header: true,
        skipEmptyLines: true,
      });

      parsed.data.forEach((row: any) => {
        // Normalisasi keys (Timestamp, temperature, dll)
        const normalizedRow: any = {};
        for (const key in row) {
          const nKey = normalizeKey(key);
          normalizedRow[nKey] = row[key];
        }
        
        if (normalizedRow.timestamp) {
          allData.push({
            timestamp: new Date(normalizedRow.timestamp),
            temperature: parseFloat(normalizedRow.temperature),
            humidity: parseFloat(normalizedRow.humidity),
            pressure: parseFloat(normalizedRow.pressure),
            voc: parseFloat(normalizedRow.voc),
          });
        }
      });
    }

    // Filter data yang tidak valid
    allData = allData.filter(d => !isNaN(d.timestamp.getTime()) && !isNaN(d.temperature));

    // Sort by timestamp
    allData.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    // Filter by Date Range jika ada
    if (startDateStr && endDateStr) {
      const start = new Date(startDateStr);
      const end = new Date(endDateStr);
      // Buat end date inklusif sampai akhir hari
      end.setHours(23, 59, 59, 999);
      
      allData = allData.filter(d => d.timestamp >= start && d.timestamp <= end);
    }

    if (allData.length === 0) {
      return NextResponse.json({ data: [], forecast: [] });
    }

    // Data Resampling / Pengambilan sebagian data jika terlalu besar
    // Agar frontend tidak berat jika ada puluhan ribu baris
    let sampleData = allData;
    if (allData.length > 1000) {
      const step = Math.floor(allData.length / 500);
      sampleData = allData.filter((_, i) => i % step === 0);
    }

    // Fungsi untuk membuat forecasting menggunakan Simple Statistics
    const createForecast = (param: string) => {
      // Gunakan 200 data terakhir untuk training agar tren lebih relevan
      const trainData = allData.slice(-200); 
      if (trainData.length < 10) return [];

      const points = trainData.map(d => [d.timestamp.getTime(), d[param]]);
      const regression = linearRegression(points);
      const lineFn = linearRegressionLine(regression);

      const lastTime = trainData[trainData.length - 1].timestamp.getTime();
      const forecastData = [];
      
      // Buat titik prediksi setiap 15 menit ke depan
      const stepMs = 15 * 60 * 1000;
      const totalSteps = (forecastHours * 60) / 15;

      for (let i = 1; i <= totalSteps; i++) {
        const futureTime = lastTime + (i * stepMs);
        let predictedValue = lineFn(futureTime);
        
        // Capping logika sederhana agar tidak minus
        if (param === 'humidity' && predictedValue > 100) predictedValue = 100;
        if (param === 'humidity' && predictedValue < 0) predictedValue = 0;
        
        forecastData.push({
          timestamp: new Date(futureTime),
          [param]: predictedValue,
          isForecast: true
        });
      }
      return forecastData;
    };

    const tempForecast = createForecast('temperature');
    const humForecast = createForecast('humidity');
    const pressForecast = createForecast('pressure');
    const vocForecast = createForecast('voc');

    // Gabungkan array forecasting
    const forecast = tempForecast.map((f, i) => ({
      timestamp: f.timestamp,
      temperature: f.temperature,
      humidity: humForecast[i]?.humidity,
      pressure: pressForecast[i]?.pressure,
      voc: vocForecast[i]?.voc,
      isForecast: true
    }));

    // Format output
    const formattedData = sampleData.map(d => ({
      ...d,
      isForecast: false
    }));

    return NextResponse.json({
      data: formattedData,
      forecast: forecast
    });

  } catch (error) {
    console.error("Error reading datalogger:", error);
    return NextResponse.json({ error: "Failed to read data" }, { status: 500 });
  }
}
