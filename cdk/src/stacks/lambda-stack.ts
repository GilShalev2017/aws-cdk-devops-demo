import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import * as path from 'path';

interface LambdaStackProps extends cdk.StackProps {
  productsTable: dynamodb.Table;
  ordersTable:   dynamodb.Table;
  usersTable:    dynamodb.Table;
  assetsBucket:  s3.Bucket;
}

export class LambdaStack extends cdk.Stack {
  public readonly productsFn: lambda.Function;
  public readonly ordersFn:   lambda.Function;
  public readonly usersFn:    lambda.Function;

  constructor(scope: Construct, id: string, props: LambdaStackProps) {
    super(scope, id, props);

    const { productsTable, ordersTable, usersTable, assetsBucket } = props;

    const commonLambdaProps: lambda.FunctionProps = {
      runtime:      lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize:   256,
      timeout:      cdk.Duration.seconds(15),
      logRetention: logs.RetentionDays.ONE_WEEK,
      code:         lambda.Code.fromAsset(''), // will be overridden per function
      handler:      'index.handler',
      environment: {
        NODE_ENV:            'production',
        PRODUCTS_TABLE_NAME: productsTable.tableName,
        ORDERS_TABLE_NAME:   ordersTable.tableName,
        USERS_TABLE_NAME:    usersTable.tableName,
        ASSETS_BUCKET_NAME:  assetsBucket.bucketName,
        AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1',
      },
    };

    // Products Lambda
    this.productsFn = new lambda.Function(this, 'ProductsFunction', {
      ...commonLambdaProps,
      functionName: 'demo-products-service',
      description:  'Products microservice',
      code:         lambda.Code.fromAsset(path.join(__dirname, '../../../lambdas/products')),
    });

    productsTable.grantReadWriteData(this.productsFn);
    assetsBucket.grantReadWrite(this.productsFn);

    // Orders Lambda
    this.ordersFn = new lambda.Function(this, 'OrdersFunction', {
      ...commonLambdaProps,
      functionName: 'demo-orders-service',
      description:  'Orders microservice',
      code:         lambda.Code.fromAsset(path.join(__dirname, '../../../lambdas/orders')),
    });

    ordersTable.grantReadWriteData(this.ordersFn);
    productsTable.grantReadData(this.ordersFn);

    // Users Lambda
    this.usersFn = new lambda.Function(this, 'UsersFunction', {
      ...commonLambdaProps,
      functionName: 'demo-users-service',
      description:  'Users microservice',
      code:         lambda.Code.fromAsset(path.join(__dirname, '../../../lambdas/users')),
    });

    usersTable.grantReadWriteData(this.usersFn);

    // Outputs
    new cdk.CfnOutput(this, 'ProductsFunctionArn', { value: this.productsFn.functionArn });
    new cdk.CfnOutput(this, 'OrdersFunctionArn',   { value: this.ordersFn.functionArn });
    new cdk.CfnOutput(this, 'UsersFunctionArn',    { value: this.usersFn.functionArn });
  }
}