-- Platform admins only (users.is_admin = true)
-- These are the only users allowed to use the app. Set manually in DB.

SELECT
  u.id,
  u.email,
  u.first_name,
  u.last_name,
  u.is_admin,
  u.created_at
FROM users u
WHERE u.is_admin = true
ORDER BY u.email;
