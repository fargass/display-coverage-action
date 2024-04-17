const core = require('@actions/core');
const github = require('@actions/github');
const {readFileSync} = require("fs");

const COMMENT_IDENTIFIER = 'coverage-summary-markdown';

function jsonToMarkdown(jsonFile, threshold = 80) {
    const data = JSON.parse(readFileSync(jsonFile, 'utf8'));
    const summary = data.total;

    let markdown = `# Coverage Summary\n\n`;
    markdown += `<!-- ${COMMENT_IDENTIFIER} -->\n\n`;
    markdown += `| Category     | Total    | Covered  | Skipped  | Percentage | Status   |\n`;
    markdown += `|--------------|----------|----------|----------|------------|----------|\n`;

    for (let key in summary) {
        const coverage = summary[key];
        const emoji = coverage.pct >= threshold ? '✅' : '❌';
        markdown += `| ${key} | ${coverage.total} | ${coverage.covered} | ${coverage.skipped} | ${coverage.pct}% | ${emoji} |\n`;
    }

    return markdown;
}

async function findComment(owner, repo, issueNumber, content) {
    const octokit = new Octokit({auth: process.env.GITHUB_TOKEN});

    const response = await octokit.rest.issues.listComments({
        owner,
        repo,
        issue_number: issueNumber
    });

    const comments = response.data;
    const targetComment = comments.find(comment => comment.body.includes(content));

    return targetComment?.id;

}

function createCommentOrUpdate({
                                   owner = github.context.repo.owner,
                                   repo = github.context.repo.repo,
                                   token,
                                   issueNumber,
                                   content
                               }) {

    const commentId = findComment(owner, repo, issueNumber, COMMENT_IDENTIFIER);
    const octokit = github.getOctokit(token);
    commentId ?
        octokit.rest.issues.updateComment({
            owner,
            repo,
            issue_number: parseInt(issueNumber),
            body: content,
            comment_id: commentId
        }) :
        octokit.rest.issues.createComment({
            owner,
            repo,
            issue_number: parseInt(issueNumber),
            body: content,
        });

}

function main() {
    try {

        const token = core.getInput('token')

        if (!token) {
            throw new Error("GITHUB_TOKEN is required.");
        }

        const jsonFile = core.getInput('json-file');
        if (!jsonFile) {
            throw new Error("JSON_FILE is required.");
        }

        const issueNumber = core.getInput('issue-number');
        if (!issueNumber) {
            throw new Error("ISSUE_NUMBER is required.");
        }

        const threshold = parseInt(core.getInput('coverage-threshold'));
        const markdownContent = jsonToMarkdown(jsonFile, threshold);

        createCommentOrUpdate({
            token,
            issueNumber,
            content: markdownContent,
        });


        console.log("Markdown file and comment created successfully.");
    } catch (error) {
        core.setFailed(error.message);
    }
}

main();
