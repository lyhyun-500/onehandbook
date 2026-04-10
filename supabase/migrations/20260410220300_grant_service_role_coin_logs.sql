-- coin_logs (nat_ledger 대체) — service_role append-only
GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT, INSERT ON TABLE public.coin_logs TO service_role;
