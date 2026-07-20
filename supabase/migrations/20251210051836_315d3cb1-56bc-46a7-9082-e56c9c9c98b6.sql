-- Drop the old status constraint and create a new one with correct values
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_status_check;

ALTER TABLE public.users ADD CONSTRAINT users_status_check 
CHECK (status IN ('pending', 'active', 'inactive', 'approved', 'rejected'));