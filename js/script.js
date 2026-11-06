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

 fix/issue-32-ui-enhancements
const $ = id => document.getElementById(id);

/* =========================================================
   DOM HELPERS
   ========================================================= */

function $(id) {
    if (typeof document === "undefined") {
        return null;
    }
    return document.getElementById(id);
}
 master

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

fix/issue-32-ui-enhancements
function firstValid(...values) {
    for (const value of values) {
        if (valid(value)) return Number(value);

function isValidMetricNumber(value) {
    if (
        value === null ||
        value === undefined ||
        value === "" ||
        typeof value === "boolean" ||
        typeof value === "object" ||
        (typeof value === "string" && value.trim() === "")
    ) {
        return false;
    }

    return Number.isFinite(Number(value));
}

function formatNumber(value, decimals = 1) {
    if (!isValidMetricNumber(value)) {
        return "--";
master
    }
    return null;
}

fix/issue-32-ui-enhancements
function showToast(message) {
    const toast = $("toast");
    const text = $("toast-message");

const METRIC_UNITS = {
    download: "Mbps",
    download_mbps: "Mbps",
    upload: "Mbps",
    upload_mbps: "Mbps",
    ping: "ms",
    ping_ms: "ms",
    jitter: "ms",
    jitter_ms: "ms",
    packetLoss: "%",
    packet_loss: "%"
};

function formatMetric(value, unit = "", decimals = 1) {
    if (!isValidMetricNumber(value)) {
        return "Unavailable";
    }

    const formatted = Number(value).toFixed(decimals);
    return unit ? `${formatted} ${unit}` : formatted;
}

function formatNetworkMetric(metricType, value, decimals = 1) {
    const unit = METRIC_UNITS[metricType] !== undefined ? METRIC_UNITS[metricType] : "";
    return formatMetric(value, unit, decimals);
}

let applicationInitialized = false;
master

    if (!toast) return;

 fix/issue-32-ui-enhancements
    if (text) text.textContent = message;

    toast.classList.add("show");

if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
        document.addEventListener(
            "DOMContentLoaded",
            initializeApplication,
            { once: true }
        );
    } else {
        initializeApplication();
    }
}

async function initializeApplication() {
    if (applicationInitialized) {
        return;
    }
    applicationInitialized = true;
master

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

 fix/issue-32-ui-enhancements
    if (!navigator.onLine) {
        setText("status", "Offline");
        setText("testMessage", "Your device is offline. Connect to the Internet first.");
        showToast("No Internet connection.");

        const data = await response.json();

        console.log(
            "Backend network quality:",
            data
        );

        // Store the latest backend response.
        backendQuality = data;

        currentMetrics.ping = isValidMetricNumber(data.ping_ms)
            ? Number(data.ping_ms)
            : null;
        currentMetrics.jitter = isValidMetricNumber(data.jitter_ms)
            ? Number(data.jitter_ms)
            : null;
        currentMetrics.packetLoss = isValidMetricNumber(data.packet_loss)
            ? Number(data.packet_loss)
            : null;

        // Diagnostic: inspect the actual API and stored values.
        console.log("PACKET LOSS TRACE:", {
            apiValue: data.packet_loss,
            storedValue: currentMetrics.packetLoss,
            packetsSent: data.packets_sent,
            packetsReceived: data.packets_received
        });

        // Update ping, jitter, and packet loss
        setText(
            "ping",
            formatNetworkMetric("ping", data.ping_ms)
        );

        setText(
            "jitter",
            formatNetworkMetric("jitter", data.jitter_ms)
        );

        setText(
            "packetLoss",
            formatNetworkMetric("packetLoss", data.packet_loss)
        );

        if (!isValidMetricNumber(data.packet_loss)) {
            console.warn(
                "Packet loss is missing or invalid:",
                data.packet_loss
            );
        }

        backendTestFinished = true;

        updateLiveDashboard();
        checkIfEverythingFinished();

    } catch (error) {
        console.error(
            "Backend network quality error:",
            error
        );

        backendTestFinished = true;

        currentMetrics.ping = null;
        currentMetrics.jitter = null;
        currentMetrics.packetLoss = null;

        setText("ping", "Unavailable");
        setText("jitter", "Unavailable");
        setText("packetLoss", "Unavailable");

        checkIfEverythingFinished();
    }
}


/* =========================================================
   CLOUDFLARE LIVE RESULTS
   ========================================================= */

function updateCloudflareLiveResults(type) {

    if (
        !speedTest ||
        !speedTest.results
    ) {
        return;
    }


    if (type === "download") {

        try {

            const bandwidth =
                speedTest.results
                    .getDownloadBandwidth();


            if (isValidMetricNumber(bandwidth)) {

                currentMetrics.download =
                    Number(bandwidth) /
                    1000000;


                setText(
                    "download",
                    formatNetworkMetric(
                        "download",
                        currentMetrics.download
                    )
                );
            }

        } catch (error) {

            console.debug(
                "Download result not ready."
            );
        }
    }


    if (type === "upload") {

        try {

            const bandwidth =
                speedTest.results
                    .getUploadBandwidth();


            if (isValidMetricNumber(bandwidth)) {

                currentMetrics.upload =
                    Number(bandwidth) /
                    1000000;


                setText(
                    "upload",
                    formatNetworkMetric(
                        "upload",
                        currentMetrics.upload
                    )
                );
            }

        } catch (error) {

            console.debug(
                "Upload result not ready."
            );
        }
    }
}


/* =========================================================
   CLOUDFLARE FINAL RESULTS
   ========================================================= */

function updateCloudflareFinalResults(
    results
) {

    try {

        const download =
            results.getDownloadBandwidth();


        if (isValidMetricNumber(download)) {

            currentMetrics.download =
                Number(download) /
                1000000;


            setText(
                "download",
                formatNetworkMetric(
                    "download",
                    currentMetrics.download
                )
            );
        } else {
            currentMetrics.download = null;
            setText("download", "Unavailable");
        }

    } catch (error) {

        console.warn(
            "Final download unavailable."
        );
        currentMetrics.download = null;
        setText("download", "Unavailable");
    }


    try {

        const upload =
            results.getUploadBandwidth();


        if (isValidMetricNumber(upload)) {

            currentMetrics.upload =
                Number(upload) /
                1000000;


            setText(
                "upload",
                formatNetworkMetric(
                    "upload",
                    currentMetrics.upload
                )
            );
        } else {
            currentMetrics.upload = null;
            setText("upload", "Unavailable");
        }

    } catch (error) {

        console.warn(
            "Final upload unavailable."
        );
        currentMetrics.upload = null;
        setText("upload", "Unavailable");
    }


    console.log(
        "Cloudflare summary:",
        results.getSummary()
    );
}


/* =========================================================
   CHECK BOTH TESTS
   ========================================================= */

function checkIfEverythingFinished() {

    if (
        !speedTestFinished ||
        !backendTestFinished
    ) {
        return;
    }


    finishCombinedTest();
}


/* =========================================================
   FINAL COMBINED RESULT
   ========================================================= */

async function finishCombinedTest() {

    clearTimeout(testTimeout);


    /*
       Make sure the latest network type is available.
    */

    detectNetworkType();


    /*
       Calculate final score using:

       Download
       Upload
       Ping
       Jitter
       Packet Loss
    */

    updateConnectivityScore();


    updateApplicationReadiness();

    updateDiagnosis();

    updateAISections();

    if (currentMetrics.download === null) {
        setText("download", "Unavailable");
    }

    if (currentMetrics.upload === null) {
        setText("upload", "Unavailable");
    }

    if (currentMetrics.ping === null) {
        setText("ping", "Unavailable");
    }

    if (currentMetrics.jitter === null) {
        setText("jitter", "Unavailable");
    }

    if (currentMetrics.packetLoss === null) {
        setText("packetLoss", "Unavailable");
    }


    /*
       Save the final result.
    */

    const testData = {

        timestamp:
            new Date().toISOString(),

        download_mbps:
            currentMetrics.download,

        upload_mbps:
            currentMetrics.upload,

        ping_ms:
            currentMetrics.ping,

        jitter_ms:
            currentMetrics.jitter,

        packet_loss:
            currentMetrics.packetLoss,

        network_type:
            currentMetrics.networkType,

        connectivity_score:
            currentMetrics.score,

        latitude:
            currentLocation
                ? currentLocation.latitude
                : null,

        longitude:
            currentLocation
                ? currentLocation.longitude
                : null
    };


    sessionTests.push(
        testData
    );


    await saveNetworkTest(
        testData
    );


    await loadNetworkHistory();


    testRunning = false;


    const button = $("startTest");

    if (button) {

        button.disabled = false;

        button.textContent =
            "Start Test";
    }


    stopSessionTimer();


    setTestMessage(
        "Internet speed test completed."
    );


    updateSessionStatistics();


    console.log(
        "FINAL NETWORK DATA:",
        testData
    );
}


/* =========================================================
   RESET UI
   ========================================================= */

function resetCurrentTestUI() {

    currentMetrics = {

        download: null,

        upload: null,

        ping: null,

        jitter: null,

        packetLoss: null,

        networkType:
            currentMetrics.networkType ||
            "Unknown",

        score: 0
    };


    setText(
        "download",
        "Testing..."
    );

    setText(
        "upload",
        "Testing..."
    );

    setText(
        "ping",
        "Testing..."
    );

    setText(
        "jitter",
        "Testing..."
    );

    setText(
        "packetLoss",
        "Testing..."
    );

    setText(
        "score",
        "0"
    );

    setText(
        "status",
        "Testing..."
    );


    setTestMessage(
        "Preparing network test..."
    );
}


/* =========================================================
   LIVE DASHBOARD
   ========================================================= */

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

    currentMetrics.score =
        calculateConnectivityScore(
            currentMetrics
        );


    setText(
        "score",
        currentMetrics.score
    );


    const status =
        getConnectivityStatus(
            currentMetrics.score
        );


    setText(
        "status",
        status
    );


    const dot =
        $("networkStatusDot");


    if (dot) {

        dot.className =
            "status-dot";

        dot.classList.add(
            status.toLowerCase()
        );
    }
}


