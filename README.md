# tiny-stack-vm

A tiny stack virtual machine for make.fun's "Build a tiny stack virtual machine, 22 November 2026" bounty: https://make.fun/bounty/tiny-stack-vm-01-run-20261122

Run with Node 22: `node main.ts`. It reads /input/<id>/program.bin and /input/<id>/input.bin for every instance and writes /output/<id>/stdout.bin and /output/<id>/exit.txt. `MAKEFUN_INPUT_DIR` and `MAKEFUN_OUTPUT_DIR` override the paths.
