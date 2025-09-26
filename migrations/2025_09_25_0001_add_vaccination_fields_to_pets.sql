-- Add vaccination fields to pets table
ALTER TABLE pets
ADD COLUMN last_vaccine_date DATE NULL AFTER special_notes,
ADD COLUMN vaccine_types VARCHAR(255) NULL AFTER last_vaccine_date,
ADD COLUMN custom_vaccine VARCHAR(255) NULL AFTER vaccine_types,
ADD COLUMN vaccination_proof VARCHAR(500) NULL AFTER custom_vaccine;

-- Add comment for documentation
ALTER TABLE pets COMMENT = 'Pet information including vaccination records';