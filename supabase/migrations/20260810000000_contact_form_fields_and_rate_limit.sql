-- Qlin — Kontaktformular: neue Felder + serverseitiges Rate-Limit
--
-- 1) demo_requests bekommt Praxisname + Standort.
-- 2) demo_rate_limits speichert pro (gehashter) IP kurzlebige Zähl-Einträge.
-- 3) demo_rate_limit(p_ip_hash) prüft/protokolliert atomar und gibt zurück,
--    ob die Anfrage erlaubt ist (true) oder das Limit erreicht wurde (false).

-- 1) Neue Formularfelder ------------------------------------------------------
alter table public.demo_requests
  add column if not exists practice text,
  add column if not exists location text;

-- 2) Rate-Limit-Speicher ------------------------------------------------------
-- Es wird nur der SHA-256-Hash der IP abgelegt (kein Klartext), Einträge sind
-- kurzlebig und werden bei jeder Prüfung gepruned → DSGVO-schonend.
create table if not exists public.demo_rate_limits (
  ip_hash    text        not null,
  created_at timestamptz not null default now()
);

create index if not exists demo_rate_limits_ip_time_idx
  on public.demo_rate_limits (ip_hash, created_at);

-- RLS an, aber bewusst OHNE Policies: nur die Service-Role (die RLS umgeht)
-- bzw. die SECURITY-DEFINER-Funktion unten darf die Tabelle berühren.
alter table public.demo_rate_limits enable row level security;

-- 3) Atomare Rate-Limit-Prüfung ----------------------------------------------
-- Fenster: 10 Minuten, max. 6 Anfragen je IP-Hash.
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

  -- abgelaufene Einträge dieser IP entfernen
  delete from public.demo_rate_limits
   where ip_hash = p_ip_hash
     and created_at < now() - v_window;

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

-- Nur die Service-Role darf die Funktion aufrufen (anon/authenticated nicht).
revoke all on function public.demo_rate_limit(text) from public, anon, authenticated;
grant execute on function public.demo_rate_limit(text) to service_role;
