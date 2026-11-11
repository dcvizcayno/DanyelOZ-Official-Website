#!/usr/bin/env python3
"""Danyel OZ Shorts Maker.

Turns one long 9:16 lyric video into a series of Shorts that tell the song in order.

  plan  downloads the video from Drive, listens to it (Whisper), times every sung line,
        and splits the song into parts of at most MAX seconds, always cutting between lines.
  cut   cuts the approved parts with ffmpeg (fades, optional end card) and uploads them
        back to the Drive folder.

Progress and results go into a small JSON "job file" in Drive that the admin app reads.
Drive is reached with a short-lived access token handed over by the admin app (it expires
within an hour), so no Drive password or service account is stored anywhere.

Run by .github/workflows/shorts-maker.yml. Local test: python maker.py selftest
"""
import json
import math
import os
import shutil
import subprocess
import sys
import tempfile
import time

DRIVE = 'https://www.googleapis.com/drive/v3/files'
UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files'

# Timing rules. The admin app (ShortsMaker.gs) uses the same numbers, so its nudges match.
LEAD = 2.5          # seconds kept before the first sung line of the song
TAIL = 3.0          # seconds kept after the last sung line
CUT_BEFORE = 0.35   # a cut lands this long before the next line starts
ENDCARD_SEC = 2.0
MIN_PART = 8.0      # parts shorter than this get merged into their neighbour where possible


# ---------------------------------------------------------------- timing helpers

def cut_point(prev, nxt):
    """Where to cut between two lines: just before the next one starts, never inside the previous one."""
    if nxt['s'] <= prev['e']:
        return nxt['s']
    return max(prev['e'] + 0.05, nxt['s'] - CUT_BEFORE)


def part_times(lines, bounds, duration):
    """bounds[k] = index of the first line of part k; returns [(start, end)] for every part."""
    out = []
    n = len(bounds)
    for k in range(n):
        a = bounds[k]
        b = (bounds[k + 1] - 1) if k + 1 < n else len(lines) - 1
        start = max(0.0, lines[a]['s'] - LEAD) if k == 0 else cut_point(lines[a - 1], lines[a])
        end = min(duration, lines[b]['e'] + TAIL) if k == n - 1 else cut_point(lines[b], lines[b + 1])
        out.append((round(start, 2), round(end, 2)))
    return out


def plan_parts(lines, duration, max_len):
    """Fewest parts that each fit in max_len, cutting only between lines; then the most even split,
    preferring cuts at longer pauses. Dynamic programming over line boundaries."""
    n = len(lines)
    if n == 0:
        raise ValueError('No sung lines were found in this video.')
    lead_start = max(0.0, lines[0]['s'] - LEAD)
    tail_end = min(duration, lines[-1]['e'] + TAIL)
    total = tail_end - lead_start
    target = total / max(1, math.ceil(total / max_len))

    def start_of(i):
        return lead_start if i == 0 else cut_point(lines[i - 1], lines[i])

    def end_of(j):  # part ends after line j
        return tail_end if j == n - 1 else cut_point(lines[j], lines[j + 1])

    def gap_after(j):
        return 99.0 if j == n - 1 else max(0.0, lines[j + 1]['s'] - lines[j]['e'])

    INF = float('inf')
    # best[i] = (parts, cost, prev) for covering lines[0:i]
    best = [(INF, INF, -1)] * (n + 1)
    best[0] = (0, 0.0, -1)
    for i in range(n):
        if best[i][0] == INF:
            continue
        s = start_of(i)
        for j in range(i, n):
            length = end_of(j) - s
            if length > max_len:
                break
            # cost: distance from an even split, minus a bonus for cutting at a real pause
            cost = best[i][1] + ((length - target) / max_len) ** 2 - min(gap_after(j), 3.0) * 0.08
            cand = (best[i][0] + 1, cost, i)
            if cand[:2] < best[j + 1][:2]:
                best[j + 1] = cand
    if best[n][0] == INF:
        # one line (or one stretch with no pause) is longer than a whole part
        longest = max(end_of(j) - start_of(j) for j in range(n))
        raise ValueError('One stretch of the song runs %.0f seconds without a pause between lines, longer than a %d second part.'
                         % (longest, max_len))
    bounds, i = [], n
    while i > 0:
        p = best[i][2]
        bounds.append(p)
        i = p
    return sorted(bounds)


# ---------------------------------------------------------------- lyric timing (Whisper)