/* =========================================================
   APPLICATION READINESS
   ========================================================= */

function updateApplicationReadiness() {

    const download =
        currentMetrics.download || 0;

    const upload =
        currentMetrics.upload || 0;

    const ping =
        currentMetrics.ping ?? 999;

    const jitter =
        currentMetrics.jitter ?? 999;

    const packetLoss =
        currentMetrics.packetLoss ?? 100;


    /* =====================================================
       GAMING
       ===================================================== */

    let gaming = 0;


    if (download >= 10) {
        gaming += 25;
    }

    else if (download >= 5) {
        gaming += 18;
    }

    else if (download >= 2) {
        gaming += 10;
    }


    if (upload >= 5) {
        gaming += 15;
    }

    else if (upload >= 2) {
        gaming += 10;
    }

    else if (upload >= 1) {
        gaming += 5;
    }


    if (ping <= 40) {
        gaming += 35;
    }

    else if (ping <= 80) {
        gaming += 28;
    }

    else if (ping <= 120) {
        gaming += 18;
    }

    else if (ping <= 200) {
        gaming += 8;
    }


    if (jitter <= 10) {
        gaming += 15;
    }

    else if (jitter <= 20) {
        gaming += 10;
    }

    else if (jitter <= 50) {
        gaming += 5;
    }


    if (packetLoss <= 0.5) {
        gaming += 10;
    }

    else if (packetLoss <= 2) {
        gaming += 5;
    }


    /* =====================================================
       VIDEO CALL
       ===================================================== */

    let videoCall = 0;


    if (download >= 5) {
        videoCall += 25;
    }

    else if (download >= 2) {
        videoCall += 15;
    }

    else if (download >= 1) {
        videoCall += 8;
    }


    if (upload >= 3) {
        videoCall += 30;
    }

    else if (upload >= 1) {
        videoCall += 18;
    }


    if (ping <= 80) {
        videoCall += 20;
    }

    else if (ping <= 150) {
        videoCall += 12;
    }

    else if (ping <= 250) {
        videoCall += 5;
    }


    if (jitter <= 20) {
        videoCall += 15;
    }

    else if (jitter <= 50) {
        videoCall += 8;
    }


    if (packetLoss <= 1) {
        videoCall += 10;
    }

    else if (packetLoss <= 3) {
        videoCall += 5;
    }


    /* =====================================================
       STREAMING
       ===================================================== */

    let streaming = 0;


    if (download >= 25) {
        streaming = 100;
    }

    else if (download >= 10) {
        streaming = 85;
    }

    else if (download >= 5) {
        streaming = 70;
    }

    else if (download >= 3) {
        streaming = 55;
    }

    else if (download >= 1) {
        streaming = 30;
    }

    else {
        streaming = 10;
    }


    if (packetLoss > 5) {
        streaming -= 10;
    }


    /* =====================================================
       BROWSING
       ===================================================== */

    let browsing = 0;


    if (download >= 10) {
        browsing += 55;
    }

    else if (download >= 5) {
        browsing += 45;
    }

    else if (download >= 2) {
        browsing += 35;
    }

    else if (download >= 1) {
        browsing += 25;
    }


    if (ping <= 100) {
        browsing += 35;
    }

    else if (ping <= 200) {
        browsing += 25;
    }

    else if (ping <= 300) {
        browsing += 15;
    }

    else {
        browsing += 5;
    }


    if (packetLoss <= 1) {
        browsing += 10;
    }

    else if (packetLoss <= 5) {
        browsing += 5;
    }


    gaming =
        Math.max(
            0,
            Math.min(
                100,
                Math.round(gaming)
            )
        );


    videoCall =
        Math.max(
            0,
            Math.min(
                100,
                Math.round(videoCall)
            )
        );


    streaming =
        Math.max(
            0,
            Math.min(
                100,
                Math.round(streaming)
            )
        );


    browsing =
        Math.max(
            0,
            Math.min(
                100,
                Math.round(browsing)
            )
        );


    setText(
        "gamingScore",
        `${gaming}%`
    );

    setProgress(
        "gamingProgress",
        gaming
    );


    setText(
        "videoCallScore",
        `${videoCall}%`
    );

    setProgress(
        "videoCallProgress",
        videoCall
    );


    setText(
        "streamingScore",
        `${streaming}%`
    );

    setProgress(
        "streamingProgress",
        streaming
    );


    setText(
        "browsingScore",
        `${browsing}%`
    );

    setProgress(
        "browsingProgress",
        browsing
    );
}


