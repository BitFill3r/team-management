CREATE TABLE surveys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 120),
  description text NOT NULL DEFAULT '' CHECK (length(description) <= 2000),
  first_label text NOT NULL CHECK (length(first_label) BETWEEN 1 AND 120),
  first_placeholder text NOT NULL DEFAULT '' CHECK (length(first_placeholder) <= 120),
  first_required boolean NOT NULL,
  second_label text NOT NULL CHECK (length(second_label) BETWEEN 1 AND 120),
  second_placeholder text NOT NULL DEFAULT '' CHECK (length(second_placeholder) <= 120),
  second_required boolean NOT NULL,
  second_type text NOT NULL CHECK (second_type IN ('text', 'single_choice')),
  warn_duplicates boolean NOT NULL DEFAULT true,
  password_hash text NOT NULL,
  password_version integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'open', 'closed')),
  published boolean NOT NULL DEFAULT false,
  version integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (status = 'draft' OR published)
);

CREATE TABLE survey_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid NOT NULL REFERENCES surveys ON DELETE CASCADE,
  label text NOT NULL CHECK (length(label) BETWEEN 1 AND 60),
  position integer NOT NULL CHECK (position >= 0),
  UNIQUE (survey_id, id),
  UNIQUE (survey_id, position)
);

CREATE TABLE survey_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid NOT NULL REFERENCES surveys ON DELETE CASCADE,
  first_value text CHECK (length(first_value) BETWEEN 1 AND 200),
  second_value text CHECK (length(second_value) BETWEEN 1 AND 200),
  option_id uuid,
  submission_id uuid NOT NULL,
  version integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (survey_id, option_id) REFERENCES survey_options (survey_id, id),
  UNIQUE (survey_id, submission_id),
  CHECK (second_value IS NULL OR option_id IS NULL),
  CHECK (first_value IS NOT NULL OR second_value IS NOT NULL OR option_id IS NOT NULL)
);
CREATE INDEX survey_responses_list ON survey_responses (survey_id, created_at, id);
CREATE INDEX survey_responses_duplicates ON survey_responses (survey_id, lower(first_value));

CREATE TABLE survey_limits (
  survey_id uuid NOT NULL REFERENCES surveys ON DELETE CASCADE,
  key text NOT NULL,
  attempts integer NOT NULL,
  window_start timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (survey_id, key)
);
CREATE INDEX survey_limits_expiry ON survey_limits (window_start);
