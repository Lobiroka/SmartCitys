const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
process.env.KEYCLOAK_ISSUER = 'https://keycloak.invalid/realms/test';
process.env.KEYCLOAK_AUDIENCE = 'test';
const tokens = require('../dist/config/verifyAccessToken');
tokens.verifyAccessToken = async (token) => ({ subject:'test', roles: token === 'other' ? [] : [token] });
const repository = require('../dist/repositories/inundationRepository');
const routes = require('../dist/routes/metricsRoutes').default;
const { errorMiddleware } = require('../dist/middlewares/errorMiddleware');
let server, base;
before(async()=>{
  const app=express(); app.use(routes); app.use(errorMiddleware);
  server=app.listen(0,'127.0.0.1'); await new Promise(resolve=>server.once('listening',resolve));
  base=`http://127.0.0.1:${server.address().port}`;
});
after(async()=>new Promise(resolve=>server.close(resolve)));
const request=(role)=>fetch(`${base}/metrics/inundation`,{headers:role?{authorization:`Bearer ${role}`}:{}});

test('SGB exige autenticação e papel antes de ler o banco',async()=>{
  repository.findInundationAreas=async()=>assert.fail('Não consultar');
  assert.equal((await request()).status,401);
  assert.equal((await request('other')).status,403);
});
test('cidadão e gestor recebem polígonos, ano e origem da camada prata',async()=>{
  const geometry={type:'Polygon',coordinates:[[[-35,-9],[-34,-9],[-34,-8],[-35,-9]]]};
  repository.findInundationAreas=async()=>[{id:'1',classe:'Alta',ano:2014,
    descricao_fonte:'SGB',geometria:geometry,bbox:[-35,-9,-34,-8],fonte:'https://example.test/sgb',
    data_extracao:new Date('2026-11-19T12:00:00Z')}];
  for(const role of ['cidadao','gestor']){
    const response=await request(role); assert.equal(response.status,200);
    const data=await response.json(); assert.equal(data.items[0].ano,2014);
    assert.deepEqual(data.items[0].geometry,geometry);
    assert.equal(data.items[0].dataExtracao,'2026-11-19T12:00:00.000Z');
  }
});
test('falha ou camada vazia retornam 503 sem vazar credenciais',async()=>{
  for(const find of [async()=>[],async()=>{throw Error('postgresql://secret')}]){
    repository.findInundationAreas=find;
    const response=await request('cidadao');assert.equal(response.status,503);
    assert.deepEqual(await response.json(),{error:'Camada de inundação temporariamente indisponível'});
  }
});
test('repositório usa transação somente leitura e tabela própria da ETL',async()=>{
  const lib=require('../dist/lib/etlPrisma');
  const calls=[];
  lib.getEtlPrisma=()=>({$transaction:async(fn)=>fn({
    $executeRaw:async(parts)=>calls.push(parts.join('')),
    $queryRaw:async(parts)=>{calls.push(parts.join(''));return [];},
  })});
  delete require.cache[require.resolve('../dist/repositories/inundationRepository')];
  const real=require('../dist/repositories/inundationRepository');
  assert.deepEqual(await real.findInundationAreas(),[]);
  assert.match(calls[0],/READ ONLY/);
  assert.match(calls[2],/public.recife_inundacao_sgb/);
});
