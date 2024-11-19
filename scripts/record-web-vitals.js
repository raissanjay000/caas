const fs = require('fs');
const { exec } = require('child_process');
const path = require('path');
const util = require('util');
const execPromise = util.promisify(exec);

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
    const metrics = {
        lcp: null,
        fid: null,
        cls: null
    };

    const lines = output.split('\n');
    for (const line of lines) {
        if (line.includes('Current:')) {
            const [metric, value] = line.split('Current:').map(s => s.trim());
            const numericValue = parseFloat(value);
            if (!isNaN(numericValue)) {
                if (line.toLowerCase().includes('lcp:')) metrics.lcp = numericValue;
                else if (line.toLowerCase().includes('fid:')) metrics.fid = numericValue;
                else if (line.toLowerCase().includes('cls:')) metrics.cls = numericValue;
            }
        }
    }

    return metrics;
}

async function runWebVitalsCheck(device = 'desktop', attempt = 1, maxAttempts = 2) {
    const url = 'https://adobecom.github.io/caas/';
    const command = `node ./web-vitals-check.js "${url}" ${device === 'mobile' ? '--mobile' : '--desktop-only'}`;

    try {
        const { stdout, stderr } = await execPromise(command);
        if (stderr) {
            console.error('Command stderr:', stderr);
        }
        return parseMetrics(stdout);
    } catch (error) {
        console.error(`Error in attempt ${attempt}:`, error.message);
        if (attempt < maxAttempts) {
            console.log(`Retrying... (Attempt ${attempt + 1}/${maxAttempts})`);
            await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds before retry
            return runWebVitalsCheck(device, attempt + 1, maxAttempts);
        }
        throw error;
    }
}

async function collectMetrics(device = 'desktop', runs = 5) {
    console.log(`\nCollecting ${device} metrics (${runs} runs)...`);
    const results = [];
    let currentRun = 1;

    while (currentRun <= runs) {
        console.log(`\nRun ${currentRun}/${runs}`);
        try {
            const metrics = await runWebVitalsCheck(device);
            if (metrics.lcp || metrics.fid || metrics.cls) {
                results.push(metrics);
                currentRun++;
            } else {
                throw new Error('No metrics collected');
            }

            // Wait between runs
            if (currentRun <= runs) {
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        } catch (error) {
            console.error(`Error in run ${currentRun}:`, error.message);
            // Only retry failed runs up to a certain number of times
            if (results.length === 0) {
                console.log('Retrying failed run...');
                await new Promise(resolve => setTimeout(resolve, 5000));
            } else {
                currentRun++; // Move on if we have at least some results
            }
        }
    }

    // Calculate statistics for each metric
    const stats = {};
    ['lcp', 'fid', 'cls'].forEach(metric => {
        const values = results.map(r => r[metric]).filter(v => v != null);
        if (values.length > 0) {
            stats[metric] = {
                values,
                mean: calculateMean(values),
                stdDev: calculateStdDev(values)
            };
        }
    });

    return stats;
}

async function ensureDirectoryExists(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

async function main() {
    try {
        // Create .github directory if it doesn't exist
        const githubDir = path.join(process.cwd(), '.github');
        await ensureDirectoryExists(githubDir);

        // Collect metrics for desktop only initially
        console.log('Starting desktop metrics collection...');
        const desktopStats = await collectMetrics('desktop', 5);

        const record = {
            timestamp: new Date().toISOString(),
            pr: {
                number: process.env.PR_NUMBER || 'unknown',
                title: process.env.PR_TITLE || 'unknown'
            },
            metrics: {
                desktop: desktopStats
            }
        };

        // Save to history file
        const historyPath = path.join(githubDir, 'web-vitals-history.json');
        let history = [];

        if (fs.existsSync(historyPath)) {
            try {
                const content = fs.readFileSync(historyPath, 'utf8');
                history = JSON.parse(content);
            } catch (error) {
                console.warn('Error reading history file, starting fresh:', error.message);
            }
        }

        // Ensure history is an array
        if (!Array.isArray(history)) {
            history = [];
        }

        history.push(record);

        // Write the updated history
        fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));

        // Output summary
        console.log('\nMetrics collected successfully:');
        console.log(JSON.stringify(record, null, 2));

    } catch (error) {
        console.error('Fatal error collecting metrics:', error);
        process.exit(1);
    }
}

main();