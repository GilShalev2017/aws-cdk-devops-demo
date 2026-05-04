#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { StorageStack } from '../stacks/storage-stack';
import { LambdaStack } from '../stacks/lambda-stack';
import { ApiStack } from '../stacks/api-stack';
import { FrontendStack } from '../stacks/frontend-stack';

const app = new cdk.App();

// ─── Environment ───────────────────────────────────────────────────────────
const env: cdk.Environment = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region:  'eu-central-1',//process.env.CDK_DEFAULT_REGION ?? 'us-east-1',
};

const appName = 'CdkDemo';

// ─── Stack 1: Storage (DynamoDB tables + S3 buckets) ──────────────────────
const storageStack = new StorageStack(app, `${appName}Storage`, {
  env,
  description: 'DynamoDB tables and S3 buckets for the demo app',
});

// ─── Stack 2: Lambda functions (microservices) ────────────────────────────
const lambdaStack = new LambdaStack(app, `${appName}Lambda`, {
  env,
  description: 'Lambda microservices for Products, Orders, and Users',
  productsTable: storageStack.productsTable,
  ordersTable:   storageStack.ordersTable,
  usersTable:    storageStack.usersTable,
  assetsBucket:  storageStack.assetsBucket,
});
lambdaStack.addDependency(storageStack);

// ─── Stack 3: API Gateway (REST API wiring lambdas) ───────────────────────
const apiStack = new ApiStack(app, `${appName}Api`, {
  env,
  description: 'API Gateway REST API connecting to Lambda microservices',
  productsFn: lambdaStack.productsFn,
  ordersFn:   lambdaStack.ordersFn,
  usersFn:    lambdaStack.usersFn,
});
apiStack.addDependency(lambdaStack);

// ─── Stack 4: Frontend (S3 + CloudFront for React app) ────────────────────
const frontendStack = new FrontendStack(app, `${appName}Frontend`, {
  env,
  description: 'S3 + CloudFront distribution serving the React SPA',
  apiUrl: apiStack.apiUrl,
});
frontendStack.addDependency(apiStack);

cdk.Tags.of(app).add('Project',     'CdkDemo');
cdk.Tags.of(app).add('ManagedBy',   'CDK');
cdk.Tags.of(app).add('Environment', 'demo');
