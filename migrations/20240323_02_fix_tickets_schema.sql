-- Begin transaction
BEGIN;

-- Add status column if it doesn't exist
ALTER TABLE tickets
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'New' CHECK (status IN ('New', 'In Progress', 'Closed'));

-- Update existing tickets to have a status
UPDATE tickets
SET status = CASE
    WHEN closed THEN 'Closed'
    ELSE 'New'
END
WHERE status IS NULL;

-- Make status column NOT NULL
ALTER TABLE tickets
ALTER COLUMN status SET NOT NULL;

-- End transaction
COMMIT; 