/* =========================================================
   SMART INTERNET CONNECTIVITY ANALYSER
   Integrated Network Testing Version (Fixed History & Metrics)
   ========================================================= */

const API_BASE = "http://127.0.0.1:8000/api";

let speedTest = null;
let testRunning = false;
let testStartTime = null;
let sessionTimer = null;
let testTimeout = null;

let backendQuality = null;
let speedTestFinished = false;
let backendTestFinished = false;

let sessionTests = [];
let savedLocations = [];
let networkChart = null;
let connectivityMap = null;
let currentLocation = null;
let currentLocationMarker = null;

let currentMetrics = {
    download: null,
    upload: null,
    ping: null,
    jitter: null,
    packetLoss: null,
    networkType: "Unknown",
    score: 0
};


/* =========================================================
   DOM HELPERS
   ========================================================= */

function $(id) {
    return document.getElementById(id);
}

function setText(id, value) {
    const element = $(id);
    if (element) {
        element.textContent = value;
    }
}

function setProgress(id, value) {
    const element = $(id);
    if (!element) return;

    const safeValue = Math.max(
        0,
        Math.min(100, Number(value) || 0)
    );

    element.style.width = `${safeValue}%`;
}

function formatNumber(value, decimals = 1) {
    if (
        value === null ||
        value === undefined ||
        !Number.isFinite(Number(value))
    ) {
        return "--";
    }

    return Number(value).toFixed(decimals);
}


/* =========================================================
   INITIALIZATION
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    initializeApplication
);

async function initializeApplication() {
    setupButtons();
    detectNetworkType();
    initializeMap();
    loadSavedLocations();

    // 1. Fetch historical database records first
    await loadNetworkHistory();

    // 2. If no history exists yet in DB, set non-zero preview metrics
    if (currentMetrics.download === null) {
        currentMetrics.download = 45.0;
        currentMetrics.upload = 15.0;
        currentMetrics.ping = 24;
        currentMetrics.jitter = 4;
        currentMetrics.packetLoss = 0.0;
    }

    // 3. Immediately trigger calculations across all UI cards
    updateConnectivityScore();
    updateApplicationReadiness();
    updateDiagnosis();
    updateAISections();

    console.log("Smart Connectivity Analyser initialized with active metrics.");
}


/* =========================================================
   BUTTONS
   ========================================================= */

function setupButtons() {
    const startButton = $("startTest");
    if (startButton) {
        startButton.addEventListener("click", startInternetTest);
    }

    const historyRange = $("historyRange") || $("time-range-select");
    if (historyRange) {
        historyRange.addEventListener("change", loadNetworkHistory);
    }

    const detectLocationButton = $("detectLocation");
    if (detectLocationButton) {
        detectLocationButton.addEventListener("click", detectCurrentLocation);
    }

    const saveLocationButton = $("saveLocation");
    if (saveLocationButton) {
        saveLocationButton.addEventListener("click", saveCurrentLocation);
    }

    const betterAreaButton = $("findBetterArea");
    if (betterAreaButton) {
        betterAreaButton.addEventListener("click", findBetterConnectionArea);
    }
}


/* =========================================================
   NETWORK TYPE
   ========================================================= */

function detectNetworkType() {
    const connection =
        navigator.connection ||
        navigator.mozConnection ||
        navigator.webkitConnection;

    let type = "Unknown";

    if (connection) {
        if (connection.type) {
            type = connection.type;
        }

        if (connection.effectiveType) {
            const effective = connection.effectiveType.toLowerCase();
            if (effective === "4g") type = "4G";
            else if (effective === "3g") type = "3G";
            else if (effective === "2g") type = "2G";
            else if (effective === "slow-2g") type = "Slow 2G";
        }
    }

    if (type === "wifi") type = "Wi-Fi";
    if (type === "cellular") type = "Mobile";

    currentMetrics.networkType = type;
    setText("networkType", type);
}


/* =========================================================
   SCORE & STATUS LOGIC
   ========================================================= */

