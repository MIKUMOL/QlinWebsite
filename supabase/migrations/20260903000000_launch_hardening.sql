-- Launch-Härtung (2026-09-03) — angewendet via Supabase MCP am 03.09.2026
--
-- 1) Die anon-Rolle konnte per REST-API direkt in demo_requests einfügen und
--    damit Rate-Limit, Honeypot und Validierung der Edge Function umgehen.
--    Das Formular schreibt ausschließlich über die Edge Function
--    (Service-Role, umgeht RLS) — die Policy ist überflüssig und fällt weg.
drop policy if exists anon_insert_only on public.demo_requests;

-- 2) demo_rate_limit(): bisher wurden nur abgelaufene Einträge der anfragenden
--    IP gelöscht; Hashes von IPs ohne Folge-Request blieben unbegrenzt liegen
--    (Widerspruch zur Datenschutzerklärung). Jetzt: alle abgelaufenen Einträge
--    werden bei jeder Prüfung entfernt.
create or replace function public.demo_rate_limit(p_ip_hash text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window   constant interval := interval '10 minutes';
  v_max      constant int      := 6;
  v_count    int;
begin
  if p_ip_hash is null or length(p_ip_hash) = 0 then
    return true;
  end if;

  -- ALLE abgelaufenen Einträge entfernen (Tabelle ist winzig, Index vorhanden)
  delete from public.demo_rate_limits
   where created_at < now() - v_window;

  select count(*) into v_count
    from public.demo_rate_limits
   where ip_hash = p_ip_hash;

  if v_count >= v_max then
    return false;  -- Limit erreicht → blockieren
  end if;

  insert into public.demo_rate_limits (ip_hash) values (p_ip_hash);
  return true;     -- erlaubt
end;
$$;

revoke all on function public.demo_rate_limit(text) from public, anon, authenticated;
grant execute on function public.demo_rate_limit(text) to service_role;

-- 3) Advisor-Hygiene: Event-Trigger-Funktion nicht über die Daten-API
--    ausführbar machen (der Event-Trigger selbst läuft unverändert weiter).
--    Tolerant, falls die Rechte zum Revoke fehlen.
do $do$
begin
  revoke all on function public.rls_auto_enable() from public, anon, authenticated;
exception when others then
  raise notice 'revoke on rls_auto_enable uebersprungen: %', sqlerrm;
end
$do$;

-- 4) Bestandsbereinigung: bereits abgelaufene Hashes sofort löschen.
delete from public.demo_rate_limits where created_at < now() - interval '10 minutes';
