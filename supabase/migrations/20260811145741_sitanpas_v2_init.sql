


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."order_status" AS ENUM (
    'pending',
    'paid',
    'shipped',
    'completed',
    'cancelled'
);


ALTER TYPE "public"."order_status" OWNER TO "postgres";


CREATE TYPE "public"."payment_method" AS ENUM (
    'cash',
    'transfer',
    'ewallet',
    'cod'
);


ALTER TYPE "public"."payment_method" OWNER TO "postgres";


CREATE TYPE "public"."pending_status" AS ENUM (
    'pending',
    'approved',
    'rejected'
);


ALTER TYPE "public"."pending_status" OWNER TO "postgres";


CREATE TYPE "public"."product_status" AS ENUM (
    'active',
    'inactive'
);


ALTER TYPE "public"."product_status" OWNER TO "postgres";


CREATE TYPE "public"."transaction_status" AS ENUM (
    'pending',
    'success',
    'failed'
);


ALTER TYPE "public"."transaction_status" OWNER TO "postgres";


CREATE TYPE "public"."unit_type" AS ENUM (
    'kg',
    'box'
);


ALTER TYPE "public"."unit_type" OWNER TO "postgres";


CREATE TYPE "public"."user_role" AS ENUM (
    'admin',
    'nelayan',
    'customer_guest'
);


ALTER TYPE "public"."user_role" OWNER TO "postgres";


CREATE TYPE "public"."user_status" AS ENUM (
    'active',
    'inactive',
    'pending'
);


ALTER TYPE "public"."user_status" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_delete_user_with_audit"("target_user_id" "uuid", "admin_user_id" "uuid", "deletion_reason" "text" DEFAULT 'Admin deletion'::"text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    target_user_record RECORD;
    current_admin_id UUID;
    affected_products INTEGER := 0;
    affected_orders INTEGER := 0;
    affected_transactions INTEGER := 0;
    affected_pending INTEGER := 0;
    result JSON;
BEGIN
    -- Validate admin permissions
    SELECT id INTO current_admin_id 
    FROM public.users 
    WHERE id = admin_user_id AND role = 'admin';
    
    IF current_admin_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Only admin users can delete users';
    END IF;
    
    -- Get target user info
    SELECT * INTO target_user_record 
    FROM public.users 
    WHERE id = target_user_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'User not found with ID: %', target_user_id;
    END IF;
    
    -- Count affected records for audit
    SELECT COUNT(*) INTO affected_products 
    FROM public.products 
    WHERE nelayan_id = target_user_id;
    
    SELECT COUNT(*) INTO affected_orders 
    FROM public.orders o 
    JOIN public.products p ON o.produk_id = p.id 
    WHERE p.nelayan_id = target_user_id;
    
    SELECT COUNT(*) INTO affected_transactions 
    FROM public.transactions 
    WHERE nelayan_id = target_user_id;
    
    SELECT COUNT(*) INTO affected_pending 
    FROM public.pending_nelayan 
    WHERE user_id = target_user_id;
    
    -- Create audit record BEFORE deletion
    INSERT INTO public.user_deletion_audit (
        deleted_user_id,
        deleted_user_email,
        deleted_user_role,
        deleted_user_name,
        admin_id,
        admin_email,
        deletion_reason,
        affected_products_count,
        affected_orders_count,
        affected_transactions_count,
        affected_pending_count,
        user_data_backup
    ) VALUES (
        target_user_record.id,
        target_user_record.email,
        target_user_record.role::TEXT,
        target_user_record.full_name,
        current_admin_id,
        (SELECT email FROM public.users WHERE id = current_admin_id),
        deletion_reason,
        affected_products,
        affected_orders,
        affected_transactions,
        affected_pending,
        row_to_json(target_user_record)
    );
    
    -- Handle related data before user deletion
    -- 1. Set nelayan_id to NULL in products (will cascade to orders via trigger)
    UPDATE public.products 
    SET nelayan_id = NULL, 
        status = 'inactive',
        updated_at = NOW()
    WHERE nelayan_id = target_user_id;
    
    -- 2. Transactions nelayan_id will be set to NULL automatically by FK constraint
    -- No manual update needed due to ON DELETE SET NULL
    
    -- 3. Delete pending nelayan applications (will cascade)
    DELETE FROM public.pending_nelayan 
    WHERE user_id = target_user_id;
    
    -- 4. Finally delete the user (this will trigger auth.users deletion via CASCADE)
    DELETE FROM public.users 
    WHERE id = target_user_id;
    
    -- Prepare success response
    result := json_build_object(
        'success', true,
        'message', 'User deleted successfully',
        'deleted_user', json_build_object(
            'id', target_user_record.id,
            'email', target_user_record.email,
            'role', target_user_record.role,
            'name', target_user_record.full_name
        ),
        'admin_info', json_build_object(
            'admin_id', current_admin_id,
            'admin_email', (SELECT email FROM public.users WHERE id = current_admin_id)
        ),
        'affected_records', json_build_object(
            'products', affected_products,
            'orders', affected_orders,
            'transactions', affected_transactions,
            'pending_applications', affected_pending
        ),
        'deletion_reason', deletion_reason,
        'deleted_at', NOW()
    );
    
    RETURN result;
    
EXCEPTION
    WHEN OTHERS THEN
        -- Log error and re-raise
        RAISE EXCEPTION 'Failed to delete user: %', SQLERRM;
END;
$$;


ALTER FUNCTION "public"."admin_delete_user_with_audit"("target_user_id" "uuid", "admin_user_id" "uuid", "deletion_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."approve_nelayan_application"("application_id" "uuid", "admin_user_id" "uuid", "notes" "text" DEFAULT NULL::"text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    target_user_id UUID;
    application_exists BOOLEAN;
BEGIN
    -- Check if admin user has admin role
    IF NOT EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = admin_user_id AND role = 'admin'
    ) THEN
        RAISE EXCEPTION 'Only admin users can approve applications';
    END IF;

    -- Get the user_id from pending application
    SELECT user_id, TRUE INTO target_user_id, application_exists
    FROM public.pending_nelayan 
    WHERE id = application_id AND status = 'pending';

    IF NOT application_exists THEN
        RAISE EXCEPTION 'Application not found or already processed';
    END IF;

    -- Update pending application status
    UPDATE public.pending_nelayan 
    SET 
        status = 'approved',
        admin_notes = notes,
        reviewed_by = admin_user_id,
        reviewed_at = NOW(),
        updated_at = NOW()
    WHERE id = application_id;

    -- Update user role to nelayan
    UPDATE public.users 
    SET 
        role = 'nelayan',
        status = 'active',
        updated_at = NOW()
    WHERE id = target_user_id;

    RETURN TRUE;
END;
$$;


