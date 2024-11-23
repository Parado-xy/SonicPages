Here are some commonly used Git commands that are essential for version control and collaboration:

### Basic Git Commands
1. **Initialize a repository**:
   ```sh
   git init
   ```
   Initializes a new Git repository in the current directory.

2. **Clone a repository**:
   ```sh
   git clone <repository_url>
   ```
   Creates a copy of an existing repository from the specified URL.

3. **Check the status of the repository**:
   ```sh
   git status
   ```
   Shows the status of changes as untracked, modified, or staged.

4. **Add files to staging area**:
   ```sh
   git add <file_name>
   ```
   Stages changes for the next commit. Use `.` to add all files:
   ```sh
   git add .
   ```

5. **Commit changes**:
   ```sh
   git commit -m "Commit message"
   ```
   Records the changes in the repository with a descriptive message.

6. **View commit history**:
   ```sh
   git log
   ```
   Shows the commit history for the repository.

### Branching and Merging
7. **Create a new branch**:
   ```sh
   git branch <branch_name>
   ```
   Creates a new branch.

8. **Switch to a branch**:
   ```sh
   git checkout <branch_name>
   ```
   Switches to the specified branch.

9. **Merge a branch**:
   ```sh
   git merge <branch_name>
   ```
   Merges the specified branch into the current branch.

10. **Delete a branch**:
    ```sh
    git branch -d <branch_name>
    ```
    Deletes the specified branch.

### Remote Repositories
11. **Add a remote repository**:
    ```sh
    git remote add origin <repository_url>
    ```
    Adds a new remote repository.

12. **Fetch changes from remote**:
    ```sh
    git fetch
    ```
    Retrieves updates from a remote repository but does not merge them.

13. **Push changes to remote**:
    ```sh
    git push origin <branch_name>
    ```
    Pushes commits from the local branch to the remote repository.

14. **Pull changes from remote**:
    ```sh
    git pull
    ```
    Fetches and merges changes from the remote repository into the current branch.

### Undoing Changes
15. **Unstage changes**:
    ```sh
    git reset <file_name>
    ```
    Removes changes from the staging area.

16. **Revert changes**:
    ```sh
    git checkout -- <file_name>
    ```
    Reverts changes in the working directory to the last committed state.

17. **Reset to a previous commit**:
    ```sh
    git reset --hard <commit_hash>
    ```
    Resets the repository to a specific commit, discarding all changes after that commit.

### Advanced Commands
18. **Stash changes**:
    ```sh
    git stash
    ```
    Temporarily saves changes that are not ready to be committed.

19. **Apply stashed changes**:
    ```sh
    git stash apply
    ```
    Applies the most recently stashed changes.

20. **Cherry-pick a commit**:
    ```sh
    git cherry-pick <commit_hash>
    ```
    Applies the changes from a specific commit to the current branch.

These commands are fundamental for most Git workflows. Understanding and using them effectively will help you manage your codebase more efficiently.