/* =========================================================
   SMART DIAGNOSIS
   ========================================================= */

function updateDiagnosis() {

    const recommendation =
        $("recommendation");


    if (!recommendation) {
        return;
    }


    if (
        currentMetrics.download === null &&
        currentMetrics.ping === null
    ) {

        recommendation.textContent =
            "Run an Internet test to begin network analysis.";

        return;
    }


    const problems = [];


    if (
        currentMetrics.download !== null &&
        currentMetrics.download < 5
    ) {

        problems.push(
            "download speed is low"
        );
    }


    if (
        currentMetrics.upload !== null &&
        currentMetrics.upload < 2
    ) {

        problems.push(
            "upload speed is low"
        );
    }


    if (
        currentMetrics.ping !== null &&
        currentMetrics.ping > 100
    ) {

        problems.push(
            "latency is high"
        );
    }


    if (
        currentMetrics.jitter !== null &&
        currentMetrics.jitter > 30
    ) {

        problems.push(
            "jitter is high"
        );
    }


    if (
        currentMetrics.packetLoss !== null &&
        currentMetrics.packetLoss > 2
    ) {

        problems.push(
            "packet loss is elevated"
        );
    }


    if (problems.length === 0) {

        recommendation.textContent =
            "Current measurements do not show a major connectivity issue.";

        return;
    }


    recommendation.textContent =
        `Detected issue: ${problems.join(", ")}. ` +
        "Consider moving closer to the access point, " +
        "reducing network congestion, or checking the network connection.";
}


