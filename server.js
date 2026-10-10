const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

app.use('/js', express.static(path.join(__dirname, 'node_modules/chart.js/dist')));
app.use('/plugin', express.static(path.join(__dirname, 'node_modules/chartjs-plugin-datalabels/dist')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/api/weather', async (req, res) => {
    let weatherPayload = null;
    
    try {
        // 1. Attempt to fetch real live hourly forecasting telemetry grids for Mesa, AZ
        const weatherUrl = 'https://open-meteo.com';
        const apiResponse = await fetch(weatherUrl, { signal: AbortSignal.timeout(4000) });
        
        if (apiResponse.ok) {
            weatherPayload = await apiResponse.json();
            console.log("🌐 Successfully fetched live satellite weather data!");
        } else {
            throw new Error("API stream rejected.");
        }
    } catch (err) {
        console.warn("⚠️ Network connection blocked. Loading offline weather_data.json backup...");
        // 2. Local fallback if your internet blocks the connection
        const localDataPath = path.join(__dirname, 'weather_data.json');
        const fileContent = fs.readFileSync(localDataPath, 'utf8');
        weatherPayload = JSON.parse(fileContent);
    }

    // 3. Pipe whichever dataset we got safely down into Python's memory buffer
    const scriptPath = path.join(__dirname, 'script.py');
    const pythonProcess = spawn('C:\\Python314\\python.exe', [scriptPath]);
    
    let pythonBuffer = '';
    pythonProcess.stdin.write(JSON.stringify(weatherPayload));
    pythonProcess.stdin.end();

    pythonProcess.stdout.on('data', (chunk) => {
        pythonBuffer += chunk.toString();
    });

    pythonProcess.on('close', (code) => {
        try {
            const finalAnalysis = JSON.parse(pythonBuffer.trim());
            res.setHeader('Content-Type', 'application/json');
            res.json(finalAnalysis);
        } catch (parseErr) {
            res.status(500).json({ error: "Failed to parse data buffers." });
        }
    });
});

app.listen(PORT, () => {
    console.log(`\n🚀 Commercial Live Server running on http://localhost:${PORT}`);
});
