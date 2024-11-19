const enforceTestRequirements = async ({ github, context, core }) => {
    try {
        const { data: files } = await github.rest.pulls.listFiles({
            owner: context.repo.owner,
            repo: context.repo.repo,
            pull_number: context.issue.number,
        });

        const prTitle = context.payload.pull_request.title;
        const commitType = prTitle.split(':')[0].toLowerCase();

        const hasNewComponent = files.some(f =>
            f.filename.includes('/components/') &&
            f.status === 'added',
        );

        const hasIntegrationTest = files.some(f =>
            f.filename.includes('.e2e.js'),
        );

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
