import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

interface ApiStackProps extends cdk.StackProps {
  productsFn: lambda.Function;
  ordersFn:   lambda.Function;
  usersFn:    lambda.Function;
}

export class ApiStack extends cdk.Stack {
  public readonly apiUrl: string;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const { productsFn, ordersFn, usersFn } = props;

    // ── Create CloudWatch role for API Gateway (required by AWS account settings) ──
    const apiGatewayCloudWatchRole = new iam.Role(this, 'ApiGatewayCloudWatchRole', {
      assumedBy: new iam.ServicePrincipal('apigateway.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonAPIGatewayPushToCloudWatchLogs'),
      ],
    });

    // Set the CloudWatch role on the account-level API Gateway settings
    const cfnAccount = new apigateway.CfnAccount(this, 'ApiGatewayAccount', {
      cloudWatchRoleArn: apiGatewayCloudWatchRole.roleArn,
    });

    // ── REST API ──────────────────────────────────────────────────────────
    const api = new apigateway.RestApi(this, 'DemoApi', {
      restApiName:  'demo-api',
      description:  'Demo REST API for CDK microservices tutorial',
      deployOptions: {
        stageName:            'v1',
        throttlingRateLimit:  100,
        throttlingBurstLimit: 200,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization', 'X-Api-Key'],
      },
    });

    // Ensure account settings are applied before the API stage is created
    api.node.addDependency(cfnAccount);

    // ── Lambda integrations ───────────────────────────────────────────────
    const productsIntegration = new apigateway.LambdaIntegration(productsFn, {
      requestTemplates: { 'application/json': '{ "statusCode": "200" }' },
    });
    const ordersIntegration = new apigateway.LambdaIntegration(ordersFn);
    const usersIntegration  = new apigateway.LambdaIntegration(usersFn);

    // ── /api root ─────────────────────────────────────────────────────────
    const apiRoot = api.root.addResource('api');

    // ── /api/products ─────────────────────────────────────────────────────
    const products  = apiRoot.addResource('products');
    const productId = products.addResource('{id}');
    const uploadUrl = productId.addResource('upload-url');

    products.addMethod('GET',    productsIntegration);
    products.addMethod('POST',   productsIntegration);
    productId.addMethod('GET',   productsIntegration);
    productId.addMethod('PUT',   productsIntegration);
    productId.addMethod('DELETE',productsIntegration);
    uploadUrl.addMethod('GET',   productsIntegration);

    // ── /api/orders ───────────────────────────────────────────────────────
    const orders  = apiRoot.addResource('orders');
    const orderId = orders.addResource('{id}');

    orders.addMethod('GET',    ordersIntegration);
    orders.addMethod('POST',   ordersIntegration);
    orderId.addMethod('GET',   ordersIntegration);
    orderId.addMethod('PUT',   ordersIntegration);
    orderId.addMethod('DELETE',ordersIntegration);

    // ── /api/users ────────────────────────────────────────────────────────
    const users  = apiRoot.addResource('users');
    const userId = users.addResource('{id}');

    users.addMethod('GET',    usersIntegration);
    users.addMethod('POST',   usersIntegration);
    userId.addMethod('GET',   usersIntegration);
    userId.addMethod('PUT',   usersIntegration);
    userId.addMethod('DELETE',usersIntegration);

    this.apiUrl = api.url;

    // ── Outputs ───────────────────────────────────────────────────────────
    new cdk.CfnOutput(this, 'ApiUrl',      { value: api.url,       exportName: 'DemoApiUrl' });
    new cdk.CfnOutput(this, 'ApiId',       { value: api.restApiId, exportName: 'DemoApiId'  });
    new cdk.CfnOutput(this, 'ProductsUrl', { value: `${api.url}api/products` });
    new cdk.CfnOutput(this, 'OrdersUrl',   { value: `${api.url}api/orders`   });
    new cdk.CfnOutput(this, 'UsersUrl',    { value: `${api.url}api/users`    });
  }
}