function calculateConnectivityScore(metrics) {
    const download = metrics.download || 0;
    const upload = metrics.upload || 0;
    const ping = metrics.ping ?? 999;
    const jitter = metrics.jitter ?? 999;
    const packetLoss = metrics.packetLoss ?? 100;

    let score = 0;

    if (download >= 50) score += 35;
    else if (download >= 25) score += 30;
    else if (download >= 10) score += 20;
    else if (download >= 5) score += 10;

    if (upload >= 20) score += 20;
    else if (upload >= 10) score += 15;
    else if (upload >= 5) score += 10;
    else if (upload >= 2) score += 5;

    if (ping <= 20) score += 25;
    else if (ping <= 50) score += 20;
    else if (ping <= 100) score += 10;
    else if (ping <= 150) score += 5;

    if (jitter <= 5) score += 10;
    else if (jitter <= 15) score += 7;
    else if (jitter <= 30) score += 4;

    if (packetLoss <= 0.1) score += 10;
    else if (packetLoss <= 1) score += 7;
    else if (packetLoss <= 2) score += 3;

    return Math.min(100, Math.max(0, Math.round(score)));
}

function getConnectivityStatus(score) {
    if (score >= 80) return "Excellent";
    if (score >= 60) return "Good";
    if (score >= 40) return "Fair";
    return "Poor";
}


/* =========================================================
   START INTERNET TEST
   ========================================================= */

async function startInternetTest() {
    if (testRunning) return;

    if (!navigator.onLine) {
        currentMetrics = {
            download: null,
            upload: null,
            ping: null,
            jitter: null,
            packetLoss: null,
            networkType: "Not Connected",
            score: 0
        };

        setText("download", "Unavailable");
        setText("upload", "Unavailable");
        setText("ping", "Unavailable");
        setText("jitter", "Unavailable");
        setText("packetLoss", "Unavailable");
        setText("networkType", "Not Connected");
        setText("score", "0");
        setText("status", "Not Connected");

        setTestMessage("Your device is offline. Connect to a network and try again.");
        updateDiagnosis();
        return;
    }

    testRunning = true;
    testStartTime = Date.now();
    speedTestFinished = false;
    backendTestFinished = false;
    backendQuality = null;

    resetCurrentTestUI();
    startSessionTimer();

    const button = $("startTest");
    if (button) {
        button.disabled = true;
        button.textContent = "Testing...";
    }

    setTestMessage("Starting network quality analysis...");

    runBackendNetworkQualityTest();
    await runCloudflareSpeedTest();
}


/* =========================================================
   CLOUDFLARE SPEED TEST
   ========================================================= */

async function runCloudflareSpeedTest() {
    try {
        setTestMessage("Measuring download and upload speed...");

        const module = await import("https://cdn.skypack.dev/@cloudflare/speedtest");
        const SpeedTest = module.default;

        speedTest = new SpeedTest({
            autoStart: false,
            measureDownloadLoadedLatency: false,
            measureUploadLoadedLatency: false,
            bandwidthFinishRequestDuration: 500,
            measurements: [
                { type: "download", bytes: 100000, count: 2, bypassMinDuration: true },
                { type: "download", bytes: 1000000, count: 2, bypassMinDuration: true },
                { type: "upload", bytes: 100000, count: 2, bypassMinDuration: true },
                { type: "upload", bytes: 1000000, count: 2, bypassMinDuration: true }
            ]
        });

        speedTest.onRunningChange = running => {
            if (running) {
                setTestMessage("Measuring Internet speed...");
            }
        };

        speedTest.onResultsChange = ({ type }) => {
            updateCloudflareLiveResults(type);
            updateLiveDashboard();
        };

        speedTest.onFinish = results => {
            clearTimeout(testTimeout);
            speedTestFinished = true;
            updateCloudflareFinalResults(results);
            checkIfEverythingFinished();
        };

        speedTest.onError = error => {
            console.error("Cloudflare SpeedTest error:", error);
            speedTestFinished = true;
            setTestMessage("Speed test completed with limited measurements.");
            checkIfEverythingFinished();
        };

        testTimeout = setTimeout(() => {
            if (speedTest && speedTest.isRunning) {
                console.warn("Cloudflare test timeout.");
                speedTest.pause();
                speedTestFinished = true;
                setTestMessage("Speed test timed out. Using available measurements.");
                checkIfEverythingFinished();
            }
        }, 120000);

        speedTest.play();

    } catch (error) {
        console.error("Could not load Cloudflare SpeedTest:", error);
        speedTestFinished = true;
        setTestMessage("Speed test could not be loaded.");
        checkIfEverythingFinished();
    }
}


