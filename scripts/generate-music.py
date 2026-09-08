"""Local ACE-Step auditions. Run with the separately installed ACE-Step Python environment."""
import argparse
import json
import os
from pathlib import Path
import shutil
import subprocess
import time

ROOT = Path(__file__).resolve().parents[1]
tracks = json.loads((ROOT/'scripts/music-auditions.json').read_text())
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--model-root', type=Path, default=Path.home()/'.local/share/evergrow-music/ACE-Step-1.5')
parser.add_argument('--track', nargs='+', choices=[track['id'] for track in tracks]+['all'], default=['all'])
parser.add_argument('--no-thinking', action='store_true', help='Skip the language model for a faster diffusion-only audition.')
parser.add_argument('--duration', type=float, help='Override audition length for a quick benchmark.')
parser.add_argument('--seed-offset', type=int, default=0)
parser.add_argument('--output-dir', type=Path, default=ROOT/'game/src/assets/music-auditions')
args = parser.parse_args()
args.model_root = args.model_root.expanduser().resolve()
args.output_dir = args.output_dir.expanduser().resolve()
# ACE-Step's progress cache is relative to cwd; keep it beside the local models.
os.chdir(args.model_root)
os.environ.setdefault('TOKENIZERS_PARALLELISM', 'false')
os.environ.setdefault('PYTORCH_ENABLE_MPS_FALLBACK', '1')
os.environ.setdefault('ACESTEP_LM_BACKEND', 'mlx')
from acestep.handler import AceStepHandler
from acestep.llm_inference import LLMHandler
from acestep.inference import GenerationParams, GenerationConfig, generate_music

output = args.output_dir
masters = args.model_root.parent/'masters'
output.mkdir(parents=True, exist_ok=True)
masters.mkdir(parents=True, exist_ok=True)
ffmpeg = shutil.which('ffmpeg') or '/opt/homebrew/bin/ffmpeg'
dit = AceStepHandler()
status, ok = dit.initialize_service(project_root=str(args.model_root), config_path='acestep-v15-turbo', device='mps', use_mlx_dit=True, offload_to_cpu=True)
print(status, flush=True)
if not ok:
    raise RuntimeError('ACE-Step initialization failed')
lm = LLMHandler()
if not args.no_thinking:
    status, ok = lm.initialize(checkpoint_dir=str(args.model_root/'checkpoints'), lm_model_path='acestep-5Hz-lm-1.7B', backend='mlx', device='mps')
    print(status, flush=True)
    if not ok:
        raise RuntimeError('Language model initialization failed')
for track in tracks:
    if 'all' not in args.track and track['id'] not in args.track:
        continue
    duration = args.duration or track['duration']
    seed = track['seed'] + args.seed_offset
    params = GenerationParams(caption=track['caption'], lyrics='[Instrumental]', instrumental=True,
        bpm=track['bpm'], keyscale=track['keyscale'], timesignature=track.get('timesignature','4'), duration=duration, seed=seed,
        inference_steps=8, shift=3.0, lm_negative_prompt=track.get('negative', 'NO USER INPUT'),
        thinking=not args.no_thinking, use_cot_caption=False,
        use_cot_metas=False, use_cot_language=False)
    config = GenerationConfig(batch_size=1, use_random_seed=False, seeds=[seed], audio_format='wav')
    print(f"Generating {track['id']} ({duration}s, seed {seed})", flush=True)
    started = time.monotonic()
    result = generate_music(dit, lm, params, config, save_dir=str(masters))
    if not result.success or not result.audios:
        raise RuntimeError(result.error or result.status_message)
    source = Path(result.audios[0]['path'])
    target = output/f"{track['id']}.mp3"
    # Audition mastering only; these are complete pieces, not yet edited into game loops.
    subprocess.run([ffmpeg, '-hide_banner', '-loglevel', 'error', '-y', '-i', str(source),
        '-af', f'loudnorm=I=-20:TP=-2:LRA=9,afade=t=in:d=1,afade=t=out:st={max(1,duration-3)}:d=3',
        '-t', str(duration), '-ar', '44100', '-codec:a', 'libmp3lame', '-b:a', '192k', str(target)], check=True)
    provenance = {**track, 'duration':duration, 'seed':seed, 'model':'acestep-v15-turbo',
        'languageModel':None if args.no_thinking else 'acestep-5Hz-lm-1.7B',
        'backend':'MLX' if dit.use_mlx_dit else 'MPS', 'shift':3.0, 'generationSeconds':round(time.monotonic()-started,2),
        'sourceRevision':subprocess.check_output(['git','-C',str(args.model_root),'rev-parse','HEAD'],text=True).strip(),
        'master':str(source), 'output':target.name}
    (output/f"{track['id']}.json").write_text(json.dumps(provenance,indent=2)+'\n')
    print(f"READY {target} ({provenance['generationSeconds']} seconds)", flush=True)
