-- Create storage bucket for fish photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'fish-photos',
  'fish-photos',
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
) ON CONFLICT (id) DO NOTHING;

-- Create storage policies for fish-photos bucket
-- Allow authenticated users to upload their own files
CREATE POLICY "Users can upload their own fish photos" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'fish-photos' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Allow authenticated users to view all fish photos (public access)
CREATE POLICY "Anyone can view fish photos" ON storage.objects
  FOR SELECT USING (bucket_id = 'fish-photos');

-- Allow users to update their own fish photos
CREATE POLICY "Users can update their own fish photos" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'fish-photos' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Allow users to delete their own fish photos
CREATE POLICY "Users can delete their own fish photos" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'fish-photos' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );