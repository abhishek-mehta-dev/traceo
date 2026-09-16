const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const {
  looksLikeJson,
  recoverTruncatedJson,
  parseJsonPreview,
  expandJsonValue
} = require(path.resolve(__dirname, '../apps/dashboard/public/json-preview.js'));

const truncatedContactList = '{"statusCode":200,"data":[{"_id":"69799b1a79ca586fc45fa4fe","fullName":"Abbot Barber","email":"sadixu@mailinator.com","companyName":"Wood Davis Co","referralSource":"Google","message":"Qui magna dolor illu","createdAt":"2026-01-28T05:14:02.172Z","updatedAt":"2026-01-28T05:14:02.172Z"},{"_id":"6956221f5d15714b5d162eb9","fullName":"Abhishek","email":"abhishsie@gmail.com","companyName":"nessfi","referralSource":"facebook","message":"cxxcvc fddssdf","';

test('looksLikeJson detects objects and arrays', () => {
  assert.equal(looksLikeJson('{"a":1}'), true);
  assert.equal(looksLikeJson(' [1]'), true);
  assert.equal(looksLikeJson('plain'), false);
});

test('recoverTruncatedJson closes incomplete keys, values, and containers', () => {
  assert.deepEqual(recoverTruncatedJson('{"a":1,"b":"hel'), { a: 1, b: 'hel' });
  assert.deepEqual(recoverTruncatedJson('{"a":1,"b":[1,2,'), { a: 1, b: [1, 2] });
  assert.deepEqual(recoverTruncatedJson('{"a":'), { a: null });
  assert.deepEqual(recoverTruncatedJson('[{"a":1},{"b":'), [{ a: 1 }, { b: null }]);
  assert.deepEqual(recoverTruncatedJson('{"a":"hi\\'), { a: 'hi' });
});

test('recoverTruncatedJson pretty-prints a captured contact-list body slice', () => {
  const recovered = recoverTruncatedJson(truncatedContactList);
  assert.equal(recovered.statusCode, 200);
  assert.equal(recovered.data.length, 2);
  assert.equal(recovered.data[1].fullName, 'Abhishek');
  assert.equal(recovered.data[1].message, 'cxxcvc fddssdf');
  assert.equal(Object.prototype.hasOwnProperty.call(recovered.data[1], ''), false);
});

test('expandJsonValue turns nested body strings into objects', () => {
  const acc = { recovered: false };
  const expanded = expandJsonValue({
    payload: {
      response: {
        body: truncatedContactList,
        bodyTruncated: true
      }
    }
  }, 0, acc);

  assert.equal(acc.recovered, true);
  assert.equal(expanded.payload.response.body.statusCode, 200);
  assert.equal(expanded.payload.response.body.data[1].email, 'abhishsie@gmail.com');
  assert.match(JSON.stringify(expanded.payload.response.body, null, 2), /\n  "statusCode": 200/);
  assert.doesNotMatch(JSON.stringify(expanded.payload.response.body), /\\{/);
});

test('parseJsonPreview marks recovered truncated JSON', () => {
  const parsed = parseJsonPreview(truncatedContactList);
  assert.equal(parsed.recovered, true);
  assert.equal(parsed.value.data[0].fullName, 'Abbot Barber');
});
