-- =====================================================
-- FIX FISHERMAN REGISTRATION FLOW
-- =====================================================

-- Update the create_user_profile function to handle fisherman registration
CREATE OR REPLACE FUNCTION create_user_profile()
RETURNS TRIGGER AS $$
DECLARE
    user_metadata JSONB;
    user_type TEXT;
BEGIN
    -- Get user metadata from the auth.users record
    user_metadata := NEW.raw_user_meta_data;
    user_type := COALESCE(user_metadata->>'user_type', 'customer');

    -- Create user record in users table
    INSERT INTO public.users (id, email, role, status, full_name, phone, address)
    VALUES (
        NEW.id,
        NEW.email,
        'customer_guest', -- Default role, will be changed to nelayan after approval
        'active',
        user_metadata->>'full_name',
        user_metadata->>'phone',
        user_metadata->>'location'
    );

    -- If user is registering as fisherman, create pending_nelayan record
    IF user_type = 'fisherman' THEN
        INSERT INTO public.pending_nelayan (
            user_id,
            nama,
            alamat,
            nomor_telpon,
            status
        ) VALUES (
            NEW.id,
            user_metadata->>'full_name',
            user_metadata->>'location',
            user_metadata->>'phone',
            'pending'
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure the trigger exists and is properly configured
DROP TRIGGER IF EXISTS create_user_profile_trigger ON auth.users;
CREATE TRIGGER create_user_profile_trigger
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION create_user_profile();