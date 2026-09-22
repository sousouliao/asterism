-- Run after setting up pg_cron, pg_net and the three Vault secrets listed in README.md.
-- Uses the legacy anon JWT for the Edge gateway; authorization inside the function
-- additionally requires the independent scheduler secret.
select cron.schedule(
  'asterism-sync-stars',
  '0 */6 * * *',
  $$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'asterism_project_url') || '/functions/v1/sync-stars',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'asterism_anon_jwt'),
        'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'asterism_anon_jwt'),
        'X-Asterism-Scheduler', (select decrypted_secret from vault.decrypted_secrets where name = 'asterism_scheduler_secret')
      ),
      body := jsonb_build_object('userId', user_id)
    )
    from public.github_sync_credentials
    where last_error is distinct from 'reconnect_required'
      and (last_attempt_at is null or last_attempt_at < now() - interval '6 hours')
    order by last_attempt_at nulls first
    limit 20;
  $$
);