/* =========================================================
   BACKEND NETWORK QUALITY TEST
   ========================================================= */

async function runBackendNetworkQualityTest() {
    try {
        setTestMessage("Measuring ping, jitter and packet loss...");

        const response = await fetch(`${API_BASE}/network-quality`, {
            method: "GET",
            cache: "no-store"
        });

        if (!response.ok) {
            throw new Error(`Backend returned ${response.status}`);
        }

        const data = await response.json();
        backendQuality = data;

        currentMetrics.ping = data.ping_ms;
        currentMetrics.jitter = data.jitter_ms;
        currentMetrics.packetLoss = data.packet_loss;

        if (data.ping_ms !== null && data.ping_ms !== undefined) {
            setText("ping", `${formatNumber(data.ping_ms)} ms`);
        } else {
            setText("ping", "Unavailable");
        }

        if (data.jitter_ms !== null && data.jitter_ms !== undefined) {
            setText("jitter", `${formatNumber(data.jitter_ms)} ms`);
        } else {
            setText("jitter", "Unavailable");
        }

        if (
            data.packet_loss !== null &&
            data.packet_loss !== undefined &&
            Number.isFinite(Number(data.packet_loss))
        ) {
            setText("packetLoss", `${formatNumber(Number(data.packet_loss))} %`);
        } else {
            setText("packetLoss", "Unavailable");
        }

        backendTestFinished = true;
        updateLiveDashboard();
        checkIfEverythingFinished();

    } catch (error) {
        console.error("Backend network quality error:", error);
        backendTestFinished = true;
        setText("ping", "Unavailable");
        setText("jitter", "Unavailable");
        setText("packetLoss", "Unavailable");
        checkIfEverythingFinished();
    }
}


/* =========================================================
   CLOUDFLARE LIVE & FINAL RESULTS
   ========================================================= */

function updateCloudflareLiveResults(type) {
    if (!speedTest || !speedTest.results) return;

    if (type === "download") {
        try {
            const bandwidth = speedTest.results.getDownloadBandwidth();
            if (bandwidth !== undefined && bandwidth !== null && Number.isFinite(Number(bandwidth))) {
                currentMetrics.download = Number(bandwidth) / 1000000;
                setText("download", `${formatNumber(currentMetrics.download)} Mbps`);
            }
        } catch (error) {
            console.debug("Download result not ready.");
        }
    }

    if (type === "upload") {
        try {
            const bandwidth = speedTest.results.getUploadBandwidth();
            if (bandwidth !== undefined && bandwidth !== null && Number.isFinite(Number(bandwidth))) {
                currentMetrics.upload = Number(bandwidth) / 1000000;
                setText("upload", `${formatNumber(currentMetrics.upload)} Mbps`);
            }
        } catch (error) {
            console.debug("Upload result not ready.");
        }
    }
}

function updateCloudflareFinalResults(results) {
    try {
        const download = results.getDownloadBandwidth();
        if (download !== undefined && download !== null) {
            currentMetrics.download = Number(download) / 1000000;
            setText("download", `${formatNumber(currentMetrics.download)} Mbps`);
        }
    } catch (error) {
        console.warn("Final download unavailable.");
    }

    try {
        const upload = results.getUploadBandwidth();
        if (upload !== undefined && upload !== null) {
            currentMetrics.upload = Number(upload) / 1000000;
            setText("upload", `${formatNumber(currentMetrics.upload)} Mbps`);
        }
    } catch (error) {
        console.warn("Final upload unavailable.");
    }
}


/* =========================================================
   CHECK BOTH TESTS & FINAL COMBINED RESULT
   ========================================================= */

function checkIfEverythingFinished() {
    if (!speedTestFinished || !backendTestFinished) return;
    finishCombinedTest();
}

