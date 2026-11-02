/* =========================================================
   CONNECTIVITY SCORE TESTS
   Run with: node --test tests/
   ========================================================= */

const { describe, test } = require("node:test");
const assert = require("node:assert/strict");

const {
    calculateConnectivityScore,
    getConnectivityStatus
} = require("../js/connectivity-score.js");


const NO_METRICS = {
    download: null,
    upload: null,
    ping: null,
    jitter: null,
    packetLoss: null
};


/* Score a single metric with every other metric skipped (null). */
function scoreOnly(name, value) {
    return calculateConnectivityScore({
        ...NO_METRICS,
        [name]: value
    });
}


/* [value, expected points] pairs at and just past every threshold. */
const BOUNDARIES = {
    download: [
        [100, 30], [99.99, 27],
        [50, 27], [49.99, 23],
        [25, 23], [24.99, 19],
        [10, 19], [9.99, 15],
        [5, 15], [4.99, 10],
        [2, 10], [1.99, 6],
        [1, 6], [0.99, 3],
        [0, 3]
    ],
    upload: [
        [50, 20], [49.99, 18],
        [25, 18], [24.99, 15],
        [10, 15], [9.99, 12],
        [5, 12], [4.99, 9],
        [2, 9], [1.99, 6],
        [1, 6], [0.99, 2],
        [0, 2]
    ],
    ping: [
        [0, 20],
        [20, 20], [20.01, 18],
        [40, 18], [40.01, 16],
        [60, 16], [60.01, 13],
        [100, 13], [100.01, 10],
        [150, 10], [150.01, 7],
        [200, 7], [200.01, 4],
        [300, 4], [300.01, 1]
    ],
    jitter: [
        [0, 20],
        [5, 20], [5.01, 17],
        [10, 17], [10.01, 14],
        [20, 14], [20.01, 11],
        [30, 11], [30.01, 8],
        [50, 8], [50.01, 5],
        [100, 5], [100.01, 2]
    ],
    packetLoss: [
        [0, 10],
        [0.5, 10], [0.51, 8],
        [1, 8], [1.01, 6],
        [2, 6], [2.01, 3],
        [5, 3], [5.01, 0],
        [100, 0]
    ]
};


