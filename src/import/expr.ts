/**
 * Tiny expression evaluator for the arithmetic that appears inside petal draw
 * calls: `r * 0.866`, `-r / 2`, `3 * M_PI / 2`, `r*0.5f`, `(r + 10)`.
 *
 * Supports: numbers (with optional f suffix), the identifiers `r` and `M_PI`,
 * unary minus, + - * /, and parentheses. Anything else throws.
 */

type Tok = { t: "num"; v: number } | { t: "id"; v: string } | { t: "op"; v: string };

function lex(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (/\s/.test(ch)) { i++; continue; }
    if (/[0-9.]/.test(ch)) {
      let j = i;
      while (j < src.length && /[0-9.]/.test(src[j])) j++;
      const numText = src.slice(i, j);
      if (src[j] === "f" || src[j] === "F") j++; // C float suffix
      out.push({ t: "num", v: parseFloat(numText) });
      i = j;
      continue;
    }
    if (/[A-Za-z_]/.test(ch)) {
      let j = i;
      while (j < src.length && /[A-Za-z0-9_]/.test(src[j])) j++;
      out.push({ t: "id", v: src.slice(i, j) });
      i = j;
      continue;
    }
    if ("+-*/()".includes(ch)) { out.push({ t: "op", v: ch }); i++; continue; }
    throw new Error(`unexpected character ${JSON.stringify(ch)} in ${JSON.stringify(src)}`);
  }
  return out;
}

export interface ExprScope { r: number; [k: string]: number }

export function evalExpr(src: string, scope: ExprScope): number {
  const toks = lex(src);
  let p = 0;
  const peek = () => toks[p];
  const eat = (v: string) => {
    const t = peek();
    if (t && t.t === "op" && t.v === v) { p++; return true; }
    return false;
  };

  function primary(): number {
    const t = peek();
    if (!t) throw new Error(`unexpected end of expression in ${JSON.stringify(src)}`);
    if (t.t === "op" && t.v === "-") { p++; return -primary(); }
    if (t.t === "op" && t.v === "+") { p++; return primary(); }
    if (t.t === "op" && t.v === "(") {
      p++;
      const v = expr();
      if (!eat(")")) throw new Error(`missing ) in ${JSON.stringify(src)}`);
      return v;
    }
    if (t.t === "num") { p++; return t.v; }
    if (t.t === "id") {
      p++;
      if (t.v === "M_PI") return Math.PI;
      if (t.v in scope) return scope[t.v];
      throw new Error(`unknown identifier ${t.v} in ${JSON.stringify(src)}`);
    }
    throw new Error(`unexpected token in ${JSON.stringify(src)}`);
  }

  function term(): number {
    let v = primary();
    for (;;) {
      if (eat("*")) v *= primary();
      else if (eat("/")) v /= primary();
      else return v;
    }
  }

  function expr(): number {
    let v = term();
    for (;;) {
      if (eat("+")) v += term();
      else if (eat("-")) v -= term();
      else return v;
    }
  }

  const v = expr();
  if (p !== toks.length) throw new Error(`trailing tokens in ${JSON.stringify(src)}`);
  return v;
}

/** Split a call's argument list on top-level commas (parens-aware). */
export function splitArgs(src: string): string[] {
  const out: string[] = [];
  let depth = 0, start = 0;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (c === "(") depth++;
    else if (c === ")") depth--;
    else if (c === "," && depth === 0) { out.push(src.slice(start, i)); start = i + 1; }
  }
  const tail = src.slice(start).trim();
  if (tail.length) out.push(tail);
  return out.map((s) => s.trim()).filter((s) => s.length > 0);
}
