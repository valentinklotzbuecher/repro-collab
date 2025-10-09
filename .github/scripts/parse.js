// .github/scripts/parse.js

module.exports = async function ({ github, context, core, env }) {
  // 1) Grab body and regex all numbered tasks
  const body = context.payload.issue.body || '';
  const taskRe = /^\s*-\s*\[[ x]\]\s*(\d+)\./gm;
  let m, nums = [];
  while ((m = taskRe.exec(body)) !== null) nums.push(parseInt(m[1], 10));
  if (nums.length === 0) return '-1';

  // 2) Determine max number from the list
  const max = Math.max(...nums);

  // 3) Parse the /done M command
  const cmd = (context.payload.comment.body || '');
  // First try exact match with trim (handles trailing/leading whitespace gracefully)
  const trimmedCmd = cmd.trim();
  const strictMatch = /^\/done\s+(\d+)$/.exec(trimmedCmd);
  
  // If strict parsing succeeds, use it
  if (strictMatch) {
    const num = parseInt(strictMatch[1], 10);
    
    // 4) Validate range
    if (!nums.includes(num)) {
      await github.rest.issues.createComment({
        owner: context.repo.owner,
        repo:  context.repo.repo,
        issue_number: context.issue.number,
        body: `🚫 Invalid milestone number. Please pick a number between 1 and ${max}.`
      });
      return '-1';
    }
    
    // 5) OK—return it
    return String(num);
  }
  
  // If strict parsing fails, check if "done" appears in the comment
  if (/done/i.test(cmd)) {
    // User tried to use /done but with incorrect format
    await github.rest.issues.createComment({
      owner: context.repo.owner,
      repo:  context.repo.repo,
      issue_number: context.issue.number,
      body: `⚠️ Your comment contains "done" but doesn't match the required format.\n\n` +
            `**Required format:** \`/done N\` where N is the milestone number\n\n` +
            `**Common mistakes to avoid:**\n` +
            `- Extra text before the command (e.g., \`I am /done 3\`)\n` +
            `- Missing space after \`/done\` (e.g., \`/done3\`)\n` +
            `- Additional text after the number (e.g., \`/done 3 now\`)\n` +
            `- Using backslashes instead of forward slash (e.g., \`\\done 3\`)\n\n` +
            `**Correct examples:** \`/done 3\`, \` /done 3\` (leading/trailing spaces are OK)\n\n` +
            `Please comment again with the correct format.`
    });
  }
  return '-1';
};