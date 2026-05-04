/**
 * Orders Microservice Lambda
 * ──────────────────────────────────────────────────────────────────────────
 * Routes:
 *   GET    /api/orders               → list orders (filter by ?userId=)
 *   POST   /api/orders               → create an order
 *   GET    /api/orders/{id}          → get one order
 *   PUT    /api/orders/{id}          → update order status
 *   DELETE /api/orders/{id}          → cancel/delete an order
 */

const { DynamoDBClient }            = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, DeleteCommand, ScanCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { randomUUID } = require('crypto');

const ddb           = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const ORDERS_TABLE  = process.env.ORDERS_TABLE_NAME;
const PRODUCTS_TABLE = process.env.PRODUCTS_TABLE_NAME;

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

const ORDER_STATUSES = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];

exports.handler = async (event) => {
  const method = event.httpMethod;
  const id     = event.pathParameters?.id;

  try {
    if (method === 'OPTIONS') return ok({});

    // GET /api/orders  (optionally ?userId=xxx)
    if (method === 'GET' && !id) {
      const userId = event.queryStringParameters?.userId;
      let items;
      if (userId) {
        const res = await ddb.send(new QueryCommand({
          TableName:                ORDERS_TABLE,
          IndexName:                'UserOrdersIndex',
          KeyConditionExpression:   'userId = :uid',
          ExpressionAttributeValues: { ':uid': userId },
          ScanIndexForward: false, // newest first
        }));
        items = res.Items;
      } else {
        const res = await ddb.send(new ScanCommand({ TableName: ORDERS_TABLE, Limit: 100 }));
        items = res.Items;
      }
      return ok({ items, count: items.length });
    }

    // GET /api/orders/{id}
    if (method === 'GET' && id) {
      // Orders table has composite key: id + userId
      // For a real app you'd require userId. Here we scan for simplicity.
      const res = await ddb.send(new ScanCommand({
        TableName:        ORDERS_TABLE,
        FilterExpression: 'id = :id',
        ExpressionAttributeValues: { ':id': id },
        Limit: 1,
      }));
      if (!res.Items?.length) return err(404, 'Order not found');
      return ok(res.Items[0]);
    }

    // POST /api/orders
    if (method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      if (!body.userId || !body.items?.length) return err(400, 'userId and items[] are required');

      // Validate products exist & compute total
      let total = 0;
      const enrichedItems = [];
      for (const li of body.items) {
        const pRes = await ddb.send(new GetCommand({ TableName: PRODUCTS_TABLE, Key: { id: li.productId } }));
        if (!pRes.Item) return err(400, `Product ${li.productId} not found`);
        const qty = Number(li.quantity ?? 1);
        enrichedItems.push({ productId: li.productId, name: pRes.Item.name, quantity: qty, unitPrice: pRes.Item.price });
        total += pRes.Item.price * qty;
      }

      const order = {
        id:        randomUUID(),
        userId:    body.userId,
        items:     enrichedItems,
        total:     Math.round(total * 100) / 100,
        status:    'pending',
        address:   body.address ?? {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await ddb.send(new PutCommand({ TableName: ORDERS_TABLE, Item: order }));
      return created(order);
    }

    // PUT /api/orders/{id}  – update status
    if (method === 'PUT' && id) {
      const body   = JSON.parse(event.body || '{}');
      const status = body.status;
      if (!ORDER_STATUSES.includes(status)) {
        return err(400, `status must be one of: ${ORDER_STATUSES.join(', ')}`);
      }
      const res = await ddb.send(new ScanCommand({
        TableName: ORDERS_TABLE,
        FilterExpression: 'id = :id',
        ExpressionAttributeValues: { ':id': id },
        Limit: 1,
      }));
      if (!res.Items?.length) return err(404, 'Order not found');
      const order = res.Items[0];
      const updated = await ddb.send(new UpdateCommand({
        TableName: ORDERS_TABLE,
        Key: { id: order.id, userId: order.userId },
        UpdateExpression: 'SET #s = :s, updatedAt = :u',
        ExpressionAttributeNames:  { '#s': 'status' },
        ExpressionAttributeValues: { ':s': status, ':u': new Date().toISOString() },
        ReturnValues: 'ALL_NEW',
      }));
      return ok(updated.Attributes);
    }

    // DELETE /api/orders/{id}
    if (method === 'DELETE' && id) {
      const res = await ddb.send(new ScanCommand({
        TableName: ORDERS_TABLE,
        FilterExpression: 'id = :id',
        ExpressionAttributeValues: { ':id': id },
        Limit: 1,
      }));
      if (!res.Items?.length) return err(404, 'Order not found');
      const order = res.Items[0];
      await ddb.send(new DeleteCommand({ TableName: ORDERS_TABLE, Key: { id: order.id, userId: order.userId } }));
      return noContent();
    }

    return err(405, 'Method not allowed');
  } catch (e) {
    console.error('Orders service error:', e);
    return err(500, e.message ?? 'Internal server error');
  }
};
