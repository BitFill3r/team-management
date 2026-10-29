INSERT INTO attendance (training_id, child_id, present, version)
SELECT t.id, c.id, false, 0
FROM trainings t
CROSS JOIN children c
WHERE NOT c.archived
ON CONFLICT (training_id, child_id) DO NOTHING;
