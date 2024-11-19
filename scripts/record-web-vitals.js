// scripts/record-web-vitals.js
const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

// Helper functions for statistics
function calculateMean(values) {
    return values.reduce((sum, val) => sum + val, 0) / values.length;
}

function calculateStdDev(values) {
    const mean = calculateMean(values);
    const squareDiffs = values.map(value => Math.pow(value - mean, 2));
    return Math.sqrt(calculateMean(squareDiffs));
}

// Parse metrics from web-vitals-check.js output
function parseMetrics(output) {
    const metrics = {};
    const lines = output.split('\n');

    for (const line of lines) {
        if (line.includes('LCP:')) {
            metrics.lcp = parseFloat(line.split(':')[1]);
        } else if (line.includes('FID:')) {
            metrics.fid = parseFloat(line.split(':')[1]);
        } else if (line.includes('CLS:')) {
            metrics.cls = parseFloat(line.split(':')[1]);
        }
    }

    return metrics;
}

async function collectMetrics(device = 'desktop', runs = 5) {
    console.log(`\nCollecting ${device} metrics (${runs} runs)...`);
    const results = [];
    const maxRetries = 2; // Limit retries per rnu

    for (let i = 0; i < runs; i++) {
        console.log(`\nRun ${i + 1}/${runs}`);
        let retryCount = 0;
        try {
            const command = `node ./web-vitals-check.js https://adobecom.github.io/caas/ ${device === 'mobile' ? '--mobile' : ''}`;
            const output = execSync(command, {
                stdio: ['pipe', 'pipe', 'pipe'],
                timeout: 60000,
            }).toString();
            const metrics = parseMetrics(output);
            results.push(metrics);

            // Wait between runs
            if (i < runs - 1) {
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        } catch (error) {
            console.error(`Error in run ${i + 1}:`, error.message);
            retryCount++;
            if (retryCount <= maxRetries) {
                i--; // Retry this run
                console.log(`Retrying... (Attempt ${retryCount}/${maxRetries})`);
                // eslint-disable-next-line max-len,no-await-in-loop
                await new Promise(resolve => setTimeout(resolve, 10000)); // Wait longer between retries
            } else {
                console.log(`Maximum retries reached for run ${i + 1}, moving to next run`);
            }
        }
    }

    if (results.length === 0) {
        throw new Error(`Failed to collect any successful measurements for ${device}`);
    }

    // Calculate statistics for each metric
    const stats = {};
    ['lcp', 'fid', 'cls'].forEach(metric => {
        const values = results.map(r => r[metric]).filter(v => v != null);
        if (values.length > 0) {
            stats[metric] = {
                values,
                mean: calculateMean(values),
                stdDev: calculateStdDev(values),
                sampleSize: values.length,
            };
        }
    });

    return stats;
}

async function main() {
    try {
        // Collect metrics for both devices
        const desktopStats = await collectMetrics('desktop');
        const mobileStats = await collectMetrics('mobile');

        const record = {
            timestamp: new Date().toISOString(),
            pr: {
                number: process.env.PR_NUMBER || 'unknown',
                title: process.env.PR_TITLE || 'unknown'
            },
            metrics: {
                desktop: desktopStats,
                mobile: mobileStats
            }
        };

        // Save to history file
        const historyPath = path.join(process.cwd(), '.github', 'web-vitals-history.json');
        let history = [];

        if (fs.existsSync(historyPath)) {
            history = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
        }

        history.push(record);
        fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));

        // Output summary
        console.log('\nMetrics collected:');
        console.log(JSON.stringify(record, null, 2));

    } catch (error) {
        console.error('Error collecting metrics:', error);
        process.exit(1);
    }
}

main();
