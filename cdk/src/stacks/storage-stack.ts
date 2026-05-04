import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

/**
 * StorageStack
 * ─────────────────────────────────────────────────────────────────────────
 * Provisions:
 *  • 3 DynamoDB tables  : products, orders, users
 *  • 1 S3 bucket        : assets (product images, uploads)
 */
export class StorageStack extends cdk.Stack {
  // Expose tables & bucket so dependent stacks can reference them
  public readonly productsTable: dynamodb.Table;
  public readonly ordersTable:   dynamodb.Table;
  public readonly usersTable:    dynamodb.Table;
  public readonly assetsBucket:  s3.Bucket;

  constructor(scope: Construct, id: string, props: cdk.StackProps) {
    super(scope, id, props);

    // ── Products Table ────────────────────────────────────────────────────
    this.productsTable = new dynamodb.Table(this, 'ProductsTable', {
      tableName:    'demo-products',
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode:  dynamodb.BillingMode.PAY_PER_REQUEST, // on-demand = no cost when idle
      removalPolicy: cdk.RemovalPolicy.DESTROY,           // easy cleanup for demo
      pointInTimeRecovery: false,
    });

    // GSI: query by category
    this.productsTable.addGlobalSecondaryIndex({
      indexName:    'CategoryIndex',
      partitionKey: { name: 'category', type: dynamodb.AttributeType.STRING },
      sortKey:      { name: 'createdAt', type: dynamodb.AttributeType.STRING },
    });

    // ── Orders Table ──────────────────────────────────────────────────────
    this.ordersTable = new dynamodb.Table(this, 'OrdersTable', {
      tableName:    'demo-orders',
      partitionKey: { name: 'id',     type: dynamodb.AttributeType.STRING },
      sortKey:      { name: 'userId', type: dynamodb.AttributeType.STRING },
      billingMode:  dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // GSI: query all orders for a user
    this.ordersTable.addGlobalSecondaryIndex({
      indexName:    'UserOrdersIndex',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey:      { name: 'createdAt', type: dynamodb.AttributeType.STRING },
    });

    // ── Users Table ───────────────────────────────────────────────────────
    this.usersTable = new dynamodb.Table(this, 'UsersTable', {
      tableName:    'demo-users',
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode:  dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // GSI: look up user by email
    this.usersTable.addGlobalSecondaryIndex({
      indexName:    'EmailIndex',
      partitionKey: { name: 'email', type: dynamodb.AttributeType.STRING },
    });

    // ── Assets Bucket ─────────────────────────────────────────────────────
    this.assetsBucket = new s3.Bucket(this, 'AssetsBucket', {
      bucketName:          `demo-assets-${this.account}-${this.region}`,
      versioned:           false,
      removalPolicy:       cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects:   true,
      cors: [
        {
          allowedOrigins: ['*'],  // tighten in production
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.PUT, s3.HttpMethods.POST],
          allowedHeaders: ['*'],
          maxAge: 3000,
        },
      ],
      lifecycleRules: [
        {
          id:         'expire-temp-uploads',
          prefix:     'tmp/',
          expiration: cdk.Duration.days(1),
        },
      ],
    });

    // ── Outputs ───────────────────────────────────────────────────────────
    new cdk.CfnOutput(this, 'ProductsTableName', { value: this.productsTable.tableName });
    new cdk.CfnOutput(this, 'OrdersTableName',   { value: this.ordersTable.tableName });
    new cdk.CfnOutput(this, 'UsersTableName',    { value: this.usersTable.tableName });
    new cdk.CfnOutput(this, 'AssetsBucketName',  { value: this.assetsBucket.bucketName });
  }
}
