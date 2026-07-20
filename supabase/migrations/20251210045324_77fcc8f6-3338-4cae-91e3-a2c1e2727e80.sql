
-- Drop the old constraint and create a new one with correct values
ALTER TABLE public.users DROP CONSTRAINT users_role_check;

ALTER TABLE public.users ADD CONSTRAINT users_role_check 
CHECK (role IN ('nelayan', 'admin', 'customer_guest'));

-- Also update any existing 'customer' roles to 'customer_guest'
UPDATE public.users SET role = 'customer_guest' WHERE role = 'customer';
