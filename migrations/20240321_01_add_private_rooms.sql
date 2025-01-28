-- Add is_private column to study_rooms table
ALTER TABLE study_rooms 
ADD COLUMN is_private BOOLEAN NOT NULL DEFAULT FALSE; 