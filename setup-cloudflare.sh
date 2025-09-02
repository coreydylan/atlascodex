#!/bin/bash

# Cloudflare configuration for atlascivica.com
# You'll need to set these environment variables:
# export CLOUDFLARE_API_TOKEN="your-api-token"
# export CLOUDFLARE_ZONE_ID="your-zone-id"

# Our AWS ALB endpoint
ALB_ENDPOINT="atlas-codex-alb-1301358987.us-west-2.elb.amazonaws.com"

# Create CNAME record for api.atlascivica.com
echo "Creating CNAME record for api.atlascivica.com..."
curl -X POST "https://api.cloudflare.com/client/v4/zones/$CLOUDFLARE_ZONE_ID/dns_records" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{
    "type": "CNAME",
    "name": "api",
    "content": "'$ALB_ENDPOINT'",
    "ttl": 1,
    "proxied": true,
    "comment": "Atlas Codex API endpoint"
  }'

echo ""
echo "DNS record created! Your API will be available at:"
echo "https://api.atlascivica.com"
echo ""
echo "Cloudflare will handle SSL/TLS automatically with proxied=true"