ALTER FUNCTION "public"."approve_nelayan_application"("application_id" "uuid", "admin_user_id" "uuid", "notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_access_nelayan_data"("user_id" "uuid", "target_nelayan_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    user_role user_role;
BEGIN
    SELECT role INTO user_role FROM public.users WHERE id = user_id;
    
    -- Admin can access all data
    IF user_role = 'admin' THEN
        RETURN TRUE;
    END IF;
    
    -- Nelayan can only access their own data
    IF user_role = 'nelayan' AND user_id = target_nelayan_id THEN
        RETURN TRUE;
    END IF;
    
    RETURN FALSE;
END;
$$;


ALTER FUNCTION "public"."can_access_nelayan_data"("user_id" "uuid", "target_nelayan_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_transaction_for_order"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    product_nelayan_id UUID;
BEGIN
    -- Get nelayan_id from product
    SELECT nelayan_id INTO product_nelayan_id
    FROM public.products
    WHERE id = NEW.produk_id;

    -- Create transaction record
    INSERT INTO public.transactions (
        order_id,
        nelayan_id,
        total_harga,
        metode_pembayaran,
        status
    ) VALUES (
        NEW.id,
        product_nelayan_id,
        NEW.total_harga,
        'cod', -- Default to cash on delivery
        'pending'
    );

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."create_transaction_for_order"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_transaction_from_order"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  product_nelayan_id UUID;
BEGIN
  -- Get nelayan_id from product
  SELECT nelayan_id INTO product_nelayan_id
  FROM products 
  WHERE id = NEW.produk_id;
  
  -- Create transaction record
  INSERT INTO transactions (
    order_id,
    nelayan_id,
    total_harga,
    metode_pembayaran,
    status
  ) VALUES (
    NEW.id,
    product_nelayan_id,
    NEW.total_harga,
    'cod', -- default payment method
    'pending'
  );
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."create_transaction_from_order"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_user_profile"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."create_user_profile"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_current_user_role"() RETURNS "public"."user_role"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    user_role_result user_role;
BEGIN
    SELECT role INTO user_role_result
    FROM public.users 
    WHERE id = auth.uid();
    
    RETURN COALESCE(user_role_result, 'customer_guest');
END;
$$;


ALTER FUNCTION "public"."get_current_user_role"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_nelayan_stats"("nelayan_user_id" "uuid") RETURNS TABLE("total_products" bigint, "active_products" bigint, "total_orders" bigint, "total_revenue" numeric, "pending_orders" bigint)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        (SELECT COUNT(*) FROM public.products WHERE nelayan_id = nelayan_user_id) as total_products,
        (SELECT COUNT(*) FROM public.products WHERE nelayan_id = nelayan_user_id AND status = 'active') as active_products,
        (SELECT COUNT(*) FROM public.transactions WHERE nelayan_id = nelayan_user_id) as total_orders,
        (SELECT COALESCE(SUM(total_harga), 0) FROM public.transactions WHERE nelayan_id = nelayan_user_id AND status = 'success') as total_revenue,
        (SELECT COUNT(*) FROM public.transactions WHERE nelayan_id = nelayan_user_id AND status = 'pending') as pending_orders;
END;
$$;


ALTER FUNCTION "public"."get_nelayan_stats"("nelayan_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_role"("_user_id" "uuid") RETURNS "text"
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  SELECT role::text FROM public.users WHERE id = _user_id;
$$;


ALTER FUNCTION "public"."get_user_role"("_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "text") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = _user_id AND role::text = _role
  );
$$;


ALTER FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() AND role = 'admin'
    );
END;
$$;


ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_nelayan"() RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() AND role = 'nelayan'
    );
END;
$$;


ALTER FUNCTION "public"."is_nelayan"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reduce_product_stock"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Reduce stock
  UPDATE products 
  SET 
    stok = stok - NEW.jumlah,
    updated_at = NOW()
  WHERE id = NEW.produk_id;
  
  -- Check if stock is now 0 or less, set status to inactive
  UPDATE products 
  SET 
    status = 'inactive',
    updated_at = NOW()
  WHERE id = NEW.produk_id AND stok <= 0;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."reduce_product_stock"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reject_nelayan_application"("application_id" "uuid", "admin_user_id" "uuid", "notes" "text" DEFAULT NULL::"text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    -- Check if admin user has admin role
    IF NOT EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = admin_user_id AND role = 'admin'
    ) THEN
        RAISE EXCEPTION 'Only admin users can reject applications';
    END IF;

    -- Update pending application status
    UPDATE public.pending_nelayan 
    SET 
        status = 'rejected',
        admin_notes = notes,
        reviewed_by = admin_user_id,
        reviewed_at = NOW(),
        updated_at = NOW()
    WHERE id = application_id AND status = 'pending';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Application not found or already processed';
    END IF;

    RETURN TRUE;
END;
$$;


ALTER FUNCTION "public"."reject_nelayan_application"("application_id" "uuid", "admin_user_id" "uuid", "notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."restore_product_stock"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Only restore stock if order status changed to cancelled
  IF OLD.status != 'cancelled' AND NEW.status = 'cancelled' THEN
    UPDATE products 
    SET 
      stok = stok + NEW.jumlah,
      status = 'active', -- reactivate product
      updated_at = NOW()
    WHERE id = NEW.produk_id;
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."restore_product_stock"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_product_stock_admin"("product_id" "uuid", "new_stock" integer) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    -- Check if the user is an admin
    IF NOT EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() AND role = 'admin'
    ) THEN
        RAISE EXCEPTION 'Unauthorized: Admin access required';
    END IF;

    -- Update the product stock
    UPDATE public.products
    SET 
        stok = new_stock,
        updated_at = NOW(),
        -- Reactivate product if stock is added and it was inactive due to no stock
        status = CASE 
            WHEN new_stock > 0 AND status = 'inactive' THEN 'active'
            WHEN new_stock = 0 THEN 'inactive'
            ELSE status
        END
    WHERE id = product_id;

    -- Check if the product exists
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Product with ID % not found', product_id;
    END IF;
END;
$$;


ALTER FUNCTION "public"."update_product_stock_admin"("product_id" "uuid", "new_stock" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_user_approval_status"("target_user_id" "uuid", "new_status" "text", "reason" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Update pending_nelayan status
  UPDATE pending_nelayan 
  SET 
    status = new_status::pending_status,
    admin_notes = COALESCE(reason, admin_notes),
    reviewed_by = auth.uid(),
    reviewed_at = NOW(),
    updated_at = NOW()
  WHERE user_id = target_user_id;
  
  -- If approved, update user role to nelayan
  IF new_status = 'approved' THEN
    UPDATE users 
    SET 
      role = 'nelayan',
      status = 'active',
      updated_at = NOW()
    WHERE id = target_user_id;
  END IF;
  
  -- If rejected, keep user as customer_guest
  IF new_status = 'rejected' THEN
    UPDATE users 
    SET 
      status = 'inactive',
      updated_at = NOW()
    WHERE id = target_user_id;
  END IF;
END;
$$;


ALTER FUNCTION "public"."update_user_approval_status"("target_user_id" "uuid", "new_status" "text", "reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_website_settings_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_website_settings_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."orders" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "customer_nama" "text" NOT NULL,
    "customer_telpon" "text" NOT NULL,
    "customer_alamat" "text" NOT NULL,
    "customer_email" "text",
    "produk_id" "uuid" NOT NULL,
    "jumlah" integer NOT NULL,
    "harga_satuan" numeric(12,2) NOT NULL,
    "total_harga" numeric(12,2) NOT NULL,
    "status" "public"."order_status" DEFAULT 'pending'::"public"."order_status" NOT NULL,
    "catatan" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "orders_harga_satuan_check" CHECK (("harga_satuan" > (0)::numeric)),
    CONSTRAINT "orders_jumlah_check" CHECK (("jumlah" > 0)),
    CONSTRAINT "orders_total_harga_check" CHECK (("total_harga" > (0)::numeric)),
    CONSTRAINT "valid_phone" CHECK (("length"("customer_telpon") >= 10)),
    CONSTRAINT "valid_total" CHECK (("total_harga" = ("harga_satuan" * ("jumlah")::numeric)))
);


ALTER TABLE "public"."orders" OWNER TO "postgres";


COMMENT ON TABLE "public"."orders" IS 'Customer orders (no login required)';



COMMENT ON COLUMN "public"."orders"."total_harga" IS 'Total price calculated as harga_satuan * jumlah';



CREATE OR REPLACE VIEW "public"."admin_customer_analytics" WITH ("security_barrier"='true') AS
 SELECT "customer_nama",
    "customer_telpon",
    "customer_alamat",
    "count"(*) AS "total_orders",
    "sum"("total_harga") AS "total_spent",
    "avg"("total_harga") AS "average_order_value",
    "min"("created_at") AS "first_order_date",
    "max"("created_at") AS "last_order_date",
    "count"(*) FILTER (WHERE ("status" = 'completed'::"public"."order_status")) AS "completed_orders",
    "count"(*) FILTER (WHERE ("status" = 'pending'::"public"."order_status")) AS "pending_orders",
    "count"(*) FILTER (WHERE ("status" = 'cancelled'::"public"."order_status")) AS "cancelled_orders",
        CASE
            WHEN ("count"(*) >= 10) THEN 'VIP Customer'::"text"
            WHEN ("count"(*) >= 5) THEN 'Regular Customer'::"text"
            WHEN ("count"(*) >= 2) THEN 'Repeat Customer'::"text"
            ELSE 'New Customer'::"text"
        END AS "customer_type"
   FROM "public"."orders" "o"
  GROUP BY "customer_nama", "customer_telpon", "customer_alamat"
  ORDER BY ("sum"("total_harga")) DESC;


ALTER VIEW "public"."admin_customer_analytics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."transactions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "nelayan_id" "uuid",
    "total_harga" numeric(12,2) NOT NULL,
    "metode_pembayaran" "public"."payment_method" DEFAULT 'cod'::"public"."payment_method" NOT NULL,
    "status" "public"."transaction_status" DEFAULT 'pending'::"public"."transaction_status" NOT NULL,
    "payment_proof_url" "text",
    "admin_notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "transactions_total_harga_check" CHECK (("total_harga" > (0)::numeric))
);


ALTER TABLE "public"."transactions" OWNER TO "postgres";


COMMENT ON TABLE "public"."transactions" IS 'Payment transactions for orders';



COMMENT ON COLUMN "public"."transactions"."metode_pembayaran" IS 'Payment method used for the transaction';



CREATE OR REPLACE VIEW "public"."admin_daily_transactions" WITH ("security_barrier"='true') AS
 SELECT "date"("created_at") AS "transaction_date",
    "count"(*) AS "total_transactions",
    "count"(*) FILTER (WHERE ("status" = 'success'::"public"."transaction_status")) AS "successful_transactions",
    "count"(*) FILTER (WHERE ("status" = 'pending'::"public"."transaction_status")) AS "pending_transactions",
    "count"(*) FILTER (WHERE ("status" = 'failed'::"public"."transaction_status")) AS "failed_transactions",
    "sum"("total_harga") AS "total_amount",
    "sum"("total_harga") FILTER (WHERE ("status" = 'success'::"public"."transaction_status")) AS "successful_amount",
    "count"(*) FILTER (WHERE ("metode_pembayaran" = 'cod'::"public"."payment_method")) AS "cod_transactions",
    "count"(*) FILTER (WHERE ("metode_pembayaran" = 'transfer'::"public"."payment_method")) AS "transfer_transactions",
    "count"(*) FILTER (WHERE ("metode_pembayaran" = 'ewallet'::"public"."payment_method")) AS "ewallet_transactions",
    "round"("avg"("total_harga"), 2) AS "average_transaction_value"
   FROM "public"."transactions" "t"
  WHERE ("created_at" >= (CURRENT_DATE - '30 days'::interval))
  GROUP BY ("date"("created_at"))
  ORDER BY ("date"("created_at")) DESC;


ALTER VIEW "public"."admin_daily_transactions" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."admin_monthly_revenue" WITH ("security_barrier"='true') AS
 SELECT "date_trunc"('month'::"text", "created_at") AS "month",
    "count"(*) AS "total_transactions",
    "sum"("total_harga") AS "total_revenue",
    "avg"("total_harga") AS "average_transaction_value",
    "count"(DISTINCT "nelayan_id") AS "active_nelayan_count",
    "sum"("total_harga") FILTER (WHERE ("metode_pembayaran" = 'cod'::"public"."payment_method")) AS "cod_revenue",
    "sum"("total_harga") FILTER (WHERE ("metode_pembayaran" = 'transfer'::"public"."payment_method")) AS "transfer_revenue",
    "sum"("total_harga") FILTER (WHERE ("metode_pembayaran" = 'ewallet'::"public"."payment_method")) AS "ewallet_revenue"
   FROM "public"."transactions" "t"
  WHERE (("status" = 'success'::"public"."transaction_status") AND ("created_at" >= "date_trunc"('month'::"text", (CURRENT_DATE - '1 year'::interval))))
  GROUP BY ("date_trunc"('month'::"text", "created_at"))
  ORDER BY ("date_trunc"('month'::"text", "created_at")) DESC;


ALTER VIEW "public"."admin_monthly_revenue" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."products" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "nelayan_id" "uuid" NOT NULL,
    "nama_produk" "text" NOT NULL,
    "deskripsi" "text",
    "harga" numeric(12,2) NOT NULL,
    "stok" integer DEFAULT 0 NOT NULL,
    "status" "public"."product_status" DEFAULT 'active'::"public"."product_status" NOT NULL,
    "image_url" "text",
    "kategori" "text",
    "berat_per_unit" numeric(8,2),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "unit_type" "public"."unit_type" DEFAULT 'kg'::"public"."unit_type",
    CONSTRAINT "products_harga_check" CHECK (("harga" > (0)::numeric)),
    CONSTRAINT "products_stok_check" CHECK (("stok" >= 0))
);