def split_long(seg_words, max_line=7.5, pause=0.55):
    """Whisper segments can hold several sung lines. Split them at pauses between words."""
    lines, cur = [], []
    for w in seg_words:
        if cur and (w['s'] - cur[-1]['e'] >= pause or (w['e'] - cur[0]['s'] > max_line and w['s'] - cur[-1]['e'] >= 0.15)):
            lines.append(cur)
            cur = []
        cur.append(w)
    if cur:
        lines.append(cur)
    return [{'s': round(l[0]['s'], 2), 'e': round(l[-1]['e'], 2), 't': ' '.join(x['w'] for x in l).strip()} for l in lines]


def transcribe(wav, model_name='small'):
    from faster_whisper import WhisperModel  # imported here so selftest runs without it
    import wave
    import numpy as np
    with wave.open(wav, 'rb') as w:   # 16 kHz mono 16-bit, made by ffmpeg; read it directly (no PyAV)
        audio = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768.0
    model = WhisperModel(model_name, device='cpu', compute_type='int8')
    segments, info = model.transcribe(audio, word_timestamps=True, vad_filter=False, beam_size=5,
                                      condition_on_previous_text=False)
    lines = []
    for seg in segments:
        words = [{'s': w.start, 'e': w.end, 'w': w.word.strip()} for w in (seg.words or []) if w.word.strip()]
        if not words:
            continue
        lines.extend(split_long(words))
    # drop obvious noise: one-character "lines" and hallucinated repeats at the very end
    lines = [l for l in lines if len(l['t']) > 1 and l['e'] > l['s']]
    return lines, getattr(info, 'language', '')


# ---------------------------------------------------------------- ffmpeg

def run(cmd):
    p = subprocess.run(cmd, capture_output=True, text=True)
    if p.returncode != 0:
        raise RuntimeError('ffmpeg failed: ' + p.stderr[-600:])
    return p.stdout


def probe(path):
    out = json.loads(run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration:stream=codec_type,width,height,r_frame_rate,sample_rate',
                          '-of', 'json', path]))
    v = next((s for s in out['streams'] if s.get('codec_type') == 'video'), {})
    a = next((s for s in out['streams'] if s.get('codec_type') == 'audio'), {})
    num, den = (v.get('r_frame_rate') or '30/1').split('/')
    return {'duration': float(out['format']['duration']), 'w': int(v.get('width', 1080)), 'h': int(v.get('height', 1920)),
            'fps': round(float(num) / float(den or 1), 3), 'sr': int(a.get('sample_rate') or 48000), 'audio': bool(a)}


FONT = next((f for f in ['/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
                         '/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf'] if os.path.exists(f)), '')


def esc(text):
    return text.replace('\\', '\\\\').replace(':', '\\:').replace("'", "’").replace('%', '\\%')


def make_clip(src, info, start, end, out, card=None):
    """Cut [start, end], fade in and out, and add a short end card. Stays 9:16, lyrics untouched."""
    length = end - start
    vf = 'fade=t=in:st=0:d=0.25,fade=t=out:st=%.2f:d=0.4' % max(0, length - 0.4)
    af = 'afade=t=in:st=0:d=0.25,afade=t=out:st=%.2f:d=0.6' % max(0, length - 0.6)
    enc = ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '21', '-maxrate', '4M', '-bufsize', '8M', '-pix_fmt', 'yuv420p',
           '-c:a', 'aac', '-b:a', '192k', '-ar', str(info['sr']), '-movflags', '+faststart']
    if not card:
        run(['ffmpeg', '-y', '-v', 'error', '-ss', '%.2f' % start, '-t', '%.2f' % length, '-i', src,
             '-vf', vf, '-af', af] + enc + [out])
        return
    w, h, fps = info['w'], info['h'], info['fps']
    big, small = int(w * 0.085), int(w * 0.05)
    font = ("fontfile='%s':" % FONT) if FONT else ''
    text = ("drawtext=%stext='%s':fontcolor=white:fontsize=%d:x=(w-text_w)/2:y=h*0.42,"
            "drawtext=%stext='%s':fontcolor=0xE3122A:fontsize=%d:x=(w-text_w)/2:y=h*0.42+%d") % (
        font, esc(card[0]), big, font, esc(card[1]), small, int(big * 1.6))
    graph = ('[0:v]%s,setsar=1[v0];[0:a]%s[a0];'
             'color=c=black:s=%dx%d:r=%s:d=%.2f,%s,fade=t=in:st=0:d=0.3,setsar=1[v1];'
             'anullsrc=r=%d:cl=stereo,atrim=0:%.2f[a1];'
             '[v0][a0][v1][a1]concat=n=2:v=1:a=1[v][a]') % (vf, af, w, h, fps, ENDCARD_SEC, text, info['sr'], ENDCARD_SEC)
    run(['ffmpeg', '-y', '-v', 'error', '-ss', '%.2f' % start, '-t', '%.2f' % length, '-i', src,
         '-filter_complex', graph, '-map', '[v]', '-map', '[a]'] + enc + [out])


