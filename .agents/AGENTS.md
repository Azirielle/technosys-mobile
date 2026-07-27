# Antigravity Project Customization Rules

## Direct Merge & Push Workflow Policy

To maximize development velocity during the system defense week, Antigravity is authorized to perform direct merges and pushes to `main` of the primary repositories (`Azirielle/technosys-admin` and `Azirielle/technosys-mobile`) and forks, provided the following strict safety protocols are executed.

### 1. Pre-Merge Verification (Strict Build Check)
Before attempting any merge to `main`, you **MUST** run the local compiler to ensure zero build errors.
* **For Admin Portal**: Run `npx tsc --noEmit` in the admin root.
* **For Mobile App**: Run `npx tsc --noEmit` in the mobile root.
* *If any error is found, abort the merge immediately and resolve the issue on the feature branch.*

### 2. Synchronization Sequence
When pushing updates, execute this precise step-by-step git pipeline to avoid state desync:
1. **Save Feature Work**: Commit all local changes on the feature branch:
   ```bash
   git add -A
   git commit -m "feat/fix(<scope>): description"
   ```
2. **Push to Forks**: Push local feature branch commits to the personal fork:
   ```bash
   $env:GITHUB_TOKEN=$null
   git push origin glorycode24/combined-features
   ```
3. **Fetch Main Updates**: Retrieve remote updates:
   ```bash
   git fetch upstream main
   ```
4. **Merge Main into Feature (Catch Conflicts)**:
   ```bash
   git merge upstream/main -m "merge: sync with upstream main"
   ```
   *If conflicts occur, resolve them manually on the feature branch, test, and re-run compilation.*
5. **Direct Merge to main**:
   ```bash
   git checkout main
   git pull upstream main
   git merge glorycode24/combined-features --no-ff -m "merge: release combined-features to main"
   ```
6. **Push to Main Branches**:
   ```bash
   $env:GITHUB_TOKEN=$null
   git push upstream main
   git push origin main
   ```
7. **Return to Feature Workspace**: Always return the active workspace to the feature branch so coding is never done directly on `main`:
   ```bash
   git checkout glorycode24/combined-features
   ```

### 3. Escape Hatch (Emergency Rollback)
If `main` becomes unstable post-push:
1. Run `git reflog` to identify the stable commit hash before the merge.
2. Reset `main` locally: `git reset --hard <stable-hash>`
3. Force push to restore stability: `git push upstream main --force`