describe("calculateConnectivityScore", () => {

    test("typical measurement", () => {
        const score = calculateConnectivityScore({
            download: 40,
            upload: 12,
            ping: 35,
            jitter: 8,
            packetLoss: 0.2
        });

        // 23 + 15 + 18 + 17 + 10
        assert.equal(score, 83);
    });

    test("high-quality measurement scores 100", () => {
        const score = calculateConnectivityScore({
            download: 150,
            upload: 60,
            ping: 10,
            jitter: 2,
            packetLoss: 0
        });

        assert.equal(score, 100);
    });

    test("very poor measurement", () => {
        const score = calculateConnectivityScore({
            download: 0.5,
            upload: 0.3,
            ping: 450,
            jitter: 150,
            packetLoss: 12
        });

        // 3 + 2 + 1 + 2 + 0
        assert.equal(score, 8);
    });

    test("extra fields such as networkType and score are ignored", () => {
        const score = calculateConnectivityScore({
            download: 150,
            upload: 60,
            ping: 10,
            jitter: 2,
            packetLoss: 0,
            networkType: "wifi",
            score: 5
        });

        assert.equal(score, 100);
    });


    for (const [metric, cases] of Object.entries(BOUNDARIES)) {

        describe(`${metric} thresholds`, () => {

            for (const [value, points] of cases) {

                test(`${metric} ${value} adds ${points} points`, () => {
                    assert.equal(scoreOnly(metric, value), points);
                });
            }
        });
    }


    describe("null metrics", () => {

        test("all metrics null scores 0", () => {
            assert.equal(calculateConnectivityScore(NO_METRICS), 0);
        });

        test("only the non-null metrics are counted", () => {
            const score = calculateConnectivityScore({
                download: 100,
                upload: null,
                ping: 20,
                jitter: null,
                packetLoss: null
            });

            // 30 + 20
            assert.equal(score, 50);
        });

        test("a single null metric removes only its own points", () => {
            const score = calculateConnectivityScore({
                download: 150,
                upload: 60,
                ping: 10,
                jitter: null,
                packetLoss: 0
            });

            assert.equal(score, 80);
        });
    });


    describe("score range", () => {

        const samples = [
            null, -1000, -1, 0, 0.5, 1, 5, 20, 50, 100, 1000,
            Infinity, -Infinity
        ];

        test("score is always an integer between 0 and 100", () => {

            for (const download of samples) {
                for (const ping of samples) {
                    for (const packetLoss of samples) {

                        const score = calculateConnectivityScore({
                            download,
                            upload: download,
                            ping,
                            jitter: ping,
                            packetLoss
                        });

                        assert.ok(
                            Number.isInteger(score),
                            `score ${score} is not an integer`
                        );
                        assert.ok(
                            score >= 0 && score <= 100,
                            `score ${score} is outside 0-100`
                        );
                    }
                }
            }
        });
    });


    /*
       Invalid inputs.
       These tests record the CURRENT behaviour; they do not
       describe the desired behaviour. Only null is skipped, so
       other non-numbers fall through the comparisons.
    */

    describe("invalid inputs (current behaviour)", () => {

        test("undefined metrics fall into the lowest bucket", () => {
            assert.equal(scoreOnly("download", undefined), 3);
            assert.equal(scoreOnly("upload", undefined), 2);
            assert.equal(scoreOnly("ping", undefined), 1);
            assert.equal(scoreOnly("jitter", undefined), 2);
            assert.equal(scoreOnly("packetLoss", undefined), 0);
        });

        test("an empty metrics object scores 8, not 0", () => {
            assert.equal(calculateConnectivityScore({}), 8);
        });

        test("NaN metrics fall into the lowest bucket", () => {
            assert.equal(scoreOnly("download", NaN), 3);
            assert.equal(scoreOnly("upload", NaN), 2);
            assert.equal(scoreOnly("ping", NaN), 1);
            assert.equal(scoreOnly("jitter", NaN), 2);
            assert.equal(scoreOnly("packetLoss", NaN), 0);
        });

        test("negative speeds fall into the lowest bucket", () => {
            assert.equal(scoreOnly("download", -5), 3);
            assert.equal(scoreOnly("upload", -5), 2);
        });

        test("negative ping, jitter and packet loss get full points", () => {
            assert.equal(scoreOnly("ping", -10), 20);
            assert.equal(scoreOnly("jitter", -10), 20);
            assert.equal(scoreOnly("packetLoss", -1), 10);
        });

        test("numeric strings are coerced to numbers", () => {
            assert.equal(scoreOnly("download", "100"), 30);
            assert.equal(scoreOnly("upload", "50"), 20);
            assert.equal(scoreOnly("ping", "20"), 20);
            assert.equal(scoreOnly("jitter", "5"), 20);
            assert.equal(scoreOnly("packetLoss", "0.5"), 10);
        });

        test("non-numeric strings fall into the lowest bucket", () => {
            assert.equal(scoreOnly("download", "fast"), 3);
            assert.equal(scoreOnly("ping", "slow"), 1);
        });

        test("empty strings are coerced to 0", () => {
            assert.equal(scoreOnly("download", ""), 3);
            assert.equal(scoreOnly("ping", ""), 20);
        });

        test("a missing metrics object throws a TypeError", () => {
            assert.throws(
                () => calculateConnectivityScore(undefined),
                TypeError
            );
        });
    });
});


describe("getConnectivityStatus", () => {

    const cases = [
        [100, "Excellent"],
        [85, "Excellent"],
        [84, "Good"],
        [70, "Good"],
        [69, "Average"],
        [50, "Average"],
        [49, "Poor"],
        [0, "Poor"]
    ];

    for (const [score, status] of cases) {

        test(`score ${score} is ${status}`, () => {
            assert.equal(getConnectivityStatus(score), status);
        });
    }

    test("non-numeric scores are Poor (current behaviour)", () => {
        assert.equal(getConnectivityStatus(undefined), "Poor");
        assert.equal(getConnectivityStatus(NaN), "Poor");
    });

    test("status matches the calculated score", () => {
        const score = calculateConnectivityScore({
            download: 40,
            upload: 12,
            ping: 35,
            jitter: 8,
            packetLoss: 0.2
        });

        assert.equal(getConnectivityStatus(score), "Good");
    });
});