/* =========================================================
   AI SECTIONS - REAL MODEL API
   ========================================================= */

async function updateAISections() {

    const prediction =
        $("predictionResult");

    const anomaly =
        $("anomalyResult");

    if (prediction) {
        prediction.textContent =
            "Running AI prediction...";
    }

    if (anomaly) {
        anomaly.textContent =
            "Running anomaly detection...";
    }

    try {

        const response =
            await fetch(
                `${API_BASE}/ai/analyze`,
                {
                    method: "GET",
                    cache: "no-store"
                }
            );

        if (!response.ok) {

            throw new Error(
                `AI API returned ${response.status}`
            );
        }

        const result =
            await response.json();

        if (!result.success) {

            throw new Error(
                result.message ||
                "AI analysis failed."
            );
        }

        const predictionData =
            result.prediction || {};

        const anomalyData =
            result.anomaly || {};

        if (prediction) {

            if (
                predictionData.predicted_connectivity_score !==
                undefined
            ) {

                prediction.textContent =
                    `Predicted connectivity score: ` +
                    `${Number(
                        predictionData.predicted_connectivity_score
                    ).toFixed(2)}/100 ` +
                    `(${predictionData.predicted_quality || "Unknown"}).`;

            } else {

                prediction.textContent =
                    "AI prediction unavailable.";
            }
        }

        if (anomaly) {

            if (anomalyData.anomaly === true) {

                anomaly.textContent =
                    `Anomaly detected. ` +
                    `Reconstruction error: ` +
                    `${Number(
                        anomalyData.reconstruction_error
                    ).toFixed(6)} ` +
                    `(threshold: ` +
                    `${Number(
                        anomalyData.threshold
                    ).toFixed(6)}).`;

            } else if (anomalyData.anomaly === false) {

                anomaly.textContent =
                    `No anomaly detected. ` +
                    `Reconstruction error: ` +
                    `${Number(
                        anomalyData.reconstruction_error
                    ).toFixed(6)} ` +
                    `(threshold: ` +
                    `${Number(
                        anomalyData.threshold
                    ).toFixed(6)}).`;

            } else {

                anomaly.textContent =
                    "AI anomaly result unavailable.";
            }
        }

    } catch (error) {

        console.error(
            "AI analysis request failed:",
            error
        );

        if (prediction) {

            prediction.textContent =
                "AI prediction unavailable. Check the backend.";
        }

        if (anomaly) {

            anomaly.textContent =
                "AI anomaly detection unavailable. Check the backend.";
        }
    }
}


