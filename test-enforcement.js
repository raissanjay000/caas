const enforceTestRequirements = async ({ github, context, core }) => {
    try {
        const { data: files } = await github.rest.pulls.listFiles({
            owner: context.repo.owner,
            repo: context.repo.repo,
            pull_number: context.issue.number,
        });

        const prTitle = context.payload.pull_request.title;
        const commitType = prTitle.split(':')[0].toLowerCase();

        // Add debug logs
        core.info(`PR Title: ${prTitle}`);
        core.info(`Commit Type: ${commitType}`);
        core.info(`Files changed: ${JSON.stringify(files.map(f => f.filename))}`);

        const hasNewComponent = files.some(f => {
            const isComponent = f.filename.includes('/components/');
            const isNew = f.status === 'added';
            // Add debug logs
            core.info(`Checking file: ${f.filename}`);
            core.info(`Is component? ${isComponent}`);
            core.info(`Is new? ${isNew}`);
            return isComponent && isNew;
        });

        const hasIntegrationTest = files.some(f =>
            f.filename.includes('.e2e.js'),
        );

        // Add debug logs
        core.info(`Has new component? ${hasNewComponent}`);
        core.info(`Has integration test? ${hasIntegrationTest}`);

        if (commitType === 'feat' && hasNewComponent && !hasIntegrationTest) {
            core.setFailed('New feature components require integration tests');
            return;
        }

        core.info('Test requirements check passed');
    } catch (error) {
        core.setFailed(error.message);
    }
};

module.exports = enforceTestRequirements;