ALTER TABLE "public"."products" OWNER TO "postgres";


COMMENT ON TABLE "public"."products" IS 'Fish products listed by approved nelayan';



COMMENT ON COLUMN "public"."products"."stok" IS 'Available stock quantity';



COMMENT ON COLUMN "public"."products"."unit_type" IS 'Unit penjualan: kg (per kilogram) atau box (per box)';



CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "role" "public"."user_role" DEFAULT 'customer_guest'::"public"."user_role" NOT NULL,
    "status" "public"."user_status" DEFAULT 'active'::"public"."user_status" NOT NULL,
    "full_name" "text",
    "phone" "text",
    "address" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "nama_lengkap" "text"
);


ALTER TABLE "public"."users" OWNER TO "postgres";


COMMENT ON TABLE "public"."users" IS 'Extended user profiles linked to Supabase Auth';



COMMENT ON COLUMN "public"."users"."role" IS 'User role: admin, nelayan, or customer_guest';



CREATE OR REPLACE VIEW "public"."admin_nelayan_monthly_report" AS
 SELECT "u"."id" AS "nelayan_id",
    "u"."nama_lengkap" AS "nelayan_name",
    "date_trunc"('month'::"text", "t"."created_at") AS "transaction_month",
    "count"(DISTINCT "t"."id") AS "monthly_transactions",
    "count"(DISTINCT "o"."id") AS "monthly_orders",
    COALESCE("sum"(
        CASE
            WHEN ("t"."status" = 'success'::"public"."transaction_status") THEN "t"."total_harga"
            ELSE (0)::numeric
        END), (0)::numeric) AS "monthly_revenue",
    COALESCE("sum"("t"."total_harga"), (0)::numeric) AS "monthly_gross_revenue",
    COALESCE("sum"("o"."jumlah"), (0)::bigint) AS "total_kg_sold",
        CASE
            WHEN ("count"(DISTINCT "t"."id") > 0) THEN "round"((COALESCE("sum"(
            CASE
                WHEN ("t"."status" = 'success'::"public"."transaction_status") THEN "t"."total_harga"
                ELSE (0)::numeric
            END), (0)::numeric) / ("count"(DISTINCT "t"."id"))::numeric), 2)
            ELSE (0)::numeric
        END AS "avg_monthly_transaction_value"
   FROM ((("public"."users" "u"
     JOIN "public"."products" "p" ON (("u"."id" = "p"."nelayan_id")))
     JOIN "public"."orders" "o" ON (("p"."id" = "o"."produk_id")))
     JOIN "public"."transactions" "t" ON (("o"."id" = "t"."order_id")))
  WHERE (("u"."role" = 'nelayan'::"public"."user_role") AND ("t"."created_at" >= "date_trunc"('month'::"text", ("now"() - '1 year'::interval))))
  GROUP BY "u"."id", "u"."nama_lengkap", ("date_trunc"('month'::"text", "t"."created_at"))
  ORDER BY "u"."nama_lengkap", ("date_trunc"('month'::"text", "t"."created_at")) DESC;


