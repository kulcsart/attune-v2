-- =====================================================
-- Fix debranding_map column if missing
-- =====================================================

-- Ensure debranding_map column exists in authors table
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'authors' 
        AND column_name = 'debranding_map'
    ) THEN
        ALTER TABLE authors ADD COLUMN debranding_map JSONB DEFAULT '{}';
        RAISE NOTICE 'Added debranding_map column to authors table';
    ELSE
        RAISE NOTICE 'debranding_map column already exists';
    END IF;
END $$;

-- Verify the column exists
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'authors' 
AND column_name IN ('debranding_map', 'signature_concepts');
