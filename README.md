# AWS CDK Demo — React + Serverless Microservices

A complete tutorial project showing how to build and deploy a **full-stack serverless application** using AWS CDK (TypeScript). Includes a React SPA, three Lambda microservices, DynamoDB tables, S3 storage, API Gateway, and CloudFront.

---

## Architecture Overview

```
                    ┌─────────────────────────────────────────────────┐
                    │              User's Browser                      │
                    └──────────────────┬──────────────────────────────┘
                                       │ HTTPS
                    ┌──────────────────▼──────────────────────────────┐
                    │           CloudFront Distribution                 │
                    │  (CDN — serves React SPA + proxies /api/*)       │
                    └──────┬───────────────────────────┬──────────────┘
                           │ /                         │ /api/*
          ┌────────────────▼──────┐    ┌───────────────▼──────────────┐
          │    S3 Hosting Bucket  │    │   API Gateway REST API (v1)   │
          │  (React build output) │    │  /api/products  /api/orders   │
          └───────────────────────┘    │  /api/users                   │
                                       └──────┬──────┬──────┬──────────┘
                                              │      │      │
                              ┌───────────────▼─┐  ┌▼──────▼──┐  ┌────▼──────────┐
                              │  Products Lambda │  │  Orders  │  │  Users Lambda │
                              │  (Node.js 20)   │  │  Lambda  │  │  (Node.js 20) │
                              └────┬────────────┘  └────┬─────┘  └───────┬───────┘
                                   │                     │                │
                    ┌──────────────▼──────────────────────▼────────────▼──────────┐
                    │                      DynamoDB (on-demand)                     │
                    │   demo-products   demo-orders    demo-users                   │
                    │   + CategoryIndex + UserOrdersIndex + EmailIndex (GSIs)       │
                    └──────────────────────────────────────────────────────────────┘
                                   │
                    ┌──────────────▼──────────────────────────────────────────────┐
                    │                   S3 Assets Bucket                           │
                    │   products/{id}/*.jpg   (product images via presigned URLs)   │
                    └──────────────────────────────────────────────────────────────┘
```

---

## Project Structure

```
aws-cdk-demo/
├── cdk/                         # Infrastructure as Code (TypeScript)
│   ├── cdk.json                 # CDK app config
│   ├── tsconfig.json
│   └── src/
│       ├── bin/
│       │   └── app.ts           # App entry point — defines all 4 stacks
│       └── stacks/
│           ├── storage-stack.ts # DynamoDB tables + S3 assets bucket
│           ├── lambda-stack.ts  # 3 Lambda microservices + IAM
│           ├── api-stack.ts     # API Gateway REST API routing
│           └── frontend-stack.ts# S3 hosting + CloudFront + deployment
│
├── lambdas/                     # Lambda microservice handlers (JavaScript)
│   ├── products/
│   │   ├── index.js             # CRUD + presigned S3 URL
│   │   └── package.json
│   ├── orders/
│   │   ├── index.js             # CRUD + product validation
│   │   └── package.json
│   └── users/
│       ├── index.js             # CRUD + email uniqueness check
│       └── package.json
│
└── frontend/                    # React SPA
    ├── public/index.html
    ├── .env.example
    └── src/
        ├── index.js             # App + router
        ├── index.css            # Global styles
        ├── api/
        │   └── client.js        # Typed API client (fetch wrapper)
        └── pages/
            ├── ProductsPage.js  # Product catalog with CRUD
            ├── OrdersPage.js    # Order management + status updates
            └── UsersPage.js     # User management
```

---

## CDK Stacks (Deployment Order)

| Stack | Resources | Depends On |
|-------|-----------|------------|
| `CdkDemoStorage` | 3 DynamoDB tables + S3 assets bucket | — |
| `CdkDemoLambda`  | 3 Lambda functions + IAM roles | Storage |
| `CdkDemoApi`     | API Gateway REST API | Lambda |
| `CdkDemoFrontend`| S3 hosting + CloudFront distribution | Api |

---

## Prerequisites

- **Node.js** 18+ and npm
- **AWS CLI** configured (`aws configure`)
- **AWS account** with permissions for CDK, Lambda, DynamoDB, S3, CloudFront, API Gateway

```bash
# Verify AWS identity
aws sts get-caller-identity
```

---

## Quick Start

### 1. Install dependencies

```bash
# Root (workspaces)
npm install

# CDK
cd cdk && npm install && cd ..

# Lambda dependencies (each is bundled separately)
cd lambdas/products && npm install && cd ../..
cd lambdas/orders   && npm install && cd ../..
cd lambdas/users    && npm install && cd ../..

# React frontend
cd frontend && npm install && cd ..
```

### 2. Bootstrap CDK (one-time per account/region)

```bash
cd cdk
npx cdk bootstrap
```

This creates the CDKToolkit CloudFormation stack (S3 bucket for assets, IAM roles).

### 3. Preview what will be deployed

```bash
cd cdk
npx cdk synth   # generate CloudFormation templates
npx cdk diff    # show what will change
```

### 4. Deploy storage + backend

```bash
cd cdk
npx cdk deploy CdkDemoStorage CdkDemoLambda CdkDemoApi --require-approval never
```

Note the `ApiUrl` output — you'll need it for local frontend development.

### 5. Build & deploy the frontend

```bash
# Set API URL for the React build
cd frontend
cp .env.example .env.local
# Edit .env.local — paste your ApiUrl from the previous step

npm run build   # outputs to frontend/build/

# Deploy to S3 + CloudFront
cd ../cdk
npx cdk deploy CdkDemoFrontend --require-approval never
```