ALTER VIEW "public"."admin_nelayan_monthly_report" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."admin_nelayan_performance" WITH ("security_barrier"='true') AS
 SELECT "u"."id" AS "nelayan_id",
    "u"."full_name" AS "nelayan_name",
    "u"."email",
    "u"."phone",
    "u"."created_at" AS "joined_date",
    COALESCE("p"."total_products", (0)::bigint) AS "total_products",
    COALESCE("p"."active_products", (0)::bigint) AS "active_products",
    COALESCE("p"."inactive_products", (0)::bigint) AS "inactive_products",
    COALESCE("t"."total_transactions", (0)::bigint) AS "total_transactions",
    COALESCE("t"."successful_transactions", (0)::bigint) AS "successful_transactions",
    COALESCE("t"."pending_transactions", (0)::bigint) AS "pending_transactions",
    COALESCE("t"."total_revenue", (0)::numeric) AS "total_revenue",
    COALESCE("o"."total_orders", (0)::bigint) AS "total_orders",
    COALESCE("o"."completed_orders", (0)::bigint) AS "completed_orders",
    COALESCE("o"."pending_orders", (0)::bigint) AS "pending_orders",
    COALESCE("o"."cancelled_orders", (0)::bigint) AS "cancelled_orders",
        CASE
            WHEN (COALESCE("t"."total_transactions", (0)::bigint) > 0) THEN "round"((((COALESCE("t"."successful_transactions", (0)::bigint))::numeric / ("t"."total_transactions")::numeric) * (100)::numeric), 2)
            ELSE (0)::numeric
        END AS "success_rate_percentage",
        CASE
            WHEN (COALESCE("o"."total_orders", (0)::bigint) > 0) THEN "round"((COALESCE("t"."total_revenue", (0)::numeric) / ("o"."total_orders")::numeric), 2)
            ELSE (0)::numeric
        END AS "average_order_value"
   FROM ((("public"."users" "u"
     LEFT JOIN ( SELECT "products"."nelayan_id",
            "count"(*) AS "total_products",
            "count"(*) FILTER (WHERE ("products"."status" = 'active'::"public"."product_status")) AS "active_products",
            "count"(*) FILTER (WHERE ("products"."status" = 'inactive'::"public"."product_status")) AS "inactive_products"
           FROM "public"."products"
          GROUP BY "products"."nelayan_id") "p" ON (("u"."id" = "p"."nelayan_id")))
     LEFT JOIN ( SELECT "transactions"."nelayan_id",
            "count"(*) AS "total_transactions",
            "count"(*) FILTER (WHERE ("transactions"."status" = 'success'::"public"."transaction_status")) AS "successful_transactions",
            "count"(*) FILTER (WHERE ("transactions"."status" = 'pending'::"public"."transaction_status")) AS "pending_transactions",
            COALESCE("sum"("transactions"."total_harga") FILTER (WHERE ("transactions"."status" = 'success'::"public"."transaction_status")), (0)::numeric) AS "total_revenue"
           FROM "public"."transactions"
          GROUP BY "transactions"."nelayan_id") "t" ON (("u"."id" = "t"."nelayan_id")))
     LEFT JOIN ( SELECT "p_1"."nelayan_id",
            "count"(*) AS "total_orders",
            "count"(*) FILTER (WHERE ("o_1"."status" = 'completed'::"public"."order_status")) AS "completed_orders",
            "count"(*) FILTER (WHERE ("o_1"."status" = 'pending'::"public"."order_status")) AS "pending_orders",
            "count"(*) FILTER (WHERE ("o_1"."status" = 'cancelled'::"public"."order_status")) AS "cancelled_orders"
           FROM ("public"."orders" "o_1"
             JOIN "public"."products" "p_1" ON (("o_1"."produk_id" = "p_1"."id")))
          GROUP BY "p_1"."nelayan_id") "o" ON (("u"."id" = "o"."nelayan_id")))
  WHERE ("u"."role" = 'nelayan'::"public"."user_role")
  ORDER BY "t"."total_revenue" DESC NULLS LAST;


