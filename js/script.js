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
    if (!element) {
        return;
    }

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

    await loadNetworkHistory();

    updateApplicationReadiness();

    updateDiagnosis();

    updateAISections();

    console.log(
        "Smart Connectivity Analyser initialized."
    );
}


/* =========================================================
   BUTTONS & EVENT LISTENERS
   ========================================================= */

function setupButtons() {
    const startButton = $("startTest");
    if (startButton) {
        startButton.addEventListener(
            "click",
            startInternetTest
        );
    }

    // Handles single dropdown selector target gracefully
    const historyRange = $("historyRange") || $("time-range-select");
    if (historyRange) {
        historyRange.addEventListener(
            "change",
            loadNetworkHistory
        );
    }

    const detectLocationButton = $("detectLocation");
    if (detectLocationButton) {
        detectLocationButton.addEventListener(
            "click",
            detectCurrentLocation
        );
    }

    const saveLocationButton = $("saveLocation");
    if (saveLocationButton) {
        saveLocationButton.addEventListener(
            "click",
            saveCurrentLocation
        );
    }

    const betterAreaButton = $("findBetterArea");
    if (betterAreaButton) {
        betterAreaButton.addEventListener(
            "click",
            findBetterConnectionArea
        );
    }

    const exportCSVButton = $("exportCSV");
    if (exportCSVButton) {
        exportCSVButton.addEventListener(
            "click",
            exportHistoryToCSV
        );
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

            if (effective === "4g") {
                type = "4G";
            } else if (effective === "3g") {
                type = "3G";
            } else if (effective === "2g") {
                type = "2G";
            } else if (effective === "slow-2g") {
                type = "Slow 2G";
            }
        }
    }

    if (type === "wifi") {
        type = "Wi-Fi";
    }

    if (type === "cellular") {
        type = "Mobile";
    }

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

    // Download contribution (up to 35 points)
    if (download >= 50) score += 35;
    else if (download >= 25) score += 30;
    else if (download >= 10) score += 20;
    else if (download >= 5) score += 10;

    // Upload contribution (up to 20 points)
    if (upload >= 20) score += 20;
    else if (upload >= 10) score += 15;
    else if (upload >= 5) score += 10;
    else if (upload >= 2) score += 5;

    // Latency / Ping contribution (up to 25 points)
    if (ping <= 20) score += 25;
    else if (ping <= 50) score += 20;
    else if (ping <= 100) score += 10;
    else if (ping <= 150) score += 5;

    // Jitter contribution (up to 10 points)
    if (jitter <= 5) score += 10;
    else if (jitter <= 15) score += 7;
    else if (jitter <= 30) score += 4;

    // Packet Loss contribution (up to 10 points)
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
    if (testRunning) {
        return;
    }

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

        setTestMessage(
            "Your device is offline. Connect to a network and try again."
        );

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

        const module = await import(
            "https://cdn.skypack.dev/@cloudflare/speedtest"
        );

        const SpeedTest = module.default;

        speedTest = new SpeedTest({
            autoStart: false,
            measureDownloadLoadedLatency: false,
            measureUploadLoadedLatency: false,
            bandwidthFinishRequestDuration: 500,
            measurements: [
                {
                    type: "download",
                    bytes: 100000,
                    count: 2,
                    bypassMinDuration: true
                },
                {
                    type: "download",
                    bytes: 1000000,
                    count: 2,
                    bypassMinDuration: true
                },
                {
                    type: "upload",
                    bytes: 100000,
                    count: 2,
                    bypassMinDuration: true
                },
                {
                    type: "upload",
                    bytes: 1000000,
                    count: 2,
                    bypassMinDuration: true
                }
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

        const response = await fetch(
            `${API_BASE}/network-quality`,
            {
                method: "GET",
                cache: "no-store"
            }
        );

        if (!response.ok) {
            throw new Error(`Backend returned ${response.status}`);
        }

        const data = await response.json();
        console.log("Backend network quality:", data);

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
    if (!speedTest || !speedTest.results) {
        return;
    }

    if (type === "download") {
        try {
            const bandwidth = speedTest.results.getDownloadBandwidth();
            if (
                bandwidth !== undefined &&
                bandwidth !== null &&
                Number.isFinite(Number(bandwidth))
            ) {
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
            if (
                bandwidth !== undefined &&
                bandwidth !== null &&
                Number.isFinite(Number(bandwidth))
            ) {
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

    console.log("Cloudflare summary:", results.getSummary());
}


/* =========================================================
   CHECK BOTH TESTS & FINAL COMBINED RESULT
   ========================================================= */

function checkIfEverythingFinished() {
    if (!speedTestFinished || !backendTestFinished) {
        return;
    }
    finishCombinedTest();
}

async function finishCombinedTest() {
    clearTimeout(testTimeout);
    detectNetworkType();
    updateConnectivityScore();
    updateApplicationReadiness();
    updateDiagnosis();
    updateAISections();
    updateSessionStatistics();

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
    updateSessionStatistics();

    console.log("FINAL NETWORK DATA:", testData);
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
   CONNECTIVITY SCORE & READINESS
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

function updateApplicationReadiness() {
    const download = currentMetrics.download || 0;
    const upload = currentMetrics.upload || 0;
    const ping = currentMetrics.ping ?? 999;
    const jitter = currentMetrics.jitter ?? 999;
    const packetLoss = currentMetrics.packetLoss ?? 100;

    // Gaming
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

    // Video Call
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

    // Streaming
    let streaming = 0;
    if (download >= 25) streaming = 100;
    else if (download >= 10) streaming = 85;
    else if (download >= 5) streaming = 70;
    else if (download >= 3) streaming = 55;
    else if (download >= 1) streaming = 30;
    else streaming = 10;

    if (packetLoss > 5) streaming -= 10;

    // Browsing
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

    updateReadinessCard("gamingScore", gaming);
    updateReadinessCard("videoCallScore", videoCall);
    updateReadinessCard("streamingScore", streaming);
    updateReadinessCard("browsingScore", browsing);
}

function updateReadinessCard(elementId, score) {
    const scoreElement = $(elementId);
    if (!scoreElement) return;

    scoreElement.textContent = `${score}%`;
    scoreElement.classList.remove('high', 'medium', 'low');

    if (score >= 80) {
        scoreElement.classList.add('high');
    } else if (score >= 50) {
        scoreElement.classList.add('medium');
    } else {
        scoreElement.classList.add('low');
    }
}


/* =========================================================
   SMART DIAGNOSIS & AI SECTIONS
   ========================================================= */

function updateDiagnosis() {
    const recommendation = $("recommendation");
    if (!recommendation) {
        return;
    }

    if (currentMetrics.download === null && currentMetrics.ping === null) {
        recommendation.textContent = "Run an Internet test to begin network analysis.";
        return;
    }

    const problems = [];
    if (currentMetrics.download !== null && currentMetrics.download < 5) {
        problems.push("download speed is low");
    }
    if (currentMetrics.upload !== null && currentMetrics.upload < 2) {
        problems.push("upload speed is low");
    }
    if (currentMetrics.ping !== null && currentMetrics.ping > 100) {
        problems.push("latency is high");
    }
    if (currentMetrics.jitter !== null && currentMetrics.jitter > 30) {
        problems.push("jitter is high");
    }
    if (currentMetrics.packetLoss !== null && currentMetrics.packetLoss > 2) {
        problems.push("packet loss is elevated");
    }

    if (problems.length === 0) {
        recommendation.textContent = "Current measurements do not show a major connectivity issue.";
        return;
    }

    recommendation.textContent =
        `Detected issue: ${problems.join(", ")}. ` +
        "Consider moving closer to the access point, " +
        "reducing network congestion, or checking the network connection.";
}

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

        if (!response.ok) {
            throw new Error(`AI API returned ${response.status}`);
        }

        const result = await response.json();
        if (!result.success) {
            throw new Error(result.message || "AI analysis failed.");
        }

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
                    `${status} Reconstruction error: ` +
                    `${Number(anomalyData.reconstruction_error).toFixed(6)} ` +
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
   SAVE & LOAD NETWORK TEST / HISTORY
   ========================================================= */

async function saveNetworkTest(testData) {
    try {
        const response = await fetch(`${API_BASE}/network-test`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(testData)
        });

        if (!response.ok) {
            throw new Error(`Server returned ${response.status}`);
        }

        const data = await response.json();
        console.log("Network test saved:", data);
    } catch (error) {
        console.error("Could not save network test:", error);
    }
}

async function loadNetworkHistory() {
    try {
        const rangeElement = $("historyRange") || $("time-range-select");
        const range = rangeElement ? rangeElement.value : "recent";

        const response = await fetch(
            `${API_BASE}/network-history?range=${encodeURIComponent(range)}`,
            { cache: "no-store" }
        );

        if (!response.ok) {
            throw new Error(`History request failed: ${response.status}`);
        }

        const data = await response.json();
        const history = Array.isArray(data) ? data : [];

        updateHistoryChart(history);

        if (history.length > 0) {
            const latest = history[history.length - 1];

            if (currentMetrics.download === null && latest.download_mbps !== null) {
                currentMetrics.download = Number(latest.download_mbps);
            }

            if (currentMetrics.upload === null && latest.upload_mbps !== null) {
                currentMetrics.upload = Number(latest.upload_mbps);
            }
        }
    } catch (error) {
        console.error("Could not load network history:", error);
        updateHistoryChart([]);
    }
}


/* =========================================================
   HISTORY CHART (HARMONIZED CANVAS TARGETING)
   ========================================================= */

function updateHistoryChart(history = []) {
    const canvas = $("networkChart") || $("historyChart");

    if (!canvas) {
        return;
    }

    if (typeof Chart === "undefined") {
        console.warn("Chart.js is not loaded.");
        return;
    }

    const labels = [];
    const scores = [];
    const downloads = [];

    if (Array.isArray(history)) {
        history.forEach(item => {
            const date = item.timestamp;
            if (date) {
                const d = new Date(date);
                labels.push(
                    d.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit"
                    })
                );
            } else {
                labels.push("");
            }

            scores.push(Number(item.connectivity_score ?? item.score) || 0);
            downloads.push(Number(item.download_mbps ?? item.downloadSpeed) || 0);
        });
    }

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
            interaction: {
                mode: "index",
                intersect: false
            },
            scales: {
                scoreAxis: {
                    type: "linear",
                    position: "left",
                    min: 0,
                    max: 100,
                    title: {
                        display: true,
                        text: "Score"
                    }
                },
                speedAxis: {
                    type: "linear",
                    position: "right",
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: "Mbps"
                    },
                    grid: {
                        drawOnChartArea: false
                    }
                }
            }
        }
    });
}


