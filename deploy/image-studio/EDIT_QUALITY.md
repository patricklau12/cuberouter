# Single-reference edit quality

## Problem and change

Image Studio previously reused a generated artwork's seed when continuing or
annotating it. Qwen's maintainers describe a noise replay failure when generation
and editing reuse the same noise at the same target size: over-sharpening and
grain can appear instead of a clean edit. See the confirmed correction in
[Diffusers issue 14824](https://github.com/huggingface/diffusers/issues/14824).

New edits of saved artwork now select a different seed before the dialog opens.
The dialog displays that seed, and the saved request, recovery and audit paths
retain it. A single uploaded reference gets a fresh seed and defaults to its
original aspect and supported output dimensions. Explicit advanced seed choices
are still sent unchanged; do not silently perturb seeds in the GPU worker.

Two separate sources of avoidable loss are addressed in the GPU worker:

- A single reference no longer always shrinks to a 1024-level conditioning image;
  it follows the source area up to 2,097,152 pixels, with pipeline alignment.
- Single-reference encoding/decoding uses the full VAE context instead of the
  runtime's default 256-pixel tiles. Multi-reference edits keep their existing
  tiled VAE and 1024 (two/three) or 512 (four/ten) conditioning budgets. Creation
  retains its existing tiled VAE. The worker restores the default and clears VAE
  feature caches in `finally`, including after inference failure.

PNG output and original reference bytes are retained. No sharpening filter,
upscaler, prompt rewriting, weight replacement or moderation bypass is added.
The model still regenerates the whole image: detail and identity may change,
especially over repeated edits. The UI recommends describing only the intended
changes and retaining the original for comparison.

## Validation on 2026-10-12

The checked deployment uses Qwen revision
`b3179ad355be050328e483a9dfdd9e60cd62adfa`, Diffusers `0.41.0.dev0`, and a
single MetaX C500 per worker. Controlled probes used the same installed pipeline
as production (class SHA-256
`8a35a96a1f82fd4126243ae0a355b9c53898c60cd4e793077376874500a6cd75`).

A CPU-only VAE round trip on a 512-square portrait crop, with no diffusion,
measured 35.79 dB reconstruction PSNR with the default tiles and 39.41 dB with
full context. Mean absolute RGB error fell from 2.33 to 1.43. This isolates an
extra codec loss; it does not measure instruction following or promise that
model-generated edits preserve every original pixel.

An isolated staging GPU probe completed all four cases at 40 steps, CFG 1:

| Case | Reference conditioning | Output | Time | Peak allocated GPU memory |
| --- | --- | --- | --- | --- |
| Existing tiled worker | 1024 | 1312 × 1312 | 46.31 s | 36.41 GB |
| Full VAE | 1024 | 1312 × 1312 | 41.42 s | 45.85 GB |
| Full VAE, native reference | 1280 | 1312 × 1312 | 44.63 s | 47.06 GB |
| Full VAE, larger output | 1280 | 1664 × 1248 | 53.49 s | 49.34 GB |

The larger output reserved 54.76 GB on a 68.28 GB C500 and did not exhaust
memory. Disabling tiling alone did not remove the full-frame over-sharpening in
the repeated-seed case. It must not be presented as the primary noise replay fix.
Test images and account credentials are excluded from this repository.

A second five-case C500 probe confirmed the seed fix independently. With the
original reference, prompt, dimensions and tiled worker unchanged, changing only
seed 42 to 43 removed visible over-sharpening. After a laptop-to-black edit, two
identical black-to-blue edits of its output reproduced grain at seed 43 and gave
a visibly cleaner result at seed 44. Both outputs were 1280-square and took about
41 seconds. Gradient energy in the upper 900 rows (outside the laptop edit) was
2.24 times the input with the reused seed and 1.13 times with the new seed; this
is an over-sharpening diagnostic, not a universal quality score. All five cases
completed without OOM (maximum allocation 46.52 GB). All eight original staging
workers were restored and reported ready after each probe.

Local regressions: 51 Python tests and 19 Studio JavaScript tests passed; the
production frontend build passed. Browser checks used the actual Studio
components with a clearly labeled local simulated API, verifying new edit seeds,
unchanged submitted settings, original upload dimensions, manual ratio selection
and translated guidance. These checks are separate from model/GPU validation.

## Rollout and rollback

1. Build/deploy the gateway/UI from this MR to Nutsflush using the existing
   deployment process. This is required for the new edit seed and upload defaults.
2. Separately copy `edit_quality.py` beside each mounted `worker21.py`, then
   review and apply `worker21-edit-quality.patch` to the existing worker source.
   Run `git apply --check /path/to/worker21-edit-quality.patch` from that code
   directory first; stop and compare the source if the check fails. The patch was
   checked against the inspected production worker and preserves its bridge
   bind address and physical-GPU lock/admission settings: those runtime details
   can differ from this repository's isolated worker example. Do not replace
   them blindly or change worker URLs, tokens, channel counts, weights or drivers.
3. Drain the chosen test worker and verify it is idle before restarting only that
   worker. Require health `state=ready`, the original physical GPU/revision,
   `single_reference_max_pixels=2097152` and
   `single_reference_vae_tiling=false`. An import error usually means the new
   helper was not copied alongside the worker.
4. On staging, generate, continue editing twice, annotate once, and edit a
   single uploaded photo. Check distinct parent/child seeds, full PNG downloads,
   original dimensions, moderation/audit completion and actual visual detail.
   Compare identical input/prompt/seed settings to evaluate VAE changes alone.
   Also run a text-to-image job and a ten-reference job to confirm unchanged
   paths. Monitor GPU memory and failures before proceeding to other workers.
5. After staging acceptance, the deployment owner can roll the same worker and UI
   changes through production with draining. Keep the agreed 14 Qwen + 2
   ShieldGemma allocation. Do not restart a gateway/dispatcher holding RAM jobs.

Rollback: drain the affected worker, restore its recorded previous source files,
then restart that worker and verify health. Restore the previous gateway/UI
image separately if necessary. A UI rollback resumes the old seed inheritance;
a worker rollback resumes the old reference resize/tiling behavior. Never delete
jobs, library data, databases, model weights or channel records as rollback.

## CubeRouter port on 2026-10-13

The seed and upload defaults are included in the native TypeScript Media Studio.
The GPU patch is an optional, separate worker rollout; merging this port does not
apply it or certify current worker deployment. Preserve existing worker
credentials, bind addresses, GPU locks and allocations when applying the patch.
The measurements above are Nutsflush evidence from 2026-10-12, not new
measurements of cuberouter.ai.
