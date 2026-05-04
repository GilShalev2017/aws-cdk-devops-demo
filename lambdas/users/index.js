/**
 * Users Microservice Lambda
 * ──────────────────────────────────────────────────────────────────────────
 * Routes:
 *   GET    /api/users                → list users
 *   POST   /api/users                → create a user
 *   GET    /api/users/{id}           → get one user
 *   PUT    /api/users/{id}           → update a user
 *   DELETE /api/users/{id}           → delete a user
 */

const { DynamoDBClient }            = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, DeleteCommand, ScanCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { randomUUID } = require('crypto');

const ddb   = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE = process.env.USERS_TABLE_NAME;

const ok        = (body) => ({ statusCode: 200, headers: cors(), body: JSON.stringify(body) });
const created   = (b)    => ({ statusCode: 201, headers: cors(), body: JSON.stringify(b)    });
const noContent = ()     => ({ statusCode: 204, headers: cors(), body: ''                   });
const err = (statusCode, message) => ({
  statusCode, headers: cors(), body: JSON.stringify({ error: message }),
});
const cors = () => ({
  'Content-Type':                'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
});

exports.handler = async (event) => {
  const method = event.httpMethod;
  const id     = event.pathParameters?.id;

  try {
    if (method === 'OPTIONS') return ok({});

    // GET /api/users
    if (method === 'GET' && !id) {
      const email = event.queryStringParameters?.email;
      let items;
      if (email) {
        const res = await ddb.send(new QueryCommand({
          TableName:                TABLE,
          IndexName:                'EmailIndex',
          KeyConditionExpression:   'email = :e',
          ExpressionAttributeValues: { ':e': email },
        }));
        items = res.Items;
      } else {
        const res = await ddb.send(new ScanCommand({ TableName: TABLE, Limit: 100 }));
        items = res.Items;
      }
      // Never return passwords
      const safe = (items || []).map(({ passwordHash, ...u }) => u);
      return ok({ items: safe, count: safe.length });
    }

    // GET /api/users/{id}
    if (method === 'GET' && id) {
      const res = await ddb.send(new GetCommand({ TableName: TABLE, Key: { id } }));
      if (!res.Item) return err(404, 'User not found');
      const { passwordHash, ...safe } = res.Item;
      return ok(safe);
    }

    // POST /api/users
    if (method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      if (!body.email || !body.name) return err(400, 'email and name are required');

      // Check for duplicate email
      const dup = await ddb.send(new QueryCommand({
        TableName:                TABLE,
        IndexName:                'EmailIndex',
        KeyConditionExpression:   'email = :e',
        ExpressionAttributeValues: { ':e': body.email },
      }));
      if (dup.Items?.length) return err(409, 'A user with this email already exists');

      const user = {
        id:        randomUUID(),
        name:      body.name,
        email:     body.email,
        role:      body.role      ?? 'customer',
        address:   body.address   ?? {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await ddb.send(new PutCommand({ TableName: TABLE, Item: user }));
      return created(user);
    }

    // PUT /api/users/{id}
    if (method === 'PUT' && id) {
      const body = JSON.parse(event.body || '{}');
      const res  = await ddb.send(new UpdateCommand({
        TableName: TABLE,
        Key: { id },
        UpdateExpression: 'SET #n = :n, address = :a, updatedAt = :u',
        ExpressionAttributeNames:  { '#n': 'name' },
        ExpressionAttributeValues: {
          ':n': body.name    ?? '',
          ':a': body.address ?? {},
          ':u': new Date().toISOString(),
        },
        ReturnValues: 'ALL_NEW',
      }));
      const { passwordHash, ...safe } = res.Attributes || {};
      return ok(safe);
    }

    // DELETE /api/users/{id}
    if (method === 'DELETE' && id) {
      await ddb.send(new DeleteCommand({ TableName: TABLE, Key: { id } }));
      return noContent();
    }

    return err(405, 'Method not allowed');
  } catch (e) {
    console.error('Users service error:', e);
    return err(500, e.message ?? 'Internal server error');
  }
};