ALTER VIEW "public"."admin_nelayan_performance" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."admin_nelayan_top_products" AS
 SELECT "u"."id" AS "nelayan_id",
    "u"."nama_lengkap" AS "nelayan_name",
    "p"."id" AS "product_id",
    "p"."nama_produk" AS "product_name",
    "p"."harga" AS "product_price",
    "p"."stok" AS "current_stock",
    "count"(DISTINCT "o"."id") AS "total_orders",
    COALESCE("sum"("o"."jumlah"), (0)::bigint) AS "total_kg_sold",
    COALESCE("sum"("o"."total_harga"), (0)::numeric) AS "total_product_revenue",
    "round"("avg"("o"."jumlah"), 2) AS "avg_order_size_kg",
    "row_number"() OVER (PARTITION BY "u"."id" ORDER BY COALESCE("sum"("o"."total_harga"), (0)::numeric) DESC) AS "revenue_rank",
    "p"."created_at" AS "product_created_date",
    "max"("o"."created_at") AS "last_order_date"
   FROM (("public"."users" "u"
     JOIN "public"."products" "p" ON (("u"."id" = "p"."nelayan_id")))
     LEFT JOIN "public"."orders" "o" ON ((("p"."id" = "o"."produk_id") AND ("o"."status" <> 'cancelled'::"public"."order_status"))))
  WHERE ("u"."role" = 'nelayan'::"public"."user_role")
  GROUP BY "u"."id", "u"."nama_lengkap", "p"."id", "p"."nama_produk", "p"."harga", "p"."stok", "p"."created_at"
  ORDER BY "u"."nama_lengkap", COALESCE("sum"("o"."total_harga"), (0)::numeric) DESC;


ALTER VIEW "public"."admin_nelayan_top_products" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."admin_nelayan_transaction_report" AS
 SELECT "u"."id" AS "nelayan_id",
    "u"."nama_lengkap" AS "nelayan_name",
    "u"."email" AS "nelayan_email",
    "u"."phone" AS "nelayan_phone",
    "u"."address" AS "nelayan_location",
    "count"(DISTINCT "t"."id") AS "total_transactions",
    "count"(DISTINCT "o"."id") AS "total_orders",
    COALESCE("sum"(
        CASE
            WHEN ("t"."status" = 'success'::"public"."transaction_status") THEN "t"."total_harga"
            ELSE (0)::numeric
        END), (0)::numeric) AS "total_revenue",
    COALESCE("sum"(
        CASE
            WHEN ("t"."status" = 'pending'::"public"."transaction_status") THEN "t"."total_harga"
            ELSE (0)::numeric
        END), (0)::numeric) AS "pending_revenue",
    COALESCE("sum"("t"."total_harga"), (0)::numeric) AS "gross_revenue",
    "count"(
        CASE
            WHEN ("o"."status" = 'pending'::"public"."order_status") THEN 1
            ELSE NULL::integer
        END) AS "pending_orders",
    "count"(
        CASE
            WHEN ("o"."status" = 'completed'::"public"."order_status") THEN 1
            ELSE NULL::integer
        END) AS "completed_orders",
    "count"(
        CASE
            WHEN ("o"."status" = 'shipped'::"public"."order_status") THEN 1
            ELSE NULL::integer
        END) AS "shipped_orders",
    "count"(
        CASE
            WHEN ("o"."status" = 'paid'::"public"."order_status") THEN 1
            ELSE NULL::integer
        END) AS "paid_orders",
    "count"(
        CASE
            WHEN ("o"."status" = 'cancelled'::"public"."order_status") THEN 1
            ELSE NULL::integer
        END) AS "cancelled_orders",
    "count"(DISTINCT "p"."id") AS "total_products",
    "count"(DISTINCT
        CASE
            WHEN ("p"."status" = 'active'::"public"."product_status") THEN "p"."id"
            ELSE NULL::"uuid"
        END) AS "active_products",
    COALESCE("sum"("p"."stok"), (0)::bigint) AS "total_stock_kg",
    "min"("t"."created_at") AS "first_transaction_date",
    "max"("t"."created_at") AS "last_transaction_date",
        CASE
            WHEN ("count"(DISTINCT "t"."id") > 0) THEN "round"((COALESCE("sum"(
            CASE
                WHEN ("t"."status" = 'success'::"public"."transaction_status") THEN "t"."total_harga"
                ELSE (0)::numeric
            END), (0)::numeric) / ("count"(DISTINCT "t"."id"))::numeric), 2)
            ELSE (0)::numeric
        END AS "avg_transaction_value",
        CASE
            WHEN ("count"(DISTINCT "o"."id") > 0) THEN "round"(((("count"(
            CASE
                WHEN ("o"."status" = 'completed'::"public"."order_status") THEN 1
                ELSE NULL::integer
            END))::numeric / ("count"(DISTINCT "o"."id"))::numeric) * (100)::numeric), 2)
            ELSE (0)::numeric
        END AS "delivery_success_rate",
        CASE
            WHEN ("max"("t"."created_at") >= ("now"() - '7 days'::interval)) THEN 'Active'::"text"
            WHEN ("max"("t"."created_at") >= ("now"() - '30 days'::interval)) THEN 'Moderate'::"text"
            ELSE 'Inactive'::"text"
        END AS "activity_status",
    "u"."created_at" AS "nelayan_join_date"
   FROM ((("public"."users" "u"
     LEFT JOIN "public"."products" "p" ON (("u"."id" = "p"."nelayan_id")))
     LEFT JOIN "public"."orders" "o" ON (("p"."id" = "o"."produk_id")))
     LEFT JOIN "public"."transactions" "t" ON (("o"."id" = "t"."order_id")))
  WHERE ("u"."role" = 'nelayan'::"public"."user_role")
  GROUP BY "u"."id", "u"."nama_lengkap", "u"."email", "u"."phone", "u"."address", "u"."created_at"
  ORDER BY COALESCE("sum"(
        CASE
            WHEN ("t"."status" = 'success'::"public"."transaction_status") THEN "t"."total_harga"
            ELSE (0)::numeric
        END), (0)::numeric) DESC, ("count"(DISTINCT "t"."id")) DESC;


ALTER VIEW "public"."admin_nelayan_transaction_report" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pending_nelayan" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "nama" "text" NOT NULL,
    "alamat" "text" NOT NULL,
    "nomor_telpon" "text" NOT NULL,
    "status" "public"."pending_status" DEFAULT 'pending'::"public"."pending_status" NOT NULL,
    "admin_notes" "text",
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "valid_phone" CHECK (("length"("nomor_telpon") >= 10))
);


ALTER TABLE "public"."pending_nelayan" OWNER TO "postgres";


COMMENT ON TABLE "public"."pending_nelayan" IS 'Applications from users wanting to become nelayan (fishermen sellers)';



CREATE OR REPLACE VIEW "public"."admin_pending_applications" WITH ("security_barrier"='true') AS
 SELECT "pn"."id" AS "application_id",
    "pn"."nama",
    "pn"."alamat",
    "pn"."nomor_telpon",
    "pn"."status",
    "pn"."created_at" AS "application_date",
    "pn"."admin_notes",
    "u"."email",
    "u"."created_at" AS "user_registered_date",
    "reviewer"."full_name" AS "reviewed_by_name",
    "pn"."reviewed_at",
    EXTRACT(days FROM ("now"() - "pn"."created_at")) AS "days_pending"
   FROM (("public"."pending_nelayan" "pn"
     JOIN "public"."users" "u" ON (("pn"."user_id" = "u"."id")))
     LEFT JOIN "public"."users" "reviewer" ON (("pn"."reviewed_by" = "reviewer"."id")))
  ORDER BY "pn"."created_at";


