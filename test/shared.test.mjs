// Run: node test/shared.test.mjs
import assert from 'node:assert/strict';
import {
  buildUrl, compactLink, fieldNames, missingVars, normalizeLink, parseCommand, valuesFromArgs, varNames,
} from '../shared.js';

const pr = normalizeLink({
  name: 'Pull request',
  url: 'https://github.com/{repo}/pull/{number}',
  keyword: 'pr',
  vars: { repo: { required: false, default: 'acme/api' } },
});
const logs = normalizeLink({
  name: 'Trace logs',
  url: 'https://logs.example.com/discover?q=traceId:{traceId}&service={service}',
  vars: { service: { required: false } },
});
const old = normalizeLink({ name: 'Jira', url: 'https://x.atlassian.net/browse/' });
const oldQuery = normalizeLink({ name: 'Search', url: 'https://docs.example.com/search?q=' });

// Links saved by 0.0.x ({ name, url }): one required "value" variable at the end.
assert.deepEqual(old, { name: 'Jira', url: 'https://x.atlassian.net/browse/', keyword: '', vars: {}, fieldOrder: [] });
assert.deepEqual(varNames(old.url), ['value']);
assert.equal(buildUrl(old, { value: 'SET-1' }), 'https://x.atlassian.net/browse/SET-1');
assert.equal(buildUrl(oldQuery, { value: 'a b&c' }), 'https://docs.example.com/search?q=a%20b%26c');

// Variables anywhere; defaults; path values keep "/"; empty optional adds nothing.
assert.equal(buildUrl(pr, { number: '4521' }), 'https://github.com/acme/api/pull/4521');
assert.equal(buildUrl(pr, { repo: 'acme/web', number: '7' }), 'https://github.com/acme/web/pull/7');
assert.equal(buildUrl(logs, { traceId: 'a/b' }), 'https://logs.example.com/discover?q=traceId:a%2Fb&service=');
assert.deepEqual(missingVars(pr, { repo: 'x' }), ['number']);
assert.deepEqual(missingVars(pr, { number: '1' }), []);

// Address bar: all values in template order; fewer values go to required variables first; last takes the rest.
assert.deepEqual(parseCommand('  PR  4521 '), { keyword: 'pr', args: ['4521'] });
assert.deepEqual(valuesFromArgs(pr, ['4521']), { number: '4521' });
assert.deepEqual(valuesFromArgs(pr, ['acme/web', '7']), { repo: 'acme/web', number: '7' });
assert.deepEqual(valuesFromArgs(oldQuery, ['two', 'words']), { value: 'two words' });
assert.deepEqual(valuesFromArgs(logs, ['t1']), { traceId: 't1' });

// Field order: set fields first, the others in template order; it also sets the address-bar order.
const res = normalizeLink({
  name: 'Resource',
  url: 'https://my.link.com/{path}/{resource}',
  vars: { path: { required: false, default: 'v22' } },
  fieldOrder: ['resource', 'path', 'gone', 'resource'],
});
assert.deepEqual(fieldNames(res), ['resource', 'path']);
assert.deepEqual(fieldNames(normalizeLink({ name: 'x', url: 'https://a/{a}/{b}/{c}', fieldOrder: ['c'] })), ['c', 'a', 'b']);
assert.deepEqual(valuesFromArgs(res, ['users']), { resource: 'users' });
assert.deepEqual(valuesFromArgs(res, ['users', 'v23']), { resource: 'users', path: 'v23' });
assert.equal(buildUrl(res, { resource: 'users' }), 'https://my.link.com/v22/users');
assert.deepEqual(compactLink(res).fieldOrder, ['resource', 'path']);
assert.equal(compactLink({ ...res, fieldOrder: ['path', 'resource'] }).fieldOrder, undefined);

// Stored form drops empty fields and settings of variables that are not in the URL.
assert.deepEqual(old.fieldOrder, []);
assert.deepEqual(compactLink(old), { name: 'Jira', url: 'https://x.atlassian.net/browse/' });
assert.deepEqual(
  compactLink({ ...pr, vars: { ...pr.vars, gone: { required: false } } }),
  { name: 'Pull request', url: pr.url, keyword: 'pr', vars: { repo: { required: false, default: 'acme/api' } } },
);

console.log('shared.test.mjs: all checks passed');