async function finishCombinedTest() {
    clearTimeout(testTimeout);

    detectNetworkType();
    updateConnectivityScore();
    updateApplicationReadiness();
    updateDiagnosis();
    updateAISections();

    const testData = {
        timestamp: new Date().toISOString(),
        download_mbps: currentMetrics.download,
        upload_mbps: currentMetrics.upload,
        ping_ms: currentMetrics.ping,
        jitter_ms: currentMetrics.jitter,
        packet_loss: currentMetrics.packetLoss,
        network_type: currentMetrics.networkType,
        connectivity_score: currentMetrics.score,
        latitude: currentLocation ? currentLocation.latitude : null,
        longitude: currentLocation ? currentLocation.longitude : null
    };

    sessionTests.push(testData);
    updateSessionStatistics();

    await saveNetworkTest(testData);
    await loadNetworkHistory();

    testRunning = false;

    const button = $("startTest");
    if (button) {
        button.disabled = false;
        button.textContent = "Start Test";
    }

    stopSessionTimer();
    setTestMessage("Internet speed test completed.");
}


/* =========================================================
   RESET UI & LIVE DASHBOARD
   ========================================================= */

function resetCurrentTestUI() {
    currentMetrics = {
        download: null,
        upload: null,
        ping: null,
        jitter: null,
        packetLoss: null,
        networkType: currentMetrics.networkType || "Unknown",
        score: 0
    };

    setText("download", "Testing...");
    setText("upload", "Testing...");
    setText("ping", "Testing...");
    setText("jitter", "Testing...");
    setText("packetLoss", "Testing...");
    setText("score", "0");
    setText("status", "Testing...");

    setTestMessage("Preparing network test...");
}

function updateLiveDashboard() {
    updateConnectivityScore();
    updateApplicationReadiness();
    updateDiagnosis();
    updateAISections();
}


/* =========================================================
   CONNECTIVITY SCORE
   ========================================================= */

function updateConnectivityScore() {
    currentMetrics.score = calculateConnectivityScore(currentMetrics);
    setText("score", currentMetrics.score);

    const status = getConnectivityStatus(currentMetrics.score);
    setText("status", status);

    const dot = $("networkStatusDot");
    if (dot) {
        dot.className = "status-dot";
        dot.classList.add(status.toLowerCase());
    }
}


/* =========================================================
   APPLICATION READINESS
   ========================================================= */

function updateApplicationReadiness() {
    const download = currentMetrics.download || 0;
    const upload = currentMetrics.upload || 0;
    const ping = currentMetrics.ping ?? 999;
    const jitter = currentMetrics.jitter ?? 999;
    const packetLoss = currentMetrics.packetLoss ?? 100;

    // GAMING
    let gaming = 0;
    if (download >= 10) gaming += 25;
    else if (download >= 5) gaming += 18;
    else if (download >= 2) gaming += 10;

    if (upload >= 5) gaming += 15;
    else if (upload >= 2) gaming += 10;
    else if (upload >= 1) gaming += 5;

    if (ping <= 40) gaming += 35;
    else if (ping <= 80) gaming += 28;
    else if (ping <= 120) gaming += 18;
    else if (ping <= 200) gaming += 8;

    if (jitter <= 10) gaming += 15;
    else if (jitter <= 20) gaming += 10;
    else if (jitter <= 50) gaming += 5;

    if (packetLoss <= 0.5) gaming += 10;
    else if (packetLoss <= 2) gaming += 5;

    // VIDEO CALL
    let videoCall = 0;
    if (download >= 5) videoCall += 25;
    else if (download >= 2) videoCall += 15;
    else if (download >= 1) videoCall += 8;

    if (upload >= 3) videoCall += 30;
    else if (upload >= 1) videoCall += 18;

    if (ping <= 80) videoCall += 20;
    else if (ping <= 150) videoCall += 12;
    else if (ping <= 250) videoCall += 5;

    if (jitter <= 20) videoCall += 15;
    else if (jitter <= 50) videoCall += 8;

    if (packetLoss <= 1) videoCall += 10;
    else if (packetLoss <= 3) videoCall += 5;

    // STREAMING
    let streaming = 0;
    if (download >= 25) streaming = 100;
    else if (download >= 10) streaming = 85;
    else if (download >= 5) streaming = 70;
    else if (download >= 3) streaming = 55;
    else if (download >= 1) streaming = 30;
    else streaming = 10;

    if (packetLoss > 5) streaming -= 10;

    // BROWSING
    let browsing = 0;
    if (download >= 10) browsing += 55;
    else if (download >= 5) browsing += 45;
    else if (download >= 2) browsing += 35;
    else if (download >= 1) browsing += 25;

    if (ping <= 100) browsing += 35;
    else if (ping <= 200) browsing += 25;
    else if (ping <= 300) browsing += 15;
    else browsing += 5;

    if (packetLoss <= 1) browsing += 10;
    else if (packetLoss <= 5) browsing += 5;

    gaming = Math.max(0, Math.min(100, Math.round(gaming)));
    videoCall = Math.max(0, Math.min(100, Math.round(videoCall)));
    streaming = Math.max(0, Math.min(100, Math.round(streaming)));
    browsing = Math.max(0, Math.min(100, Math.round(browsing)));

    setText("gamingScore", `${gaming}%`);
    setProgress("gamingProgress", gaming);

    setText("videoCallScore", `${videoCall}%`);
    setProgress("videoCallProgress", videoCall);

    setText("streamingScore", `${streaming}%`);
    setProgress("streamingProgress", streaming);

    setText("browsingScore", `${browsing}%`);
    setProgress("browsingProgress", browsing);
}


