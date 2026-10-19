CREATE TABLE public.racing_result_collection_state (
  race_date date NOT NULL,
  venue text NOT NULL CHECK (venue IN ('ST','HV')),
  first_confirmed_at timestamptz NOT NULL,
  source_sha256 text NOT NULL,
  expected_races integer NOT NULL CHECK (expected_races BETWEEN 1 AND 14),
  dispatched_at timestamptz,
  last_attempt_at timestamptz,
  PRIMARY KEY (race_date, venue)
);
GRANT ALL ON public.racing_result_collection_state TO service_role;
ALTER TABLE public.racing_result_collection_state ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.racing_result_collection_state IS 'Private scheduler observations: first official CLOSED/all RESULT confirmation, never actual race finish time. No prediction writes.';