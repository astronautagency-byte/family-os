-- Apply after deploying and validating the authenticated photo reader.
update storage.buckets
set public = false
where id = 'grocery-photos';
