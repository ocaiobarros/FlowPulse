
-- Create storage bucket for field technician photo attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('flowmap-attachments', 'flowmap-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to their own folder
CREATE POLICY "Users can upload flowmap attachments"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'flowmap-attachments'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow public read access
CREATE POLICY "Flowmap attachments are publicly readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'flowmap-attachments');

-- Allow users to delete their own uploads
CREATE POLICY "Users can delete own flowmap attachments"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'flowmap-attachments'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
