export const promisify = fn => (...a) => new Promise((res, rej) => fn(...a, (e, v) => (e ? rej(e) : res(v))));
export default { promisify };
