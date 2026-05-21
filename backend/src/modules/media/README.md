# Media Uploads

Images are uploaded directly from the app to S3 with short-lived signed `PUT` URLs.

Flow:

1. App calls `POST /api/media/upload-url`.
2. Backend validates ownership and returns `uploadUrl`, `objectKey`, and `publicUrl`.
3. App uploads the image bytes directly to S3 using `PUT`.
4. App calls `POST /api/media/confirm`.
5. Backend stores the public URL on the target entity.

Targets:

- `business-logo`, requires `targetId` with a business owned by the user.
- `product-image`, requires `targetId` with a product from a business owned by the user.

Required environment variables:

- `AWS_REGION`
- `AWS_S3_BUCKET`
- `AWS_S3_PUBLIC_BASE_URL`, optional but recommended for CloudFront later.
- AWS credentials through the default SDK chain, such as `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` locally, or an IAM role in production.

The bucket should allow public reads only for the `media/*` prefix or be served through CloudFront. Writes should stay private and go only through signed URLs.
