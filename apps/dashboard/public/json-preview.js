(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  root.TraceoJsonPreview = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function looksLikeJson(value) {
    if (typeof value !== 'string') return false;
    const trimmed = value.trim();
    return trimmed.startsWith('{') || trimmed.startsWith('[');
  }

  function recoverTruncatedJson(source) {
    let text = String(source);
    let inString = false;
    let escaped = false;
    let stringStart = -1;
    const stack = [];

    for (let i = 0; i < text.length; i += 1) {
      const ch = text[i];
      if (inString) {
        if (escaped) {
          escaped = false;
          continue;
        }
        if (ch === '\\') {
          escaped = true;
          continue;
        }
        if (ch === '"') {
          inString = false;
          stringStart = -1;
        }
        continue;
      }
      if (ch === '"') {
        inString = true;
        stringStart = i;
        continue;
      }
      if (ch === '{') stack.push('}');
      else if (ch === '[') stack.push(']');
      else if ((ch === '}' || ch === ']') && stack[stack.length - 1] === ch) stack.pop();
    }

    if (escaped && inString) {
      text = text.slice(0, -1);
    }

    if (inString && stringStart >= 0) {
      const before = text.slice(0, stringStart);
      const prev = before.trimEnd().slice(-1);
      if (prev === ':') {
        text += '"';
      } else {
        text = before.replace(/[\s,]+$/, '');
      }
    } else {
      text = text.replace(/[\s,]+$/, '');
    }

    if (/:\s*$/.test(text)) {
      text += 'null';
    }

    if (stack[stack.length - 1] === '}' && /(?:[{,]\s*)"(?:\\.|[^"\\])*"$/.test(text)) {
      text += ':null';
    }

    while (stack.length) {
      text += stack.pop();
    }

    try {
      return JSON.parse(text);
    } catch {
      return undefined;
    }
  }

  function parseJsonPreview(text) {
    const trimmed = String(text).trim();
    if (!trimmed) return { value: text, recovered: false };
    try {
      return { value: JSON.parse(trimmed), recovered: false };
    } catch {
      const recovered = recoverTruncatedJson(trimmed);
      if (recovered !== undefined) return { value: recovered, recovered: true };
      return { value: text, recovered: false };
    }
  }

  function expandJsonValue(value, depth, acc) {
    const level = depth || 0;
    const bag = acc || { recovered: false };
    if (level > 10) return value;
    if (typeof value === 'string' && looksLikeJson(value)) {
      const parsed = parseJsonPreview(value);
      if (typeof parsed.value !== 'string') {
        if (parsed.recovered) bag.recovered = true;
        return expandJsonValue(parsed.value, level + 1, bag);
      }
      return value;
    }
    if (Array.isArray(value)) {
      return value.map((item) => expandJsonValue(item, level + 1, bag));
    }
    if (value && typeof value === 'object') {
      const out = {};
      Object.entries(value).forEach(([key, child]) => {
        out[key] = expandJsonValue(child, level + 1, bag);
      });
      return out;
    }
    return value;
  }

  return {
    looksLikeJson,
    recoverTruncatedJson,
    parseJsonPreview,
    expandJsonValue
  };
});