ALTER VIEW "public"."admin_pending_applications" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."admin_product_analytics" WITH ("security_barrier"='true') AS
 SELECT "p"."id" AS "product_id",
    "p"."nama_produk",
    "p"."kategori",
    "p"."harga",
    "p"."stok",
    "p"."status",
    "p"."created_at",
    "u"."full_name" AS "nelayan_name",
    "u"."email" AS "nelayan_email",
    COALESCE("o"."total_orders", (0)::bigint) AS "total_orders",
    COALESCE("o"."total_quantity_sold", (0)::bigint) AS "total_quantity_sold",
    COALESCE("o"."total_revenue", (0)::numeric) AS "total_revenue",
        CASE
            WHEN ("p"."created_at" > ("now"() - '30 days'::interval)) THEN COALESCE("o"."total_orders", (0)::bigint)
            ELSE (0)::bigint
        END AS "orders_last_30_days",
        CASE
            WHEN (COALESCE("o"."total_orders", (0)::bigint) > 0) THEN "round"((COALESCE("o"."total_revenue", (0)::numeric) / ("o"."total_orders")::numeric), 2)
            ELSE (0)::numeric
        END AS "average_order_value",
        CASE
            WHEN ("p"."stok" = 0) THEN 'Out of Stock'::"text"
            WHEN ("p"."stok" <= 5) THEN 'Low Stock'::"text"
            WHEN ("p"."stok" <= 20) THEN 'Medium Stock'::"text"
            ELSE 'High Stock'::"text"
        END AS "stock_status"
   FROM (("public"."products" "p"
     JOIN "public"."users" "u" ON (("p"."nelayan_id" = "u"."id")))
     LEFT JOIN ( SELECT "orders"."produk_id",
            "count"(*) AS "total_orders",
            "sum"("orders"."jumlah") AS "total_quantity_sold",
            "sum"("orders"."total_harga") AS "total_revenue"
           FROM "public"."orders"
          WHERE ("orders"."status" <> 'cancelled'::"public"."order_status")
          GROUP BY "orders"."produk_id") "o" ON (("p"."id" = "o"."produk_id")))
  ORDER BY "o"."total_revenue" DESC NULLS LAST;


ALTER VIEW "public"."admin_product_analytics" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."admin_system_overview" WITH ("security_barrier"='true') AS
 SELECT ( SELECT "count"(*) AS "count"
           FROM "public"."users"
          WHERE ("users"."role" = 'admin'::"public"."user_role")) AS "total_admins",
    ( SELECT "count"(*) AS "count"
           FROM "public"."users"
          WHERE ("users"."role" = 'nelayan'::"public"."user_role")) AS "total_nelayan",
    ( SELECT "count"(*) AS "count"
           FROM "public"."users"
          WHERE ("users"."role" = 'customer_guest'::"public"."user_role")) AS "total_customers",
    ( SELECT "count"(*) AS "count"
           FROM "public"."products") AS "total_products",
    ( SELECT "count"(*) AS "count"
           FROM "public"."products"
          WHERE ("products"."status" = 'active'::"public"."product_status")) AS "active_products",
    ( SELECT "count"(*) AS "count"
           FROM "public"."products"
          WHERE ("products"."stok" = 0)) AS "out_of_stock_products",
    ( SELECT "count"(*) AS "count"
           FROM "public"."orders") AS "total_orders",
    ( SELECT "count"(*) AS "count"
           FROM "public"."orders"
          WHERE ("orders"."status" = 'pending'::"public"."order_status")) AS "pending_orders",
    ( SELECT "count"(*) AS "count"
           FROM "public"."orders"
          WHERE ("orders"."created_at" >= CURRENT_DATE)) AS "orders_today",
    ( SELECT "count"(*) AS "count"
           FROM "public"."transactions") AS "total_transactions",
    ( SELECT COALESCE("sum"("transactions"."total_harga"), (0)::numeric) AS "coalesce"
           FROM "public"."transactions"
          WHERE ("transactions"."status" = 'success'::"public"."transaction_status")) AS "total_revenue",
    ( SELECT "count"(*) AS "count"
           FROM "public"."transactions"
          WHERE ("transactions"."status" = 'pending'::"public"."transaction_status")) AS "pending_transactions",
    ( SELECT "count"(*) AS "count"
           FROM "public"."pending_nelayan"
          WHERE ("pending_nelayan"."status" = 'pending'::"public"."pending_status")) AS "pending_applications",
    ( SELECT "count"(*) AS "count"
           FROM "public"."orders"
          WHERE ("orders"."created_at" >= ("now"() - '24:00:00'::interval))) AS "orders_last_24h",
    ( SELECT "count"(*) AS "count"
           FROM "public"."products"
          WHERE ("products"."created_at" >= ("now"() - '7 days'::interval))) AS "new_products_last_week";


ALTER VIEW "public"."admin_system_overview" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."admin_system_summary" AS
 SELECT "count"(DISTINCT "u"."id") AS "total_nelayan",
    "count"(DISTINCT "p"."id") AS "total_products",
    "count"(DISTINCT "o"."id") AS "total_orders",
    "count"(DISTINCT "t"."id") AS "total_transactions",
    COALESCE("sum"(
        CASE
            WHEN ("t"."status" = 'success'::"public"."transaction_status") THEN "t"."total_harga"
            ELSE (0)::numeric
        END), (0)::numeric) AS "total_system_revenue",
    COALESCE("sum"(
        CASE
            WHEN ("t"."status" = 'pending'::"public"."transaction_status") THEN "t"."total_harga"
            ELSE (0)::numeric
        END), (0)::numeric) AS "pending_system_revenue",
    "count"(DISTINCT
        CASE
            WHEN ("date"("o"."created_at") = CURRENT_DATE) THEN "o"."id"
            ELSE NULL::"uuid"
        END) AS "today_orders",
    COALESCE("sum"(
        CASE
            WHEN (("date"("t"."created_at") = CURRENT_DATE) AND ("t"."status" = 'success'::"public"."transaction_status")) THEN "t"."total_harga"
            ELSE (0)::numeric
        END), (0)::numeric) AS "today_revenue",
    "count"(DISTINCT
        CASE
            WHEN ("date_trunc"('month'::"text", "o"."created_at") = "date_trunc"('month'::"text", (CURRENT_DATE)::timestamp with time zone)) THEN "o"."id"
            ELSE NULL::"uuid"
        END) AS "this_month_orders",
    COALESCE("sum"(
        CASE
            WHEN (("date_trunc"('month'::"text", "t"."created_at") = "date_trunc"('month'::"text", (CURRENT_DATE)::timestamp with time zone)) AND ("t"."status" = 'success'::"public"."transaction_status")) THEN "t"."total_harga"
            ELSE (0)::numeric
        END), (0)::numeric) AS "this_month_revenue",
    "count"(DISTINCT
        CASE
            WHEN ("p"."status" = 'active'::"public"."product_status") THEN "p"."id"
            ELSE NULL::"uuid"
        END) AS "active_products",
    "count"(DISTINCT
        CASE
            WHEN ("u"."status" = 'active'::"public"."user_status") THEN "u"."id"
            ELSE NULL::"uuid"
        END) AS "active_nelayan",
    COALESCE("sum"(
        CASE
            WHEN ("p"."status" = 'active'::"public"."product_status") THEN "p"."stok"
            ELSE 0
        END), (0)::bigint) AS "total_available_stock_kg"
   FROM ((("public"."users" "u"
     LEFT JOIN "public"."products" "p" ON (("u"."id" = "p"."nelayan_id")))
     LEFT JOIN "public"."orders" "o" ON (("p"."id" = "o"."produk_id")))
     LEFT JOIN "public"."transactions" "t" ON (("o"."id" = "t"."order_id")))
  WHERE ("u"."role" = 'nelayan'::"public"."user_role");