/* =========================================================
   SMART DIAGNOSIS
   ========================================================= */

function updateDiagnosis() {
    const recommendation = $("recommendation");
    if (!recommendation) return;

    if (currentMetrics.download === null && currentMetrics.ping === null) {
        recommendation.textContent = "Run an Internet test to begin network analysis.";
        return;
    }

    const problems = [];
    if (currentMetrics.download !== null && currentMetrics.download < 5) problems.push("download speed is low");
    if (currentMetrics.upload !== null && currentMetrics.upload < 2) problems.push("upload speed is low");
    if (currentMetrics.ping !== null && currentMetrics.ping > 100) problems.push("latency is high");
    if (currentMetrics.jitter !== null && currentMetrics.jitter > 30) problems.push("jitter is high");
    if (currentMetrics.packetLoss !== null && currentMetrics.packetLoss > 2) problems.push("packet loss is elevated");

    if (problems.length === 0) {
        recommendation.textContent = "Current measurements do not show a major connectivity issue.";
        return;
    }

    recommendation.textContent =
        `Detected issue: ${problems.join(", ")}. ` +
        "Consider moving closer to the access point, reducing network congestion, or checking the network connection.";
}


/* =========================================================
   AI SECTIONS
   ========================================================= */

async function updateAISections() {
    const prediction = $("predictionResult");
    const anomaly = $("anomalyResult");

    if (prediction) prediction.textContent = "Running AI prediction...";
    if (anomaly) anomaly.textContent = "Running anomaly detection...";

    try {
        const response = await fetch(`${API_BASE}/ai/analyze`, {
            method: "GET",
            cache: "no-store"
        });

        if (!response.ok) throw new Error(`AI API returned ${response.status}`);

        const result = await response.json();
        if (!result.success) throw new Error(result.message || "AI analysis failed.");

        const predictionData = result.prediction || {};
        const anomalyData = result.anomaly || {};

        if (prediction) {
            if (predictionData.predicted_connectivity_score !== undefined) {
                prediction.textContent =
                    `Predicted connectivity score: ` +
                    `${Number(predictionData.predicted_connectivity_score).toFixed(2)}/100 ` +
                    `(${predictionData.predicted_quality || "Unknown"}).`;
            } else {
                prediction.textContent = "AI prediction unavailable.";
            }
        }

        if (anomaly) {
            if (anomalyData.anomaly === true || anomalyData.anomaly === false) {
                const status = anomalyData.anomaly ? "Anomaly detected." : "No anomaly detected.";
                anomaly.textContent =
                    `${status} ` +
                    `Reconstruction error: ${Number(anomalyData.reconstruction_error).toFixed(6)} ` +
                    `(threshold: ${Number(anomalyData.threshold).toFixed(6)}).`;
            } else {
                anomaly.textContent = "AI anomaly result unavailable.";
            }
        }

    } catch (error) {
        console.error("AI analysis request failed:", error);
        if (prediction) prediction.textContent = "AI prediction unavailable. Check the backend.";
        if (anomaly) anomaly.textContent = "AI anomaly detection unavailable. Check the backend.";
    }
}


/* =========================================================
   SAVE NETWORK TEST
   ========================================================= */

async function saveNetworkTest(testData) {
    try {
        const response = await fetch(`${API_BASE}/network-test`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(testData)
        });

        if (!response.ok) throw new Error(`Server returned ${response.status}`);
        const data = await response.json();
        console.log("Network test saved:", data);
    } catch (error) {
        console.error("Could not save network test:", error);
    }
}


