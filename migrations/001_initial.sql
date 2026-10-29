CREATE TABLE children (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 60),
  archived boolean NOT NULL DEFAULT false,
  version integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE trainings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL UNIQUE
);

CREATE TABLE attendance (
  training_id uuid NOT NULL REFERENCES trainings(id) ON DELETE CASCADE,
  child_id uuid NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  present boolean NOT NULL DEFAULT false,
  version integer NOT NULL DEFAULT 0,
  PRIMARY KEY (training_id, child_id)
);

CREATE TABLE login_attempts (
  key text PRIMARY KEY,
  attempts integer NOT NULL,
  window_start timestamptz NOT NULL DEFAULT now()
);