### 6. Open the app

The `FrontendUrl` CloudFormation output gives you the CloudFront URL, e.g.:
```
https://d1abc123xyz.cloudfront.net
```

---

## Deploy All at Once (CI/CD)

```bash
# From repo root — builds frontend then deploys all stacks
npm run frontend:build
npm run deploy
```

---

## API Reference

Base URL: `https://<api-id>.execute-api.<region>.amazonaws.com/v1`

### Products
| Method | Path | Description |
|--------|------|-------------|
| GET    | `/api/products`              | List all (optional `?category=electronics`) |
| POST   | `/api/products`              | Create product |
| GET    | `/api/products/:id`          | Get one |
| PUT    | `/api/products/:id`          | Update |
| DELETE | `/api/products/:id`          | Delete |
| GET    | `/api/products/:id/upload-url` | Presigned S3 URL for image upload |

**Create product body:**
```json
{
  "name": "Wireless Headphones",
  "description": "Noise-cancelling, 30hr battery",
  "price": 149.99,
  "category": "electronics",
  "stock": 42
}
```

### Orders
| Method | Path | Description |
|--------|------|-------------|
| GET    | `/api/orders`     | List all (optional `?userId=<id>`) |
| POST   | `/api/orders`     | Create order |
| GET    | `/api/orders/:id` | Get one |
| PUT    | `/api/orders/:id` | Update status |
| DELETE | `/api/orders/:id` | Delete/cancel |

**Create order body:**
```json
{
  "userId": "user-uuid-here",
  "items": [
    { "productId": "product-uuid", "quantity": 2 }
  ],
  "address": { "street": "123 Main St", "city": "Tel Aviv" }
}
```

### Users
| Method | Path | Description |
|--------|------|-------------|
| GET    | `/api/users`     | List all (optional `?email=`) |
| POST   | `/api/users`     | Create user |
| GET    | `/api/users/:id` | Get one |
| PUT    | `/api/users/:id` | Update |
| DELETE | `/api/users/:id` | Delete |

---

## Local Development

### Backend (test Lambda locally)

```bash
# Install AWS SAM CLI for local Lambda invocation
brew install aws-sam-cli   # macOS

# Or invoke directly via AWS CLI (tests the deployed function)
aws lambda invoke \
  --function-name demo-products-service \
  --payload '{"httpMethod":"GET","path":"/api/products","pathParameters":null,"queryStringParameters":null}' \
  --cli-binary-format raw-in-base64-out \
  output.json && cat output.json
```

### Frontend

```bash
cd frontend
cp .env.example .env.local   # add your API Gateway URL
npm start                    # http://localhost:3000
```

### Seed test data

```bash
# Create a user
curl -X POST $API_URL/api/users \
  -H 'Content-Type: application/json' \
  -d '{"name":"Alice Smith","email":"alice@example.com"}'

# Create a product
curl -X POST $API_URL/api/products \
  -H 'Content-Type: application/json' \
  -d '{"name":"Laptop","price":999.99,"category":"electronics","stock":10}'

# Create an order (use real IDs from above)
curl -X POST $API_URL/api/orders \
  -H 'Content-Type: application/json' \
  -d '{"userId":"<user-id>","items":[{"productId":"<product-id>","quantity":1}]}'
```

---

## DynamoDB Schema

### demo-products
| Attribute | Type | Key |
|-----------|------|-----|
| id | String | PK |
| category | String | GSI PK (CategoryIndex) |
| createdAt | String | GSI SK |
| name, description, price, stock, imageKey | — | attributes |

### demo-orders
| Attribute | Type | Key |
|-----------|------|-----|
| id | String | PK |
| userId | String | SK + GSI PK (UserOrdersIndex) |
| createdAt | String | GSI SK |
| items, total, status, address | — | attributes |

### demo-users
| Attribute | Type | Key |
|-----------|------|-----|
| id | String | PK |
| email | String | GSI PK (EmailIndex) |
| name, role, address | — | attributes |

---

## Cost Estimate (demo / low-traffic)

| Service | Pricing model | Estimated cost |
|---------|--------------|----------------|
| Lambda | Per request + duration | < $0.01/day |
| DynamoDB | On-demand (pay per request) | < $0.01/day |
| API Gateway | Per request | < $0.01/day |
| S3 | Per GB + request | < $0.01/day |
| CloudFront | Free tier (1TB/month) | $0 for demo |
| **Total** | | **~$0 for demo usage** |

---

## Cleanup

```bash
cd cdk
npx cdk destroy --all --force
```

> **Note:** DynamoDB tables and S3 buckets use `RemovalPolicy.DESTROY` so they are deleted with the stack. Do **not** use this in production!

---

## Next Steps

To evolve this into a production system:

- 🔐 **Auth** — Add Amazon Cognito User Pools + JWT authorizers on API Gateway
- 📧 **Events** — Add SQS/SNS between order creation and fulfillment Lambda
- 🔍 **Search** — Add OpenSearch for product search
- 📊 **Monitoring** — Add CloudWatch dashboards, Lambda Powertools
- 🚀 **CI/CD** — Add AWS CodePipeline or GitHub Actions workflow
- 🔒 **Security** — Enable WAF on CloudFront, restrict CORS origins, enable DynamoDB encryption at rest
- 📦 **Bundling** — Use `NodejsFunction` construct with esbuild for tree-shaken Lambda bundles
- 🌍 **Custom domain** — Add Route 53 + ACM certificate to CloudFront
"# aws-cdk-devops-demo" 
