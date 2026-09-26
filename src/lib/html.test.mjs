// escapeHtml — node:test (frontend'de vitest yok; Node'un tür soyma özelliği .ts'i doğrudan çalıştırır)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml } from './html.ts';

test('etiket, öznitelik ve & karakterlerini kaçırır (saklı XSS yükü etkisiz)', () => {
  assert.equal(escapeHtml('<img src=x onerror=alert(1)>'), '&lt;img src=x onerror=alert(1)&gt;');
  assert.equal(escapeHtml(`a"b'c&d`), 'a&quot;b&#39;c&amp;d');
  assert.equal(escapeHtml('</title><script>x()</script>'), '&lt;/title&gt;&lt;script&gt;x()&lt;/script&gt;');
});

test('null/undefined boş, sayı metne çevrilir, düz metin değişmez', () => {
  assert.equal(escapeHtml(null), '');
  assert.equal(escapeHtml(undefined), '');
  assert.equal(escapeHtml(42), '42');
  assert.equal(escapeHtml('Düz metin — çğıöşü'), 'Düz metin — çğıöşü');
});
