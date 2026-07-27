const fs = require('fs');
const path = require('path');

// 1. Validate Environment Variables
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const PR_NUMBER = process.env.PR_NUMBER;
const GITHUB_REPOSITORY = process.env.GITHUB_REPOSITORY;

if (!GEMINI_API_KEY) {
  console.error("Missing GEMINI_API_KEY environment secret.");
  process.exit(1);
}
if (!GITHUB_TOKEN || !PR_NUMBER || !GITHUB_REPOSITORY) {
  console.error("Missing GitHub Actions workflow environment context (GITHUB_TOKEN, PR_NUMBER, GITHUB_REPOSITORY).");
  process.exit(1);
}

const [owner, repo] = GITHUB_REPOSITORY.split('/');

// 2. Filter Diff to exclude lockfiles, logs, build assets and configuration noise
function filterDiff(rawDiff) {
  const sections = rawDiff.split(/^diff --git /m);
  const filteredSections = [];
  
  if (sections[0] && sections[0].trim()) {
    filteredSections.push(sections[0]);
  }
  
  for (let i = 1; i < sections.length; i++) {
    const section = sections[i];
    const firstLine = section.split('\n')[0];
    
    // Skip lockfiles, metadata, build files, and binary assets
    if (
      firstLine.includes('package-lock.json') ||
      firstLine.includes('yarn.lock') ||
      firstLine.includes('tsconfig.json') ||
      firstLine.includes('.png') ||
      firstLine.includes('.jpg') ||
      firstLine.includes('.jpeg') ||
      firstLine.includes('.gif') ||
      firstLine.includes('.ico') ||
      firstLine.includes('.svg') ||
      firstLine.includes('assets/') ||
      firstLine.includes('.expo/') ||
      firstLine.includes('node_modules/') ||
      firstLine.includes('.playwright-cli/') ||
      firstLine.includes('.system_generated/')
    ) {
      continue;
    }
    filteredSections.push('diff --git ' + section);
  }
  
  return filteredSections.join('\n');
}

// 3. Post a global fallback review when line-by-line comments trigger GitHub validation errors
async function postGlobalReview(owner, repo, prNumber, result) {
  let compiledBody = `### 🤖 AI Code Review Verdict: ${result.verdict === 'APPROVED' ? '✅ Approved' : '⚠️ Changes Requested'}\n\n${result.summary}\n\n`;
  
  if (result.comments && result.comments.length > 0) {
    compiledBody += `#### 📝 Line-by-Line Feedback:\n`;
    result.comments.forEach(c => {
      compiledBody += `* **File \`${c.file}\` (Line ${c.line})**: ${c.message}\n`;
    });
  }
  
  console.log("Posting global fallback review comment to GitHub...");
  const githubRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/reviews`, {
    method: 'POST',
    headers: {
      'Authorization': `token ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      'User-Agent': 'github-actions-ai-reviewer'
    },
    body: JSON.stringify({
      body: compiledBody,
      event: result.verdict === 'APPROVED' ? 'APPROVE' : 'REQUEST_CHANGES'
    })
  });
  
  if (!githubRes.ok) {
    const errMsg = await githubRes.text();
    throw new Error(`Failed to post fallback global review: ${githubRes.status} - ${errMsg}`);
  }
  console.log("Successfully posted global review!");
}