# ---------------------------------------------------------------- Drive

class Drive:
    def __init__(self, token):
        import requests
        self.r = requests
        self.h = {'Authorization': 'Bearer ' + token}

    def download(self, file_id, path):
        with self.r.get(DRIVE + '/' + file_id, params={'alt': 'media', 'supportsAllDrives': 'true'}, headers=self.h,
                        stream=True, timeout=120) as res:
            if res.status_code != 200:
                raise RuntimeError('Drive would not hand over the video (%s). Pick it again in the app.' % res.status_code)
            with open(path, 'wb') as f:
                for chunk in res.iter_content(1 << 20):
                    f.write(chunk)

    def write_json(self, file_id, data):
        res = self.r.patch(UPLOAD + '/' + file_id, params={'uploadType': 'media'}, headers=dict(self.h, **{'Content-Type': 'application/json'}),
                           data=json.dumps(data, ensure_ascii=False).encode('utf-8'), timeout=60)
        if res.status_code >= 300:
            raise RuntimeError('Could not update the job file in Drive (%s).' % res.status_code)

    def upload(self, path, name, folder_id):
        meta = {'name': name, 'parents': [folder_id], 'mimeType': 'video/mp4'}
        start = self.r.post(UPLOAD, params={'uploadType': 'resumable', 'supportsAllDrives': 'true'},
                            headers=dict(self.h, **{'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': 'video/mp4'}),
                            data=json.dumps(meta), timeout=60)
        if start.status_code >= 300:
            raise RuntimeError('Drive refused the upload (%s).' % start.status_code)
        with open(path, 'rb') as f:
            res = self.r.put(start.headers['Location'], data=f, headers={'Content-Type': 'video/mp4'}, timeout=600)
        if res.status_code >= 300:
            raise RuntimeError('Upload to Drive failed (%s).' % res.status_code)
        return res.json()['id']


# ---------------------------------------------------------------- commands

def job_update(drive, job_file, job, **kw):
    job.update(kw)
    job['updated'] = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
    drive.write_json(job_file, job)


