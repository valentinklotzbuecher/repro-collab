module.exports = async function ({ github, context, core, env }) {
    const [owner, repo] = process.env.FORK_REPO.split('/');
    
    // 0) Check and close the data generation issue if still open
    const { data: dataIssues } = await github.rest.issues.listForRepo({
        owner, repo,
        state: 'open',
        per_page: 100
    });
    
    const dataGenIssue = dataIssues.find(i => 
        i.title === 'Generate and add research data'
    );
    
    if (dataGenIssue) {
        // Auto-close the data generation issue
        await github.rest.issues.update({
            owner, repo,
            issue_number: dataGenIssue.number,
            state: 'closed'
        });
        
        await github.rest.issues.createComment({
            owner, repo,
            issue_number: dataGenIssue.number,
            body: '✅ This issue has been automatically closed as Milestone 9 is being completed.'
        });
        
        console.log(`Automatically closed data generation issue #${dataGenIssue.number}`);
    }
    
    // 1) Check for 2 commit authors (excluding upstream contributors)
    
    // Get upstream contributors to exclude
    let upstreamLogins = [];
    try {
        const { data: upstreamContributors } = await github.rest.repos.listContributors({
            owner: context.repo.owner,
            repo: context.repo.repo,
            per_page: 100
        });
        upstreamLogins = upstreamContributors.map(c => c.login.toLowerCase());
    } catch (error) {
        console.log('Could not fetch upstream contributors:', error.message);
        // Continue with empty array as fallback
    }
    
    // Skip check if comment was made by an upstream contributor
    const isUpstreamContributor = upstreamLogins.includes(context.actor.toLowerCase());
    
    if (!isUpstreamContributor) {
        // Use Commits API instead of Contributors API (much less caching!)
        let validCommitAuthors = [];
        
        try {
            const { data: commits } = await github.rest.repos.listCommits({
                owner, repo,
                per_page: 100  // Check last 100 commits
            });
            
            // Get unique commit authors excluding upstream contributors
            const commitAuthors = [...new Set(
                commits
                .map(c => c.author?.login)
                .filter(login => login && !upstreamLogins.includes(login.toLowerCase()))
            )];
            
            validCommitAuthors = commitAuthors;
            console.log('Valid commit authors found:', commitAuthors);
            
        } catch (error) {
            console.log('Commits API error:', error.message);
        }
        
        if (validCommitAuthors.length < 2) {
            await github.rest.issues.createComment({
                owner: context.repo.owner,
                repo: context.repo.repo,
                issue_number: context.issue.number,
                body: `🚫 Milestone 9 not complete. Found ${validCommitAuthors.length} partner(s) with commits: ${validCommitAuthors.join(', ')}. Both partners need to make commits (upload files, edit files, etc.). Then run \`/done 9\` again. Note this check will fail for person A unless you choose to merge back all changes from person B.`
            });
            return;
        }
        
        console.log(`✅ Found ${validCommitAuthors.length} valid commit authors:`, validCommitAuthors);
    }
    
    // 2) Check for Data folder with files
    let dataFiles = [];
    try {
        const { data: contents } = await github.rest.repos.getContent({
            owner, repo,
            path: 'data'
        });
        
        if (Array.isArray(contents)) {
            dataFiles = contents.filter(item => 
                item.type === 'file' && 
                (item.name.endsWith('.csv') || item.name.endsWith('.txt') || item.name.endsWith('.json'))
            );
        }
    } catch (error) {
        try {
            const { data: contents } = await github.rest.repos.getContent({
                owner, repo,
                path: 'Data'
            });
            
            if (Array.isArray(contents)) {
                dataFiles = contents.filter(item => 
                    item.type === 'file' && 
                    (item.name.endsWith('.csv') || item.name.endsWith('.txt') || item.name.endsWith('.json'))
                );
            }
        } catch (error2) {
            // Data folder doesn't exist
        }
    }
    
    if (dataFiles.length < 2) {
        await github.rest.issues.createComment({
            owner: context.repo.owner,
            repo: context.repo.repo,
            issue_number: context.issue.number,
            body: '🚫 Milestone 9 not complete. Create a "data" folder and upload at least 2 data files from the Shiny app from two different people. Then run `/done 9` again.'
        });
        return;
    }
    
    // ✅ Milestone 9 successful - now automatically trigger Milestone 10
    
    const preregistrationUrl = context.payload.issue.html_url;
    // the titles are used in check 10!!!
    // Create three collaboration issues in the fork
    const issue1 = await github.rest.issues.create({
        owner, repo,
        title: 'Decide on meta-comment',
        body: [
            '## Decide on meta-comment',
            '',
            'The quote in the study overview is kind of funny, but should we really keep it?',
            '- [ ] Make a decision to keep or remove it',
            '- [ ] Justify your decision',
        ].join('\n')
    });
    
    const issue2 = await github.rest.issues.create({
        owner, repo,
        title: 'Update number of participants',
        body: [
            '## Update number of participants',
            '',
            'The preregistration currently says we\’ll collect data from five participants. But that number is clearly outdated — look how many we are!',
            '- [ ] Count the number of participants in the room',
            '- [ ] Update the number in the preregistration',
        ].join('\n')
    });
    
    const issue3 = await github.rest.issues.create({
        owner, repo,
        title: 'Correct materials\' description',
        body: [
            '## Correct materials\' description',
            '',
            'Some things have changed since the original study or the original study did not entail sufficient information for an exact replication.',
            'These things need to be incorporated:',
            '- We are using a different data collection tool',
            '- We randomly generated the size of the comparison squares from a uniform distribution',
        ].join('\n')
    });
    
    const issue4 = await github.rest.issues.create({
        owner, repo,
        title: 'Clarify procedure',
        body: [
            '## Clarify procedure',
            '',
            'The procedure description also needs a refresh:', 
            '- We didn\'t use a tachistoscope',
            '- We didn\'t categorize stimuli into three difficulty levels', 
            '- None of us will ever complete 6,850 (!!) trials', 
        ].join('\n')
    });
    
    const issue5 = await github.rest.issues.create({
        owner, repo,
        title: 'Improve data analysis plan',
        body: [
            '## Improve data analysis plan',
            '',
            'So far, the preregistration says we\'ll plot the results for each participant and visually inspect the data.', 
            'That’s... certainly *one* way to approach it, but does anyone have a better idea?'
        ].join('\n')
    });
    
    // Update main issue - mark both 9 and 10 complete
    const updatedBody = context.payload.issue.body
    .replace(/^(\s*-\s*\[)\s\](\s*9\..*)$/m, '$1x]$2')
    + '\n- [ ] 10. Collaborate on issues  - 🔴 Hard' + 
    ' \n- [ ] 11. Learn about GitHub Codespaces - 🟡 Medium';
    
    await github.rest.issues.update({
        owner: context.repo.owner,
        repo: context.repo.repo,
        issue_number: context.issue.number,
        body: updatedBody,
        state: 'open'
    });
    
    // Combined success comment for both milestones
    const completionBodyLines = [
        '**Great job on completing milestone 9** 🎉',
        '',
        'With milestone 9 you have completed the basic training.',
        'Milestone 10 encourages you to simply try out more messy, less structured collaboration with your partner by revising the preregistration. This is where you bring together everything you\'ve learned.', 
        'To help you get started, we\'ve created a set of issues that outline specific improvements to make. Use these issues to assign tasks and coordinate your work.',
        '',
        'However, there is so much to learn! From here on, you can choose to work on a number of milestones, in **whatever order** you want.',
        'So you could do `/done 14` and then `/done 10` if you wanted.',
        'Simply pick milestones that teach some skills you find useful. Everything >10 are delightfull side quests.',
        '',
        '**Can you solve all sidequests (milestones >10) before finishing 10?**',
        '',
        '**Task**: Revise the preregistration together', 
        '* Use issues to **assign tasks**.', 
        `1. [Decide on meta-comment](${issue1.data.html_url})`,
        `2. [Update number of participants](${issue2.data.html_url})`,
        `3. [Correct materials' description](${issue3.data.html_url})`,
        `4. [Clarify procedure](${issue4.data.html_url})`,
        `5. [Improve data analysis plan](${issue5.data.html_url})`,
        '* Work individually in your **own branch or fork**.', 
        '* **Create PRs** when you\'re ready for feedback.', 
        '* Use PRs to **discuss and improve** the changes.', 
        '* **Close issues** once tasks are complete.', 
    ];
    
    await github.rest.issues.createComment({
        owner: context.repo.owner,
        repo: context.repo.repo,
        issue_number: context.issue.number,
        body: completionBodyLines.join('\n')
    });

    const body11 = [
        '**Task**: Execute code in the cloud',
        '',
        'You may have noticed that we have avoided using local software to edit files or interact with Git (spoiler: this will be part of a longer workshop).',
        'Still, there is something almost as good, an IDE/VS Code in the browser.',
        'To enable that either:',
        '* type `.` (literal dot on your keyboard) while you in the code or PR view',
        '* replace `github.com` with `github.dev` in the URL',
        `* https://github.dev/${owner}/${repo}/`,
        '',
        `<img src="https://${context.repo.owner}.github.io/${context.repo.repo}/assets/web_VS.gif" alt="VS_Web">`,
        '',
        'You may have seen this interface already, however, we can go even further and enable not only editing but also code execution in the cloud.',
        '',
        'In the lower left corner click on `GitHub` then `Create New Code Space` then `<your-fork-name>` then `main` and then `2 cores, 8GB RAM, 32GB storage` (but it doesn\'t matter). Do not worry about the "paid for ..." part you have at least 120h (Okt 2025) for free.',
        '',
        'Now you can open a terminal and actually run code which will be handy for some of the other milestones here. To run R code you would need to install R first (which is possible but not quite accessible enough for this workshop.)',
        'Try typing `git status` in the terminal.',
        '',
        'Another cool (and fully optional feature) is "Live sharing". Let\'s try it out.',
        'In the left icon line there is a button "Extentions" (the four blocks). Click on it and search for "Live Share". Install the extention from the author "Microsoft".',
        'Now, a new symbol appeared in the left icon line (the arrow). Click on it and start a live sharing session! One user shares their session, the other joins. This way you can code live together. However, remember it is basically as if you are sitting at the same computer so all git actions etc. will be on behalf of whoever shares their session.'
    ]
    

    await github.rest.issues.createComment({
        owner: context.repo.owner,
        repo: context.repo.repo,
        issue_number: context.issue.number,
        body: body11.join('\n')
    });
}