/* =========================================================
   SAVE NETWORK TEST
   ========================================================= */

async function saveNetworkTest(
    testData
) {

    try {

        const response =
            await fetch(
                `${API_BASE}/network-test`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify(
                            testData
                        )
                }
            );


        if (!response.ok) {

            throw new Error(
                `Server returned ${response.status}`
            );
        }


        const data =
            await response.json();


        console.log(
            "Network test saved:",
            data
        );


    } catch (error) {

        console.error(
            "Could not save network test:",
            error
        );
    }
}


/* =========================================================
   NETWORK HISTORY
   ========================================================= */

async function loadNetworkHistory() {

    try {

        const rangeElement =
            $("historyRange");


        const range =
            rangeElement
                ? rangeElement.value
                : "recent";


        const response =
            await fetch(
                `${API_BASE}/network-history?range=${encodeURIComponent(
                    range
                )}`,
                {
                    cache: "no-store"
                }
            );


        if (!response.ok) {

            throw new Error(
                `History request failed: ${response.status}`
            );
        }


        const data =
            await response.json();


        const history =
            Array.isArray(data)
                ? data
                : [];


        updateHistoryChart(
            history
        );


        if (history.length > 0) {

            const latest =
                history[
                    history.length - 1
                ];


            /*
               Restore latest database result.
            */

            if (
                currentMetrics.download === null &&
                latest.download_mbps !== null
            ) {

                currentMetrics.download =
                    Number(
                        latest.download_mbps
                    );
            }


            if (
                currentMetrics.upload === null &&
                latest.upload_mbps !== null
            ) {

                currentMetrics.upload =
                    Number(
                        latest.upload_mbps
                    );
            }
        }


    } catch (error) {

        console.error(
            "Could not load network history:",
            error
        );


        updateHistoryChart(
            []
        );
    }
}