// 4. Main script execution
async function main() {
  console.log(`Starting AI review for PR #${PR_NUMBER} in ${owner}/${repo}...`);
  
  // A. Fetch PR Diff from GitHub API
  const diffUrl = `https://api.github.com/repos/${owner}/${repo}/pulls/${PR_NUMBER}`;
  console.log(`Fetching diff from: ${diffUrl}`);
  
  const diffResponse = await fetch(diffUrl, {
    method: 'GET',
    headers: {
      'Authorization': `token ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3.diff',
      'User-Agent': 'github-actions-ai-reviewer'
    }
  });
  
  if (!diffResponse.ok) {
    throw new Error(`Failed to fetch PR diff: ${diffResponse.status} - ${diffResponse.statusText}`);
  }
  
  const rawDiff = await diffResponse.text();
  const filteredDiff = filterDiff(rawDiff);
  
  if (!filteredDiff || filteredDiff.trim().length === 0) {
    console.log("No reviewable code changes found (only lockfiles, binary assets, or build noise). Approving automatically.");
    await postGlobalReview(owner, repo, PR_NUMBER, {
      verdict: 'APPROVED',
      summary: "No reviewable code changes detected in this pull request (only lockfiles, documentation, configuration, or media assets modified).",
      comments: []
    });
    return;
  }
  
  console.log(`Cleaned diff length: ${filteredDiff.length} characters.`);
  if (filteredDiff.length > 60000) {
    console.warn("Cleaned diff exceeds size limits (60k characters). Requesting human review to save token limits.");
    await postGlobalReview(owner, repo, PR_NUMBER, {
      verdict: 'CHANGES_REQUESTED',
      summary: "⚠️ **Diff exceeds review limits.** This pull request is too large (>60,000 characters) for automated AI review. Please split your changes into smaller pull requests or ask a human supervisor to perform manual code review.",
      comments: []
    });
    return;
  }

  // B. Construct System Prompt & Call Gemini API
  const systemPrompt = `You are a friendly, constructive, and highly detail-oriented senior code reviewer for TechnoSys, a cross-platform geofenced HRIS and IMS.
Your task is to analyze the git diff of a Pull Request in the React Native / Expo Mobile repository and decide whether to APPROVE it or request changes.

### TECH STACK GUIDELINES:
- Framework: React Native with Expo SDK 56 & expo-router.
- Database/Backend: Supabase JS client.
- Rules:
  - Do NOT use \`window.alert()\` under any circumstances. Always use React Native's native dialog API: \`Alert.alert()\`.
  - Ensure coordinates checks verify mocked state (\`location.mocked\`) and accuracy bounds (\`accuracy <= 50\`) to prevent GPS spoofing.
  - Wrap database queries and sync queue operations in robust try...catch blocks.
  - Verify that style objects are created using React Native's \`StyleSheet.create\` at the bottom of the files.
- Tone: Keep comments friendly, encouraging, and collaborative. Give clear example code suggestions where appropriate.

### EXPECTED OUTPUT SCHEMA:
You must respond in JSON format matching this schema:
{
  "verdict": "APPROVED" or "CHANGES_REQUESTED",
  "summary": "High-level summary of your verdict, using bullet points and markdown.",
  "comments": [
    {
      "file": "relative/path/to/file.tsx",
      "line": 42,
      "message": "Friendly correction with a recommended code block if applicable"
    }
  ]
}

Ensure the "comments" line numbers match exactly with line additions in the diff. If not certain, omit the inline comment and put the note in the main summary.`;

  const requestBody = {
    contents: [
      {
        role: "user",
        parts: [
          { text: systemPrompt },
          { text: `Here is the Pull Request Diff to analyze:\n\n${filteredDiff}` }
        ]
      }
    ],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          verdict: {
            type: "STRING",
            enum: ["APPROVED", "CHANGES_REQUESTED"]
          },
          summary: {
            type: "STRING"
          },
          comments: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                file: { type: "STRING" },
                line: { type: "INTEGER" },
                message: { type: "STRING" }
              },
              required: ["file", "line", "message"]
            }
          }
        },
        required: ["verdict", "summary", "comments"]
      }
    }
  };

  console.log("Calling Gemini API for review...");
  const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });

  if (!geminiRes.ok) {
    const errText = await geminiRes.text();
    throw new Error(`Gemini API returned an error: ${geminiRes.status} - ${errText}`);
  }

  const geminiData = await geminiRes.json();
  const responseText = geminiData.candidates[0].content.parts[0].text;
  const result = JSON.parse(responseText);

  console.log(`AI Verdict: ${result.verdict}. Caught ${result.comments.length} issues.`);

  // C. Post review to GitHub API (Try inline comments first, fall back to global if validation fails)
  try {
    console.log("Attempting to post inline PR review...");
    const githubRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${PR_NUMBER}/reviews`, {
      method: 'POST',
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'github-actions-ai-reviewer'
      },
      body: JSON.stringify({
        body: result.summary,
        event: result.verdict === 'APPROVED' ? 'APPROVE' : 'REQUEST_CHANGES',
        comments: result.comments.map(c => ({
          path: c.file,
          line: c.line,
          body: c.message
        }))
      })
    });

    if (!githubRes.ok) {
      const errMsg = await githubRes.text();
      console.warn("Failed to post inline review comments. Falling back to global review. Details:", errMsg);
      await postGlobalReview(owner, repo, PR_NUMBER, result);
    } else {
      console.log("Successfully posted inline review comments!");
    }
  } catch (e) {
    console.error("Error occurred while posting inline review, falling back to global format:", e.message);
    await postGlobalReview(owner, repo, PR_NUMBER, result);
  }
}

main().catch(err => {
  console.error("AI Review Script Failed:", err);
  process.exit(1);
});
