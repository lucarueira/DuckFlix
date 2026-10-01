'use strict';
const { catalog } = require('../../manga-catalog.cjs');

exports.handler = async event => {
  if (event.httpMethod !== 'GET') return { statusCode: 405, body: JSON.stringify({ error: 'Método inválido.' }) };
  try {
    const data = await catalog(event.queryStringParameters?.action, event.queryStringParameters || {});
    return { statusCode: 200, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, body: JSON.stringify(data) };
  } catch (cause) {
    return { statusCode: cause.status || 502, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, body: JSON.stringify({ error: cause.status ? cause.message : 'Consulta indisponível.' }) };
  }
};