/* =========================================================
   HISTORY CHART
   ========================================================= */

function updateHistoryChart(
    history
) {

    const canvas =
        $("networkChart");


    if (!canvas) {
        return;
    }


    if (
        typeof Chart === "undefined"
    ) {

        console.warn(
            "Chart.js is not loaded."
        );

        return;
    }


    const labels = [];

    const scores = [];

    const downloads = [];


    history.forEach(
        item => {

            const date =
                item.timestamp;


            if (date) {

                const d =
                    new Date(date);


                labels.push(
                    d.toLocaleTimeString(
                        [],
                        {
                            hour: "2-digit",
                            minute: "2-digit"
                        }
                    )
                );

            }

            else {

                labels.push("");
            }


            scores.push(
                Number(
                    item.connectivity_score
                ) || 0
            );


            downloads.push(
                Number(
                    item.download_mbps
                ) || 0
            );
        }
    );


    if (networkChart) {

        networkChart.destroy();

        networkChart = null;
    }


    networkChart =
        new Chart(
            canvas.getContext("2d"),
            {
                type: "line",

                data: {

                    labels,

                    datasets: [

                        {
                            label:
                                "Connectivity Score",

                            data:
                                scores,

                            borderWidth: 2,

                            tension: 0.3,

                            yAxisID:
                                "scoreAxis"
                        },

                        {
                            label:
                                "Download Mbps",

                            data:
                                downloads,

                            borderWidth: 2,

                            tension: 0.3,

                            yAxisID:
                                "speedAxis"
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
            }
        );
}


/* =========================================================
   SESSION TIMER
   ========================================================= */

function startSessionTimer() {

    stopSessionTimer();

    updateSessionTime();


    sessionTimer =
        setInterval(
            updateSessionTime,
            1000
        );
}


function stopSessionTimer() {

    if (sessionTimer) {

        clearInterval(
            sessionTimer
        );

        sessionTimer = null;
    }
}


function updateSessionTime() {

    if (!testStartTime) {
        return;
    }


    const elapsedSeconds =
        Math.floor(
            (
                Date.now() -
                testStartTime
            ) / 1000
        );


    const hours =
        Math.floor(
            elapsedSeconds / 3600
        );


    const minutes =
        Math.floor(
            (
                elapsedSeconds % 3600
            ) / 60
        );


    const seconds =
        elapsedSeconds % 60;


    const formatted =
        String(hours).padStart(2, "0") +
        ":" +
        String(minutes).padStart(2, "0") +
        ":" +
        String(seconds).padStart(2, "0");


    setText(
        "sessionTime",
        formatted
    );
}


/* =========================================================
   SESSION STATISTICS
   ========================================================= */

function updateSessionStatistics() {

    if (
        sessionTests.length === 0
    ) {

        setText(
            "averageSpeed",
            "0 Mbps"
        );

        setText(
            "averagePing",
            "0 ms"
        );

        setText(
            "peakSpeed",
            "0 Mbps"
        );

        setText(
            "downtime",
            "0 min"
        );

        return;
    }


    const speeds =
        sessionTests
            .map(
                test =>
                    Number(
                        test.download_mbps
                    )
            )
            .filter(
                Number.isFinite
            );


    const pings =
        sessionTests
            .map(
                test =>
                    Number(
                        test.ping_ms
                    )
            )
            .filter(
                Number.isFinite
            );


    const averageSpeed =
        speeds.length
            ? speeds.reduce(
                (a, b) => a + b,
                0
            ) / speeds.length
            : 0;


    const averagePing =
        pings.length
            ? pings.reduce(
                (a, b) => a + b,
                0
            ) / pings.length
            : 0;


    const peakSpeed =
        speeds.length
            ? Math.max(...speeds)
            : 0;


    setText(
        "averageSpeed",
        formatNetworkMetric(
            "download",
            averageSpeed
        )
    );


    setText(
        "averagePing",
        formatNetworkMetric(
            "ping",
            averagePing
        )
    );


    setText(
        "peakSpeed",
        formatNetworkMetric(
            "download",
            peakSpeed
        )
    );


    /*
       This is currently the number of poor test sessions,
       not real measured downtime minutes.
    */

    const poorTests =
        sessionTests.filter(
            test =>
                Number(
                    test.connectivity_score
                ) < 30
        ).length;


    setText(
        "downtime",
        `${poorTests} min`
    );
}


/* =========================================================
   MAP
   ========================================================= */

function initializeMap() {

    const mapElement =
        $("connectivityMap");


    if (!mapElement) {
        return;
    }


    if (
        typeof L === "undefined"
    ) {

        console.warn(
            "Leaflet is not loaded."
        );

        return;
    }


    connectivityMap =
        L.map(
            mapElement
        ).setView(
            [
                18.5204,
                73.8567
            ],
            10
        );


    L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
            attribution:
                "&copy; OpenStreetMap contributors"
        }
    ).addTo(
        connectivityMap
    );
}


/* =========================================================
   LOCATION
   ========================================================= */

function detectCurrentLocation() {
    const result = $("locationResult");

    if (!navigator.geolocation) {
        if (result) {
            result.textContent =
                "Geolocation is not supported by this browser.";
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

            // Reject readings with more than 100 metres
            // of reported uncertainty.
            if (accuracy > 500) {
                if (result) {
                    result.textContent =
                        `Location is too approximate ` +
                        `(±${Math.round(accuracy)} m). ` +
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
                    `Location detected: ` +
                    `${latitude.toFixed(6)}, ` +
                    `${longitude.toFixed(6)} ` +
                    `(±${Math.round(accuracy)} m)`;
            }

            showLocationOnMap(latitude, longitude);
        },

        error => {
            console.error("Geolocation error:", error);

            let message = "Unable to detect location.";

            if (error.code === 1) {
                message =
                    "Location permission denied. Allow location access in Chrome.";
            } else if (error.code === 2) {
                message =
                    "Location unavailable. Check your device's location settings.";
            } else if (error.code === 3) {
                message =
                    "Location request timed out. Please try again.";
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


/* =========================================================
   SHOW LOCATION
   ========================================================= */

let currentLocationMarker = null;

function showLocationOnMap(latitude, longitude) {
    if (!connectivityMap) {
 master
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

fix/issue-32-ui-enhancements
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

/* =========================================================
   DEBUG API & EXPORTS
   ========================================================= */

const smartConnectivity = {

    formatNumber,

    formatMetric,

    formatNetworkMetric,

    isValidMetricNumber,

    METRIC_UNITS,
 master

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

 fix/issue-32-ui-enhancements
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


    detectCurrentLocation,


    saveCurrentLocation,


    findBetterConnectionArea
};

if (typeof window !== "undefined") {
    window.smartConnectivity = smartConnectivity;
    window.formatNumber = formatNumber;
    window.formatMetric = formatMetric;
    window.formatNetworkMetric = formatNetworkMetric;
    window.isValidMetricNumber = isValidMetricNumber;
    window.METRIC_UNITS = METRIC_UNITS;
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = {
        formatNumber,
        formatMetric,
        formatNetworkMetric,
        isValidMetricNumber,
        METRIC_UNITS,
        smartConnectivity
    };
}
 master
