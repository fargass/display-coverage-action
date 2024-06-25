const core = require('@actions/core');
const github = require('@actions/github');
const {readFileSync} = require("fs");

const COMMENT_IDENTIFIER = 'coverage-summary-markdown';
const DEFAULT_TITLE = 'Coverage Summary';
function jsonToMarkdown(title,jsonFile, displayedLines, threshold = 80) {
    const data = JSON.parse(readFileSync(jsonFile, 'utf8'));
    const summary = data.total;

    let markdown = `# ${title ?? DEFAULT_TITLE}\n\n`;
    markdown += `<!-- ${jsonFile} -->\n\n`;
    markdown += `| Category     | Total    | Covered  | Skipped  | Percentage | Status   |\n`;
    markdown += `|--------------|----------|----------|----------|------------|----------|\n`;

    for (let key in summary) {
        if (!displayedLines.includes(key)) continue;
        const coverage = summary[key];
        const emoji = coverage.pct >= threshold ? '✅' : '❌';
        markdown += `| ${key} | ${coverage.total} | ${coverage.covered} | ${coverage.skipped} | ${coverage.pct}% | ${emoji} |\n`;
    }

    return markdown;
}

async function findComment(owner, repo, issueNumber, token, content) {
    const octokit = github.getOctokit(token);

    try {
        const response = await octokit.rest.issues.listComments({
            owner,
            repo,
            issue_number: issueNumber
        });

        const comments = response.data;
        const targetComment = comments.find(comment => comment.body.includes(content));

        return targetComment?.id;
    } catch (e) {
        console.log("Cannot find coverage summary comment", e);
        core.setFailed(e.message);
    }
}

async function createCommentOrUpdate({
                                         title=COMMENT_IDENTIFIER,
                                         owner = github.context.repo.owner,
                                         repo = github.context.repo.repo,
                                         token,
                                         issueNumber,
                                         content
                                     }) {

    const commentId = await findComment(owner, repo, issueNumber, token,title);
    const octokit = github.getOctokit(token);
    try {
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
    } catch (e) {
        console.log("Cannot create or update coverage summary comment", e);
        core.setFailed(e.message);
    }

}

async function main() {
    try {
        const token = core.getInput('token')

        if (!token) {
            throw new Error("GITHUB_TOKEN is required.");
        }

        const jsonFile = core.getInput('json-file');
        if (!jsonFile) {
            throw new Error("JSON_FILE is required.");
        }

        const displayedLines = core.getInput('displayed-lines').split(',')

        const issueNumber = core.getInput('issue-number');
        if (!issueNumber) {
            throw new Error("ISSUE_NUMBER is required.");
        }

        const threshold = parseInt(core.getInput('coverage-threshold'));
        const markdownContent = jsonToMarkdown(core.getInput('title'),jsonFile, displayedLines, threshold);

        await createCommentOrUpdate({
            title: core.getInput('title'),
            token,
            issueNumber,
            content: markdownContent,
        });


        console.log("Coverage summary Markdown comment created successfully.");
    } catch (error) {
        core.setFailed(error.message);
    }
}

main();
