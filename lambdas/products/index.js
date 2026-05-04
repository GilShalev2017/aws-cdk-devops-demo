/**
 * Products Microservice Lambda
 * ──────────────────────────────────────────────────────────────────────────
 * Routes:
 *   GET    /api/products             → list all products (optionally filter by category)
 *   POST   /api/products             → create a product
 *   GET    /api/products/{id}        → get one product
 *   PUT    /api/products/{id}        → update a product
 *   DELETE /api/products/{id}        → delete a product
 *   GET    /api/products/{id}/upload-url → generate S3 presigned upload URL
 */

const { DynamoDBClient }            = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, DeleteCommand, ScanCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl }               = require('@aws-sdk/s3-request-presigner');
const { randomUUID }                 = require('crypto');

const ddb    = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const s3     = new S3Client({});
const TABLE  = process.env.PRODUCTS_TABLE_NAME;
const BUCKET = process.env.ASSETS_BUCKET_NAME;

// ── Helpers ───────────────────────────────────────────────────────────────
const ok  = (body)  => ({ statusCode: 200, headers: cors(), body: JSON.stringify(body) });
const created = (b) => ({ statusCode: 201, headers: cors(), body: JSON.stringify(b)    });
const noContent = () => ({ statusCode: 204, headers: cors(), body: ''                  });
const err = (statusCode, message) => ({
  statusCode, headers: cors(), body: JSON.stringify({ error: message }),
});
const cors = () => ({
  'Content-Type':                'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
});

// ── Handler ───────────────────────────────────────────────────────────────
exports.handler = async (event) => {
  const method   = event.httpMethod;
  const pathParts = (event.path || '').split('/').filter(Boolean);
  const id        = event.pathParameters?.id;
  const isUpload  = pathParts.includes('upload-url');

  try {
    if (method === 'OPTIONS') return ok({});

    // GET /api/products/{id}/upload-url
    if (method === 'GET' && isUpload && id) {
      const key     = `products/${id}/${randomUUID()}.jpg`;
      const command = new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: 'image/jpeg' });
      const url     = await getSignedUrl(s3, command, { expiresIn: 300 }); // 5 min
      return ok({ uploadUrl: url, key });
    }

    // GET /api/products
    if (method === 'GET' && !id) {
      const category = event.queryStringParameters?.category;
      let items;
      if (category) {
        const res = await ddb.send(new QueryCommand({
          TableName:                TABLE,
          IndexName:                'CategoryIndex',
          KeyConditionExpression:   'category = :cat',
          ExpressionAttributeValues: { ':cat': category },
        }));
        items = res.Items;
      } else {
        const res = await ddb.send(new ScanCommand({ TableName: TABLE, Limit: 100 }));
        items = res.Items;
      }
      return ok({ items, count: items.length });
    }

    // GET /api/products/{id}
    if (method === 'GET' && id) {
      const res = await ddb.send(new GetCommand({ TableName: TABLE, Key: { id } }));
      if (!res.Item) return err(404, 'Product not found');
      return ok(res.Item);
    }

    // POST /api/products
    if (method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      if (!body.name || !body.price) return err(400, 'name and price are required');
      const item = {
        id:          randomUUID(),
        name:        body.name,
        description: body.description ?? '',
        price:       Number(body.price),
        category:    body.category    ?? 'general',
        stock:       body.stock       ?? 0,
        imageKey:    body.imageKey    ?? null,
        createdAt:   new Date().toISOString(),
        updatedAt:   new Date().toISOString(),
      };
      await ddb.send(new PutCommand({ TableName: TABLE, Item: item }));
      return created(item);
    }

    // PUT /api/products/{id}
    if (method === 'PUT' && id) {
      const body = JSON.parse(event.body || '{}');
      const res  = await ddb.send(new UpdateCommand({
        TableName: TABLE,
        Key:       { id },
        UpdateExpression:          'SET #n = :n, description = :d, price = :p, category = :c, stock = :s, updatedAt = :u',
        ExpressionAttributeNames:  { '#n': 'name' },
        ExpressionAttributeValues: {
          ':n': body.name        ?? '',
          ':d': body.description ?? '',
          ':p': Number(body.price ?? 0),
          ':c': body.category    ?? 'general',
          ':s': body.stock       ?? 0,
          ':u': new Date().toISOString(),
        },
        ReturnValues: 'ALL_NEW',
      }));
      return ok(res.Attributes);
    }

    // DELETE /api/products/{id}
    if (method === 'DELETE' && id) {
      await ddb.send(new DeleteCommand({ TableName: TABLE, Key: { id } }));
      return noContent();
    }

    return err(405, 'Method not allowed');
  } catch (e) {
    console.error('Products service error:', e);
    return err(500, e.message ?? 'Internal server error');
  }
};
