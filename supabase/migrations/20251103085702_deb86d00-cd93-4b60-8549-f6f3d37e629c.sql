-- Ensure signup trigger exists to create profiles on new users
DO $$ BEGIN
  -- Create trigger only if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created_profiles'
  ) THEN
    CREATE TRIGGER on_auth_user_created_profiles
      AFTER INSERT ON auth.users
      FOR EACH ROW
      EXECUTE FUNCTION public.handle_new_user();
  END IF;
END $$;