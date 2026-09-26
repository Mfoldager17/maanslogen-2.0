#!/bin/bash
# Kører når LocalStack er klar. Opretter de to buckets og gør dem offentligt
# læsbare, så billed-URL'er virker uden signatur — ligesom et R2-bucket med et
# offentligt domæne foran.
set -e

for bucket in maanslogen-dev maanslogen-test; do
  awslocal s3api create-bucket --bucket "$bucket" >/dev/null 2>&1 || true
  awslocal s3api put-bucket-policy --bucket "$bucket" --policy "{
    \"Version\": \"2012-10-17\",
    \"Statement\": [{
      \"Effect\": \"Allow\",
      \"Principal\": \"*\",
      \"Action\": \"s3:GetObject\",
      \"Resource\": \"arn:aws:s3:::$bucket/*\"
    }]
  }" >/dev/null

  # Browseren uploader direkte til den presignede URL, så CORS skal tillade
  # PUT fra det lokale web.
  awslocal s3api put-bucket-cors --bucket "$bucket" --cors-configuration '{
    "CORSRules": [{
      "AllowedOrigins": ["http://localhost:3000"],
      "AllowedMethods": ["GET", "PUT", "HEAD"],
      "AllowedHeaders": ["*"],
      "ExposeHeaders": ["ETag"]
    }]
  }' >/dev/null
done

echo "Buckets klar: maanslogen-dev, maanslogen-test"