def cmd_plan(env):
    s = env['settings']
    max_len = int(s.get('max', 59))
    eff = max_len - (ENDCARD_SEC if s.get('endcard', True) else 0)
    drive = Drive(env['token'])
    job = {'job_id': env['job_id'], 'mode': 'plan', 'status': 'planning', 'message': 'Downloading the video'}
    job_update(drive, env['job_file'], job)
    tmp = tempfile.mkdtemp()
    try:
        src = os.path.join(tmp, 'in.mp4')
        drive.download(env['file_id'], src)
        info = probe(src)
        if info['w'] > info['h']:
            job['warning'] = 'This video is landscape, not 9:16. The parts will keep its shape.'
        job_update(drive, env['job_file'], job, message='Listening for the lyrics', duration=round(info['duration'], 2),
                   width=info['w'], height=info['h'])
        wav = os.path.join(tmp, 'a.wav')
        run(['ffmpeg', '-y', '-v', 'error', '-i', src, '-vn', '-ac', '1', '-ar', '16000', wav])
        lines, lang = transcribe(wav, s.get('model', 'small'))
        bounds = plan_parts(lines, info['duration'], eff)
        times = part_times(lines, bounds, info['duration'])
        job_update(drive, env['job_file'], job, status='planned', message='', language=lang, lines=lines, bounds=bounds,
                   parts=[{'start': a, 'end': b} for a, b in times], max=max_len, effective_max=eff)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def cmd_cut(env):
    s = env['settings']
    parts = s.get('parts') or []
    if not parts:
        raise ValueError('No approved parts were sent.')
    drive = Drive(env['token'])
    job = {'job_id': env['job_id'], 'mode': 'cut', 'status': 'cutting', 'message': 'Downloading the video', 'clips': []}
    job_update(drive, env['job_file'], job)
    tmp = tempfile.mkdtemp()
    try:
        src = os.path.join(tmp, 'in.mp4')
        drive.download(env['file_id'], src)
        info = probe(src)
        if not info['audio']:
            raise ValueError('This video has no sound, so there is nothing to cut on.')
        title = str(s.get('title') or 'Song')[:80]
        site = str(s.get('site') or 'danyeloz.info')
        n = len(parts)
        for k, p in enumerate(parts):
            start, end = float(p['start']), min(float(p['end']), info['duration'])
            if end - start <= 1:
                raise ValueError('Part %d is too short to cut.' % (k + 1))
            job_update(drive, env['job_file'], job, message='Cutting part %d of %d' % (k + 1, n))
            card = None
            if s.get('endcard', True):
                card = ('Part %d %s' % (k + 2, s.get('next_when', 'tomorrow')), site) if k + 1 < n else ('Full song', site)
            out = os.path.join(tmp, 'part%d.mp4' % (k + 1))
            make_clip(src, info, start, end, out, card)
            name = '%s - Part %d of %d.mp4' % (title.replace('/', '-'), k + 1, n)
            fid = drive.upload(out, name, env['out_folder'])
            job['clips'].append({'part': k + 1, 'file_id': fid, 'name': name, 'size_mb': round(os.path.getsize(out) / 1048576, 1),
                                 'len': round(probe(out)['duration'], 1)})
        job_update(drive, env['job_file'], job, status='cut', message='')
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def main():
    if len(sys.argv) > 1 and sys.argv[1] == 'selftest':
        return selftest()
    env = {k: os.environ.get(v, '') for k, v in [('job_id', 'JOB_ID'), ('mode', 'MODE'), ('file_id', 'FILE_ID'),
                                                 ('job_file', 'JOB_FILE_ID'), ('out_folder', 'OUT_FOLDER_ID'), ('token', 'DRIVE_TOKEN')]}
    env['settings'] = json.loads(os.environ.get('SETTINGS') or '{}')
    for k in ('job_id', 'mode', 'file_id', 'job_file', 'token'):
        if not env[k]:
            raise SystemExit('Missing ' + k)
    try:
        (cmd_plan if env['mode'] == 'plan' else cmd_cut)(env)
    except Exception as e:  # tell the admin app in plain words, then fail the run
        try:
            Drive(env['token']).write_json(env['job_file'], {'job_id': env['job_id'], 'mode': env['mode'], 'status': 'failed',
                                                             'message': str(e)[:400],
                                                             'updated': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())})
        except Exception:
            pass
        raise


# ---------------------------------------------------------------- selftest (no Drive, no Whisper)

def selftest():
    import random
    random.seed(4)
    # a 3:24 song: 8 s intro, lines of 3 to 6 s with short pauses, an instrumental break, a 6 s outro
    lines, t = [], 8.0
    for i in range(36):
        d = random.uniform(3, 6)
        lines.append({'s': round(t, 2), 'e': round(t + d, 2), 't': 'line %d' % (i + 1)})
        t += d + (random.uniform(0.3, 1.2) if i % 4 else random.uniform(1.5, 3))
        if i == 23:
            t += 14  # bridge break
    duration = round(t + 6, 2)
    for max_len in (57, 88):
        b = plan_parts(lines, duration, max_len)
        times = part_times(lines, b, duration)
        lens = [round(e - s, 1) for s, e in times]
        assert all(l <= max_len for l in lens), lens
        assert times[0][0] == max(0, lines[0]['s'] - LEAD)
        assert all(abs(times[k][1] - times[k + 1][0]) < 1e-6 for k in range(len(times) - 1)), 'parts must touch'
        for k in range(1, len(b)):  # every cut sits between two lines
            assert lines[b[k] - 1]['e'] <= times[k][0] <= lines[b[k]]['s'] + 1e-6
        print('max', max_len, 'duration', duration, 'parts', len(b), 'lengths', lens)
    try:
        plan_parts([{'s': 0, 'e': 70, 't': 'x'}], 75, 57)
        raise AssertionError('should refuse a 70 second line')
    except ValueError as e:
        print('refused as expected:', e)
    words = [{'s': 0, 'e': .4, 'w': 'I'}, {'s': .5, 'e': .9, 'w': 'was'}, {'s': 1.0, 'e': 1.6, 'w': 'there'},
             {'s': 2.6, 'e': 3.0, 'w': 'you'}, {'s': 3.1, 'e': 3.5, 'w': 'left'}]
    assert [l['t'] for l in split_long(words)] == ['I was there', 'you left']
    print('selftest ok')


if __name__ == '__main__':
    main()
