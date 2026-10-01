'use strict';
const { searchMusic } = require('../../youtube-music-catalog.cjs');

exports.handler = async event => {
  if (event.httpMethod !== 'GET') return { statusCode: 405, body: JSON.stringify({ error: 'Método inválido.' }) };
  try {
    const data = await searchMusic(event.queryStringParameters?.q);
    return { statusCode: 200, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, body: JSON.stringify(data) };
  } catch (cause) {
    return { statusCode: cause.status || 502, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
      body: JSON.stringify({ error: cause.status ? cause.message : 'Falha temporária na busca.' }) };
  }
};
