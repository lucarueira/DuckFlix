'use strict';
const { image } = require('../../manga-catalog.cjs');

exports.handler = async event => {
  if (event.httpMethod !== 'GET') return { statusCode: 405, body: JSON.stringify({ error: 'Método inválido.' }) };
  try {
    const { bytes, type } = await image(event.queryStringParameters || {});
    return { statusCode: 200, headers: { 'Content-Type': type, 'Cache-Control': 'public, max-age=600' }, isBase64Encoded: true, body: bytes.toString('base64') };
  } catch (cause) {
    return { statusCode: cause.status || 502, headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify({ error: cause.status ? cause.message : 'Imagem indisponível.' }) };
  }
};
