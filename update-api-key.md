# Update OpenAI API Key

To fix the extraction errors, you need to add your OpenAI API key:

## Option 1: Update via AWS Console
1. Go to ECS Console: https://console.aws.amazon.com/ecs
2. Click on "atlas-codex-cluster"
3. Click on "atlas-codex-worker-service"
4. Click "Update service"
5. Click "Create new revision"
6. Find the container definition
7. Update the OPENAI_API_KEY environment variable with your key
8. Save and deploy

## Option 2: Update via CLI
```bash
# Set your API key
export OPENAI_API_KEY="sk-your-actual-key-here"

# Register new task definition
aws ecs register-task-definition \
  --family atlas-codex-worker \
  --network-mode awsvpc \
  --requires-compatibilities FARGATE \
  --cpu 2048 \
  --memory 4096 \
  --execution-role-arn arn:aws:iam::790856971687:role/atlas-codex-ecs-TaskExecutionRole-yGbKsh4Ss65u \
  --task-role-arn arn:aws:iam::790856971687:role/atlas-codex-ecs-TaskRole-T9COUaYj4Eg5 \
  --container-definitions "[
    {
      \"name\": \"worker\",
      \"image\": \"790856971687.dkr.ecr.us-west-2.amazonaws.com/atlas-codex-worker:latest\",
      \"essential\": true,
      \"environment\": [
        {\"name\": \"NODE_ENV\", \"value\": \"production\"},
        {\"name\": \"QUEUE_URL\", \"value\": \"https://sqs.us-west-2.amazonaws.com/790856971687/atlas-codex-queue\"},
        {\"name\": \"AWS_REGION\", \"value\": \"us-west-2\"},
        {\"name\": \"OPENAI_API_KEY\", \"value\": \"$OPENAI_API_KEY\"}
      ],
      \"logConfiguration\": {
        \"logDriver\": \"awslogs\",
        \"options\": {
          \"awslogs-group\": \"/ecs/atlas-codex-worker\",
          \"awslogs-region\": \"us-west-2\",
          \"awslogs-stream-prefix\": \"worker\"
        }
      }
    }
  ]" \
  --region us-west-2

# Update service
aws ecs update-service \
  --cluster atlas-codex-cluster \
  --service atlas-codex-worker-service \
  --task-definition atlas-codex-worker:5 \
  --region us-west-2
```

## Get an OpenAI API Key
1. Go to: https://platform.openai.com/api-keys
2. Create a new API key
3. Copy the key (starts with "sk-")
4. Update the task definition as shown above
