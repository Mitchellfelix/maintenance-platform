# GitHub Admin-Only Protection

Use this when you want only repo admins to be able to push directly to `main` and to gate merges behind admin-owned code review.

## Prerequisite

The person running these commands must have **Admin** permission on:

- `Mitchellfelix/maintenance-platform`

## 1) Require admin code-owner review

Create `CODEOWNERS` on `main` so PR approval is tied to admin ownership.

```bash
mkdir -p .github
cat > .github/CODEOWNERS <<'EOF'
* @Mitchellfelix
EOF
git add .github/CODEOWNERS
git commit -m "Require admin code-owner review"
git push origin main
```

## 2) Protect `main` with admin-only push restriction

```bash
gh api -X PUT "repos/Mitchellfelix/maintenance-platform/branches/main/protection" --input - <<'EOF'
{
  "required_status_checks": null,
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": true,
    "required_approving_review_count": 1,
    "require_last_push_approval": true
  },
  "restrictions": {
    "users": ["Mitchellfelix"],
    "teams": [],
    "apps": []
  },
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_conversation_resolution": true
}
EOF
```

## 3) Verify protection

```bash
gh api "repos/Mitchellfelix/maintenance-platform/branches/main/protection"
```

You should see:

- pull request reviews required
- code owner reviews required
- force pushes disabled
- deletions disabled
- direct push restrictions limited to the admin user(s)