/* =========================================================
   TIMERS & STATISTICS
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
    if (!testStartTime) {
        return;
    }

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

    const averageSpeed = speeds.length
        ? speeds.reduce((a, b) => a + b, 0) / speeds.length
        : 0;

    const averagePing = pings.length
        ? pings.reduce((a, b) => a + b, 0) / pings.length
        : 0;

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
   MAP INITIALIZATION & AUTO-RESIZE
   ========================================================= */

function initializeMap() {
    const mapElement = $("connectivityMap");

    if (!mapElement) {
        return;
    }

    if (typeof L === "undefined") {
        console.warn("Leaflet is not loaded.");
        return;
    }

    connectivityMap = L.map(mapElement).setView([18.5204, 73.8567], 10);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors"
    }).addTo(connectivityMap);

    // Guarantee map tile rendering across desktop & mobile viewports
    setTimeout(() => {
        if (connectivityMap) {
            connectivityMap.invalidateSize();
        }
    }, 300);
}


/* =========================================================
   LOCATION DETECTION & MANAGEMENT
   ========================================================= */

function detectCurrentLocation() {
    const result = $("locationResult");

    if (!navigator.geolocation) {
        if (result) {
            result.textContent = "Geolocation is not supported by this browser.";
        }
        return;
    }

    if (result) {
        result.textContent = "Detecting your location...";
    }

    navigator.geolocation.getCurrentPosition(
        position => {
            const latitude = position.coords.latitude;
            const longitude = position.coords.longitude;
            const accuracy = position.coords.accuracy;

            console.log("Location detection:", {
                latitude,
                longitude,
                accuracyMeters: accuracy,
                timestamp: new Date(position.timestamp)
            });

            if (accuracy > 500) {
                if (result) {
                    result.textContent =
                        `Location is too approximate (±${Math.round(accuracy)} m). ` +
                        `Move to an open area and try again.`;
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

            if (error.code === 1) {
                message = "Location permission denied. Allow location access in Chrome.";
            } else if (error.code === 2) {
                message = "Location unavailable. Check your device's location settings.";
            } else if (error.code === 3) {
                message = "Location request timed out. Please try again.";
            }

            if (result) {
                result.textContent = message;
            }
        },
        {
            enableHighAccuracy: true,
            timeout: 30000,
            maximumAge: 0
        }
    );
}

function showLocationOnMap(latitude, longitude) {
    if (!connectivityMap) {
        return;
    }

    const location = [latitude, longitude];
    connectivityMap.setView(location, 15);

    if (currentLocationMarker) {
        currentLocationMarker.setLatLng(location);
    } else {
        currentLocationMarker = L.marker(location).addTo(connectivityMap);
    }

    currentLocationMarker.bindPopup("Current Location").openPopup();
}

function saveCurrentLocation() {
    const result = $("locationResult");

    if (!currentLocation) {
        if (result) {
            result.textContent = "Detect your location first.";
        }
        return;
    }

    const point = {
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        score: currentMetrics.score,
        download: currentMetrics.download,
        upload: currentMetrics.upload,
        ping: currentMetrics.ping,
        timestamp: new Date().toISOString()
    };

    savedLocations.push(point);

    localStorage.setItem(
        "savedNetworkLocations",
        JSON.stringify(savedLocations)
    );

    if (result) {
        result.textContent = "Current network location saved.";
    }

    addSavedLocationToMap(point);
}

function loadSavedLocations() {
    try {
        const saved = localStorage.getItem("savedNetworkLocations");
        if (!saved) return;

        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
            savedLocations = parsed;
        }

        savedLocations.forEach(point => {
            addSavedLocationToMap(point);
        });
    } catch (error) {
        console.error("Could not load saved locations:", error);
    }
}

function addSavedLocationToMap(point) {
    if (!connectivityMap) return;

    if (
        !Number.isFinite(Number(point.latitude)) ||
        !Number.isFinite(Number(point.longitude))
    ) {
        return;
    }

    const score = Number(point.score) || 0;

    L.circleMarker(
        [Number(point.latitude), Number(point.longitude)],
        { radius: 8 }
    )
        .addTo(connectivityMap)
        .bindPopup(`Connectivity Score: ${score}/100`);
}

function findBetterConnectionArea() {
    const result = $("navigationResult");

    if (!currentLocation) {
        if (result) {
            result.textContent = "Detect your current location first.";
        }
        return;
    }

    if (!Array.isArray(savedLocations) || savedLocations.length === 0) {
        if (result) {
            result.textContent = "No saved network locations are available yet.";
        }
        return;
    }

    const betterPoints = savedLocations.filter(
        point => Number(point.score) > currentMetrics.score
    );

    if (betterPoints.length === 0) {
        if (result) {
            result.textContent = "No saved location currently has a higher connectivity score.";
        }
        return;
    }

    betterPoints.sort((a, b) => Number(b.score) - Number(a.score));
    const target = betterPoints[0];

    const distance = calculateDistanceKm(
        currentLocation.latitude,
        currentLocation.longitude,
        Number(target.latitude),
        Number(target.longitude)
    );

    const bearing = calculateBearing(
        currentLocation.latitude,
        currentLocation.longitude,
        Number(target.latitude),
        Number(target.longitude)
    );

    const direction = bearingToDirection(bearing);

    if (result) {
        result.textContent =
            `Better saved area found. ` +
            `Score: ${target.score}/100. ` +
            `Distance: ${distance.toFixed(2)} km. ` +
            `Direction: ${direction}.`;
    }

    if (connectivityMap) {
        connectivityMap.setView(
            [Number(target.latitude), Number(target.longitude)],
            14
        );
    }
}


/* =========================================================
   GEOMETRY & MATH HELPERS
   ========================================================= */

function calculateDistanceKm(lat1, lon1, lat2, lon2) {
    const earthRadius = 6371;
    const dLat = degreesToRadians(lat2 - lat1);
    const dLon = degreesToRadians(lon2 - lon1);

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(degreesToRadians(lat1)) *
        Math.cos(degreesToRadians(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return earthRadius * c;
}

function calculateBearing(lat1, lon1, lat2, lon2) {
    const phi1 = degreesToRadians(lat1);
    const phi2 = degreesToRadians(lat2);
    const lambda = degreesToRadians(lon2 - lon1);

    const y = Math.sin(lambda) * Math.cos(phi2);
    const x =
        Math.cos(phi1) * Math.sin(phi2) -
        Math.sin(phi1) * Math.cos(phi2) * Math.cos(lambda);

    const bearing = Math.atan2(y, x);
    return (radiansToDegrees(bearing) + 360) % 360;
}

function bearingToDirection(bearing) {
    const directions = [
        "North",
        "North-East",
        "East",
        "South-East",
        "South",
        "South-West",
        "West",
        "North-West"
    ];
    const index = Math.round(bearing / 45) % 8;
    return directions[index];
}

function degreesToRadians(degrees) {
    return (degrees * Math.PI) / 180;
}

function radiansToDegrees(radians) {
    return (radians * 180) / Math.PI;
}


/* =========================================================
   BACKEND HEALTH & TEST MESSAGE
   ========================================================= */

async function checkBackendHealth() {
    try {
        const response = await fetch(`${API_BASE}/health`);
        if (!response.ok) return false;

        const data = await response.json();
        console.log("Backend health:", data);
        return true;
    } catch (error) {
        console.error("Backend health check failed:", error);
        return false;
    }
}

function setTestMessage(message) {
    setText("testMessage", message);
}


/* =========================================================
   CSV EXPORT LOGIC (SCOPED & SAFE)
   ========================================================= */

async function exportHistoryToCSV() {
    try {
        let records = [];

        try {
            const response = await fetch(`${API_BASE}/network-history`);
            if (response.ok) {
                records = await response.json();
            }
        } catch (err) {
            console.warn("Could not fetch history endpoint, falling back to local session records.", err);
        }

        if (!Array.isArray(records) || records.length === 0) {
            records = sessionTests;
        }

        if (!Array.isArray(records) || records.length === 0) {
            alert("No history records available to export.");
            return;
        }

        const headers = [
            "Timestamp",
            "Download Speed (Mbps)",
            "Upload Speed (Mbps)",
            "Ping (ms)",
            "Connectivity Score"
        ];

        const csvRows = [headers.join(",")];

        records.forEach(record => {
            const timestamp = record.timestamp
                ? `"${String(record.timestamp).replace(/"/g, '""')}"`
                : '"N/A"';
            const downloadSpeed = record.download_mbps ?? record.downloadSpeed ?? "N/A";
            const uploadSpeed = record.upload_mbps ?? record.uploadSpeed ?? "N/A";
            const ping = record.ping_ms ?? record.ping ?? "N/A";
            const score = record.connectivity_score ?? record.connectivityScore ?? record.score ?? "N/A";

            csvRows.push([timestamp, downloadSpeed, uploadSpeed, ping, score].join(","));
        });

        const csvContent = csvRows.join("\r\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const blobUrl = URL.createObjectURL(blob);

        const downloadLink = document.createElement("a");
        downloadLink.href = blobUrl;

        const today = new Date().toISOString().split("T")[0];
        downloadLink.setAttribute("download", `network_history_${today}.csv`);

        document.body.appendChild(downloadLink);
        downloadLink.click();

        document.body.removeChild(downloadLink);
        URL.revokeObjectURL(blobUrl);

    } catch (error) {
        console.error("Error exporting CSV:", error);
        alert("An error occurred while exporting network history.");
    }
}


/* =========================================================
   GLOBAL EXPORTS & ABSTRACTIONS
   ========================================================= */

window.smartConnectivity = {
    getCurrentNetworkData() {
        return {
            ...currentMetrics,
            backendQuality,
            location: currentLocation,
            sessionTests
        };
    },
    checkBackendHealth,
    runBackendNetworkQualityTest,
    loadNetworkHistory,
    detectCurrentLocation,
    saveCurrentLocation,
    findBetterConnectionArea,
    exportHistoryToCSV
};