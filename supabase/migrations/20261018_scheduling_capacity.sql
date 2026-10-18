-- Capacidade da agenda: quantos carros o lava rápido atende ao mesmo tempo
-- (boxes/equipes). 1 = um por vez (comportamento anterior).
--
-- A trava appointments_no_overlap (nenhuma sobreposição) vira um gatilho que
-- permite até `capacity` atendimentos simultâneos. O lock por conta serializa
-- agendamentos concorrentes (painel e robô ao mesmo tempo).

ALTER TABLE public.scheduling_settings
    ADD COLUMN IF NOT EXISTS capacity INT NOT NULL DEFAULT 1 CHECK (capacity BETWEEN 1 AND 20);

ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_no_overlap;

CREATE OR REPLACE FUNCTION public.appointments_check_capacity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  max_capacity INT;
  peak INT;
BEGIN
  IF NEW.status NOT IN ('CONFIRMED', 'COMPLETED') THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('appointments:' || NEW.tenant_id::text));

  SELECT COALESCE(
    (SELECT capacity FROM public.scheduling_settings WHERE tenant_id = NEW.tenant_id),
    1
  ) INTO max_capacity;

  -- Pico de ocupação dentro do intervalo novo: ele sempre acontece no início
  -- do intervalo ou no início de algum agendamento que começa dentro dele.
  SELECT COALESCE(MAX(cnt), 0) INTO peak
  FROM (
    SELECT (
      SELECT COUNT(*)
      FROM public.appointments a
      WHERE a.tenant_id = NEW.tenant_id
        AND a.id <> NEW.id
        AND a.status IN ('CONFIRMED', 'COMPLETED')
        AND a.starts_at <= p.point
        AND a.ends_at > p.point
    ) AS cnt
    FROM (
      SELECT NEW.starts_at AS point
      UNION
      SELECT a.starts_at
      FROM public.appointments a
      WHERE a.tenant_id = NEW.tenant_id
        AND a.id <> NEW.id
        AND a.status IN ('CONFIRMED', 'COMPLETED')
        AND a.starts_at > NEW.starts_at
        AND a.starts_at < NEW.ends_at
    ) p
  ) occupancy;

  IF peak >= max_capacity THEN
    RAISE EXCEPTION 'Capacidade da agenda esgotada nesse horário'
      USING ERRCODE = '23P01';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_appointments_check_capacity ON public.appointments;
CREATE TRIGGER trg_appointments_check_capacity
    BEFORE INSERT OR UPDATE OF status, starts_at, ends_at ON public.appointments
    FOR EACH ROW EXECUTE FUNCTION public.appointments_check_capacity();
