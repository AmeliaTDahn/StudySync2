-- Begin transaction
BEGIN;

-- Add Science subject for the tutor
INSERT INTO tutor_subjects (tutor_id, subject)
VALUES ('cff86bc4-ab2c-441b-96f1-0de35a6e41b3', 'Science')
ON CONFLICT (tutor_id, subject) DO NOTHING;

COMMIT; 