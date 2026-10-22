export function createRouter() {
  const routes = [];
  return {
    add(method, path, opts, handler) {
      const keys = [];
      const re = new RegExp('^' + path.replace(/:[A-Za-z]+/g, m => { keys.push(m.slice(1)); return '([^/]+)'; }) + '/?$');
      routes.push({ method, re, keys, auth: opts.auth || 'none', raw: !!opts.raw, handler });
    },
    match(method, pathname) {
      let pathMatched = false;
      for (const r of routes) {
        const m = r.re.exec(pathname);
        if (!m) continue;
        pathMatched = true;
        if (r.method !== method) continue;
        const params = {};
        r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
        return { route: r, params };
      }
      return { route: null, pathMatched };
    },
  };
}
