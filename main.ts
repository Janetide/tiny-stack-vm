// Tiny stack VM for make.fun's "Build a tiny stack virtual machine, 22 November 2026" bounty.
// Runs every program.bin in /input/<id>/ and writes /output/<id>/stdout.bin + exit.txt.
// The ISA is the kit's program/generator/subject/ISA.md; semantics follow its reference VM.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// opcode -> [immediate bytes, pops, pushes]
const T = {
  0: [0, 0, 0], 1: [1, 0, 1], 2: [4, 0, 1], 3: [0, 1, 0], 4: [0, 1, 2],
  5: [0, 2, 2], 6: [0, 2, 3], 7: [0, 3, 3],
  16: [0, 2, 1], 17: [0, 2, 1], 18: [0, 2, 1], 19: [0, 2, 1], 20: [0, 2, 1],
  21: [0, 2, 1], 22: [0, 2, 1], 23: [0, 1, 1], 24: [0, 2, 1], 25: [0, 2, 1],
  26: [0, 2, 1], 27: [0, 1, 1], 28: [0, 2, 1], 29: [0, 2, 1], 30: [0, 2, 1],
  31: [0, 2, 1], 32: [0, 2, 1], 33: [0, 2, 1], 34: [0, 2, 1],
  48: [2, 0, 0], 49: [2, 1, 0], 50: [2, 1, 0], 51: [2, 0, 0], 52: [0, 0, 0],
  64: [0, 1, 1], 65: [0, 2, 0],
  80: [0, 1, 0], 81: [0, 1, 0], 82: [0, 0, 1], 83: [0, 1, 0],
};

const enc = new TextEncoder();

// Runs one program on its input. Returns [exit code, stdout bytes].
function run(p, inp) {
  const D = new Int32Array(256);
  const C = new Int32Array(64);
  const M = new Int32Array(256);
  const out = new Uint8Array(65536);
  const n = p.length;
  let sp = 0, csp = 0, olen = 0, ip = 0, pc = 0, steps = 0;
  for (;;) {
    if (steps === 1000000) return [10, out.subarray(0, olen)];
    if (pc < 0 || pc >= n) return [9, out.subarray(0, olen)];
    const op = p[pc];
    const t = T[op];
    if (t === undefined) return [5, out.subarray(0, olen)];
    const imm = t[0];
    if (pc + imm >= n) return [9, out.subarray(0, olen)];
    steps++;
    const next = pc + 1 + imm;
    if (sp < t[1]) return [2, out.subarray(0, olen)];
    if (sp - t[1] + t[2] > 256) return [3, out.subarray(0, olen)];
    pc = next;
    switch (op) {
      case 0: return [0, out.subarray(0, olen)];
      case 1: D[sp++] = (p[next - 1] << 24) >> 24; break;
      case 2: D[sp++] = p[next - 4] | (p[next - 3] << 8) | (p[next - 2] << 16) | (p[next - 1] << 24); break;
      case 3: sp--; break;
      case 4: D[sp] = D[sp - 1]; sp++; break;
      case 5: { const x = D[sp - 1]; D[sp - 1] = D[sp - 2]; D[sp - 2] = x; break; }
      case 6: D[sp] = D[sp - 2]; sp++; break;
      case 7: { const a = D[sp - 3]; D[sp - 3] = D[sp - 2]; D[sp - 2] = D[sp - 1]; D[sp - 1] = a; break; }
      case 23: D[sp - 1] = -D[sp - 1] | 0; break;
      case 27: D[sp - 1] = ~D[sp - 1]; break;
      case 16: case 17: case 18: case 19: case 20: case 21: case 22:
      case 24: case 25: case 26: case 28: case 29: case 30: case 32: case 33:
      case 34: {
        const b = D[sp - 1], a = D[sp - 2];
        let r;
        if (op === 16) r = (a + b) | 0;
        else if (op === 17) r = (a - b) | 0;
        else if (op === 18) r = Math.imul(a, b);
        else if (op === 19) {
          if (b === 0) return [4, out.subarray(0, olen)];
          r = a === -2147483648 && b === -1 ? a : (a / b) | 0;
        } else if (op === 20) {
          if (b === 0) return [4, out.subarray(0, olen)];
          r = b === -1 ? 0 : (a % b) | 0;
        } else if (op === 21) {
          if (b === 0) return [4, out.subarray(0, olen)];
          r = Math.floor((a >>> 0) / (b >>> 0)) | 0;
        } else if (op === 22) {
          if (b === 0) return [4, out.subarray(0, olen)];
          r = ((a >>> 0) % (b >>> 0)) | 0;
        } else if (op === 24) r = a & b;
        else if (op === 25) r = a | b;
        else if (op === 26) r = a ^ b;
        else if (op === 28) r = a << (b & 31);
        else if (op === 29) r = a >> (b & 31);
        else if (op === 30) r = (a >>> (b & 31)) | 0;
        else if (op === 32) r = a === b ? 1 : 0;
        else if (op === 33) r = a < b ? 1 : 0;
        else r = (a >>> 0) < (b >>> 0) ? 1 : 0;
        sp -= 2;
        D[sp++] = r;
        break;
      }
      case 48: case 49: case 50: {
        const rel = ((p[next - 2] | (p[next - 1] << 8)) << 16) >> 16;
        let take = true;
        if (op !== 48) {
          const v = D[--sp];
          take = op === 49 ? v === 0 : v !== 0;
        }
        if (take) pc = next + rel;
        break;
      }
      case 51:
        if (csp === 64) return [7, out.subarray(0, olen)];
        C[csp++] = next;
        pc = p[next - 2] | (p[next - 1] << 8);
        break;
      case 52:
        if (csp === 0) return [8, out.subarray(0, olen)];
        pc = C[--csp];
        break;
      case 64: {
        const addr = D[sp - 1];
        if (addr < 0 || addr >= 256) return [6, out.subarray(0, olen)];
        D[sp - 1] = M[addr];
        break;
      }
      case 65: {
        const addr = D[sp - 1], v = D[sp - 2];
        if (addr < 0 || addr >= 256) return [6, out.subarray(0, olen)];
        sp -= 2;
        M[addr] = v;
        break;
      }
      case 80: {
        const bytes = enc.encode(String(D[sp - 1]));
        if (olen + bytes.length > 65536) return [11, out.subarray(0, olen)];
        sp--;
        out.set(bytes, olen);
        olen += bytes.length;
        break;
      }
      case 81:
        if (olen + 1 > 65536) return [11, out.subarray(0, olen)];
        out[olen++] = D[--sp] & 255;
        break;
      case 82:
        D[sp++] = ip < inp.length ? inp[ip++] : -1;
        break;
      case 83:
        return [D[--sp] & 255, out.subarray(0, olen)];
    }
  }
}

const I = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const O = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
for (const id of readdirSync(I).sort()) {
  const [code, stdout] = run(readFileSync(join(I, id, 'program.bin')), readFileSync(join(I, id, 'input.bin')));
  mkdirSync(join(O, id), { recursive: true });
  writeFileSync(join(O, id, 'stdout.bin'), stdout);
  writeFileSync(join(O, id, 'exit.txt'), String(code));
}
