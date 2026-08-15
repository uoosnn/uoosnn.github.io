---
title: "3 Rules for Developers Collaborating with AI"
date: 2026-05-20
tags: [Tech, Troubleshooting, Incident Report]
---

# 3 Rules for Developers Collaborating with AI


While the introduction of AI into the development process has dramatically boosted productivity, it has also brought about new types of failures and technical debt. After experiencing an incident where applying AI-generated code without verification led to system-wide instability, we established clear guidelines for collaborating with AI. These are not mere recommendations but essential minimum safeguards that must be adhered to for stable service.

### Rule 1. Do not fully trust AI's output.

AI generates code at an astonishing speed, but its output often includes 'hallucinations.' This can manifest as calling non-existent APIs or suggesting the use of long-deprecated libraries.

Merging such code without review is akin to embedding unpredictable bugs into the system. Therefore, all AI-generated code should be treated like a Pull Request from a junior developer. This means meticulous verification and unit testing, equivalent to peer review, are essential. AI is merely an excellent assistant developer; the ultimate responsibility lies with the developer merging the code.

### Rule 2. Record all changes through version control.

When collaborating with AI, using a Version Control System, especially `git`, is not an option but a necessity. It's common for existing features to malfunction or potential side effects to be discovered after applying AI-suggested code.

By clearly committing work units through version control, you can immediately revert to a previous stable state if a problem arises. This provides a psychological and technical safety net, allowing you to experiment with and apply AI suggestions without fear. Instead of wasting time debugging problematic code, you can control risk with a single command.

```bash
# In case of an issue, immediately revert to the last stable commit
git reset --hard <last_stable_commit_hash>
```

If no commits had been made, it would have taken several times more time and effort to identify which changes caused the problem.

### Rule 3. Strictly adhere to Rules 1 and 2.

The third rule re-emphasizes the importance of the preceding two rules. Even a single exception (skipping a review, missing a commit) during the development process can jeopardize the entire project. The productivity benefits gained from adopting AI are only meaningful when these two fundamental principles are strictly followed.

In conclusion, AI is not replacing the developer's role but transforming it. The core competency of developers is now shifting from the ability to write code from scratch to the ability to **verify, improve, and safely integrate AI-generated code into the overall system.** These three rules represent the minimum discipline required to ensure stability in a changing development environment.

---
*Posted: 2026-05-20 21:13:55*
*Updated: 2026-08-15 13:57:00*
