# Security model

- Browser code uses only the Supabase publishable key.
- Privileged secrets and OAuth refresh tokens are never committed to GitHub.
- Creator data is protected by Supabase Row Level Security tied to the authenticated owner.
- Google/YouTube refresh tokens are stored only in the non-exposed `private` database schema.
- Public publishing requires an explicit approval event.
- Worker credentials live only in `worker/.env`, which is gitignored.
- Private clip previews are stored in a non-public Supabase Storage bucket with owner-scoped policies.
- Duplicate source submissions and duplicate active jobs are prevented at the database layer.
- Worker job claims use leases so abandoned work can be reclaimed safely.
