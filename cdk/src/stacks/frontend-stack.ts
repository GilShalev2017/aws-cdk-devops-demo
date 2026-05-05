import * as cdk from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";
import * as path from "path";

interface FrontendStackProps extends cdk.StackProps {
  apiUrl: string;
}

export class FrontendStack extends cdk.Stack {
  public readonly distributionUrl: string;

  constructor(scope: Construct, id: string, props: FrontendStackProps) {
    super(scope, id, props);

    const { apiUrl } = props;

    // 1. Hosting Bucket
    const hostingBucket = new s3.Bucket(this, "HostingBucket", {
      bucketName: `demo-frontend-${this.account}-${this.region}`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    });

    // 2. Create the OAC (Origin Access Control)
    const oac = new cloudfront.CfnOriginAccessControl(this, "FrontendOAC", {
      originAccessControlConfig: {
        name: `demo-frontend-oac-${this.stackName}`,
        originAccessControlOriginType: "s3",
        signingBehavior: "always",
        signingProtocol: "sigv4",
      },
    });

    const apiDomain = cdk.Fn.select(2, cdk.Fn.split("/", apiUrl));

    // 3. Distribution
    const distribution = new cloudfront.Distribution(this, "Distribution", {
      comment: "CDK Demo React App",
      defaultRootObject: "index.html",
      defaultBehavior: {
        origin: new origins.S3Origin(hostingBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      // additionalBehaviors: {
      //   "/api/*": {
      //     origin: new origins.HttpOrigin(apiDomain, {
      //       protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
      //     }),
      //     viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
      //     allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
      //     cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
      //     // Prevents Host header forwarding which breaks API Gateway
      //     originRequestPolicy:
      //       cloudfront.OriginRequestPolicy.USER_AGENT_REFERER_HEADERS,
      //   },
      // },
      additionalBehaviors: {
        "/api/*": {
          // CHANGE 1: Use RestApiOrigin or ensure HttpOrigin has the correct originPath
          origin: new origins.HttpOrigin(apiDomain, {
            protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
            // CHANGE 2: This prepends the stage to every request forwarded to the API
            originPath: "/v1",
          }),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          // Note: ALL_VIEWER_EXCEPT_HOST_HEADER is safer if you encounter 403s
          originRequestPolicy:
            cloudfront.OriginRequestPolicy.USER_AGENT_REFERER_HEADERS,
        },
      },
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: "/index.html",
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: "/index.html",
        },
      ],
    });

    // 4. THE FIX: Force OAC and Remove OAI
    const cfnDist = distribution.node
      .defaultChild as cloudfront.CfnDistribution;

    // Explicitly remove the OAI created by the S3Origin construct
    cfnDist.addPropertyOverride(
      "DistributionConfig.Origins.0.S3OriginConfig.OriginAccessIdentity",
      "",
    );
    // Attach the OAC
    cfnDist.addPropertyOverride(
      "DistributionConfig.Origins.0.OriginAccessControlId",
      oac.getAtt("Id"),
    );

    // 5. Bucket Policy for OAC
    hostingBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        actions: ["s3:GetObject"],
        resources: [hostingBucket.arnForObjects("*")],
        principals: [new iam.ServicePrincipal("cloudfront.amazonaws.com")],
        conditions: {
          StringEquals: {
            "AWS:SourceArn": `arn:aws:cloudfront::${this.account}:distribution/${distribution.distributionId}`,
          },
        },
      }),
    );

    this.distributionUrl = `https://${distribution.distributionDomainName}`;

    // 6. Deploy React build
    new s3deploy.BucketDeployment(this, "DeployFrontend", {
      sources: [
        s3deploy.Source.asset(path.join(__dirname, "../../../frontend/build")),
      ],
      destinationBucket: hostingBucket,
      distribution,
      distributionPaths: ["/*"],
    });

    new cdk.CfnOutput(this, "FrontendUrl", { value: this.distributionUrl });
  }
}
