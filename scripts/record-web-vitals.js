const fs = require('fs');
const { exec } = require('child_process');
const path = require('path');
const util = require('util');
const execPromise = util.promisify(exec);

async function collectMetrics() {
    console.log('Collecting web vitals metrics...');
    try {
        // Execute web-vitals-check.js
        const url = 'https://adobecom.github.io/caas/';
        const command = `node ${path.join(process.cwd(), 'scripts', 'web-vitals-check.js')} "${url}"`;

        const { stdout, stderr } = await execPromise(command);
        if (stderr) {
            console.error('Command stderr:', stderr);
        }

        // Parse metrics from the output
        const currentMetricsPath = path.join(process.cwd(), '.github', 'current-metrics.json');

        if (fs.existsSync(currentMetricsPath)) {
            const currentMetrics = JSON.parse(fs.readFileSync(currentMetricsPath, 'utf8'));

            const record = {
                date: new Date().toISOString(),
                pr: {
                    number: process.env.PR_NUMBER || 'unknown',
                    title: process.env.PR_TITLE || 'unknown'
                },
                metrics: currentMetrics.metrics
            };

            // Ensure .github directory exists
            const githubDir = path.join(process.cwd(), '.github');
            if (!fs.existsSync(githubDir)) {
                fs.mkdirSync(githubDir, { recursive: true });
            }

            // Store metrics in history file
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

            if (!Array.isArray(history)) {
                history = [];
            }

            history.push(record);
            fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));

            console.log('Metrics collected:');
            console.log(JSON.stringify(record, null, 2));
        } else {
            console.error('No metrics file found. Web vitals check may have failed.');
            process.exit(1);
        }

    } catch (error) {
        console.error('Error collecting metrics:', error);
        process.exit(1);
    }
}

collectMetrics();
