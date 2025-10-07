// .github/scripts/parseSlashCommand.js
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
  const cmd = (context.payload.comment.body || '').trim();
  const cm = /^\/done\s+(\d+)/.exec(cmd);
  if (!cm) return '-1';
  const num = parseInt(cm[1], 10);

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
};