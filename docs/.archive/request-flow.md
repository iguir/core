1. Request arrives.   → Hono router matches route
2. Route declares { auth: true, permission: 'posts.update' }
3. Auth middleware    → loads user from session/token, sets c.var.user
4. ACL middleware     → computes c.var.can()
                      → if route declares 'permission', runs can(user, perm)
                      → 403 if denied
5. Condition callback (if declared)
                      → runs your custom check
                      → 403 if returns false
6. Validation         → body/query/params parsed and validated
7. Handler runs