/* ============================================================
   SMART CONNECTIVITY ANALYSER
   COMPLETE INTEGRATED SCRIPT
   ============================================================ */

const API_BASE = window.API_BASE || "http://127.0.0.1:8000/api";

let networkChart = null;
let connectivityMap = null;
let currentMarker = null;
let testInProgress = false;
let speedTest = null;
let sessionStartTime = Date.now();
let sessionTimer = null;
let downtimeSeconds = 0;
let currentLocation = null;
let sessionTests = [];
let savedLocations = [];

let currentMetrics = {
    download: null,
    upload: null,
    ping: null,
    jitter: null,
    packetLoss: null,
    networkType: "Unknown",
    score: 0
};

/* ============================================================
   HELPERS
   ============================================================ */

const $ = id => document.getElementById(id);

function setText(id, value) {
    const el = $(id);
    if (el) el.textContent = value;
}

function setProgress(id, value) {
    const el = $(id);
    if (el) {
        el.style.width = `${Math.max(0, Math.min(100, Number(value) || 0))}%`;
    }
}

function valid(value) {
    return value !== null &&
        value !== undefined &&
        value !== "" &&
        typeof value !== "boolean" &&
        Number.isFinite(Number(value));
}

function number(value, fallback = null) {
    return valid(value) ? Number(value) : fallback;
}

function firstValid(...values) {
    for (const value of values) {
        if (valid(value)) return Number(value);
    }
    return null;
}

function showToast(message) {
    const toast = $("toast");
    const text = $("toast-message");

    if (!toast) return;

    if (text) text.textContent = message;

    toast.classList.add("show");

    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => {
        toast.classList.remove("show");
    }, 3000);
}

/* ============================================================
   INITIALIZATION
   ============================================================ */

document.addEventListener("DOMContentLoaded", initializeApplication);

function initializeApplication() {
    setupButtons();
    setupNetworkListeners();
    detectNetworkType();

    initializeMap();
    initializeChart();

    loadSavedLocations();
    loadNetworkHistory();

    updateDashboard();
    updateApplicationReadiness();
    updateNetworkRecommendation();
    updateAIAnalysis();

    startSessionTimer();

    console.log("Smart Connectivity Analyser initialized.");
}

function setupButtons() {
    $("startTest")?.addEventListener("click", startNetworkTest);
    $("exportCSV")?.addEventListener("click", exportHistoryToCSV);

    $("historyRange")?.addEventListener("change", () => {
        loadNetworkHistory($("historyRange").value);
    });

    $("detectLocation")?.addEventListener("click", detectLocation);
    $("saveLocation")?.addEventListener("click", saveLocation);
    $("findBetterArea")?.addEventListener("click", findBetterArea);
}

function setupNetworkListeners() {
    window.addEventListener("online", () => {
        updateNetworkStatus();
        showToast("Internet connection restored.");
    });

    window.addEventListener("offline", () => {
        updateNetworkStatus();
        showToast("Internet connection lost.");
    });

    window.addEventListener("resize", () => {
        connectivityMap?.invalidateSize();
        networkChart?.resize();
    });

    setInterval(() => {
        if (!navigator.onLine) downtimeSeconds++;
        updateSessionStatistics();
    }, 1000);
}

/* ============================================================
   NETWORK TYPE
   ============================================================ */

function detectNetworkType() {
    const connection =
        navigator.connection ||
        navigator.mozConnection ||
        navigator.webkitConnection;

    let type = "Unknown";

    if (connection?.type) type = connection.type;
    else if (connection?.effectiveType) {
        type = connection.effectiveType.toUpperCase();
    }

    if (type.toLowerCase() === "wifi") type = "Wi-Fi";
    if (type.toLowerCase() === "cellular") type = "Mobile";

    currentMetrics.networkType = type;
    setText("networkType", type);
}

/* ============================================================
   MAP - OPENSTREETMAP
   ============================================================ */

function initializeMap() {
    const element = $("connectivityMap");

    if (!element) {
        console.warn("connectivityMap element missing.");
        return;
    }

    if (typeof L === "undefined") {
        console.error("Leaflet is not loaded.");
        return;
    }

    if (connectivityMap) {
        connectivityMap.invalidateSize();
        return;
    }

    connectivityMap = L.map(element, {
        zoomControl: true,
        scrollWheelZoom: true
    }).setView([19.0760, 72.8777], 12);

    const tiles = L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
            minZoom: 1,
            maxZoom: 19,
            attribution: "&copy; OpenStreetMap contributors"
        }
    );

    tiles.on("tileerror", error => {
        console.warn("Map tile error:", error);
        setText("locationResult", "Map tiles unavailable. Check your connection.");
    });

    tiles.addTo(connectivityMap);

    connectivityMap.whenReady(() => {
        setTimeout(() => connectivityMap.invalidateSize(true), 300);
    });

    console.log("OpenStreetMap initialized.");
}