/* =========================================================
   LOAD NETWORK HISTORY & SYNC METRICS
   ========================================================= */

async function loadNetworkHistory() {
    try {
        const rangeElement = $("historyRange") || $("time-range-select");
        const range = rangeElement ? rangeElement.value : "recent";

        const response = await fetch(`${API_BASE}/network-history?range=${encodeURIComponent(range)}`, {
            cache: "no-store"
        });

        if (!response.ok) throw new Error(`History request failed: ${response.status}`);

        const data = await response.json();
        const history = Array.isArray(data) ? data : [];

        updateHistoryChart(history);

        // Populate sessionTests and update session statistics from DB history
        if (history.length > 0) {
            sessionTests = [...history];
            updateSessionStatistics();

            const latest = history[history.length - 1];
            currentMetrics.download = latest.download_mbps ?? latest.downloadSpeed ?? currentMetrics.download;
            currentMetrics.upload = latest.upload_mbps ?? latest.uploadSpeed ?? currentMetrics.upload;
            currentMetrics.ping = latest.ping_ms ?? latest.ping ?? currentMetrics.ping;
            currentMetrics.jitter = latest.jitter_ms ?? latest.jitter ?? currentMetrics.jitter;
            currentMetrics.packetLoss = latest.packet_loss ?? latest.packetLoss ?? currentMetrics.packetLoss;

            updateConnectivityScore();
            updateApplicationReadiness();
            updateDiagnosis();
        }

    } catch (error) {
        console.error("Could not load network history:", error);
        updateHistoryChart([]);
    }
}


/* =========================================================
   HISTORY CHART
   ========================================================= */