ALTER VIEW "public"."admin_system_summary" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."admin_transaction_summary" AS
 SELECT "t"."id",
    "t"."order_id",
    COALESCE("u"."full_name", 'Deleted User'::"text") AS "nelayan_name",
    COALESCE("u"."email", 'N/A'::"text") AS "nelayan_email",
    "t"."total_harga",
    "t"."metode_pembayaran",
    "t"."status",
    "t"."created_at",
    "t"."updated_at",
        CASE
            WHEN ("t"."nelayan_id" IS NULL) THEN 'User Deleted'::"text"
            ELSE 'Active'::"text"
        END AS "nelayan_status"
   FROM ("public"."transactions" "t"
     LEFT JOIN "public"."users" "u" ON (("t"."nelayan_id" = "u"."id")))
  ORDER BY "t"."created_at" DESC;


ALTER VIEW "public"."admin_transaction_summary" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."profiles" AS
 SELECT "u"."id",
    "u"."id" AS "user_id",
    COALESCE("u"."full_name", "u"."nama_lengkap", "pn"."nama") AS "full_name",
    "u"."email",
    COALESCE("u"."phone", "pn"."nomor_telpon") AS "phone",
    COALESCE("u"."address", "pn"."alamat") AS "location",
    NULL::"text" AS "bio",
    NULL::"text" AS "avatar_url",
        CASE
            WHEN ("u"."role" = 'nelayan'::"public"."user_role") THEN 'approved'::"text"
            WHEN ("pn"."status" IS NOT NULL) THEN ("pn"."status")::"text"
            ELSE 'pending'::"text"
        END AS "approval_status",
    "pn"."reviewed_at" AS "approved_at",
    "pn"."reviewed_by" AS "approved_by",
    "pn"."admin_notes" AS "rejection_reason",
    COALESCE("pn"."created_at", "u"."created_at") AS "created_at",
    GREATEST(COALESCE("pn"."updated_at", "u"."updated_at"), "u"."updated_at") AS "updated_at",
        CASE
            WHEN (("u"."role" = 'nelayan'::"public"."user_role") OR ("pn"."user_id" IS NOT NULL)) THEN 'fisherman'::"text"
            ELSE 'customer'::"text"
        END AS "user_type"
   FROM ("public"."users" "u"
     LEFT JOIN "public"."pending_nelayan" "pn" ON (("u"."id" = "pn"."user_id")))
  WHERE (("u"."role" = ANY (ARRAY['nelayan'::"public"."user_role", 'customer_guest'::"public"."user_role"])) OR ("pn"."user_id" IS NOT NULL));


ALTER VIEW "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."website_settings" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "setting_key" "text" NOT NULL,
    "setting_value" "text" NOT NULL,
    "setting_type" "text" DEFAULT 'string'::"text",
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."website_settings" OWNER TO "postgres";


COMMENT ON TABLE "public"."website_settings" IS 'Dynamic website configuration settings';



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pending_nelayan"
    ADD CONSTRAINT "pending_nelayan_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "unique_order_transaction" UNIQUE ("order_id");



ALTER TABLE ONLY "public"."pending_nelayan"
    ADD CONSTRAINT "unique_pending_application" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."website_settings"
    ADD CONSTRAINT "website_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."website_settings"
    ADD CONSTRAINT "website_settings_setting_key_key" UNIQUE ("setting_key");



CREATE INDEX "idx_orders_created_at" ON "public"."orders" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_orders_customer_telpon" ON "public"."orders" USING "btree" ("customer_telpon");



CREATE INDEX "idx_orders_produk_id" ON "public"."orders" USING "btree" ("produk_id");



CREATE INDEX "idx_orders_status" ON "public"."orders" USING "btree" ("status");



CREATE INDEX "idx_pending_nelayan_status" ON "public"."pending_nelayan" USING "btree" ("status");



CREATE INDEX "idx_pending_nelayan_user_id" ON "public"."pending_nelayan" USING "btree" ("user_id");



CREATE INDEX "idx_products_created_at" ON "public"."products" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_products_kategori" ON "public"."products" USING "btree" ("kategori");



CREATE INDEX "idx_products_nelayan_id" ON "public"."products" USING "btree" ("nelayan_id");



CREATE INDEX "idx_products_status" ON "public"."products" USING "btree" ("status");



CREATE INDEX "idx_transactions_created_at" ON "public"."transactions" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_transactions_nelayan_id" ON "public"."transactions" USING "btree" ("nelayan_id");



CREATE INDEX "idx_transactions_order_id" ON "public"."transactions" USING "btree" ("order_id");



CREATE INDEX "idx_transactions_status" ON "public"."transactions" USING "btree" ("status");



CREATE INDEX "idx_users_email" ON "public"."users" USING "btree" ("email");



CREATE INDEX "idx_users_role" ON "public"."users" USING "btree" ("role");



CREATE INDEX "idx_users_status" ON "public"."users" USING "btree" ("status");



CREATE INDEX "idx_website_settings_key" ON "public"."website_settings" USING "btree" ("setting_key");



CREATE OR REPLACE TRIGGER "create_transaction_on_order" AFTER INSERT ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."create_transaction_for_order"();



CREATE OR REPLACE TRIGGER "reduce_stock_on_order" AFTER INSERT ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."reduce_product_stock"();



CREATE OR REPLACE TRIGGER "restore_stock_on_cancel" AFTER UPDATE ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."restore_product_stock"();



CREATE OR REPLACE TRIGGER "trigger_create_transaction_from_order" AFTER INSERT ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."create_transaction_from_order"();



CREATE OR REPLACE TRIGGER "trigger_reduce_stock_on_order" AFTER INSERT ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."reduce_product_stock"();



CREATE OR REPLACE TRIGGER "trigger_restore_stock_on_cancel" AFTER UPDATE ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."restore_product_stock"();



CREATE OR REPLACE TRIGGER "trigger_update_website_settings_updated_at" BEFORE UPDATE ON "public"."website_settings" FOR EACH ROW EXECUTE FUNCTION "public"."update_website_settings_updated_at"();