/* ============================================================
   LOCATION
   ============================================================ */

function detectLocation() {
    if (!navigator.geolocation) {
        setText("locationResult", "Geolocation is not supported.");
        return;
    }

    setText("locationResult", "Detecting location...");

    navigator.geolocation.getCurrentPosition(
        position => {
            const latitude = position.coords.latitude;
            const longitude = position.coords.longitude;
            const accuracy = position.coords.accuracy;

            currentLocation = {
                latitude,
                longitude,
                accuracy,
                timestamp: position.timestamp
            };

            initializeMap();

            if (connectivityMap) {
                const point = [latitude, longitude];

                connectivityMap.setView(point, 16);

                if (currentMarker) {
                    currentMarker.setLatLng(point);
                } else {
                    currentMarker = L.marker(point).addTo(connectivityMap);
                }

                currentMarker
                    .bindPopup("Your Current Location")
                    .openPopup();
            }

            setText(
                "locationResult",
                `Location detected: ${latitude.toFixed(5)}, ${longitude.toFixed(5)} (±${Math.round(accuracy)} m)`
            );

            showToast("Location detected.");
        },
        error => {
            let message = "Unable to detect location.";

            if (error.code === 1) {
                message = "Location permission denied. Allow browser location access.";
            } else if (error.code === 2) {
                message = "Location unavailable.";
            } else if (error.code === 3) {
                message = "Location request timed out.";
            }

            setText("locationResult", message);
        },
        {
            enableHighAccuracy: true,
            timeout: 20000,
            maximumAge: 0
        }
    );
}

function saveLocation() {
    let latitude;
    let longitude;

    if (currentLocation) {
        latitude = currentLocation.latitude;
        longitude = currentLocation.longitude;
    } else if (connectivityMap) {
        const center = connectivityMap.getCenter();
        latitude = center.lat;
        longitude = center.lng;
    } else {
        showToast("Detect your location first.");
        return;
    }

    const point = {
        latitude,
        longitude,
        score: currentMetrics.score,
        download: currentMetrics.download,
        upload: currentMetrics.upload,
        ping: currentMetrics.ping,
        timestamp: new Date().toISOString()
    };

    savedLocations.push(point);

    localStorage.setItem(
        "savedConnectivityLocations",
        JSON.stringify(savedLocations)
    );

    addSavedLocationToMap(point);

    setText("locationResult", "Network location saved.");
    showToast("Location saved successfully.");
}

function loadSavedLocations() {
    try {
        const data = JSON.parse(
            localStorage.getItem("savedConnectivityLocations") || "[]"
        );

        savedLocations = Array.isArray(data) ? data : [];

        savedLocations.forEach(addSavedLocationToMap);
    } catch (error) {
        console.warn("Saved locations could not load:", error);
        savedLocations = [];
    }
}

function addSavedLocationToMap(point) {
    if (!connectivityMap || typeof L === "undefined") return;

    const latitude = number(point.latitude);
    const longitude = number(point.longitude);

    if (latitude === null || longitude === null) return;

    L.circleMarker([latitude, longitude], {
        radius: 7,
        weight: 2
    })
        .addTo(connectivityMap)
        .bindPopup(
            `Connectivity Score: ${number(point.score, 0)}/100`
        );
}

function findBetterArea() {
    if (!currentLocation) {
        setText("navigationResult", "Detect your current location first.");
        return;
    }

    const better = savedLocations
        .filter(point =>
            number(point.score, -1) > currentMetrics.score
        )
        .sort((a, b) => Number(b.score) - Number(a.score));

    if (!better.length) {
        setText(
            "navigationResult",
            "No saved location has a higher connectivity score yet."
        );
        return;
    }

    const target = better[0];

    const distance = calculateDistanceKm(
        currentLocation.latitude,
        currentLocation.longitude,
        Number(target.latitude),
        Number(target.longitude)
    );

    const direction = bearingToDirection(
        calculateBearing(
            currentLocation.latitude,
            currentLocation.longitude,
            Number(target.latitude),
            Number(target.longitude)
        )
    );

    setText(
        "navigationResult",
        `Better saved area found. Score: ${target.score}/100. Distance: ${distance.toFixed(2)} km. Direction: ${direction}.`
    );

    connectivityMap?.setView(
        [Number(target.latitude), Number(target.longitude)],
        15
    );
}