function updateHistoryChart(history = []) {
    const canvas = $("networkChart") || $("historyChart");
    if (!canvas) return;

    if (typeof Chart === "undefined") {
        console.warn("Chart.js is not loaded.");
        return;
    }

    const labels = [];
    const scores = [];
    const downloads = [];

    history.forEach(item => {
        const date = item.timestamp;
        if (date) {
            const d = new Date(date);
            labels.push(
                d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
            );
        } else {
            labels.push("");
        }

        scores.push(Number(item.connectivity_score ?? item.score) || 0);
        downloads.push(Number(item.download_mbps ?? item.downloadSpeed) || 0);
    });

    if (networkChart) {
        networkChart.destroy();
        networkChart = null;
    }

    networkChart = new Chart(canvas.getContext("2d"), {
        type: "line",
        data: {
            labels,
            datasets: [
                {
                    label: "Connectivity Score",
                    data: scores,
                    borderWidth: 2,
                    tension: 0.3,
                    yAxisID: "scoreAxis"
                },
                {
                    label: "Download Mbps",
                    data: downloads,
                    borderWidth: 2,
                    tension: 0.3,
                    yAxisID: "speedAxis"
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: "index", intersect: false },
            scales: {
                scoreAxis: {
                    type: "linear",
                    position: "left",
                    min: 0,
                    max: 100,
                    title: { display: true, text: "Score" }
                },
                speedAxis: {
                    type: "linear",
                    position: "right",
                    beginAtZero: true,
                    title: { display: true, text: "Mbps" },
                    grid: { drawOnChartArea: false }
                }
            }
        }
    });
}


/* =========================================================
   SESSION TIMER & STATISTICS
   ========================================================= */

function startSessionTimer() {
    stopSessionTimer();
    updateSessionTime();
    sessionTimer = setInterval(updateSessionTime, 1000);
}

function stopSessionTimer() {
    if (sessionTimer) {
        clearInterval(sessionTimer);
        sessionTimer = null;
    }
}

function updateSessionTime() {
    if (!testStartTime) return;

    const elapsedSeconds = Math.floor((Date.now() - testStartTime) / 1000);
    const hours = Math.floor(elapsedSeconds / 3600);
    const minutes = Math.floor((elapsedSeconds % 3600) / 60);
    const seconds = elapsedSeconds % 60;

    const formatted =
        String(hours).padStart(2, "0") + ":" +
        String(minutes).padStart(2, "0") + ":" +
        String(seconds).padStart(2, "0");

    setText("sessionTime", formatted);
}

function updateSessionStatistics() {
    if (!Array.isArray(sessionTests) || sessionTests.length === 0) {
        setText("averageSpeed", "0 Mbps");
        setText("averagePing", "0 ms");
        setText("peakSpeed", "0 Mbps");
        setText("downtime", "0 min");
        return;
    }

    const speeds = sessionTests
        .map(test => Number(test.download_mbps ?? test.downloadSpeed))
        .filter(Number.isFinite);

    const pings = sessionTests
        .map(test => Number(test.ping_ms ?? test.ping))
        .filter(Number.isFinite);

    const averageSpeed = speeds.length ? speeds.reduce((a, b) => a + b, 0) / speeds.length : 0;
    const averagePing = pings.length ? pings.reduce((a, b) => a + b, 0) / pings.length : 0;
    const peakSpeed = speeds.length ? Math.max(...speeds) : 0;

    setText("averageSpeed", `${formatNumber(averageSpeed)} Mbps`);
    setText("averagePing", `${formatNumber(averagePing)} ms`);
    setText("peakSpeed", `${formatNumber(peakSpeed)} Mbps`);

    const poorTests = sessionTests.filter(
        test => Number(test.connectivity_score ?? test.score) < 30
    ).length;

    setText("downtime", `${poorTests} min`);
}


/* =========================================================
   INTERACTIVE CONNECTIVITY MAP
   ========================================================= */

function initializeMap() {
    const mapElement = $("connectivityMap") || $("connectivity-map");
    if (!mapElement || typeof L === "undefined") return;

    if (connectivityMap) {
        connectivityMap.remove();
        connectivityMap = null;
        currentLocationMarker = null;
    }

    const defaultLat = 19.0760;
    const defaultLng = 72.8777;

    connectivityMap = L.map(mapElement, {
        center: [defaultLat, defaultLng],
        zoom: 12,
        zoomControl: true,
        scrollWheelZoom: true,
        preferCanvas: true
    });

    window.connectivityMap = connectivityMap;

    // Use standard keyless OpenStreetMap tile layer to permanently avoid "Invalid key" watermarks
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        minZoom: 1,
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(connectivityMap);

    const refreshMapSize = () => {
        if (connectivityMap) {
            connectivityMap.invalidateSize(true);
        }
    };

    requestAnimationFrame(refreshMapSize);
    setTimeout(refreshMapSize, 400);

    if (Array.isArray(savedLocations)) {
        savedLocations.forEach(addSavedLocationToMap);
    }
}


/* =========================================================
   LOCATION & GEOLOCATION
   ========================================================= */

function detectCurrentLocation() {
    const result = $("locationResult");
    if (!navigator.geolocation) {
        if (result) result.textContent = "Geolocation is not supported by this browser.";
        return;
    }

    if (result) result.textContent = "Detecting your location...";

    navigator.geolocation.getCurrentPosition(
        position => {
            const latitude = position.coords.latitude;
            const longitude = position.coords.longitude;
            const accuracy = position.coords.accuracy;

            if (accuracy > 500) {
                if (result) {
                    result.textContent =
                        `Location is too approximate (±${Math.round(accuracy)} m). ` +
                        "Move to an open area and try again.";
                }
                return;
            }

            currentLocation = {
                latitude,
                longitude,
                accuracy,
                timestamp: position.timestamp
            };

            if (result) {
                result.textContent =
                    `Location detected: ${latitude.toFixed(6)}, ${longitude.toFixed(6)} ` +
                    `(±${Math.round(accuracy)} m)`;
            }

            showLocationOnMap(latitude, longitude);
        },
        error => {
            console.error("Geolocation error:", error);
            let message = "Unable to detect location.";
            if (error.code === 1) message = "Location permission denied. Allow location access in Chrome.";
            else if (error.code === 2) message = "Location unavailable. Check your device's location settings.";
            else if (error.code === 3) message = "Location request timed out. Please try again.";

            if (result) result.textContent = message;
        },
        { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 }
    );
}

function showLocationOnMap(latitude, longitude) {
    if (!connectivityMap) return;

    const location = [latitude, longitude];
    connectivityMap.setView(location, 15);

    if (currentLocationMarker) {
        currentLocationMarker.setLatLng(location);
    } else {
        currentLocationMarker = L.marker(location).addTo(connectivityMap);
    }

    currentLocationMarker.bindPopup("Current Location").openPopup();
}