CREATE OR REPLACE TRIGGER "update_orders_updated_at" BEFORE UPDATE ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_pending_nelayan_updated_at" BEFORE UPDATE ON "public"."pending_nelayan" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_products_updated_at" BEFORE UPDATE ON "public"."products" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_transactions_updated_at" BEFORE UPDATE ON "public"."transactions" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_users_updated_at" BEFORE UPDATE ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "fk_products_nelayan" FOREIGN KEY ("nelayan_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "fk_transactions_nelayan" FOREIGN KEY ("nelayan_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_produk_id_fkey" FOREIGN KEY ("produk_id") REFERENCES "public"."products"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."pending_nelayan"
    ADD CONSTRAINT "pending_nelayan_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."pending_nelayan"
    ADD CONSTRAINT "pending_nelayan_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_nelayan_id_fkey" FOREIGN KEY ("nelayan_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_nelayan_id_fkey" FOREIGN KEY ("nelayan_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Nelayan can view own transactions" ON "public"."transactions" FOR SELECT USING ((("nelayan_id" = "auth"."uid"()) AND ("nelayan_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'nelayan'::"public"."user_role"))))));



CREATE POLICY "allow_all_orders" ON "public"."orders" USING (true) WITH CHECK (true);



CREATE POLICY "allow_all_pending_nelayan" ON "public"."pending_nelayan" USING (true) WITH CHECK (true);



CREATE POLICY "allow_all_products" ON "public"."products" USING (true) WITH CHECK (true);



CREATE POLICY "allow_all_transactions" ON "public"."transactions" USING (true) WITH CHECK (true);



CREATE POLICY "allow_all_users" ON "public"."users" USING (true) WITH CHECK (true);



CREATE POLICY "allow_all_website_settings" ON "public"."website_settings" USING (true) WITH CHECK (true);



ALTER TABLE "public"."orders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pending_nelayan" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."products" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."transactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."website_settings" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































GRANT ALL ON FUNCTION "public"."admin_delete_user_with_audit"("target_user_id" "uuid", "admin_user_id" "uuid", "deletion_reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."admin_delete_user_with_audit"("target_user_id" "uuid", "admin_user_id" "uuid", "deletion_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_delete_user_with_audit"("target_user_id" "uuid", "admin_user_id" "uuid", "deletion_reason" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."approve_nelayan_application"("application_id" "uuid", "admin_user_id" "uuid", "notes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."approve_nelayan_application"("application_id" "uuid", "admin_user_id" "uuid", "notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."approve_nelayan_application"("application_id" "uuid", "admin_user_id" "uuid", "notes" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_access_nelayan_data"("user_id" "uuid", "target_nelayan_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_access_nelayan_data"("user_id" "uuid", "target_nelayan_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_access_nelayan_data"("user_id" "uuid", "target_nelayan_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_transaction_for_order"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_transaction_for_order"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_transaction_for_order"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_transaction_from_order"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_transaction_from_order"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_transaction_from_order"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_user_profile"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_user_profile"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_user_profile"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_current_user_role"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_current_user_role"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_current_user_role"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_nelayan_stats"("nelayan_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_nelayan_stats"("nelayan_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_nelayan_stats"("nelayan_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_role"("_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_role"("_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_role"("_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_nelayan"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_nelayan"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_nelayan"() TO "service_role";



GRANT ALL ON FUNCTION "public"."reduce_product_stock"() TO "anon";
GRANT ALL ON FUNCTION "public"."reduce_product_stock"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."reduce_product_stock"() TO "service_role";



GRANT ALL ON FUNCTION "public"."reject_nelayan_application"("application_id" "uuid", "admin_user_id" "uuid", "notes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."reject_nelayan_application"("application_id" "uuid", "admin_user_id" "uuid", "notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reject_nelayan_application"("application_id" "uuid", "admin_user_id" "uuid", "notes" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."restore_product_stock"() TO "anon";
GRANT ALL ON FUNCTION "public"."restore_product_stock"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."restore_product_stock"() TO "service_role";



GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_product_stock_admin"("product_id" "uuid", "new_stock" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."update_product_stock_admin"("product_id" "uuid", "new_stock" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_product_stock_admin"("product_id" "uuid", "new_stock" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_user_approval_status"("target_user_id" "uuid", "new_status" "text", "reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."update_user_approval_status"("target_user_id" "uuid", "new_status" "text", "reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_user_approval_status"("target_user_id" "uuid", "new_status" "text", "reason" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_website_settings_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_website_settings_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_website_settings_updated_at"() TO "service_role";


















GRANT ALL ON TABLE "public"."orders" TO "anon";
GRANT ALL ON TABLE "public"."orders" TO "authenticated";
GRANT ALL ON TABLE "public"."orders" TO "service_role";



GRANT ALL ON TABLE "public"."admin_customer_analytics" TO "anon";
GRANT ALL ON TABLE "public"."admin_customer_analytics" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_customer_analytics" TO "service_role";



GRANT ALL ON TABLE "public"."transactions" TO "anon";
GRANT ALL ON TABLE "public"."transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."transactions" TO "service_role";



GRANT ALL ON TABLE "public"."admin_daily_transactions" TO "anon";
GRANT ALL ON TABLE "public"."admin_daily_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_daily_transactions" TO "service_role";



GRANT ALL ON TABLE "public"."admin_monthly_revenue" TO "anon";
GRANT ALL ON TABLE "public"."admin_monthly_revenue" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_monthly_revenue" TO "service_role";



GRANT ALL ON TABLE "public"."products" TO "anon";
GRANT ALL ON TABLE "public"."products" TO "authenticated";
GRANT ALL ON TABLE "public"."products" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";



GRANT ALL ON TABLE "public"."admin_nelayan_monthly_report" TO "anon";
GRANT ALL ON TABLE "public"."admin_nelayan_monthly_report" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_nelayan_monthly_report" TO "service_role";



GRANT ALL ON TABLE "public"."admin_nelayan_performance" TO "anon";
GRANT ALL ON TABLE "public"."admin_nelayan_performance" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_nelayan_performance" TO "service_role";



GRANT ALL ON TABLE "public"."admin_nelayan_top_products" TO "anon";
GRANT ALL ON TABLE "public"."admin_nelayan_top_products" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_nelayan_top_products" TO "service_role";



GRANT ALL ON TABLE "public"."admin_nelayan_transaction_report" TO "anon";
GRANT ALL ON TABLE "public"."admin_nelayan_transaction_report" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_nelayan_transaction_report" TO "service_role";



GRANT ALL ON TABLE "public"."pending_nelayan" TO "anon";
GRANT ALL ON TABLE "public"."pending_nelayan" TO "authenticated";
GRANT ALL ON TABLE "public"."pending_nelayan" TO "service_role";



GRANT ALL ON TABLE "public"."admin_pending_applications" TO "anon";
GRANT ALL ON TABLE "public"."admin_pending_applications" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_pending_applications" TO "service_role";



GRANT ALL ON TABLE "public"."admin_product_analytics" TO "anon";
GRANT ALL ON TABLE "public"."admin_product_analytics" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_product_analytics" TO "service_role";



GRANT ALL ON TABLE "public"."admin_system_overview" TO "anon";
GRANT ALL ON TABLE "public"."admin_system_overview" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_system_overview" TO "service_role";



GRANT ALL ON TABLE "public"."admin_system_summary" TO "anon";
GRANT ALL ON TABLE "public"."admin_system_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_system_summary" TO "service_role";



GRANT ALL ON TABLE "public"."admin_transaction_summary" TO "anon";
GRANT ALL ON TABLE "public"."admin_transaction_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_transaction_summary" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."website_settings" TO "anon";
GRANT ALL ON TABLE "public"."website_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."website_settings" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";



