function calculateDistanceKm(lat1, lon1, lat2, lon2) {
    const rad = value => value * Math.PI / 180;

    const dLat = rad(lat2 - lat1);
    const dLon = rad(lon2 - lon1);

    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(rad(lat1)) *
        Math.cos(rad(lat2)) *
        Math.sin(dLon / 2) ** 2;

    return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function calculateBearing(lat1, lon1, lat2, lon2) {
    const rad = value => value * Math.PI / 180;
    const deg = value => value * 180 / Math.PI;

    const phi1 = rad(lat1);
    const phi2 = rad(lat2);
    const lambda = rad(lon2 - lon1);

    const y = Math.sin(lambda) * Math.cos(phi2);
    const x =
        Math.cos(phi1) * Math.sin(phi2) -
        Math.sin(phi1) * Math.cos(phi2) * Math.cos(lambda);

    return (deg(Math.atan2(y, x)) + 360) % 360;
}

function bearingToDirection(bearing) {
    const directions = [
        "North", "North-East", "East", "South-East",
        "South", "South-West", "West", "North-West"
    ];

    return directions[Math.round(bearing / 45) % 8];
}

/* ============================================================
   CHART
   ============================================================ */

function initializeChart() {
    const canvas = $("networkChart");

    if (!canvas) {
        console.warn("Canvas #networkChart not found.");
        return;
    }

    if (typeof Chart === "undefined") {
        console.error("Chart.js is not loaded.");
        setText("testMessage", "Chart.js failed to load. Check its CDN script.");
        return;
    }

    if (networkChart) return;

    networkChart = new Chart(canvas.getContext("2d"), {
        type: "line",
        data: {
            labels: [],
            datasets: [
                {
                    label: "Connectivity Score",
                    data: [],
                    borderColor: "#a78bfa",
                    backgroundColor: "rgba(167, 139, 250, 0.14)",
                    borderWidth: 3,
                    tension: 0.35,
                    fill: true,
                    spanGaps: true,
                    yAxisID: "scoreAxis"
                },
                {
                    label: "Download Speed (Mbps)",
                    data: [],
                    borderColor: "#f472b6",
                    backgroundColor: "rgba(244, 114, 182, 0.10)",
                    borderWidth: 3,
                    tension: 0.35,
                    fill: false,
                    spanGaps: true,
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
            plugins: {
                legend: {
                    display: true,
                    position: "bottom"
                }
            },
            scales: {
                scoreAxis: {
                    type: "linear",
                    position: "left",
                    min: 0,
                    max: 100,
                    title: {
                        display: true,
                        text: "Connectivity Score"
                    }
                },
                speedAxis: {
                    type: "linear",
                    position: "right",
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: "Download Mbps"
                    },
                    grid: {
                        drawOnChartArea: false
                    }
                }
            }
        }
    });
}

function normalizeHistoryItem(item = {}) {
    return {
        timestamp: item.timestamp || item.created_at || item.time || new Date().toISOString(),
        download_mbps: firstValid(item.download_mbps, item.download, item.downloadSpeed),
        upload_mbps: firstValid(item.upload_mbps, item.upload, item.uploadSpeed),
        ping: firstValid(item.ping_ms, item.ping),
        jitter: firstValid(item.jitter_ms, item.jitter),
        packet_loss: firstValid(item.packet_loss, item.packetLoss, item.packet_loss_percent),
        connectivity_score: firstValid(item.connectivity_score, item.score)
    };
}

async function loadNetworkHistory(range = null) {
    const selectedRange = range || $("historyRange")?.value || "recent";

    try {
        const response = await fetch(
            `${API_BASE}/network-history?range=${encodeURIComponent(selectedRange)}`,
            { cache: "no-store" }
        );

        if (!response.ok) {
            throw new Error(`History API returned ${response.status}`);
        }

        const result = await response.json();

        const data = Array.isArray(result)
            ? result
            : result.history || result.data || result.results || [];

        if (!Array.isArray(data)) {
            throw new Error("Unexpected history response.");
        }

        sessionTests = data
            .map(normalizeHistoryItem)
            .filter(item => Number.isFinite(Date.parse(item.timestamp)));

    } catch (error) {
        console.warn("History API unavailable:", error.message);
    }

    updateHistoryChart(sessionTests, selectedRange);
    updateSessionStatistics();
}

function updateHistoryChart(history = sessionTests, range = null) {
    initializeChart();
    if (!networkChart) return;

    const selectedRange = range || $("historyRange")?.value || "recent";

    const durations = {
        "1h": 3600000,
        "24h": 86400000,
        "7d": 604800000
    };

    const now = Date.now();

    const filtered = history
        .map(normalizeHistoryItem)
        .filter(item => {
            const time = Date.parse(item.timestamp);

            if (!Number.isFinite(time)) return false;
            if (selectedRange === "recent") return true;

            const duration = durations[selectedRange];

            return !duration || (now - time <= duration && now - time >= 0);
        })
        .sort((a, b) =>
            Date.parse(a.timestamp) - Date.parse(b.timestamp)
        );

    networkChart.data.labels = filtered.map(item =>
        new Date(item.timestamp).toLocaleString([], {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        })
    );

    networkChart.data.datasets[0].data =
        filtered.map(item => item.connectivity_score);

    networkChart.data.datasets[1].data =
        filtered.map(item => item.download_mbps);

    networkChart.update();
}

/* ============================================================
   INTERNET TEST
   ============================================================ */

async function startNetworkTest() {
    if (testInProgress) return;

    if (!navigator.onLine) {
        setText("status", "Offline");
        setText("testMessage", "Your device is offline. Connect to the Internet first.");
        showToast("No Internet connection.");
        return;
    }

    testInProgress = true;

    const button = $("startTest");

    if (button) {
        button.disabled = true;
        button.textContent = "Testing...";
    }

    currentMetrics = {
        download: null,
        upload: null,
        ping: null,
        jitter: null,
        packetLoss: null,
        networkType: currentMetrics.networkType,
        score: 0
    };

    setText("testMessage", "Testing your Internet connection...");
    setText("status", "Testing");

    updateDashboard();

    try {
        const [backendData, bandwidthData] = await Promise.all([
            runBackendNetworkQualityTest(),
            runCloudflareBandwidthTest()
        ]);

        applyBackendMetrics(backendData);
        applyBandwidthMetrics(bandwidthData);

        if (currentMetrics.ping === null || currentMetrics.jitter === null) {
            const latency = await measureBrowserLatency();

            if (currentMetrics.ping === null) {
                currentMetrics.ping = latency.ping;
            }

            if (currentMetrics.jitter === null) {
                currentMetrics.jitter = latency.jitter;
            }
        }

        detectNetworkType();

        currentMetrics.score = calculateConnectivityScore(currentMetrics);

        const entry = {
            timestamp: new Date().toISOString(),
            download_mbps: currentMetrics.download,
            upload_mbps: currentMetrics.upload,
            ping_ms: currentMetrics.ping,
            jitter_ms: currentMetrics.jitter,
            packet_loss: currentMetrics.packetLoss,
            connectivity_score: currentMetrics.score,
            network_type: currentMetrics.networkType,
            latitude: currentLocation?.latitude ?? null,
            longitude: currentLocation?.longitude ?? null
        };

        sessionTests.push(normalizeHistoryItem(entry));

        updateDashboard();
        updateApplicationReadiness();
        updateNetworkRecommendation();
        updateAIAnalysis();

        updateHistoryChart(sessionTests);
        updateSessionStatistics();

        await saveNetworkTest(entry);

        setText("testMessage", "Internet connectivity test completed successfully.");
        showToast("Network test completed.");

    } catch (error) {
        console.error("Test error:", error);
        setText("testMessage", "Test failed. Check the backend and browser console.");
        showToast("Network test failed.");
    } finally {
        testInProgress = false;

        if (button) {
            button.disabled = false;
            button.textContent = "Start Test";
        }

        updateNetworkStatus();
    }
}

/* ============================================================
   CLOUDFLARE BANDWIDTH
   ============================================================ */

async function runCloudflareBandwidthTest() {
    try {
        setText("testMessage", "Measuring download and upload speed...");

        const module = await import("https://cdn.skypack.dev/@cloudflare/speedtest");
        const SpeedTest = module.default;

        const test = new SpeedTest({
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

        speedTest = test;

        return await new Promise(resolve => {
            let completed = false;

            const finish = result => {
                if (completed) return;
                completed = true;
                clearTimeout(speedTestTimeout);
                resolve(result);
            };

            test.onFinish = results => {
                let download = null;
                let upload = null;

                try {
                    download = safeNumber(results.getDownloadBandwidth()) ;
                    upload = safeNumber(results.getUploadBandwidth());
                } catch (error) {
                    console.warn("Could not read speed results:", error);
                }

                finish({
                    download: download === null ? null : download / 1000000,
                    upload: upload === null ? null : upload / 1000000
                });
            };

            test.onError = error => {
                console.warn("Cloudflare speed test error:", error);
                finish({ download: null, upload: null });
            };

            test.onResultsChange = ({ type } = {}) => {
                try {
                    if (type === "download") {
                        const value = test.results.getDownloadBandwidth();
                        if (valid(value)) {
                            setText("download", `${(Number(value) / 1000000).toFixed(2)}`);
                        }
                    }

                    if (type === "upload") {
                        const value = test.results.getUploadBandwidth();
                        if (valid(value)) {
                            setText("upload", `${(Number(value) / 1000000).toFixed(2)}`);
                        }
                    }
                } catch (error) {
                    console.debug("Live result pending:", error);
                }
            };

            speedTestTimeout = setTimeout(() => {
                try {
                    test.pause();
                } catch (_) {}

                finish({ download: null, upload: null });
            }, 90000);

            try {
                test.play();
            } catch (error) {
                console.error("Could not start Cloudflare test:", error);
                finish({ download: null, upload: null });
            }
        });

    } catch (error) {
        console.warn("Cloudflare speed test unavailable:", error);
        return { download: null, upload: null };
    }
}

/* ============================================================
   BACKEND NETWORK QUALITY
   ============================================================ */

async function runBackendNetworkQualityTest() {
    try {
        const response = await fetch(`${API_BASE}/network-quality`, {
            method: "GET",
            cache: "no-store"
        });

        if (!response.ok) {
            throw new Error(`Backend returned ${response.status}`);
        }

        return await response.json();

    } catch (error) {
        console.warn("Backend network-quality API unavailable:", error.message);
        return null;
    }
}

function applyBackendMetrics(data) {
    if (!data) return;

    const metrics = data.metrics || data.data || data;

    currentMetrics.ping = firstValid(
        metrics.ping_ms,
        metrics.ping,
        currentMetrics.ping
    );

    currentMetrics.jitter = firstValid(
        metrics.jitter_ms,
        metrics.jitter,
        currentMetrics.jitter
    );

    currentMetrics.packetLoss = firstValid(
        metrics.packet_loss,
        metrics.packet_loss_percent,
        metrics.packetLoss,
        currentMetrics.packetLoss
    );

    currentMetrics.download = firstValid(
        metrics.download_mbps,
        metrics.download,
        currentMetrics.download
    );

    currentMetrics.upload = firstValid(
        metrics.upload_mbps,
        metrics.upload,
        currentMetrics.upload
    );

    currentMetrics.networkType =
        metrics.network_type ||
        metrics.networkType ||
        currentMetrics.networkType;
}

function applyBandwidthMetrics(data) {
    if (!data) return;

    if (currentMetrics.download === null && valid(data.download)) {
        currentMetrics.download = Number(data.download);
    }

    if (currentMetrics.upload === null && valid(data.upload)) {
        currentMetrics.upload = Number(data.upload);
    }
}

async function measureBrowserLatency() {
    const samples = [];

    for (let i = 0; i < 4; i++) {
        const start = performance.now();

        try {
            await fetch(
                `https://www.cloudflare.com/cdn-cgi/trace?time=${Date.now()}-${i}`,
                {
                    cache: "no-store",
                    mode: "no-cors"
                }
            );

            samples.push(performance.now() - start);

        } catch (error) {
            console.warn("Latency sample failed:", error);
        }
    }

    if (!samples.length) {
        return { ping: null, jitter: null };
    }

    const average =
        samples.reduce((sum, value) => sum + value, 0) / samples.length;

    const jitter =
        samples.reduce((sum, value) => sum + Math.abs(value - average), 0) /
        samples.length;

    return {
        ping: Number(average.toFixed(2)),
        jitter: Number(jitter.toFixed(2))
    };
}

/* ============================================================
   CONNECTIVITY SCORE
   ============================================================ */

function calculateConnectivityScore(metrics) {
    const values = [];

    if (valid(metrics.download)) {
        values.push(Math.min(100, Number(metrics.download) * 2));
    }

    if (valid(metrics.upload)) {
        values.push(Math.min(100, Number(metrics.upload) * 4));
    }

    if (valid(metrics.ping)) {
        values.push(Math.max(0, 100 - Number(metrics.ping) * 0.6));
    }

    if (valid(metrics.jitter)) {
        values.push(Math.max(0, 100 - Number(metrics.jitter) * 1.5));
    }

    if (valid(metrics.packetLoss)) {
        values.push(Math.max(0, 100 - Number(metrics.packetLoss) * 10));
    }

    if (!values.length) return 0;

    return Math.round(
        values.reduce((sum, value) => sum + value, 0) / values.length
    );
}

function getConnectivityStatus(score) {
    if (!navigator.onLine) return "Offline";
    if (score >= 80) return "Excellent";
    if (score >= 60) return "Good";
    if (score >= 40) return "Fair";
    if (score > 0) return "Poor";
    return "Online";
}

/* ============================================================
   DASHBOARD
   ============================================================ */

function updateDashboard() {
    setText("download", valid(currentMetrics.download) ? currentMetrics.download.toFixed(2) : "—");
    setText("upload", valid(currentMetrics.upload) ? currentMetrics.upload.toFixed(2) : "—");
    setText("ping", valid(currentMetrics.ping) ? currentMetrics.ping.toFixed(2) : "—");
    setText("jitter", valid(currentMetrics.jitter) ? currentMetrics.jitter.toFixed(2) : "—");
    setText("packetLoss", valid(currentMetrics.packetLoss) ? currentMetrics.packetLoss.toFixed(2) : "—");

    setText("networkType", currentMetrics.networkType || "Unknown");

    currentMetrics.score = calculateConnectivityScore(currentMetrics);

    setText("score", currentMetrics.score);
    setProgress("scoreProgress", currentMetrics.score);

    const status = getConnectivityStatus(currentMetrics.score);
    setText("status", status);

    const dot = $("networkStatusDot");

    if (dot) {
        dot.classList.remove(
            "connected", "disconnected", "testing",
            "excellent", "good", "fair", "poor"
        );

        dot.classList.add(navigator.onLine ? "connected" : "disconnected");
    }
}

function updateNetworkStatus() {
    if (!navigator.onLine) {
        setText("status", "Offline");
        $("networkStatusDot")?.classList.add("disconnected");
    } else if (!testInProgress) {
        updateDashboard();
    }
}

/* ============================================================
   APPLICATION READINESS
   ============================================================ */

function updateApplicationReadiness() {
    const download = number(currentMetrics.download);
    const upload = number(currentMetrics.upload);
    const ping = number(currentMetrics.ping);
    const jitter = number(currentMetrics.jitter);
    const loss = number(currentMetrics.packetLoss);

    const gaming = readiness([
        download === null ? null : Math.min(25, download * 2.5),
        upload === null ? null : Math.min(15, upload * 3),
        ping === null ? null : Math.max(0, 35 - ping * 0.35),
        jitter === null ? null : Math.max(0, 15 - jitter * 0.75),
        loss === null ? null : Math.max(0, 10 - loss * 5)
    ], [25, 15, 35, 15, 10]);

    const video = readiness([
        download === null ? null : Math.min(25, download * 5),
        upload === null ? null : Math.min(30, upload * 6),
        ping === null ? null : Math.max(0, 20 - ping * 0.08),
        jitter === null ? null : Math.max(0, 15 - jitter * 0.3),
        loss === null ? null : Math.max(0, 10 - loss * 3)
    ], [25, 30, 20, 15, 10]);

    const streaming = download === null
        ? null
        : download >= 25 ? 100
            : download >= 10 ? 85
                : download >= 5 ? 70
                    : download >= 3 ? 55
                        : download >= 1 ? 30 : 10;

    const browsing = readiness([
        download === null ? null : Math.min(55, download * 5.5),
        ping === null ? null : Math.max(0, 35 - ping * 0.12),
        loss === null ? null : Math.max(0, 10 - loss * 2)
    ], [55, 35, 10]);

    setReadiness("gamingScore", "gamingProgress", gaming);
    setReadiness("videoCallScore", "videoCallProgress", video);
    setReadiness("streamingScore", "streamingProgress", streaming);
    setReadiness("browsingScore", "browsingProgress", browsing);
}

function readiness(parts, maxima) {
    let score = 0;
    let possible = 0;

    parts.forEach((value, index) => {
        if (value !== null && Number.isFinite(value)) {
            score += value;
            possible += maxima[index];
        }
    });

    if (!possible) return null;

    return Math.round(Math.max(0, Math.min(100, score / possible * 100)));
}

function setReadiness(textId, barId, value) {
    setText(textId, value === null ? "—" : `${value}%`);

    if (value !== null) {
        setProgress(barId, value);
    }
}

/* ============================================================
   DIAGNOSIS + AI-STYLE LOCAL ANALYSIS
   ============================================================ */

function updateNetworkRecommendation() {
    const problems = [];

    if (valid(currentMetrics.download) && currentMetrics.download < 5) {
        problems.push("download speed is low");
    }

    if (valid(currentMetrics.upload) && currentMetrics.upload < 2) {
        problems.push("upload speed is low");
    }

    if (valid(currentMetrics.ping) && currentMetrics.ping > 100) {
        problems.push("latency is high");
    }

    if (valid(currentMetrics.jitter) && currentMetrics.jitter > 30) {
        problems.push("jitter is high");
    }

    if (valid(currentMetrics.packetLoss) && currentMetrics.packetLoss > 2) {
        problems.push("packet loss is elevated");
    }

    if (!problems.length) {
        setText(
            "recommendation",
            "Current measurements do not show a major connectivity issue."
        );
        return;
    }

    setText(
        "recommendation",
        `Detected issue: ${problems.join(", ")}. Try moving closer to your router, reducing network congestion, or checking your Internet connection.`
    );
}

function updateAIAnalysis() {
    const prediction = $("predictionResult");
    const anomaly = $("anomalyResult");

    if (sessionTests.length < 2) {
        if (prediction) {
            prediction.textContent = "Collect more network measurements to analyse connectivity trends.";
        }

        if (anomaly) {
            anomaly.textContent = "More measurements are required for anomaly detection.";
        }

        return;
    }

    const recent = sessionTests.slice(-5);

    const speeds = recent
        .map(item => number(item.download_mbps))
        .filter(value => value !== null);

    const pings = recent
        .map(item => number(item.ping))
        .filter(value => value !== null);

    if (prediction && speeds.length >= 2) {
        prediction.textContent =
            speeds[speeds.length - 1] >= speeds[0]
                ? "Recent download measurements indicate a stable or improving trend."
                : "Recent download measurements indicate a declining trend. Continue monitoring.";
    }

    if (anomaly && pings.length >= 2) {
        const average =
            pings.reduce((sum, value) => sum + value, 0) / pings.length;

        anomaly.textContent =
            pings[pings.length - 1] > average * 1.5
                ? "Possible latency anomaly detected compared with recent measurements."
                : "No significant latency anomaly detected in recent measurements.";
    }
}

/* ============================================================
   SAVE TEST TO BACKEND
   ============================================================ */

async function saveNetworkTest(data) {
    try {
        const response = await fetch(`${API_BASE}/network-test`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            throw new Error(`Backend returned ${response.status}`);
        }

        console.log("Network test saved:", await response.json());

    } catch (error) {
        console.warn("Could not save test to backend:", error.message);
    }
}

/* ============================================================
   HISTORY
   ============================================================ */

async function loadNetworkHistory(range = null) {
    const selectedRange = range || $("historyRange")?.value || "recent";

    try {
        const response = await fetch(
            `${API_BASE}/network-history?range=${encodeURIComponent(selectedRange)}`,
            { cache: "no-store" }
        );

        if (!response.ok) {
            throw new Error(`History API returned ${response.status}`);
        }

        const result = await response.json();

        const data = Array.isArray(result)
            ? result
            : result.history || result.data || result.results || [];

        if (!Array.isArray(data)) {
            throw new Error("Unexpected history format.");
        }

        sessionTests = data
            .map(normalizeHistoryItem)
            .filter(item => Number.isFinite(Date.parse(item.timestamp)));

    } catch (error) {
        console.warn("History unavailable:", error.message);
    }

    updateHistoryChart(sessionTests, selectedRange);
    updateSessionStatistics();
}

function normalizeHistoryItem(item = {}) {
    return {
        timestamp: item.timestamp || item.created_at || item.time || new Date().toISOString(),
        download_mbps: firstValid(item.download_mbps, item.download, item.downloadSpeed),
        upload_mbps: firstValid(item.upload_mbps, item.upload, item.uploadSpeed),
        ping: firstValid(item.ping_ms, item.ping),
        jitter: firstValid(item.jitter_ms, item.jitter),
        packet_loss: firstValid(item.packet_loss, item.packetLoss, item.packet_loss_percent),
        connectivity_score: firstValid(item.connectivity_score, item.score)
    };
}

function updateHistoryChart(history = sessionTests, range = null) {
    initializeChart();

    if (!networkChart) return;

    const selectedRange = range || $("historyRange")?.value || "recent";

    const durationMap = {
        "1h": 3600000,
        "24h": 86400000,
        "7d": 604800000
    };

    const now = Date.now();

    const filtered = history
        .map(normalizeHistoryItem)
        .filter(item => {
            const time = Date.parse(item.timestamp);

            if (!Number.isFinite(time)) return false;
            if (selectedRange === "recent") return true;

            const duration = durationMap[selectedRange];

            return !duration || (now - time <= duration && now - time >= 0);
        })
        .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));

    networkChart.data.labels = filtered.map(item =>
        new Date(item.timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit"
        })
    );

    networkChart.data.datasets[0].data =
        filtered.map(item => item.connectivity_score);

    networkChart.data.datasets[1].data =
        filtered.map(item => item.download_mbps);

    networkChart.update();
}

/* ============================================================
   CSV EXPORT
   ============================================================ */

function exportHistoryToCSV() {
    if (!sessionTests.length) {
        showToast("No network history available to export.");
        return;
    }

    const headers = [
        "Timestamp",
        "Download Mbps",
        "Upload Mbps",
        "Ping ms",
        "Jitter ms",
        "Packet Loss %",
        "Connectivity Score"
    ];

    const rows = sessionTests.map(raw => {
        const item = normalizeHistoryItem(raw);

        return [
            item.timestamp,
            item.download_mbps ?? "",
            item.upload_mbps ?? "",
            item.ping ?? "",
            item.jitter ?? "",
            item.packet_loss ?? "",
            item.connectivity_score ?? ""
        ];
    });

    const csv = [headers, ...rows]
        .map(row =>
            row.map(value =>
                `"${String(value).replace(/"/g, '""')}"`
            ).join(",")
        )
        .join("\r\n");

    const blob = new Blob(["\uFEFF" + csv], {
        type: "text/csv;charset=utf-8;"
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `connectivity-history-${new Date().toISOString().slice(0, 10)}.csv`;

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);

    showToast("CSV exported successfully.");
}

/* ============================================================
   SESSION TIMER + STATISTICS
   ============================================================ */

function startSessionTimer() {
    if (sessionTimer) clearInterval(sessionTimer);

    sessionTimer = setInterval(() => {
        const seconds = Math.floor((Date.now() - sessionStartTime) / 1000);

        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const remaining = seconds % 60;

        setText(
            "sessionTime",
            [hours, minutes, remaining]
                .map(value => String(value).padStart(2, "0"))
                .join(":")
        );

        updateSessionStatistics();

    }, 1000);
}

function updateSessionStatistics() {
    const speeds = sessionTests
        .map(item => number(normalizeHistoryItem(item).download_mbps))
        .filter(value => value !== null);

    const pings = sessionTests
        .map(item => number(normalizeHistoryItem(item).ping))
        .filter(value => value !== null);

    const averageSpeed = speeds.length
        ? speeds.reduce((a, b) => a + b, 0) / speeds.length
        : null;

    const averagePing = pings.length
        ? pings.reduce((a, b) => a + b, 0) / pings.length
        : null;

    const peakSpeed = speeds.length
        ? Math.max(...speeds)
        : null;

    setText(
        "averageSpeed",
        averageSpeed === null ? "—" : `${averageSpeed.toFixed(2)} Mbps`
    );

    setText(
        "averagePing",
        averagePing === null ? "—" : `${averagePing.toFixed(2)} ms`
    );

    setText(
        "peakSpeed",
        peakSpeed === null ? "—" : `${peakSpeed.toFixed(2)} Mbps`
    );

    setText("downtime", `${Math.floor(downtimeSeconds / 60)} min`);
}

/* ============================================================
   UTILITY + PUBLIC API
   ============================================================ */

async function checkBackendHealth() {
    try {
        const response = await fetch(`${API_BASE}/health`, {
            cache: "no-store"
        });

        return response.ok;
    } catch (error) {
        console.warn("Backend health check failed:", error);
        return false;
    }
}

const smartConnectivity = {
    getCurrentNetworkData() {
        return {
            ...currentMetrics,
            location: currentLocation,
            history: sessionTests
        };
    },

    startNetworkTest,
    loadNetworkHistory,
    exportHistoryToCSV,
    detectLocation,
    saveLocation,
    findBetterArea,
    checkBackendHealth,
    calculateConnectivityScore
};

window.smartConnectivity = smartConnectivity;
window.calculateConnectivityScore = calculateConnectivityScore;
window.exportHistoryToCSV = exportHistoryToCSV;
window.loadNetworkHistory = loadNetworkHistory;
window.METRIC_UNITS = {
    download: "Mbps",
    upload: "Mbps",
    ping: "ms",
    jitter: "ms",
    packetLoss: "%"
};